#!/usr/bin/env python3
"""
Asset pipeline: scanned STL sculptures -> low-poly GLB with baked normal + AO maps.

Run headless with the bpy 4.2 venv:
    /tmp/claude-0/bvenv/bin/python tools/blender/make_statues.py [name ...]

With no arguments, processes every model in MODELS. With names, only those
(matching MODELS[i]['name']) are processed -- useful for iterating on one
model's orientation/scale without re-baking everything else.

For each model:
  1. Import the STL scan.
  2. Reorient it so the real "up" axis of the sculpture becomes Blender's Z
     axis (a few of these scans are not Z-up as exported), yaw it to face
     the desired direction, and recentre the origin (base centre for
     statues, bbox centre for flat relief panels).
  3. Uniformly scale to the real-world size given in each model's spec
     (measured off the *original* high-res mesh, so unit ambiguity in the
     source files doesn't matter -- we scale to the known physical size).
  4. Duplicate the high-res mesh (kept for baking), decimate the working
     copy down to a desktop-friendly triangle budget.
  5. UV-unwrap the low-poly copy (Smart UV Project) and bake a tangent-space
     normal map and an ambient-occlusion map from the high-res original onto
     it with Cycles ("Selected to Active"). If baking fails for any reason,
     falls back to exporting a higher-decimation mesh (no maps) instead.
  6. Export a single embedded-texture GLB to assets/models/.
"""
import bpy
import bmesh
import math
import os
import sys
import mathutils
import time

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SCAN_DIR = '/tmp/claude-0/scans/parthenon_inner'
HORSE_PATH = '/tmp/claude-0/scans/skulpturhalle_extract/files/Example_-_Parthenon_horse_scanned_by_Cosmo_Wenman.stl'
OUT_DIR = os.path.join(REPO_ROOT, 'assets', 'models')

# ---------------------------------------------------------------------------
# Per-model specs.
#
# up_rot: extra Euler rotation (radians, applied about X/Y/Z in that order)
#   applied right after import, BEFORE measuring/scaling, to bring the
#   sculpture's real up direction onto Blender's +Z and its front onto
#   Blender's +Y (so that after glTF's Z-up -> Y-up axis conversion the
#   model faces -Z in three.js/glTF space, matching this project's
#   "caryatid faces -z" / figure-facing convention).
# target_axis: which *local* axis (after up_rot) to measure the target
#   real-world size against ('z' for standing height for statues and for
#   the panels' height, since all scans came out with a sensible bbox on
#   that axis once oriented).
# target_size: real-world metres for that axis (see docs/PLAN.md brief).
# kind: 'statue' (origin at base centre) | 'panel' (origin at bbox centre).
# tris: desktop low-poly triangle target.
# yaw_deg: additional spin about Z (tuned by eye against in-engine
#   screenshots -- see docs/PROGRESS notes below each entry).
# ---------------------------------------------------------------------------
MODELS = [
    dict(name='caryatid', src=os.path.join(SCAN_DIR, 'Caryatid_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=2.3, kind='statue',
         tris=9000, yaw_deg=180, bake=True),
    dict(name='dionysos', src=os.path.join(SCAN_DIR, 'Dionysos_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.3, kind='statue',
         tris=9000, yaw_deg=0, bake=True),
    # Iris is a fragmentary, striding/flying pediment figure with wind-blown
    # drapery spreading well beyond her own height -- the scan's native Z
    # axis (no extra rotation) already matches a standing figure's vertical
    # extent; rotating Y onto Z (as first tried) instead measured across the
    # spread drapery and produced an implausible ~4.6m-wide mesh.
    dict(name='iris', src=os.path.join(SCAN_DIR, 'Iris_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.35, kind='statue',
         tris=9000, yaw_deg=0, bake=True),
    dict(name='artemis', src=os.path.join(SCAN_DIR, 'Artemis_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.75, kind='statue',
         tris=9000, yaw_deg=180, bake=True),
    dict(name='kekrops_pandrossos', src=os.path.join(SCAN_DIR, 'Kekrops-Pandrossos_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.35, kind='statue',
         tris=9000, yaw_deg=180, bake=True),
    dict(name='metope_south09', src=os.path.join(SCAN_DIR, 'South_Metope_09_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.2, kind='panel',
         tris=4000, yaw_deg=0, bake=True),
    dict(name='metope_north03', src=os.path.join(SCAN_DIR, 'North_Metope_03_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.2, kind='panel',
         tris=4000, yaw_deg=0, bake=True),
    dict(name='metope_west09', src=os.path.join(SCAN_DIR, 'West_Metope_09_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.2, kind='panel',
         tris=4000, yaw_deg=0, bake=True),
    dict(name='metope_east10', src=os.path.join(SCAN_DIR, 'East_Metope_10_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.2, kind='panel',
         tris=4000, yaw_deg=0, bake=True),
    dict(name='frieze_south10', src=os.path.join(SCAN_DIR, 'South_Frieze_10_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.0, kind='panel',
         tris=4000, yaw_deg=0, bake=True),
    dict(name='frieze_north3839', src=os.path.join(SCAN_DIR, 'North_Frieze_38-39_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.0, kind='panel',
         tris=5000, yaw_deg=0, bake=True),
    dict(name='frieze_west0102', src=os.path.join(SCAN_DIR, 'West_Frieze_01-02_100K.stl'),
         up_rot=(0, 0, 0), target_axis='z', target_size=1.0, kind='panel',
         tris=5000, yaw_deg=0, bake=True),
    dict(name='horse_head', src=HORSE_PATH,
         up_rot=(0, 0, 0), target_axis='z', target_size=0.85, kind='statue',
         tris=12000, yaw_deg=0, bake=True),
]


def log(msg):
    print('[make_statues] %s' % msg, flush=True)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = 32


def import_stl(path):
    bpy.ops.wm.stl_import(filepath=path)
    objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if len(objs) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs = [bpy.context.view_layer.objects.active]
    obj = objs[0]
    obj.name = 'source'
    return obj


def bbox_world(obj):
    bb = [obj.matrix_world @ mathutils.Vector(c) for c in obj.bound_box]
    xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def apply_all_transforms(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def process(spec):
    log('=== %s ===' % spec['name'])
    reset_scene()
    obj = import_stl(spec['src'])

    # 1) orient: bring the sculpture's real up axis onto Blender +Z
    obj.rotation_euler = spec['up_rot']
    apply_all_transforms(obj)

    # 2) measure + scale to the real-world size (unit-agnostic: we scale
    #    to the known physical size regardless of the scan's native units)
    (x0, x1), (y0, y1), (z0, z1) = bbox_world(obj)
    axis_extent = {'x': x1 - x0, 'y': y1 - y0, 'z': z1 - z0}[spec['target_axis']]
    if axis_extent <= 0:
        raise RuntimeError('degenerate bbox for %s' % spec['name'])
    scale = spec['target_size'] / axis_extent
    obj.scale = (scale, scale, scale)
    apply_all_transforms(obj)

    # 3) yaw to face the desired direction (tuned by eye against renders)
    if spec['yaw_deg']:
        obj.rotation_euler = (0, 0, math.radians(spec['yaw_deg']))
        apply_all_transforms(obj)

    # 4) recentre origin
    (x0, x1), (y0, y1), (z0, z1) = bbox_world(obj)
    cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    if spec['kind'] == 'statue':
        dz = z0  # base at z=0
    else:
        dz = (z0 + z1) / 2.0  # panel centre
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    for v in obj.data.vertices:
        v.co.x -= cx
        v.co.y -= cy
        v.co.z -= dz
    obj.data.update()

    (x0, x1), (y0, y1), (z0, z1) = bbox_world(obj)
    log('  final bbox size = (%.3f, %.3f, %.3f) m, base/centre at origin' % (x1 - x0, y1 - y0, z1 - z0))

    hi_tris = len(obj.data.polygons)
    log('  hi-res tris: %d' % hi_tris)

    # 5) duplicate the hi-res mesh for baking, then decimate the working copy
    hi = obj
    hi.name = 'hires'
    lo = hi.copy()
    lo.data = hi.data.copy()
    lo.name = 'lowpoly'
    bpy.context.collection.objects.link(lo)

    ratio = min(1.0, spec['tris'] / max(1, hi_tris))
    dec = lo.modifiers.new('decimate', 'DECIMATE')
    dec.ratio = ratio
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.modifier_apply(modifier=dec.name)
    lo_tris = len(lo.data.polygons)
    log('  low-poly tris: %d (ratio %.3f)' % (lo_tris, ratio))

    # clean up + shade smooth for a sculptural look under the baked normal map
    bpy.ops.object.select_all(action='DESELECT')
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.shade_smooth()

    # 6) UV unwrap the low-poly copy
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')

    baked_ok = False
    normal_path = None
    ao_path = None
    if spec.get('bake', True):
        try:
            normal_path, ao_path = bake_maps(hi, lo, spec['name'])
            baked_ok = True
        except Exception as e:
            log('  BAKE FAILED (%s) -- falling back to plain higher-decimation export' % e)

    if not baked_ok:
        # fallback: remove the low-poly copy, re-decimate the hi-res mesh to
        # ~20k tris instead, export with no maps.
        bpy.data.objects.remove(lo, do_unlink=True)
        fallback_ratio = min(1.0, 20000.0 / max(1, hi_tris))
        dec2 = hi.modifiers.new('decimate', 'DECIMATE')
        dec2.ratio = fallback_ratio
        bpy.context.view_layer.objects.active = hi
        bpy.ops.object.modifier_apply(modifier=dec2.name)
        export_obj = hi
        mat = bpy.data.materials.new(spec['name'] + '_mat')
        mat.use_nodes = True
        export_obj.data.materials.append(mat)
    else:
        export_obj = lo
        bpy.data.objects.remove(hi, do_unlink=True)
        mat = bpy.data.materials.new(spec['name'] + '_mat')
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes.get('Principled BSDF')
        base_color = (0.86, 0.83, 0.77, 1.0)  # pale Pentelic marble base tint
        bsdf.inputs['Base Color'].default_value = base_color
        bsdf.inputs['Roughness'].default_value = 0.55

        norm_img_node = nt.nodes.new('ShaderNodeTexImage')
        norm_img_node.image = bpy.data.images.load(normal_path)
        norm_img_node.image.colorspace_settings.name = 'Non-Color'
        norm_map_node = nt.nodes.new('ShaderNodeNormalMap')
        nt.links.new(norm_img_node.outputs['Color'], norm_map_node.inputs['Color'])
        nt.links.new(norm_map_node.outputs['Normal'], bsdf.inputs['Normal'])

        ao_img_node = nt.nodes.new('ShaderNodeTexImage')
        ao_img_node.image = bpy.data.images.load(ao_path)
        ao_img_node.image.colorspace_settings.name = 'Non-Color'
        # AO is exported as a separate map for three.js's aoMap (uv2), not
        # multiplied into base color here -- keep the material's base color
        # clean and let the runtime aoMap do the occlusion. The glTF exporter
        # only picks up an occlusion texture through a node group literally
        # named "glTF Settings" with an "Occlusion" input socket.
        gs_tree = bpy.data.node_groups.get('glTF Settings')
        if gs_tree is None:
            gs_tree = bpy.data.node_groups.new('glTF Settings', 'ShaderNodeTree')
            gs_tree.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
        gs_node = nt.nodes.new('ShaderNodeGroup')
        gs_node.node_tree = gs_tree
        nt.links.new(ao_img_node.outputs['Color'], gs_node.inputs['Occlusion'])
        export_obj.data.materials.append(mat)

    # 7) export GLB
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, spec['name'] + '.glb')
    bpy.ops.object.select_all(action='DESELECT')
    export_obj.select_set(True)
    bpy.context.view_layer.objects.active = export_obj
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        use_selection=True,
        export_format='GLB',
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_materials='EXPORT',
        export_image_format='JPEG' if baked_ok else 'AUTO',
        export_apply=True,
    )
    size_kb = os.path.getsize(out_path) / 1024.0
    final_tris = len(export_obj.data.polygons)
    log('  exported %s (%d tris, %.0f KB, baked=%s)' % (out_path, final_tris, size_kb, baked_ok))
    return dict(name=spec['name'], tris=final_tris, kb=size_kb, baked=baked_ok)


def bake_maps(hi, lo, name):
    """Selected-to-active Cycles bake: normal (tangent space) + AO from hi onto lo."""
    tex_dir = os.path.join(REPO_ROOT, '_bake_tmp')
    os.makedirs(tex_dir, exist_ok=True)

    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.device = 'CPU'
    scn.cycles.samples = 24

    # material + empty image slot on the low-poly object for baking to land in
    mat = bpy.data.materials.new(name + '_bakemat')
    mat.use_nodes = True
    lo.data.materials.clear()
    lo.data.materials.append(mat)
    nt = mat.node_tree

    def make_bake_target(img_name, res, is_normal):
        img = bpy.data.images.new(img_name, width=res, height=res, alpha=False)
        if is_normal:
            img.colorspace_settings.name = 'Non-Color'
            img.generated_color = (0.5, 0.5, 1.0, 1.0)
        else:
            img.colorspace_settings.name = 'Non-Color'
            img.generated_color = (1.0, 1.0, 1.0, 1.0)
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = img
        nt.nodes.active = node
        return img, node

    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo

    cage_extrusion = 0.02
    ray_distance = 0.08

    # --- normal map ---
    norm_res = 1024
    norm_img, norm_node = make_bake_target(name + '_normal', norm_res, True)
    scn.render.bake.use_selected_to_active = True
    scn.render.bake.cage_extrusion = cage_extrusion
    scn.render.bake.max_ray_distance = ray_distance
    scn.render.bake.margin = 4
    bpy.ops.object.bake(type='NORMAL', normal_space='TANGENT', use_selected_to_active=True,
                         cage_extrusion=cage_extrusion, max_ray_distance=ray_distance)
    norm_path = os.path.join(tex_dir, name + '_normal.png')
    norm_img.filepath_raw = norm_path
    norm_img.file_format = 'PNG'
    norm_img.save()

    # --- AO map ---
    ao_res = 768
    ao_img, ao_node = make_bake_target(name + '_ao', ao_res, False)
    bpy.ops.object.bake(type='AO', use_selected_to_active=True,
                         cage_extrusion=cage_extrusion, max_ray_distance=ray_distance)
    ao_path = os.path.join(tex_dir, name + '_ao.png')
    ao_img.filepath_raw = ao_path
    ao_img.file_format = 'PNG'
    ao_img.save()

    # clean bake material off the low-poly (final material is built by caller)
    lo.data.materials.clear()

    return norm_path, ao_path


def main():
    wanted = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    results = []
    t0 = time.time()
    for spec in MODELS:
        if wanted and spec['name'] not in wanted:
            continue
        try:
            results.append(process(spec))
        except Exception as e:
            log('FAILED %s: %s' % (spec['name'], e))
            import traceback
            traceback.print_exc()
    log('--- summary (%.1fs) ---' % (time.time() - t0))
    total_kb = 0
    for r in results:
        log('%-24s tris=%-6d %6.0f KB baked=%s' % (r['name'], r['tris'], r['kb'], r['baked']))
        total_kb += r['kb']
    log('total: %.0f KB' % total_kb)


if __name__ == '__main__':
    main()

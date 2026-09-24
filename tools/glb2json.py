# Convert GLB files to self-contained glTF JSON (binary buffer embedded as a base64 data URI).
# Artifact hosting serves .json but not .glb; GLTFLoader parses either.
# Usage: python3 tools/glb2json.py assets/models/caryatid.glb ...  -> assets/models/caryatid.gltf.json
import base64, json, struct, sys
for path in sys.argv[1:]:
    data = open(path, 'rb').read()
    magic, version, length = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF', path
    off, doc, binchunk = 12, None, b''
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A: doc = json.loads(chunk)
        elif ctype == 0x004E4942: binchunk = chunk
        off += 8 + clen
    doc['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(binchunk).decode()
    out = path[:-4] + '.gltf.json'
    json.dump(doc, open(out, 'w'), separators=(',', ':'))
    print(out, len(open(out, 'rb').read()) // 1024, 'KB')

# Module 00 — src/00-config.js
Top-level statement: `window.CFG = ...;` (this module is the one exception: it is a plain object assignment via an IIFE, not a builder function).

```
window.CFG = (function () {
  var mobile = (typeof innerWidth === 'number') && innerWidth < 640;
  return {
    PLATEAU_H: 80, PLATEAU_X: 300, PLATEAU_Z: 150, PLATEAU_CX: -45, PLATEAU_CZ: 0,
    MOBILE: mobile,
    SEG: mobile ? { colRadial: 24, colHeight: 2, capital: 16 } : { colRadial: 40, colHeight: 4, capital: 24 }
  };
})();
```
Write exactly this. ~12 lines.

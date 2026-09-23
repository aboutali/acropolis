// 00-config: shared constants
window.CFG = (function () {
  var mobile = (typeof innerWidth === 'number') && innerWidth < 640;
  return {
    PLATEAU_H: 80, PLATEAU_X: 300, PLATEAU_Z: 150, PLATEAU_CX: -45, PLATEAU_CZ: 0,
    MOBILE: mobile,
    SEG: mobile ? { colRadial: 24, colHeight: 2, capital: 16 } : { colRadial: 40, colHeight: 4, capital: 24 }
  };
})();

(function () {
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var CHARS = '01{}[]()<>/\\|!@#$%^&*+-=~?:;.,ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
  var FS = 11, CW = 7, CH = 13, G = 110;
  var cols, rows, grid, level, flashT, dpr, W, H, R, sigma;
  var mouse = { x: -9999, y: -9999 }, smooth = { x: -9999, y: -9999 }, active = false;

  function rnd() { return CHARS[(Math.random() * CHARS.length) | 0]; }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FS + 'px "Courier New", monospace';
    ctx.textBaseline = 'top';
    CW = ctx.measureText('M').width;
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    grid = new Array(cols * rows);
    for (var i = 0; i < grid.length; i++) grid[i] = rnd();
    level = new Float32Array(cols * rows);
    flashT = new Float32Array(cols * rows);
    R = Math.max(60, Math.min(W, H) * 0.09);
    sigma = R * 0.45;
  }

  function move(x, y) {
    mouse.x = x; mouse.y = y;
    if (!active) { smooth.x = x; smooth.y = y; active = true; }
  }
  window.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
  window.addEventListener('touchstart', function (e) { move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  window.addEventListener('touchmove', function (e) { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  document.addEventListener('mouseleave', function () { active = false; mouse.x = mouse.y = smooth.x = smooth.y = -9999; });
  window.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener('resize', resize);

  function sm(t) { return t * t * (3 - 2 * t); }

  function frame() {
    smooth.x = mouse.x;
    smooth.y = mouse.y;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    for (var k = 0; k < 120; k++) grid[(Math.random() * grid.length) | 0] = rnd();

    var now = performance.now() / 1000;
    if (Math.random() < 0.25) {
      var wl = 4 + ((Math.random() * 7) | 0), wr = (Math.random() * rows) | 0;
      var wc = (Math.random() * Math.max(1, cols - wl)) | 0;
      for (var q = 0; q < wl; q++) { var wi = wr * cols + wc + q; grid[wi] = rnd(); flashT[wi] = now; }
    }

    var R2 = R * R, inv = 1 / (2 * sigma * sigma);
    var gray = 'rgb(' + G + ',' + G + ',' + G + ')';
    for (var r = 0; r < rows; r++) {
      var dy = r * CH + CH / 2 - smooth.y;
      for (var c = 0; c < cols; c++) {
        var dx = c * CW + CW / 2 - smooth.x;
        var d2 = dx * dx + dy * dy;
        var i = r * cols + c;
        var target = d2 < R2 ? Math.exp(-d2 * inv) : 0;
        var lv = level[i] += (target - level[i]) * (target > level[i] ? 0.8 : 0.3);
        if (lv < 0.002) level[i] = lv = 0;
        var ft = flashT[i], f = 0;
        if (ft) {
          var age = now - ft;
          if (age >= 2) flashT[i] = 0;
          else f = age < 0.3 ? sm(age / 0.3) : 1 - sm((age - 0.3) / 1.7);
        }
        if (f > lv) lv = f;
        if (lv < 0.01) {
          ctx.fillStyle = gray;
        } else {
          ctx.fillStyle = 'rgb(' + ((G * (1 - lv)) | 0) + ',' + ((G + (255 - G) * lv) | 0) + ',' + ((G - (G - 65) * lv) | 0) + ')';
        }
        ctx.fillText(grid[i], c * CW, r * CH);
      }
    }
    requestAnimationFrame(frame);
  }

  resize();
  requestAnimationFrame(frame);
})();

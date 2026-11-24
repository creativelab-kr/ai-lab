// AI 경영 실험실 — 첫 화면 실시간 3D. 직접 쓴 WebGL(외부 라이브러리·통신 없음).
// 막대 하나가 장부의 한 줄이다. 줄들이 숨 쉬듯 오르내리고, 화면을 움직이면 시점이 따라온다.
(function () {
  var cv = document.getElementById('scene'); if (!cv) return;
  var gl = null;
  try { gl = cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' }); } catch (e) {}
  if (!gl) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { if (window.console) console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  function program(vs, fs) {
    var a = shader(gl.VERTEX_SHADER, vs), b = shader(gl.FRAGMENT_SHADER, fs); if (!a || !b) return null;
    var p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { if (window.console) console.warn(gl.getProgramInfoLog(p)); return null; }
    return p;
  }

  // ── 막대(도시) ──
  var barP = program(
    'attribute vec3 aPos;attribute vec3 aN;attribute vec2 aUV;attribute vec3 aInst;attribute float aFace;' +
    'uniform mat4 uVP;uniform float uT;' +
    'varying vec3 vN;varying vec2 vUV;varying vec2 vDim;varying float vY;varying float vW;varying float vHot;' +
    'void main(){float s=aInst.z;float r=length(aInst.xy);' +
    'float base=0.22+3.3*pow(s,2.4)*exp(-r*r*0.014)+0.55*exp(-r*r*0.06);' +
    'float wave=0.5+0.5*sin(r*0.9-uT*0.9+s*6.2831);' +
    'float br=0.5+0.5*sin(uT*(0.25+fract(s*7.31)*0.5)+s*40.0);' +
    'float h=base*(0.55+0.3*wave+0.15*br);float w=0.66;' +
    'vec3 p=vec3(aPos.x*w+aInst.x,aPos.y*h,aPos.z*w+aInst.y);' +
    'vDim=aFace>0.5?vec2(w,w):vec2(w,h);vUV=aUV*vDim;vN=aN;vY=p.y;vHot=step(0.93,fract(s*13.7));' +
    'gl_Position=uVP*vec4(p,1.0);vW=gl_Position.w;}',
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform float uPulse;' +
    'varying vec3 vN;varying vec2 vUV;varying vec2 vDim;varying float vY;varying float vW;varying float vHot;' +
    'void main(){float t=clamp(vY/3.4,0.0,1.0);' +
    'vec3 c=mix(vec3(0.04,0.07,0.20),vec3(0.15,0.39,0.92),smoothstep(0.0,0.5,t));' +
    'c=mix(c,vec3(0.55,0.36,0.96),smoothstep(0.35,0.9,t));' +
    'c*=0.42+0.58*max(dot(normalize(vN),normalize(vec3(0.35,0.85,0.4))),0.0);' +
    'float e=min(min(vUV.x,vDim.x-vUV.x),min(vUV.y,vDim.y-vUV.y));' +
    'float edge=1.0-smoothstep(0.0,0.04,e);' +
    'vec3 ec=mix(vec3(0.45,0.65,1.0),vec3(0.96,0.72,1.0),t);' +
    'c+=ec*edge*(0.5+0.5*vHot);' +
    'c+=vHot*vec3(0.9,0.55,1.0)*0.22*uPulse;' +
    'float fog=clamp((vW-10.0)/24.0,0.0,1.0);float a=1.0-fog*fog;' +
    'gl_FragColor=vec4(c*a,a);}');
  // ── 바닥 격자 ──
  var gndP = program(
    'attribute vec2 aP;uniform mat4 uVP;varying vec2 vXZ;void main(){vXZ=aP*44.0;gl_Position=uVP*vec4(vXZ.x,0.0,vXZ.y,1.0);}',
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nvarying vec2 vXZ;void main(){vec2 g=abs(fract(vXZ)-0.5);float l=1.0-smoothstep(0.0,0.035,min(g.x,g.y));' +
    'float r=length(vXZ);float a=l*0.42*exp(-r*r*0.0045);gl_FragColor=vec4(vec3(0.36,0.52,1.0)*a,a);}');
  // ── 떠오르는 점 ──
  var ptP = program(
    'attribute vec4 aS;uniform mat4 uVP;uniform float uT;uniform float uPx;varying float vA;' +
    'void main(){float y=mod(uT*aS.w+aS.z*9.0,9.0);gl_Position=uVP*vec4(aS.x,y,aS.y,1.0);' +
    'vA=sin(y/9.0*3.14159);gl_PointSize=uPx*(0.5+fract(aS.z*9.1))*46.0/max(gl_Position.w,0.1);}',
    'precision mediump float;varying float vA;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.0,d)*vA*0.75;gl_FragColor=vec4(vec3(0.72,0.78,1.0)*a,a);}');
  if (!barP || !gndP || !ptP) return;

  // 막대 꼭짓점: 옆면 4 + 윗면 1 (바닥면 없음)
  var F = [ // 네 모서리(x,y,z,u,v) + 법선 + 윗면 여부
    [[-.5, 1, -.5, 0, 0], [.5, 1, -.5, 1, 0], [.5, 1, .5, 1, 1], [-.5, 1, .5, 0, 1], [0, 1, 0], 1],
    [[.5, 0, -.5, 0, 0], [.5, 0, .5, 1, 0], [.5, 1, .5, 1, 1], [.5, 1, -.5, 0, 1], [1, 0, 0], 0],
    [[-.5, 0, .5, 0, 0], [-.5, 0, -.5, 1, 0], [-.5, 1, -.5, 1, 1], [-.5, 1, .5, 0, 1], [-1, 0, 0], 0],
    [[.5, 0, .5, 0, 0], [-.5, 0, .5, 1, 0], [-.5, 1, .5, 1, 1], [.5, 1, .5, 0, 1], [0, 0, 1], 0],
    [[-.5, 0, -.5, 0, 0], [.5, 0, -.5, 1, 0], [.5, 1, -.5, 1, 1], [-.5, 1, -.5, 0, 1], [0, 0, -1], 0]
  ];
  var N = 9, data = [], count = 0, ORDER = [0, 1, 2, 0, 2, 3];
  for (var i = -N; i <= N; i++) for (var j = -N; j <= N; j++) {
    var sd = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; sd = sd - Math.floor(sd);
    for (var f = 0; f < 5; f++) for (var k = 0; k < 6; k++) {
      var c = F[f][ORDER[k]], n = F[f][4];
      data.push(c[0], c[1], c[2], n[0], n[1], n[2], c[3], c[4], i, j, sd, F[f][5]); count++;
    }
  }
  var barB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, barB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  var gndB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gndB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  var pts = [], PN = 150;
  for (var q = 0; q < PN; q++) { var r1 = Math.sin(q * 12.9898) * 43758.5453, r2 = Math.sin(q * 78.233) * 12345.678, r3 = Math.sin(q * 39.425) * 24634.6345; r1 -= Math.floor(r1); r2 -= Math.floor(r2); r3 -= Math.floor(r3); pts.push((r1 - .5) * 22, (r2 - .5) * 22, r3, 0.18 + r1 * 0.3); }
  var ptB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ptB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);

  function loc(p, names) { var o = {}; names.forEach(function (n) { o[n] = n.charAt(0) === 'u' ? gl.getUniformLocation(p, n) : gl.getAttribLocation(p, n); }); return o; }
  var bL = loc(barP, ['aPos', 'aN', 'aUV', 'aInst', 'aFace', 'uVP', 'uT', 'uPulse']), gL = loc(gndP, ['aP', 'uVP']), pL = loc(ptP, ['aS', 'uVP', 'uT', 'uPx']);

  // 행렬(열 우선)
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; }
  function look(e, c) {
    var zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xy, xz); xx /= l; xz /= l;   // up(0,1,0) × z
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return [xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1];
  }
  function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) { var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }

  var px = 0, py = 0, tx = 0, ty = 0, dpr = 1, W = 0, H = 0, visible = true, raf = 0, t0 = performance.now();
  window.addEventListener('pointermove', function (e) { tx = (e.clientX / innerWidth) * 2 - 1; ty = (e.clientY / innerHeight) * 2 - 1; }, { passive: true });
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (w !== W || h !== H) { W = w; H = h; cv.width = w; cv.height = h; }
  }
  function attr(l, n, stride, off) { if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, stride, off); }
  function draw(now) {
    size(); var t = reduce ? 14 : (now - t0) / 1000;
    px += (tx - px) * 0.04; py += (ty - py) * 0.04;
    var asp = W / H, wide = asp > 1.15;
    var ang = t * 0.055 + px * 0.4 + 0.6, rad = wide ? 15.5 : 19, ey = 7.2 + py * 1.6;
    var vp = mul(persp(wide ? 0.72 : 0.9, asp, 0.5, 80), look([Math.cos(ang) * rad, ey, Math.sin(ang) * rad], [0, 1.1, 0]));
    var sh = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, wide ? 0.42 : 0, wide ? -0.02 : 0.3, 0, 1];   // 화면 안에서 도시를 옆(넓은 화면)·위(좁은 화면)로 민다
    vp = mul(sh, vp);
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.disable(gl.DEPTH_TEST); gl.useProgram(gndP); gl.bindBuffer(gl.ARRAY_BUFFER, gndB); attr(gL.aP, 2, 8, 0);
    gl.uniformMatrix4fv(gL.uVP, false, new Float32Array(vp)); gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.useProgram(barP); gl.bindBuffer(gl.ARRAY_BUFFER, barB);
    attr(bL.aPos, 3, 48, 0); attr(bL.aN, 3, 48, 12); attr(bL.aUV, 2, 48, 24); attr(bL.aInst, 3, 48, 32); attr(bL.aFace, 1, 48, 44);
    gl.uniformMatrix4fv(bL.uVP, false, new Float32Array(vp)); gl.uniform1f(bL.uT, t); gl.uniform1f(bL.uPulse, 0.6 + 0.4 * Math.sin(t * 2)); gl.drawArrays(gl.TRIANGLES, 0, count);

    gl.depthMask(false); gl.blendFunc(gl.ONE, gl.ONE); gl.useProgram(ptP); gl.bindBuffer(gl.ARRAY_BUFFER, ptB); attr(pL.aS, 4, 16, 0);
    gl.uniformMatrix4fv(pL.uVP, false, new Float32Array(vp)); gl.uniform1f(pL.uT, t); gl.uniform1f(pL.uPx, dpr); gl.drawArrays(gl.POINTS, 0, PN);
    gl.depthMask(true);
    [bL.aPos, bL.aN, bL.aUV, bL.aInst, bL.aFace].forEach(function (l) { if (l >= 0) gl.disableVertexAttribArray(l); });
    cv.setAttribute('data-ready', '1');
  }
  function loop(now) { raf = 0; if (!visible || document.hidden) return; draw(now); if (!reduce) raf = requestAnimationFrame(loop); }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) kick(); }).observe(cv);
  document.addEventListener('visibilitychange', kick); window.addEventListener('resize', kick);
  cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); visible = false; });
  kick();
})();

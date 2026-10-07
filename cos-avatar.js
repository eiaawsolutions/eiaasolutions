/* ============================================================
   EIAAW Solutions — CoS avatar
   Live 3D avatar for CoS, the EIAAW Chief of Staff AI assistant.
   Three.js is self-hosted (vendor/three.r128.min.js) and loaded lazily
   the first time an avatar is mounted, so it never touches first paint.

   window.CoSAvatar.mount(canvas, { frame: 'bust' | 'head', minimal: bool })
     -> Promise<controller>
   controller: setState('idle'|'listening'|'thinking'|'speaking'),
               say(text, { sound, lang }) -> Promise, stop(), wave(),
               setActive(bool)  (pauses rendering when false), destroy()

   Voice uses the browser's built-in speech engine: free, runs on the
   visitor's device, nothing is sent to any server.
   ============================================================ */
(function () {
  'use strict';
  var BASE = (function () {
    try { return document.currentScript.src.replace(/[^\/]*(\?.*)?$/, ''); } catch (e) { return ''; }
  })();
  var VER = (function () {
    try { var m = document.currentScript.src.match(/\?v=([^&]+)/); return m ? '?v=' + m[1] : ''; } catch (e) { return ''; }
  })();

  var threePromise;
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threePromise) return threePromise;
    threePromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = BASE + 'vendor/three.r128.min.js' + VER;
      s.async = true;
      s.onload = function () { window.THREE ? resolve(window.THREE) : reject(new Error('three missing')); };
      s.onerror = function () { threePromise = null; reject(new Error('three failed to load')); };
      document.head.appendChild(s);
    });
    return threePromise;
  }

  var reduceMotion = false;
  try { reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- language + voice ---------- */
  function detectLang(text) {
    if (/[㐀-鿿]/.test(text)) return 'zh';
    if (/\b(saya|anda|dan|yang|untuk|dengan|tidak|boleh|terima kasih|selamat|apa|ini|itu|kami|sila)\b/i.test(text)) return 'ms';
    return 'en';
  }
  var voices = [];
  function loadVoices() { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } }
  try { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) {}
  function pickVoice(l) {
    var want = { en: ['en-gb', 'en-us', 'en-au', 'en-in', 'en'], ms: ['ms-my', 'ms', 'id-id', 'id'], zh: ['zh-cn', 'zh-hans', 'zh-tw', 'zh-hk', 'zh'] }[l];
    var best = null, bs = -1;
    voices.forEach(function (v) {
      var vl = v.lang.toLowerCase().replace('_', '-'), sc = -1;
      want.forEach(function (w, i) { if (vl === w || vl.indexOf(w + '-') === 0 || vl === w.split('-')[0]) sc = Math.max(sc, 100 - i * 10); });
      if (sc < 0) return;
      if (/natural|neural|online|premium|enhanced|google/i.test(v.name)) sc += 8;
      if (sc > bs) { bs = sc; best = v; }
    });
    return best;
  }

  var PRESET = {
    idle:      { eyeY: 1,    eyeX: 1,   gx: 0,   gy: 0,    tilt: 0,    lean: 0,    ring: 0.15, nodeR: 2.35, nodeS: 0.35, speak: 0, warm: 0, glow: 0.8,  smile: 1 },
    listening: { eyeY: 1.15, eyeX: 1.1, gx: 0,   gy: 0,    tilt: 0.13, lean: 0.35, ring: 0.5,  nodeR: 1.95, nodeS: 0.6,  speak: 0, warm: 0, glow: 1.15, smile: 1.15 },
    thinking:  { eyeY: 0.85, eyeX: 1,   gx: 0.1, gy: 0.14, tilt: -0.1, lean: 0,    ring: 1.4,  nodeR: 2.55, nodeS: 1.9,  speak: 0, warm: 1, glow: 0.9,  smile: 0.7 },
    speaking:  { eyeY: 1,    eyeX: 1,   gx: 0,   gy: 0,    tilt: 0.03, lean: 0.12, ring: 0.35, nodeR: 2.2,  nodeS: 0.7,  speak: 1, warm: 0, glow: 1.25, smile: 1 }
  };

  function mount(canvas, opts) {
    opts = opts || {};
    return loadThree().then(function (THREE) { return build(THREE, canvas, opts); });
  }

  function build(THREE, canvas, opts) {
    var minimal = !!opts.minimal, headFrame = opts.frame === 'head';
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    var C = { deep: 0x0A4D47, dark: 0x11766A, teal: 0x1FA896, mint: 0x22B8A5, glow: 0x7FE6D4, ink: 0x0F1A1D, cream: 0xFAF7F2, gold: 0xE8B04A };

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dcc6, 0.95));
    var key = new THREE.DirectionalLight(0xfff6e6, 0.85); key.position.set(-3, 4, 6); scene.add(key);
    var rim = new THREE.DirectionalLight(0x6ff0da, 0.55); rim.position.set(4, 2, -3); scene.add(rim);

    function softShield(sx, sy, sz, taper, segW, segH) {
      var g = new THREE.SphereGeometry(1, segW || 48, segH || 36), p = g.attributes.position, v = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        var t = Math.max(0, -v.y), k = 1 - taper * t * t;
        p.setXYZ(i, v.x * k * sx, v.y * sy, v.z * k * sz);
      }
      g.computeVertexNormals(); return g;
    }
    function gradientColors(geo, top, bottom) {
      var p = geo.attributes.position, c = new Float32Array(p.count * 3), a = new THREE.Color(top), b = new THREE.Color(bottom), o = new THREE.Color();
      var min = 1e9, max = -1e9, i;
      for (i = 0; i < p.count; i++) { min = Math.min(min, p.getY(i)); max = Math.max(max, p.getY(i)); }
      for (i = 0; i < p.count; i++) { var t = (p.getY(i) - min) / (max - min); o.copy(b).lerp(a, t); c[i * 3] = o.r; c[i * 3 + 1] = o.g; c[i * 3 + 2] = o.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); return geo;
    }
    function glowTexture() {
      var s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
      var g = cv.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      return new THREE.CanvasTexture(cv);
    }
    var GLOW = glowTexture();
    function glossy(color, extra) {
      return new THREE.MeshPhysicalMaterial(Object.assign({ color: color, roughness: 0.38, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.25 }, extra || {}));
    }
    function ell(rx, ry, seg) { return new THREE.CircleGeometry(1, seg || 32).scale(rx, ry, 1); }

    var rig = new THREE.Group(); scene.add(rig);
    var headPivot = new THREE.Group(); headPivot.position.y = 0.55; rig.add(headPivot);

    var HX = 1.05, HY = 1.12, HZ = 0.82;
    headPivot.add(new THREE.Mesh(gradientColors(softShield(HX, HY, HZ, 0.16), C.glow, C.dark), glossy(0xffffff, { vertexColors: true })));
    [-1, 1].forEach(function (s) {
      var e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), glossy(C.teal)); e.scale.set(0.6, 1, 1); e.position.set(s * (HX + 0.02), 0.05, 0); headPivot.add(e);
    });
    var faceMesh = new THREE.Mesh(softShield(HX * 0.82, HY * 0.8, HZ * 0.8, 0.14, 48, 36), new THREE.MeshStandardMaterial({ color: C.cream, roughness: 0.55 }));
    faceMesh.position.set(0, -0.02, 0.3); headPivot.add(faceMesh);

    var face = new THREE.Group(); face.position.z = 0.3 + HZ * 0.8 + 0.015; headPivot.add(face);
    var eyes = [-1, 1].map(function (side) {
      var g = new THREE.Group(); g.position.set(side * 0.34, 0.14, 0);
      g.add(new THREE.Mesh(ell(0.125, 0.185), new THREE.MeshBasicMaterial({ color: C.ink })));
      var iris = new THREE.Mesh(ell(0.085, 0.12), new THREE.MeshBasicMaterial({ color: C.teal })); iris.position.set(0, -0.03, 0.002); g.add(iris);
      var h1 = new THREE.Mesh(ell(0.04, 0.045, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); h1.position.set(0.04, 0.07, 0.004); g.add(h1);
      var h2 = new THREE.Mesh(ell(0.018, 0.02, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); h2.position.set(-0.04, -0.06, 0.004); g.add(h2);
      face.add(g); return { g: g };
    });
    var brows = [-1, 1].map(function (s) {
      var b = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.028), new THREE.MeshBasicMaterial({ color: C.dark }));
      b.position.set(s * 0.34, 0.43, 0); b.rotation.z = s * -0.12; face.add(b); return b;
    });
    [-1, 1].forEach(function (s) {
      var c = new THREE.Mesh(ell(0.12, 0.075), new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.32, depthWrite: false }));
      c.position.set(s * 0.56, -0.16, 0); face.add(c);
    });
    var smileMat = new THREE.MeshBasicMaterial({ color: C.deep, transparent: true });
    var smile = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 10, 32, Math.PI), smileMat);
    smile.rotation.z = Math.PI; smile.position.set(0, -0.14, 0); face.add(smile);
    var mouth = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: C.deep }));
    mouth.position.set(0, -0.16, 0.001); face.add(mouth);

    var antenna = new THREE.Group(); antenna.position.y = HY - 0.04; headPivot.add(antenna);
    var stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.34, 12), glossy(C.dark)); stalk.position.y = 0.17; antenna.add(stalk);
    var orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), new THREE.MeshStandardMaterial({ color: C.gold, emissive: C.gold, emissiveIntensity: 0.45, roughness: 0.3 }));
    orb.position.y = 0.42; antenna.add(orb);
    var orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: C.gold, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    orbGlow.scale.set(0.8, 0.8, 1); orb.add(orbGlow);

    var torso = new THREE.Group(); torso.position.y = -1.62; rig.add(torso);
    var suitGeo = new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.6); suitGeo.scale(1.65, 1.05, 0.9);
    var suit = new THREE.Mesh(suitGeo, glossy(C.dark, { roughness: 0.5, clearcoat: 0.3 })); suit.position.y = -0.32; torso.add(suit);
    var collar = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.1, 16, 40), new THREE.MeshStandardMaterial({ color: C.cream, roughness: 0.6 }));
    collar.rotation.x = Math.PI / 2; collar.position.y = 0.62; torso.add(collar);
    var pin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), glossy(C.teal, { emissive: C.teal, emissiveIntensity: 0.35 }));
    pin.scale.set(1, 1.15, 0.5); pin.position.set(0.62, 0.28, 0.84); torso.add(pin);

    var hands = [], halo = null, sats = [], dust = null, shadow = null;
    if (!minimal) {
      var handMat = glossy(C.cream, { roughness: 0.55, clearcoat: 0.2 });
      hands = [-1, 1].map(function (s) {
        var g = new THREE.Group();
        var palm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), handMat); palm.scale.set(0.9, 1.05, 0.8); g.add(palm);
        var thumb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), handMat); thumb.position.set(-s * 0.26, -0.02, 0.04); g.add(thumb);
        var cuff = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 12, 24), glossy(C.teal)); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.3; g.add(cuff);
        g.position.set(s * 2.15, -1.35, 0.5); rig.add(g); return g;
      });
      halo = new THREE.Group(); halo.position.set(0, 0.55, -0.9); rig.add(halo);
      halo.add(new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.02, 12, 120), new THREE.MeshBasicMaterial({ color: C.teal, transparent: true, opacity: 0.4 })));
      for (var i = 0; i < 18; i++) {
        var big = i % 6 === 0;
        var t = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.07 : 0.04, 12, 10), new THREE.MeshBasicMaterial({ color: big ? C.gold : C.teal, transparent: true, opacity: big ? 1 : 0.7 }));
        var a = i / 18 * Math.PI * 2; t.position.set(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0); halo.add(t);
      }
      var SAT = [new THREE.SphereGeometry(0.22, 24, 16), new THREE.TorusGeometry(0.2, 0.07, 14, 28), new THREE.IcosahedronGeometry(0.25, 2)];
      sats = SAT.map(function (geo) {
        var mat = new THREE.MeshStandardMaterial({ color: C.mint, emissive: C.teal, emissiveIntensity: 0.45, roughness: 0.3 });
        var m = new THREE.Mesh(geo, mat);
        var glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: C.glow, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.scale.set(1.2, 1.2, 1); m.add(glow);
        var lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        var line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: C.teal, transparent: true, opacity: 0.35 }));
        rig.add(m, line); return { m: m, mat: mat, glow: glow, line: line, lg: lg };
      });
      var N = 120, dp = new Float32Array(N * 3);
      for (var j = 0; j < N; j++) { var r = 3 + Math.random() * 3.5, an = Math.random() * 6.283, e = (Math.random() - 0.5) * 4.5; dp[j * 3] = Math.cos(an) * r; dp[j * 3 + 1] = e; dp[j * 3 + 2] = Math.sin(an) * r * 0.5 - 1; }
      var dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
      dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: C.teal, size: 0.05, transparent: true, opacity: 0.5 })); scene.add(dust);
    }

    /* ---------- state ---------- */
    var state = 'idle', cur = Object.assign({}, PRESET.idle);
    var ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    function onMove(e) {
      var r = canvas.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var span = Math.max(window.innerWidth, 600) / 2;
      ptr.tx = Math.max(-1, Math.min(1, (e.clientX - cx) / span)); ptr.ty = Math.max(-1, Math.min(1, -(e.clientY - cy) / span));
    }
    window.addEventListener('pointermove', onMove, { passive: true });

    function resize() {
      var w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      if (headFrame) { camera.position.set(0, 0.75, 5.6); camera.lookAt(0, 0.75, 0); }
      else {
        var ar = w / h;
        camera.position.set(0, ar < 0.8 ? 0.2 : 0.1, ar < 0.8 ? 16.5 : (ar < 1.1 ? 13.5 : 11.5));
        camera.lookAt(0, 0, 0);
      }
      camera.updateProjectionMatrix();
    }
    var ro = (typeof ResizeObserver !== 'undefined') ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas); resize();

    /* ---------- loop ---------- */
    var clock = new THREE.Clock(), warmCol = new THREE.Color(C.gold), coolCol = new THREE.Color(C.mint), tmp = new THREE.Color();
    var nextBlink = 2, blink = 0, spin = 0, orbit = 0, waveT = -1, active = opts.active !== false, raf = 0, dead = false;
    function lerp(a, b, t) { return a + (b - a) * t; }
    var hp = new THREE.Vector3(0, 0.55, 0);

    function frame() {
      if (dead) return;
      if (!active || document.hidden) { raf = 0; return; }
      raf = requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime, P = PRESET[state];
      var k = 1 - Math.exp(-dt * 5), mo = reduceMotion ? 0.35 : 1, key2;
      for (key2 in P) cur[key2] = lerp(cur[key2], P[key2], k);
      ptr.x = lerp(ptr.x, ptr.tx, 1 - Math.exp(-dt * 4)); ptr.y = lerp(ptr.y, ptr.ty, 1 - Math.exp(-dt * 4));

      rig.position.y = Math.sin(t * 1.5) * 0.07 * mo;
      headPivot.rotation.y = ptr.x * 0.4; headPivot.rotation.x = -ptr.y * 0.22 + cur.lean * 0.1;
      headPivot.rotation.z = cur.tilt + Math.sin(t * 0.8) * 0.025 * mo;
      headPivot.position.z = cur.lean * 0.35;
      torso.rotation.y = ptr.x * 0.12;
      antenna.rotation.z = Math.sin(t * 2.2) * 0.18 * mo; orb.position.y = 0.42 + Math.abs(Math.sin(t * 3)) * 0.04 * mo;
      orbGlow.material.opacity = 0.35 + 0.2 * Math.sin(t * 3) * mo;

      if (t > nextBlink) { blink = 1; nextBlink = t + 2 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt * 7);
      var lid = 1 - Math.sin(blink * Math.PI) * 0.95;
      eyes.forEach(function (e, i) {
        var sd = i ? 1 : -1;
        e.g.scale.set(cur.eyeX, Math.max(0.05, cur.eyeY * lid), 1);
        e.g.position.x = sd * 0.34 + (cur.gx + ptr.x * 0.06);
        e.g.position.y = 0.14 + (cur.gy + ptr.y * 0.05);
        brows[i].position.y = 0.43 + (cur.eyeY - 1) * 0.18 + (cur.gy * 0.3);
      });

      var sp = cur.speak, voice = state === 'speaking' ? (0.5 + 0.5 * Math.abs(Math.sin(t * 9))) * (0.6 + 0.4 * Math.sin(t * 3.7)) : 0;
      smile.scale.setScalar(cur.smile); smileMat.opacity = 1 - sp;
      mouth.scale.set(0.75 + 0.25 * voice, Math.max(0.001, sp * (0.2 + voice * 0.95)), 1);

      if (!minimal) {
        hands.forEach(function (h, i) {
          var sd = i ? 1 : -1;
          h.position.set(sd * 2.15, -1.35 + Math.sin(t * 1.6 + i * 1.7) * 0.06 * mo, 0.5); h.rotation.z = sd * 0.15;
        });
        if (waveT >= 0) {
          waveT += dt; var r2 = hands[1], u = Math.min(waveT / 0.5, 1), out = waveT < 2.6 ? u : Math.max(0, 1 - (waveT - 2.6) / 0.5);
          r2.position.set(2.15 - 0.15 * out, -1.35 + 1.7 * out, 0.7 * out + 0.5);
          r2.rotation.z = 0.15 + Math.sin(waveT * 11) * 0.45 * out;
          if (waveT > 3.2) waveT = -1;
        }
        spin += dt * cur.ring * mo; halo.rotation.z = spin;
        halo.rotation.x = Math.sin(t * 0.4) * 0.06; halo.rotation.y = ptr.x * 0.15;
        halo.scale.setScalar(1 + (state === 'speaking' ? Math.abs(Math.sin(t * 6)) * 0.015 : 0) + (state === 'listening' ? Math.sin(t * 3) * 0.02 : 0));
        orbit += dt * cur.nodeS * mo;
        tmp.copy(coolCol).lerp(warmCol, cur.warm);
        sats.forEach(function (s, i) {
          var a = orbit + i * Math.PI * 2 / 3, R = cur.nodeR;
          s.m.position.set(Math.cos(a) * R, 0.55 + Math.sin(a) * R * 0.42 + Math.sin(t + i) * 0.08 * mo, Math.sin(a) * R * 0.7);
          s.m.rotation.x += dt * (0.8 + i * 0.3) * mo; s.m.rotation.y += dt * (1.1 - i * 0.2) * mo;
          s.mat.color.copy(tmp); s.mat.emissive.copy(tmp).multiplyScalar(0.7); s.mat.emissiveIntensity = 0.45 + 0.2 * Math.sin(t * 3 + i);
          s.glow.material.color.copy(tmp); s.glow.material.opacity = 0.38 * cur.glow;
          var p = s.lg.attributes.position; p.setXYZ(0, hp.x, hp.y, hp.z); p.setXYZ(1, s.m.position.x, s.m.position.y, s.m.position.z); p.needsUpdate = true;
          s.line.material.color.copy(tmp);
        });
        dust.rotation.y = t * 0.03 * mo;
      }
      renderer.render(scene, camera);
    }
    function start() { if (!raf && !dead) { clock.getDelta(); raf = requestAnimationFrame(frame); } }
    function onVis() { if (!document.hidden) start(); }
    document.addEventListener('visibilitychange', onVis);
    start();

    /* ---------- speech ---------- */
    var speakToken = 0;
    function stop() {
      speakToken++;
      try { speechSynthesis.cancel(); } catch (e) {}
      if (state === 'speaking') state = 'idle';
    }
    function say(text, o) {
      o = o || {};
      stop();
      var token = speakToken, l = o.lang || detectLang(text);
      return new Promise(function (resolve) {
        function done() { if (token === speakToken) { state = 'idle'; } resolve(); }
        var v = null;
        if (o.sound && 'speechSynthesis' in window) v = pickVoice(l);
        if (!v) {   // silent: still animate for a natural reading time
          state = 'speaking';
          setTimeout(done, Math.min(9000, Math.max(1800, String(text).length * 55)));
          return;
        }
        var u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = l === 'zh' ? 0.95 : 1; u.pitch = 1.05;
        u.onstart = function () { if (token === speakToken) state = 'speaking'; };
        u.onend = u.onerror = done;
        speechSynthesis.speak(u);
      });
    }

    return {
      setState: function (s) { if (PRESET[s]) { if (s !== 'speaking') { speakToken++; try { speechSynthesis.cancel(); } catch (e) {} } state = s; } },
      say: say,
      stop: stop,
      wave: function () { if (!minimal) waveT = 0; },
      setActive: function (a) { active = !!a; if (active) start(); },
      hasVoice: function (l) { return !!('speechSynthesis' in window && pickVoice(l || 'en')); },
      detectLang: detectLang,
      destroy: function () {
        dead = true; cancelAnimationFrame(raf); stop();
        window.removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis);
        if (ro) ro.disconnect(); renderer.dispose();
      }
    };
  }

  window.CoSAvatar = { mount: mount, detectLang: detectLang };
})();

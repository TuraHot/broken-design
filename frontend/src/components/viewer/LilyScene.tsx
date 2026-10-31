'use client';

// Spectral lily — procedural x-ray glass flower, auto-rotating around the screen centre.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

interface BladeParams {
  len: number;
  width: number;
  phi0: number;
  phi1: number;
  curlPow: number;
  cup: number;
  ruffle: number;
  segU?: number;
  segV?: number;
  twist?: number;
}

interface IrisOptions {
  core?: number;
  hue?: number;
  bright?: number;
  body?: number;
  throat?: number;
}

const VERTEX = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
  void main(){
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position,1.0);
    vW = wp.xyz;
    vec4 mv = viewMatrix * wp;
    vV = -mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;

const FRAGMENT = /* glsl */ `
  uniform float uTime, uSeed, uCore, uHueShift, uBright;
  uniform vec3 uBody, uThroat;
  varying vec3 vN; varying vec3 vV; varying vec2 vUv; varying vec3 vW;
  vec3 ramp(float k){
    k = fract(k);
    vec3 a = vec3(0.30,0.62,1.0);
    vec3 b = vec3(0.70,0.45,1.0);
    vec3 c = vec3(1.0,0.66,0.48);
    vec3 d = vec3(0.45,0.95,1.0);
    if(k < .30) return mix(a,b,smoothstep(0.,.30,k));
    if(k < .55) return mix(b,c,smoothstep(.30,.55,k));
    if(k < .78) return mix(c,d,smoothstep(.55,.78,k));
    return mix(d,a,smoothstep(.78,1.,k));
  }
  void main(){
    vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
    vec3 v = normalize(vV);
    float nv = abs(dot(n,v));
    float fres = pow(1.0 - nv, 2.0);
    float film = fres*1.3 + vUv.x*0.5 + n.y*0.2 + uSeed + uHueShift + uTime*0.03;
    vec3 irid = ramp(film);
    float throat = smoothstep(0.62, 0.05, vUv.x) * uCore;
    float rib = exp(-abs(vUv.y)*14.0) * (0.4 + 0.6*smoothstep(1.0,0.15,vUv.x));
    float veins = pow(abs(sin(vUv.y*17.0 + vUv.x*1.2)), 30.0) * (0.25 + 0.5*vUv.x);
    float edge = smoothstep(0.78, 1.0, abs(vUv.y));
    float band = fract(vW.y*0.3 - uTime*0.1);
    float scan = smoothstep(0.03, 0.0, abs(band-0.5));
    vec3 body = mix(uBody, irid, 0.35 + fres*0.4);
    vec3 glow = body*(0.05 + fres*0.9 + rib*0.42 + veins*0.9)*(1.0 - throat*0.55)
              + vec3(0.5,0.92,1.0)*edge*0.5
              + uThroat*throat*0.9
              + vec3(0.55,0.88,1.0)*scan*0.35;
    float a = clamp(0.06 + fres*0.65 + throat*0.28 + rib*0.28 + veins*0.7 + edge*0.3 + scan*0.25, 0.0, 1.0);
    gl_FragColor = vec4(glow * a * uBright, 1.0);
  }`;

/** A curling, cupped blade used for both tepals and leaves. */
function blade(p: BladeParams): THREE.BufferGeometry {
  const { len, width, phi0, phi1, curlPow, cup, ruffle, segU = 56, segV = 20, twist = 0 } = p;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let r = 0;
  let y = 0;
  const step = len / segU;
  const centers: { r: number; y: number; phi: number }[] = [];
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const phi = phi0 + (phi1 - phi0) * Math.pow(u, curlPow);
    centers.push({ r, y, phi });
    r += Math.sin(phi) * step;
    y += Math.cos(phi) * step;
  }
  const norm = 0.4429;
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    const c = centers[i];
    const w = (width * Math.pow(u, 0.5) * Math.pow(1 - u, 0.72)) / norm;
    const inY = Math.sin(c.phi);
    const inZ = -Math.cos(c.phi);
    const tw = twist * u;
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1;
      const s = v * w;
      const cupOff = v * v * w * cup + Math.sin(u * 22.0 + v * 2.0) * ruffle * Math.pow(Math.abs(v), 3) * w;
      pos.push(s * Math.cos(tw), c.y + inY * cupOff + s * Math.sin(tw) * 0.3, c.r + inZ * cupOff);
      uv.push(u, v);
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j;
      const b = a + segV + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function additive(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export default function LilyScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The shader palette was tuned in sRGB-as-linear; keep that look on the newer colour pipeline.
    const prevColorManagement = THREE.ColorManagement.enabled;
    THREE.ColorManagement.enabled = false;

    const canvas = document.createElement('canvas');
    // Interaction off: no grab cursor / touch capture. Restore `touch-action:none;cursor:grab` with the controls.
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Rotating 3D x-ray lily');

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch {
      THREE.ColorManagement.enabled = prevColorManagement;
      setFailed(true);
      return;
    }
    host.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0.5, 0.9, 12.2);

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(0, -0.6, 0);
    // Mouse/touch interaction is off for now — the lily only auto-rotates. Re-enable by removing these two lines.
    controls.enableRotate = false;
    controls.enableZoom = false;
    // controls.enableDamping = true;
    // controls.dampingFactor = 0.06;
    controls.enablePan = false;
    // controls.minDistance = 5;
    // controls.maxDistance = 15;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 1.5;
    controls.update();

    const timeUniform = { value: 0 };
    const irisMaterial = (seed: number, o: IrisOptions = {}) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: timeUniform,
          uSeed: { value: seed },
          uCore: { value: o.core ?? 1.0 },
          uHueShift: { value: o.hue ?? 0.0 },
          uBright: { value: o.bright ?? 1.0 },
          uBody: { value: new THREE.Color(o.body ?? 0xdfe8ff) },
          uThroat: { value: new THREE.Color(o.throat ?? 0xf06ad8) },
        },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });

    const plant = new THREE.Group();
    scene.add(plant);
    const flower = new THREE.Group();
    flower.rotation.x = 0.42;
    flower.position.y = 0.15;
    plant.add(flower);

    const wireMat = new THREE.LineBasicMaterial({
      color: 0xbfd8ff,
      transparent: true,
      opacity: 0.035,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // tepals: 3 outer, 3 inner
    const tepals: { mesh: THREE.Mesh; base: number; ph: number }[] = [];
    for (let k = 0; k < 6; k++) {
      const outer = k % 2 === 0;
      const g = blade({
        len: outer ? 2.6 : 2.45,
        width: outer ? 0.6 : 0.72,
        phi0: 0.32,
        phi1: outer ? 2.25 : 2.05,
        curlPow: 1.7,
        cup: 0.32,
        ruffle: outer ? 0.05 : 0.09,
        twist: (k % 3 - 1) * 0.12,
      });
      const m = new THREE.Mesh(g, irisMaterial(k * 0.11, { hue: outer ? 0 : 0.08, bright: 0.6, throat: 0xd84ad0 }));
      const pivot = new THREE.Group();
      pivot.rotation.y = (k * Math.PI) / 3 + (outer ? 0 : 0.06);
      pivot.add(m);
      m.add(new THREE.LineSegments(new THREE.WireframeGeometry(g), wireMat));
      m.rotation.x = outer ? 0.0 : -0.05;
      flower.add(pivot);
      tepals.push({ mesh: m, base: m.rotation.x, ph: k * 1.3 });
    }

    // stamens + anthers
    const filMat = additive(0xf3e6c4, 0.5);
    const antherMat = additive(0xffcf7a, 0.9);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3 + Math.PI / 6;
      const ln = 1.75 + (k % 2) * 0.12;
      const pts = [
        new THREE.Vector3(0, 0.05, 0),
        new THREE.Vector3(Math.cos(a) * 0.16, ln * 0.45, Math.sin(a) * 0.16),
        new THREE.Vector3(Math.cos(a) * 0.48, ln * 0.86, Math.sin(a) * 0.48),
        new THREE.Vector3(Math.cos(a) * 0.7, ln * 0.97, Math.sin(a) * 0.7),
      ];
      const curve = new THREE.CatmullRomCurve3(pts);
      flower.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.011, 6, false), filMat));
      const an = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), antherMat);
      an.scale.set(1, 1, 3.6);
      an.position.copy(pts[3]);
      an.lookAt(pts[3].clone().add(new THREE.Vector3(-Math.sin(a), 0, Math.cos(a))));
      flower.add(an);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), additive(0xffb050, 0.08));
      halo.position.copy(pts[3]);
      flower.add(halo);
    }

    // pistil
    const pistCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.03, 0.95, 0.02),
      new THREE.Vector3(0.0, 1.85, 0.12),
      new THREE.Vector3(-0.04, 2.15, 0.24),
    ]);
    flower.add(new THREE.Mesh(new THREE.TubeGeometry(pistCurve, 40, 0.02, 8, false), additive(0xe2d6ff, 0.45)));
    const stigma = new THREE.Group();
    stigma.position.copy(pistCurve.getPoint(1));
    for (let k = 0; k < 3; k++) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), additive(0xf0e4ff, 0.85));
      const a = (k * Math.PI * 2) / 3;
      lobe.position.set(Math.cos(a) * 0.04, 0.01, Math.sin(a) * 0.04);
      stigma.add(lobe);
    }
    flower.add(stigma);

    // soft throat glow
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), additive(0xe060c8, 0.14));
    core.position.y = 0.3;
    flower.add(core);
    const coreLight = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), additive(0x7a50ff, 0.05));
    coreLight.position.y = 0.45;
    flower.add(coreLight);

    // stem
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.1, 0),
      new THREE.Vector3(0.05, -1.2, -0.1),
      new THREE.Vector3(-0.08, -2.8, -0.05),
      new THREE.Vector3(0.04, -5.2, 0.05),
    ]);
    const stemGeo = new THREE.TubeGeometry(stemCurve, 80, 0.05, 10, false);
    const uvA = stemGeo.attributes.uv;
    for (let i = 0; i < uvA.count; i++) {
      const u = uvA.getX(i);
      const v = uvA.getY(i);
      uvA.setXY(i, u * 1.6 + 0.2, (v * 2 - 1) * 0.25);
    }
    plant.add(new THREE.Mesh(stemGeo, irisMaterial(0.6, { core: 0.0, hue: 0.35, bright: 0.75, body: 0xa8e8ff })));

    // leaves
    const leafSpecs = [
      { t: 0.3, a: 0.6, len: 2.0, w: 0.26 },
      { t: 0.45, a: 2.9, len: 2.3, w: 0.28 },
      { t: 0.62, a: 4.6, len: 2.1, w: 0.26 },
      { t: 0.78, a: 1.6, len: 1.8, w: 0.24 },
    ];
    leafSpecs.forEach((s, i) => {
      const g = blade({ len: s.len, width: s.w, phi0: 0.55, phi1: 1.75, curlPow: 1.4, cup: 0.45, ruffle: 0.0, segU: 48, segV: 10, twist: 0.35 });
      const m = new THREE.Mesh(g, irisMaterial(0.4 + i * 0.13, { core: 0.0, hue: 0.42, bright: 0.7, body: 0xc4e6ff }));
      m.add(new THREE.LineSegments(new THREE.WireframeGeometry(g), wireMat));
      const holder = new THREE.Group();
      holder.position.copy(stemCurve.getPoint(s.t));
      holder.rotation.y = s.a;
      holder.add(m);
      plant.add(holder);
    });

    // drifting motes
    const N = reduce ? 160 : 380;
    const mp = new Float32Array(N * 3);
    const mc = new Float32Array(N * 3);
    const mv = new Float32Array(N);
    const palette = [0x6f9bff, 0xb08bff, 0xffc08a, 0x9fe6ff].map((h) => new THREE.Color(h));
    for (let i = 0; i < N; i++) {
      const r = 1.5 + Math.random() * 4.5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      mp[i * 3] = r * Math.sin(ph) * Math.cos(th);
      mp[i * 3 + 1] = r * Math.cos(ph) * 0.8 - 0.4;
      mp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const c = palette[i % 4];
      mc[i * 3] = c.r;
      mc[i * 3 + 1] = c.g;
      mc[i * 3 + 2] = c.b;
      mv[i] = 0.002 + Math.random() * 0.005;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    moteGeo.setAttribute('color', new THREE.BufferAttribute(mc, 3));
    const dot = document.createElement('canvas');
    dot.width = dot.height = 32;
    const dctx = dot.getContext('2d');
    if (dctx) {
      const gr = dctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.35, 'rgba(255,255,255,.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      dctx.fillStyle = gr;
      dctx.fillRect(0, 0, 32, 32);
    }
    const dotTex = new THREE.CanvasTexture(dot);
    scene.add(
      new THREE.Points(
        moteGeo,
        new THREE.PointsMaterial({
          size: 0.05,
          map: dotTex,
          vertexColors: true,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );

    // bloom
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.4, 0.85);
    composer.addPass(bloom);

    const resize = () => {
      const W = host.clientWidth || window.innerWidth;
      const H = host.clientHeight || window.innerHeight;
      renderer.setSize(W, H, false);
      composer.setSize(W, H);
      camera.aspect = W / H;
      camera.fov = W / H < 0.8 ? 52 : 38;
      // Sit lower on screen so the bloom stays clear of the navbar and the intro text (negative y = down).
      camera.setViewOffset(W, H, 0, -H * 0.14, W, H);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let intro = 0;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      t += dt;
      timeUniform.value = t;
      intro = Math.min(1, intro + dt * 0.7);
      const e = 1 - Math.pow(1 - intro, 3);
      tepals.forEach((p) => {
        const breathe = reduce ? 0 : Math.sin(t * 0.9 + p.ph) * 0.03;
        p.mesh.rotation.x = p.base - (1 - e) * 0.55 + breathe;
      });
      flower.rotation.z = reduce ? 0 : Math.sin(t * 0.35) * 0.04;
      core.scale.setScalar(1 + Math.sin(t * 2.0) * 0.08);
      if (!reduce) {
        const arr = moteGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < N; i++) {
          arr[i * 3 + 1] += mv[i];
          if (arr[i * 3 + 1] > 3.2) arr[i * 3 + 1] = -4.4;
        }
        moteGeo.attributes.position.needsUpdate = true;
      }
      controls.update();
      composer.render();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const obj = o as THREE.Mesh;
        obj.geometry?.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      dotTex.dispose();
      composer.dispose();
      renderer.dispose();
      canvas.remove();
      THREE.ColorManagement.enabled = prevColorManagement;
    };
  }, []);

  return (
    <div ref={hostRef} className="fixed inset-0">
      {failed && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sky-200">
          WebGL is not available in this browser, so the 3D lily cannot render.
        </p>
      )}
    </div>
  );
}

'use client';

// Creator scene — a procedural "model being made": a faceted glass solid with wireframe and vertex dots, inside a
// bounding box with corner ticks, a transform gizmo and a ground grid. Drag to rotate; it also turns on its own.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const FACE_VERTEX = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = -mv.xyz;
    vN = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;

const FACE_FRAGMENT = /* glsl */ `
  uniform float uTime, uOpacity;
  varying vec3 vN; varying vec3 vV;
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
    float fres = pow(1.0 - abs(dot(n, normalize(vV))), 2.0);
    vec3 col = ramp(fres*1.2 + n.y*0.3 + uTime*0.03);
    float a = clamp(0.06 + fres*0.75, 0.0, 1.0);
    gl_FragColor = vec4(col * a * uOpacity, 1.0);
  }`;

function additiveLine(color: number, opacity: number) {
  return new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

export default function CreatorScene() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // The palette was tuned in sRGB-as-linear (same as the lily); keep that look on the newer colour pipeline.
    const prevColorManagement = THREE.ColorManagement.enabled;
    THREE.ColorManagement.enabled = false;

    const canvas = document.createElement('canvas');
    // Vertical swipes still scroll the page on touch screens; horizontal drags rotate the model.
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Interactive 3D model preview. Drag to rotate.');

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
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(4.4, 2.8, 5.6);

    const controls = new OrbitControls(camera, canvas);
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.8;
    controls.minPolarAngle = 0.5;
    controls.maxPolarAngle = 1.95;
    controls.target.set(0, 0, 0);
    controls.update();

    const timeUniform = { value: 0 };
    const opacityUniform = { value: 0 };

    // The model: a faceted icosphere (flat normals), its wireframe, vertex dots and a counter-rotating core.
    const model = new THREE.Group();
    scene.add(model);

    const solid = new THREE.IcosahedronGeometry(1.2, 1);
    solid.computeVertexNormals();
    model.add(
      new THREE.Mesh(
        solid,
        new THREE.ShaderMaterial({
          uniforms: { uTime: timeUniform, uOpacity: opacityUniform },
          vertexShader: FACE_VERTEX,
          fragmentShader: FACE_FRAGMENT,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    const wire = additiveLine(0xbfd8ff, 0.55);
    model.add(new THREE.LineSegments(new THREE.WireframeGeometry(solid), wire));

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

    const unique = new Map<string, THREE.Vector3>();
    const sp = solid.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(sp, i);
      unique.set(`${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`, v);
    }
    const vertexDots = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints([...unique.values()]),
      new THREE.PointsMaterial({
        size: 0.1,
        map: dotTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    model.add(vertexDots);

    const core = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.OctahedronGeometry(0.5, 0)), additiveLine(0xffb070, 0.9));
    model.add(core);
    model.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 20, 14),
        new THREE.MeshBasicMaterial({ color: 0xff9a5a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }),
      ),
    );

    // Bounding box + bright corner ticks (world-aligned, so the model turns inside it like in a 3D editor).
    const half = 1.55;
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(half * 2, half * 2, half * 2)), additiveLine(0x8fd3ff, 0.22)));
    const tick = 0.38;
    const ticks: number[] = [];
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        for (const sz of [-1, 1]) {
          const x = sx * half;
          const y = sy * half;
          const z = sz * half;
          ticks.push(x, y, z, x - sx * tick, y, z, x, y, z, x, y - sy * tick, z, x, y, z, x, y, z - sz * tick);
        }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(ticks, 3));
    scene.add(new THREE.LineSegments(tickGeo, additiveLine(0x8fd3ff, 0.95)));

    // Transform gizmo in the lower-front corner: three axes with arrow tips.
    const gizmo = new THREE.Group();
    gizmo.position.set(-half, -half, half);
    scene.add(gizmo);
    const axes: [THREE.Vector3, number][] = [
      [new THREE.Vector3(1, 0, 0), 0x8fd3ff],
      [new THREE.Vector3(0, 1, 0), 0xb892ff],
      [new THREE.Vector3(0, 0, -1), 0xffb070],
    ];
    const up = new THREE.Vector3(0, 1, 0);
    for (const [dir, color] of axes) {
      const len = 0.9;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), dir.clone().multiplyScalar(len)]);
      gizmo.add(new THREE.Line(lineGeo, additiveLine(color, 0.95)));
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.2, 10),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      cone.position.copy(dir).multiplyScalar(len + 0.08);
      cone.quaternion.setFromUnitVectors(up, dir);
      gizmo.add(cone);
    }

    // Ground grid under the box.
    const grid = new THREE.GridHelper(7, 14, 0x2a5a80, 0x16283a);
    grid.position.y = -half - 0.02;
    const gridMat = grid.material as THREE.LineBasicMaterial;
    gridMat.transparent = true;
    gridMat.opacity = 0.5;
    gridMat.depthWrite = false;
    scene.add(grid);

    // A little drifting dust.
    const DUST = 140;
    const dp = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      const r = 2 + Math.random() * 2.6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      dp[i * 3] = r * Math.sin(ph) * Math.cos(th);
      dp[i * 3 + 1] = r * Math.cos(ph) * 0.8;
      dp[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        size: 0.045,
        map: dotTex,
        color: 0xb892ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(dust);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.45, 0.85));

    const resize = () => {
      const W = host.clientWidth || 400;
      const H = host.clientHeight || 400;
      renderer.setSize(W, H, false);
      composer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Skip rendering while the panel is off screen.
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(host);

    let raf = 0;
    let last = performance.now();
    let t = 0;
    let intro = 0;
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      t += dt;
      timeUniform.value = t;
      intro = Math.min(1, intro + dt * 0.8);
      const e = 1 - Math.pow(1 - intro, 3);
      opacityUniform.value = e;
      model.scale.setScalar(0.6 + 0.4 * e);
      if (!reduce) {
        model.rotation.y += dt * 0.35;
        model.rotation.x = Math.sin(t * 0.4) * 0.12;
        core.rotation.y -= dt * 0.9;
        core.rotation.x += dt * 0.5;
        dust.rotation.y += dt * 0.03;
      }
      controls.update();
      composer.render();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
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
    <div ref={hostRef} className="absolute inset-0">
      {failed && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/65">
          WebGL is not available in this browser, so the 3D preview cannot render.
        </p>
      )}
    </div>
  );
}

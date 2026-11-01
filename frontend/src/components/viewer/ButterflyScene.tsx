'use client';

// Halo butterfly — a glowing white/violet wireframe butterfly seen from a fixed oblique angle. Ported from the
// "Halo Butterfly" reference (hand-built wing fans, branching veins, eye spots, lathe body) to this project's three.js.
// No camera controls: the view is fixed and only the wings beat slowly. Bloom does the glowing.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

type RGB = [number, number, number];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (x: number) => Math.max(0, Math.min(1, x));

// The lily's palette: white core -> hud blue -> violet -> amber at the wing edge
const STOPS: RGB[] = [
  [1, 1, 1],
  [0.45, 0.78, 1],
  [0.68, 0.48, 1],
  [1, 0.62, 0.38],
];
// where each colour sits along the core -> edge distance: blue early, violet mid-wing, amber at the rim
const STOP_AT = [0, 0.14, 0.5, 1];
function tint(d: number): RGB {
  const x = clamp(d);
  let i = 0;
  while (i < STOP_AT.length - 2 && x > STOP_AT[i + 1]) i++;
  const f = (x - STOP_AT[i]) / (STOP_AT[i + 1] - STOP_AT[i]);
  const a = STOPS[i];
  const b = STOPS[i + 1];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
}
const glow = (d: number) => (0.2 + 0.8 * Math.pow(1 - clamp(d), 1.25)) * (0.5 + 0.5 * Math.min(1, clamp(d) / 0.22));

/** Coloured line segments (colour fades with distance `d` from the core). */
class Lines {
  p: number[] = [];
  c: number[] = [];
  seg(a: THREE.Vector3, b: THREE.Vector3, da: number, db: number, w: number) {
    const ca = tint(da);
    const cb = tint(db);
    const ga = glow(da) * w;
    const gb = glow(db) * w;
    this.p.push(a.x, a.y, a.z, b.x, b.y, b.z);
    this.c.push(ca[0] * ga, ca[1] * ga, ca[2] * ga, cb[0] * gb, cb[1] * gb, cb[2] * gb);
  }
  geom() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c.map((x) => Math.min(1, x)), 3));
    return g;
  }
}

/** Glowing points with a per-point size. */
class Nodes {
  p: number[] = [];
  c: number[] = [];
  s: number[] = [];
  add(v: THREE.Vector3, d: number, size: number, boost = 1) {
    const c = tint(d * 0.6);
    const g = Math.min(1, (0.55 + 0.45 * (1 - d)) * boost);
    this.p.push(v.x, v.y, v.z);
    this.c.push(c[0] * g, c[1] * g, c[2] * g);
    this.s.push(size);
  }
  geom() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('size', new THREE.Float32BufferAttribute(this.s, 1));
    return g;
  }
}

interface WingCfg {
  scallops: number;
  cell: [number, number, number, number];
  veins: number;
  rows: number;
  perRow: number;
  eyes: [number, number, number, number][];
}

interface Mats {
  lines: THREE.ShaderMaterial;
  fill: THREE.ShaderMaterial;
  nodes: THREE.ShaderMaterial;
}

function buildButterfly(mats: Mats) {
  const group = new THREE.Group();
  const wingR = new THREE.Group();
  const wingL = new THREE.Group();
  const mirror = new THREE.Group();
  mirror.scale.x = -1;
  wingL.add(mirror);
  group.add(wingR, wingL);

  const lines = new Lines();
  const nodes = new Nodes();
  const fillP: number[] = [];
  const fillC: number[] = [];
  const fillI: number[] = [];

  // deterministic pseudo-random so the scale dust is the same every load
  let rs = 11;
  const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;

  // A wing is a fan from its root to an outline curve, gently cupped and corrugated along the veins.
  function wing(root: [number, number], outline: [number, number][], nu: number, nv: number, cup: number, seed: number, cfg: WingCfg) {
    const curve = new THREE.CatmullRomCurve3(
      outline.map((p) => new THREE.Vector3(p[0], p[1], 0)),
      false,
      'centripetal',
    );
    const edge = curve.getSpacedPoints(nu);
    const R = new THREE.Vector3(root[0], root[1], 0);
    const P: THREE.Vector3[][] = [];
    const D: number[][] = [];
    let maxL = 0;
    edge.forEach((e) => {
      maxL = Math.max(maxL, e.distanceTo(R));
    });
    for (let i = 0; i <= nu; i++) {
      P.push([]);
      D.push([]);
      const e = edge[i];
      const dir = e.clone().sub(R);
      const L = dir.length();
      const nrm = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
      const scallop = 0.028 * 0.5 * (1 + Math.cos((i / nu) * Math.PI * 2 * cfg.scallops));
      for (let j = 0; j <= nv; j++) {
        const v0 = Math.pow(j / nv, 0.82);
        const v = v0 * (1 - scallop * Math.pow(v0, 10));
        const p = R.clone()
          .addScaledVector(dir, v)
          .addScaledVector(nrm, Math.sin(Math.PI * v) * 0.035 * Math.sin(i * 0.31 + seed));
        p.z = cup * v * v * (L / maxL) + 0.022 * Math.sin(i * 0.9 + seed) * v + 0.04 * Math.sin(v * 3.1 + i * 0.12) * v;
        P[i].push(p);
        D[i].push(clamp((v * L) / maxL));
      }
    }
    // fine hologram mesh
    for (let i = 0; i <= nu; i++)
      for (let j = 0; j < nv; j++) {
        const border = i === 0 || i === nu;
        lines.seg(P[i][j], P[i][j + 1], D[i][j], D[i][j + 1], border ? 1.15 : i % 4 === 0 ? 0.4 : 0.24);
      }
    for (let j = 1; j <= nv; j++)
      for (let i = 0; i < nu; i++) {
        const outer = j === nv;
        lines.seg(P[i][j], P[i + 1][j], D[i][j], D[i + 1][j], outer ? 1.0 : j % 3 === 0 ? 0.42 : 0.24);
      }
    for (let i = 0; i < nu; i++)
      for (let j = 1; j < nv; j++) {
        if ((i + j) % 2) lines.seg(P[i][j], P[i + 1][j + 1], D[i][j], D[i + 1][j + 1], 0.15);
        else lines.seg(P[i + 1][j], P[i][j + 1], D[i + 1][j], D[i][j + 1], 0.15);
      }

    // sample any (u along the rim, v from root to rim) point on the wing surface
    const S = (u0: number, v0: number): [THREE.Vector3, number] => {
      const u = clamp(u0);
      const v = clamp(v0);
      const fi = u * nu;
      const fj = nv * Math.pow(v, 1 / 0.82);
      const i0 = Math.min(Math.floor(fi), nu - 1);
      const j0 = Math.min(Math.floor(fj), nv - 1);
      const a = fi - i0;
      const b = fj - j0;
      const p = new THREE.Vector3()
        .addScaledVector(P[i0][j0], (1 - a) * (1 - b))
        .addScaledVector(P[i0 + 1][j0], a * (1 - b))
        .addScaledVector(P[i0][j0 + 1], (1 - a) * b)
        .addScaledVector(P[i0 + 1][j0 + 1], a * b);
      p.z += 0.004;
      const d = D[i0][j0] * (1 - a) * (1 - b) + D[i0 + 1][j0] * a * (1 - b) + D[i0][j0 + 1] * (1 - a) * b + D[i0 + 1][j0 + 1] * a * b;
      return [p, d];
    };
    const path = (fn: (t: number) => [number, number], n: number, w: number) => {
      let prev = S(...fn(0));
      for (let s = 1; s <= n; s++) {
        const cur = S(...fn(s / n));
        lines.seg(prev[0], cur[0], prev[1], cur[1], w);
        prev = cur;
      }
    };

    // branching veins: a closed discal cell, veins radiating from it to the rim, two veins from the root
    const C = cfg.cell;
    const K = cfg.veins;
    const ends: number[] = [];
    path((t) => [lerp(C[0], C[1], t), C[3] + 0.02 * Math.sin(Math.PI * t)], 24, 1.3);
    path((t) => [C[0], lerp(C[2], C[3], t)], 10, 1.2);
    path((t) => [C[1], lerp(C[2], C[3], t)], 10, 1.2);
    path((t) => [lerp(0.5 * (C[0] + C[1]), C[0], t), lerp(0, C[2], t)], 10, 1.3);
    path((t) => [lerp(0.5 * (C[0] + C[1]), C[1], t), lerp(0, C[2], t)], 10, 1.3);
    for (let k = 0; k < K; k++) {
      const ue = lerp(0.035, 0.965, k / (K - 1));
      ends.push(ue);
      let us: number;
      let vs: number;
      if (ue < C[0] - 0.03) {
        us = 0.02 + ue * 0.3;
        vs = 0.02;
      } else if (ue > C[1] + 0.03) {
        us = 0.98 - (1 - ue) * 0.3;
        vs = 0.02;
      } else {
        us = lerp(C[0], C[1], (ue - C[0]) / (C[1] - C[0]));
        vs = C[3];
      }
      path((t) => [lerp(us, ue, Math.pow(t, 0.75)), lerp(vs, 1, t)], 22, 1.15);
      // fork the longest veins near the rim
      if (k % 3 === 1 && k < K - 1) {
        const uf = lerp(us, ue, Math.pow(0.6, 0.75));
        const vf = lerp(vs, 1, 0.6);
        const un = lerp(ue, lerp(0.035, 0.965, (k + 1) / (K - 1)), 0.5);
        path((t) => [lerp(uf, un, t), lerp(vf, 0.995, t)], 10, 0.85);
      }
    }
    // double submarginal line and glowing lunules between the vein ends
    path((t) => [t, 0.9 + 0.018 * Math.sin(t * Math.PI * 2 * cfg.scallops)], 160, 0.7);
    path((t) => [t, 0.82], 140, 0.45);
    for (let k = 0; k < ends.length - 1; k++) {
      const a = ends[k];
      const b = ends[k + 1];
      const m = (a + b) / 2;
      path((t) => [lerp(a, b, t), 0.965 - 0.07 * Math.sin(Math.PI * t)], 8, 0.8);
      const [pm, dm] = S(m, 0.93);
      nodes.add(pm, dm, 0.95, 1.2);
    }
    // eye-spot rings
    cfg.eyes.forEach((E) => {
      [1, 0.68, 0.38].forEach((r, ri) =>
        path((t) => [E[0] + Math.cos(t * Math.PI * 2) * E[2] * r, E[1] + Math.sin(t * Math.PI * 2) * E[3] * r], 40, 1.25 - ri * 0.15),
      );
      const [pc, dc] = S(E[0], E[1]);
      nodes.add(pc, Math.max(0, dc - 0.4), 1.6, 1.6);
      for (let a = 0; a < 8; a++) {
        const [pr, dr] = S(E[0] + Math.cos((a * Math.PI) / 4) * E[2], E[1] + Math.sin((a * Math.PI) / 4) * E[3]);
        nodes.add(pr, dr, 0.55, 1.1);
      }
    });
    // shimmering scale dust laid out in rows across the membrane
    for (let row = 0; row < cfg.rows; row++) {
      const v = lerp(0.14, 0.97, row / (cfg.rows - 1));
      const n = Math.round(lerp(12, cfg.perRow, v));
      for (let q = 0; q < n; q++) {
        const [p, d] = S((q + 0.5 + (rnd() - 0.5) * 0.6) / n, v + (rnd() - 0.5) * 0.02);
        nodes.add(p, d, 0.22 + rnd() * 0.2, 0.75);
      }
    }
    // translucent membrane
    const base = fillP.length / 3;
    for (let i = 0; i <= nu; i++)
      for (let j = 0; j <= nv; j++) {
        const p = P[i][j];
        const c = tint(D[i][j]);
        const g = glow(D[i][j]);
        fillP.push(p.x, p.y, p.z);
        fillC.push(c[0] * g, c[1] * g, c[2] * g);
      }
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++) {
        const a = base + i * (nv + 1) + j;
        const b = a + 1;
        const c = a + nv + 1;
        const d = c + 1;
        fillI.push(a, c, b, b, c, d);
      }
    // nodes along the rim and at vein crossings
    for (let i = 0; i <= nu; i += 3) nodes.add(P[i][nv], D[i][nv], 1.3, 1.3);
    for (let i = 2; i < nu; i += 8) nodes.add(P[i][Math.round(nv * 0.62)], D[i][Math.round(nv * 0.62)], 0.6);
    return { P, D, R, nu, nv };
  }

  type Wing = ReturnType<typeof wing>;

  // stamen-like filaments that grow out of the wing tips
  function stamens(W: Wing, idxs: number[], len: number) {
    idxs.forEach((i, k) => {
      const tip = W.P[i][W.nv];
      const dir = tip.clone().sub(W.R).normalize();
      const side = new THREE.Vector3(-dir.y, dir.x, 0).multiplyScalar((k - (idxs.length - 1) / 2) * 0.35);
      const l = len * (0.75 + (0.25 * ((k * 7) % 3)) / 2);
      const c = new THREE.QuadraticBezierCurve3(
        tip,
        tip.clone().addScaledVector(dir, l * 0.55).addScaledVector(side, l * 0.4).add(new THREE.Vector3(0, 0, 0.06)),
        tip.clone().addScaledVector(dir, l).addScaledVector(side, l * 0.9).add(new THREE.Vector3(0, 0, 0.1)),
      );
      const pts = c.getPoints(10);
      for (let s = 0; s < pts.length - 1; s++) lines.seg(pts[s], pts[s + 1], 0.55 - s * 0.03, 0.55 - (s + 1) * 0.03, 0.9);
      nodes.add(pts[pts.length - 1], 0.1, 1.9, 1.5);
      nodes.add(pts[5], 0.4, 0.7);
    });
  }

  const fore = wing(
    [0.06, 0.2],
    [[0.1, 0.42], [0.55, 1.05], [1.15, 1.55], [1.72, 1.78], [1.98, 1.58], [1.9, 1.1], [1.62, 0.62], [1.12, 0.22], [0.55, 0.04], [0.12, 0.06]],
    96,
    26,
    0.22,
    0.4,
    { scallops: 11, cell: [0.3, 0.62, 0.1, 0.46], veins: 11, rows: 14, perRow: 70, eyes: [[0.36, 0.8, 0.045, 0.07], [0.46, 0.84, 0.03, 0.05]] },
  );
  const hind = wing(
    [0.05, -0.02],
    [[0.16, 0.02], [0.75, 0.0], [1.3, -0.18], [1.58, -0.6], [1.5, -1.05], [1.18, -1.42], [0.86, -1.72], [0.6, -2.05], [0.4, -1.8], [0.24, -1.2], [0.08, -0.45]],
    90,
    24,
    0.16,
    2.1,
    { scallops: 9, cell: [0.22, 0.5, 0.1, 0.42], veins: 9, rows: 12, perRow: 60, eyes: [[0.42, 0.72, 0.06, 0.1], [0.62, 0.78, 0.035, 0.06]] },
  );
  stamens(fore, [Math.round(fore.nu * 0.36), Math.round(fore.nu * 0.42), Math.round(fore.nu * 0.48)], 0.42);
  stamens(hind, [Math.round(hind.nu * 0.72), Math.round(hind.nu * 0.79)], 0.36);

  const wingLines = new THREE.LineSegments(lines.geom(), mats.lines);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fillP, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(fillC, 3));
  fg.setIndex(fillI);
  fg.computeVertexNormals();
  const wingFill = new THREE.Mesh(fg, mats.fill);
  const wingNodes = new THREE.Points(nodes.geom(), mats.nodes);
  wingR.add(wingLines, wingFill, wingNodes);
  mirror.add(wingLines.clone(), wingFill.clone(), wingNodes.clone());

  // body: thorax + segmented abdomen + head, as a lathe wireframe
  const body = new Lines();
  const bodyNodes = new Nodes();
  const prof: [number, number][] = [];
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    const y = lerp(0.5, -1.25, t);
    let r: number;
    if (y > 0.36) r = 0.065 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.43) / 0.075, 2)));
    else if (y > -0.02) r = 0.1 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 0.17) / 0.2, 2))) + 0.01;
    else r = 0.085 * Math.pow(Math.max(0, 1 - (-0.02 - y) / 1.25), 0.6) * (0.9 + 0.1 * Math.cos(y * 26));
    prof.push([Math.max(r, 0.004), y]);
  }
  const SEG = 12;
  const bp = (k: number, s: number) => {
    const [r, y] = prof[k];
    const a = (s / SEG) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.9);
  };
  const bd = (k: number) => clamp(Math.abs(prof[k][1] - 0.17) / 1.6);
  for (let k = 0; k < prof.length - 1; k++)
    for (let s = 0; s < SEG; s++) {
      body.seg(bp(k, s), bp(k + 1, s), bd(k) * 0.6, bd(k + 1) * 0.6, 0.85);
      if (k % 2 === 0) body.seg(bp(k, s), bp(k, s + 1), bd(k) * 0.6, bd(k) * 0.6, 0.7);
    }
  // antennae with clubbed tips
  [1, -1].forEach((sx) => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.02 * sx, 0.5, 0.03),
      new THREE.Vector3(0.14 * sx, 0.85, 0.05),
      new THREE.Vector3(0.3 * sx, 1.2, 0.02),
      new THREE.Vector3(0.4 * sx, 1.4, -0.04),
    ]);
    const pts = c.getPoints(24);
    for (let s = 0; s < pts.length - 1; s++) body.seg(pts[s], pts[s + 1], 0.15 + s * 0.012, 0.15 + (s + 1) * 0.012, 0.9);
    bodyNodes.add(pts[pts.length - 1], 0.05, 2.0, 1.6);
    bodyNodes.add(pts[pts.length - 3], 0.1, 1.0, 1.2);
  });
  // compound eyes: small wire spheres
  [1, -1].forEach((sx) => {
    const c = new THREE.Vector3(0.048 * sx, 0.455, 0.03);
    const r = 0.034;
    const sph = (phi: number, a: number) =>
      c.clone().add(new THREE.Vector3(Math.sin(phi) * Math.cos(a) * r, Math.cos(phi) * r, Math.sin(phi) * Math.sin(a) * r));
    for (let la = 1; la < 6; la++) {
      const phi = (la / 6) * Math.PI;
      for (let s = 0; s < 14; s++) body.seg(sph(phi, (s / 14) * Math.PI * 2), sph(phi, ((s + 1) / 14) * Math.PI * 2), 0.05, 0.05, 0.6);
    }
    for (let m = 0; m < 8; m++) {
      const a = (m / 8) * Math.PI * 2;
      for (let la = 0; la < 6; la++) body.seg(sph((la / 6) * Math.PI, a), sph(((la + 1) / 6) * Math.PI, a), 0.05, 0.05, 0.5);
    }
    bodyNodes.add(c.clone().add(new THREE.Vector3(0.01 * sx, 0, 0.03)), 0.0, 0.9, 1.4);
  });
  // coiled proboscis under the head
  {
    let prev: THREE.Vector3 | null = null;
    for (let s = 0; s <= 60; s++) {
      const t = s / 60;
      const a = t * Math.PI * 5;
      const r = 0.075 * (1 - t * 0.8);
      const p = new THREE.Vector3(0, 0.4 - 0.02 * t + Math.cos(a) * r * 0.9 - 0.075, 0.07 + Math.sin(a) * r);
      if (prev) body.seg(prev, p, 0.1, 0.1, 0.75);
      prev = p;
    }
  }
  // six jointed legs folded under the thorax
  [[0.28, 0.5], [0.17, 0.0], [0.06, -0.45]].forEach(([y, sw]) => {
    [1, -1].forEach((sx) => {
      const pts = [
        new THREE.Vector3(0.05 * sx, y, -0.06),
        new THREE.Vector3(0.16 * sx, y + 0.02 + sw * 0.06, -0.16),
        new THREE.Vector3(0.24 * sx, y - 0.12 + sw * 0.18, -0.12),
        new THREE.Vector3(0.3 * sx, y - 0.3 + sw * 0.3, -0.18),
        new THREE.Vector3(0.33 * sx, y - 0.4 + sw * 0.36, -0.2),
      ];
      for (let s = 0; s < pts.length - 1; s++) {
        body.seg(pts[s], pts[s + 1], 0.25 + s * 0.08, 0.25 + (s + 1) * 0.08, 0.7);
        if (s > 0) bodyNodes.add(pts[s], 0.3, 0.45, 0.9);
      }
    });
  });
  // fine hairs on the thorax and wing roots
  for (let h = 0; h < 160; h++) {
    const y = rnd() * 0.36;
    const a = rnd() * Math.PI * 2;
    const r = 0.1 * Math.sqrt(Math.max(0.05, 1 - Math.pow((y - 0.17) / 0.2, 2))) + 0.01;
    const n = new THREE.Vector3(Math.cos(a), (rnd() - 0.5) * 0.6, Math.sin(a) * 0.9).normalize();
    const p0 = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r * 0.9);
    body.seg(p0, p0.clone().addScaledVector(n, 0.03 + rnd() * 0.05), 0.0, 0.35, 0.55);
  }
  group.add(new THREE.LineSegments(body.geom(), mats.lines), new THREE.Points(bodyNodes.geom(), mats.nodes));

  return { group, wingR, wingL };
}

function haloTexture(inner: string, outer: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner);
    gr.addColorStop(0.25, outer);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

// Fixed oblique view: ~45 degrees round from the front, a little above the butterfly.
const DISTANCE = 10.8;
const AZIMUTH = THREE.MathUtils.degToRad(-45);
const ELEVATION = THREE.MathUtils.degToRad(4);
// Looking slightly to the right of the body puts the whole butterfly (the wing sweeps right) in the middle of the frame.
const TARGET = new THREE.Vector3(1.0, -0.05, 0);

/** Screen positions (CSS px inside the canvas) of three spots on the butterfly, for HUD callouts. */
export type ButterflyAnchors = Record<'antenna' | 'fore' | 'hind', { x: number; y: number }>;

export default function ButterflyScene({ onProject }: { onProject?: (anchors: ButterflyAnchors) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Read through a ref so a new callback does not rebuild the whole scene.
  const onProjectRef = useRef(onProject);
  onProjectRef.current = onProject;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Keep the colours exactly as authored (same setting as the lily scene).
    const prevColorManagement = THREE.ColorManagement.enabled;
    THREE.ColorManagement.enabled = false;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Glowing 3D wireframe butterfly with violet wings');

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    } catch {
      THREE.ColorManagement.enabled = prevColorManagement;
      setFailed(true);
      return;
    }
    host.appendChild(canvas);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(
      TARGET.x + DISTANCE * Math.sin(AZIMUTH) * Math.cos(ELEVATION),
      TARGET.y + DISTANCE * Math.sin(ELEVATION),
      TARGET.z + DISTANCE * Math.cos(AZIMUTH) * Math.cos(ELEVATION),
    );
    camera.lookAt(TARGET);

    const time = { value: 0 };
    const px = { value: renderer.getPixelRatio() };
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uTime: time },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: /* glsl */ `
        uniform float uTime; varying vec3 vC; varying float vS;
        void main(){ vC = color; vec4 w = modelMatrix * vec4(position, 1.0);
          vS = 0.82 + 0.18 * sin(uTime * 1.3 - length(w.xy) * 3.0);
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `varying vec3 vC; varying float vS; void main(){ gl_FragColor = vec4(vC * vS * 0.7, 1.0); }`,
    });
    const fillMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vC; varying vec3 vN; varying vec3 vV;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = -mv.xyz; vN = normalMatrix * normal; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying vec3 vN; varying vec3 vV;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); gl_FragColor = vec4(vC * (0.07 + 0.2 * f), 1.0); }`,
    });
    const nodeMat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uPx: px },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uPx; attribute float size; varying vec3 vC; varying float vA;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float ph = position.x * 13.0 + position.y * 7.0; vA = 0.6 + 0.4 * sin(uTime * 2.2 + ph);
          gl_PointSize = size * uPx * 34.0 * (0.85 + 0.25 * vA) / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vC; varying float vA;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float c = smoothstep(0.5, 0.0, r);
          float a = (pow(c, 6.0) * 1.4 + pow(c, 2.0) * 0.35) * vA; if (a < 0.004) discard; gl_FragColor = vec4(vC * a, 1.0); }`,
    });

    const { group: fly, wingR, wingL } = buildButterfly({ lines: lineMat, fill: fillMat, nodes: nodeMat });
    const rig = new THREE.Group();
    rig.rotation.x = -0.5;
    rig.add(fly);
    scene.add(rig);

    // radiant core: soft sprite halos around the thorax
    const texA = haloTexture('rgba(255,255,255,1)', 'rgba(190,225,255,0.35)');
    const texB = haloTexture('rgba(140,175,255,0.3)', 'rgba(150,100,255,0.07)');
    const haloA = new THREE.Sprite(new THREE.SpriteMaterial({ map: texA, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    haloA.scale.set(0.3, 0.3, 1);
    haloA.position.set(0, 0.17, 0.02);
    fly.add(haloA);
    const haloB = new THREE.Sprite(new THREE.SpriteMaterial({ map: texB, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    haloB.scale.set(3.4, 3.4, 1);
    haloB.position.set(0, 0.0, -0.05);
    fly.add(haloB);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    // Same bloom setup as the lily (no gamma pass: it lifts the dark background to grey on this three.js version).
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.45, 0.55));

    let sizeKey = '';
    const resize = () => {
      const W = host.clientWidth || 400;
      const H = host.clientHeight || 400;
      sizeKey = `${W}x${H}`;
      renderer.setSize(W, H, false);
      composer.setSize(W, H);
      camera.aspect = W / H;
      camera.fov = W / H < 0.75 ? 58 : 34;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Skip rendering while the butterfly is off screen.
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(host);

    const anchor = new THREE.Vector3();
    let last = performance.now();
    let flapT = 0;
    let raf = 0;
    let projected: typeof onProjectRef.current;
    let projectedSize = '';
    const frame =(now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      raf = requestAnimationFrame(frame);
      if (!visible) return;
      if (!reduce) {
        flapT += dt;
        time.value += dt;
      }
      // A relaxed wing beat (a short rest at the top of each stroke) while the butterfly stays where it is.
      const s = Math.sin(flapT * 5.2);
      const beat = 0.5 + 0.5 * Math.sign(s) * Math.pow(Math.abs(s), 0.7);
      const a = reduce ? 1.0 : 0.35 + 1.0 * beat;
      wingR.rotation.y = -a;
      wingL.rotation.y = a;
      // Hovering in place: only a small lift with each wing stroke.
      if (!reduce) rig.position.y = 0.12 * Math.sin(flapT * 5.2 + 0.6);
      haloA.material.opacity = 0.55 + 0.12 * Math.sin(time.value * 1.7);
      // Leader lines stay still: anchors are measured once on a fixed pose (wings half open, no lift), again only when
      // the size or the callback changes.
      const project = onProjectRef.current;
      if (project && (project !== projected || sizeKey !== projectedSize)) {
        const wr = wingR.rotation.y;
        const wl = wingL.rotation.y;
        const ry = rig.position.y;
        wingR.rotation.y = -1.0;
        wingL.rotation.y = 1.0;
        rig.position.y = 0;
        scene.updateMatrixWorld();
        camera.updateMatrixWorld();
        const W = host.clientWidth;
        const H = host.clientHeight;
        const toScreen = (obj: THREE.Object3D, x: number, y: number, z: number) => {
          anchor.set(x, y, z);
          obj.localToWorld(anchor).project(camera);
          return { x: (anchor.x * 0.5 + 0.5) * W, y: (-anchor.y * 0.5 + 0.5) * H };
        };
        project({
          antenna: toScreen(fly, 0.4, 1.4, -0.04),
          fore: toScreen(wingR, 1.85, 1.7, 0.1),
          hind: toScreen(wingR, 0.62, -2.0, 0),
        });
        wingR.rotation.y = wr;
        wingL.rotation.y = wl;
        rig.position.y = ry;
        projected = project;
        projectedSize = sizeKey;
      }
      composer.render();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      scene.traverse((o) => {
        const obj = o as THREE.Mesh;
        obj.geometry?.dispose();
        const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      texA.dispose();
      texB.dispose();
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

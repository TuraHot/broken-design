'use client';

// Pixie light: a glowing orb with tiny flickering wings and a sparkle trail.
// Chases the mouse; on touch devices (or before the mouse moves) it flies around the flower.
import { useEffect, useRef } from 'react';

const IDLE_AFTER_S = 1.2; // mouse still for this long → pixie hovers around the last point
const MAX_PARTICLES = 140;
const SPARK_COLORS = ['143,211,255', '184,146,255', '255,176,112']; // hud, violet, amber

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: string;
}

export default function PixieCursor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = window.innerWidth;
    let H = window.innerHeight;

    const drawPixie = (px: number, py: number, heading: number, flap: number, alpha: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = 'lighter';

      const halo = ctx.createRadialGradient(px, py, 0, px, py, 46);
      halo.addColorStop(0, 'rgba(223,243,255,0.9)');
      halo.addColorStop(0.18, 'rgba(143,211,255,0.55)');
      halo.addColorStop(0.5, 'rgba(184,146,255,0.18)');
      halo.addColorStop(1, 'rgba(184,146,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(px, py, 46, 0, Math.PI * 2);
      ctx.fill();

      // Two small wings swept back from the orb; `flap` squeezes them sideways.
      ctx.translate(px, py);
      ctx.rotate(heading);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side * flap, 1);
        ctx.beginPath();
        ctx.moveTo(2, 1);
        ctx.bezierCurveTo(8, 14, 20, 14, 18, 5);
        ctx.bezierCurveTo(16, 0, 8, -2, 2, -1);
        ctx.closePath();
        ctx.fillStyle = 'rgba(143,211,255,0.28)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(223,243,255,0.7)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(143,211,255,1)';
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(px, py, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Resizing clears the canvas; the reduced-motion pixie is static, so redraw it here.
      if (reduce) drawPixie(W * 0.62, H * 0.4, 0.4, 1, 1);
    };
    resize();
    window.addEventListener('resize', resize);

    if (reduce) {
      return () => window.removeEventListener('resize', resize);
    }

    const mouse = { x: 0, y: 0, seen: false, last: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.seen = true;
      mouse.last = performance.now();
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const particles: Particle[] = [];
    let emit = 0;
    let x = W * 0.5;
    let y = H * 0.45;
    let heading = 0;
    let phase = 0;
    const start = performance.now();
    let last = start;
    let raf = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const t = now / 1000;

      let tx: number;
      let ty: number;
      let rate: number;
      if (mouse.seen) {
        const idle = (now - mouse.last) / 1000;
        if (idle < IDLE_AFTER_S) {
          tx = mouse.x;
          ty = mouse.y;
          rate = 3.2;
        } else {
          tx = mouse.x + Math.cos(t * 1.3) * 28;
          ty = mouse.y + Math.sin(t * 1.7) * 18;
          rate = 2.2;
        }
      } else {
        // Orbit around the flower (roughly the middle of the screen).
        tx = W * 0.5 + Math.cos(t * 0.5) * Math.min(W * 0.18, 260);
        ty = H * 0.45 + Math.sin(t * 0.8) * Math.min(H * 0.2, 160);
        rate = 1.6;
      }
      tx = Math.min(Math.max(tx, 0), W);
      ty = Math.min(Math.max(ty, 0), H);

      const k = 1 - Math.exp(-dt * rate);
      const nx = x + (tx - x) * k;
      const ny = y + (ty - y) * k;
      const vx = dt > 0 ? (nx - x) / dt : 0;
      const vy = dt > 0 ? (ny - y) / dt : 0;
      const speed = Math.hypot(vx, vy);
      x = nx;
      y = ny;

      if (speed > 25) {
        const target = Math.atan2(vy, vx) + Math.PI / 2; // wings are swept back relative to "up"
        let diff = target - heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        heading += diff * (1 - Math.exp(-dt * 6));
      }

      // Little flits while moving.
      const wob = Math.sin(t * 6) * Math.min(speed / 60, 1) * 4;
      const px = x + Math.cos(heading) * wob;
      const py = y + Math.sin(heading) * wob;

      // Sparkle trail: more while moving.
      emit += dt * (30 + Math.min(speed, 600) * 0.12);
      while (emit >= 1) {
        emit -= 1;
        if (particles.length >= MAX_PARTICLES) {
          emit = 0;
          break;
        }
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 14;
        particles.push({
          x: px + (Math.random() - 0.5) * 6,
          y: py + (Math.random() - 0.5) * 6,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp + 6,
          age: 0,
          life: 0.7 + Math.random() * 0.9,
          size: 1.2 + Math.random() * 2.2,
          color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
        });
      }

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles[i] = particles[particles.length - 1];
          particles.pop();
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const remaining = 1 - p.age / p.life;
        ctx.fillStyle = `rgba(${p.color},${(Math.pow(remaining, 1.6) * 0.9).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * remaining), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      phase += dt * (18 + (Math.min(speed, 500) / 500) * 14);
      const flap = 0.35 + 0.65 * Math.abs(Math.cos(phase));
      drawPixie(px, py, heading, flap, Math.min(1, (now - start) / 700));

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-20 h-full w-full" />;
}

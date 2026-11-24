import { useEffect, useRef } from 'react';

interface MeshNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hl: number;
  phase: number;
}

interface Pulse {
  x: number;
  y: number;
  r: number;
  maxR: number;
}

/**
 * Lightweight, touch-reactive NeuroLink Neural Mesh Canvas for Mobile Auth.
 * Preserves the signature radiating emerald network aesthetic from Desktop Web
 * at phone-friendly density and smooth frame pacing.
 */
export function NeuralMeshCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const pulsesRef = useRef<Pulse[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = canvas.clientWidth || 390;
    let h = canvas.clientHeight || 800;

    const nodes: MeshNode[] = Array.from({ length: 42 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.34,
      vy: (Math.random() - 0.5) * 0.34,
      r: 1.6 + Math.random() * 1.2,
      hl: 0,
      phase: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
    };
    const onTap = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pulsesRef.current.push({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        r: 4,
        maxR: 190,
      });
      if (pulsesRef.current.length > 5) pulsesRef.current.shift();
    };

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onTap, { passive: true });

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const ptr = pointerRef.current;
      const pulses = pulsesRef.current;

      for (let i = pulses.length - 1; i >= 0; i--) {
        const p = pulses[i]!;
        p.r += 4.5;
        const alpha = Math.max(0, 0.42 * (1 - p.r / p.maxR));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(22, 163, 74, ${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        if (p.r >= p.maxR) pulses.splice(i, 1);
      }

      for (const n of nodes) {
        if (!reducedMotion) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
        n.hl *= 0.92;
        if (ptr.active) {
          const d = Math.hypot(ptr.x - n.x, ptr.y - n.y);
          if (d < 150) n.hl = Math.max(n.hl, 1 - d / 150);
        }
        for (const p of pulses) {
          const dp = Math.hypot(p.x - n.x, p.y - n.y);
          if (Math.abs(dp - p.r) < 28) n.hl = Math.max(n.hl, 0.95);
        }
      }

      const maxDist = 115;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          if (dist < maxDist) {
            const hl = Math.max(a.hl, b.hl);
            const alpha = (1 - dist / maxDist) * (0.09 + hl * 0.42);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(22, 163, 74, ${alpha})`;
            ctx.lineWidth = 0.7 + hl * 0.8;
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.hl * 1.1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22, 163, 74, ${0.18 + n.hl * 0.68})`;
        ctx.fill();
      }

      if (!reducedMotion) raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('pointerdown', onTap);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

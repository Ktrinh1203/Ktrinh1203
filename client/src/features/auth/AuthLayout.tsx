import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Logo } from '../../components/layout/AppShell';

interface MeshPoint {
  xFrac: number;
  yFrac: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  highlight: number;
}

interface MeshPulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

const POINT_COUNT = 82;
const LINK_DISTANCE = 148;
const CURSOR_REVEAL_RADIUS = 230;
const CURSOR_DIRECT_LINK_RADIUS = 185;

function createMeshPoints(width: number, height: number): MeshPoint[] {
  return Array.from({ length: POINT_COUNT }, () => {
    const xFrac = Math.random();
    const yFrac = Math.random();
    return {
      xFrac,
      yFrac,
      x: xFrac * width,
      y: yFrac * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      radius: 1.6 + Math.random() * 1.4,
      highlight: 0,
    };
  });
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const pulsesRef = useRef<MeshPulse[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const points = createMeshPoints(width, height);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      width = rect.width;
      height = rect.height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (const p of points) {
        p.x = p.xFrac * width;
        p.y = p.yFrac * height;
      }
    };

    resize();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    observer?.observe(container);

    const drawFrame = () => {
      const mouse = mouseRef.current;
      const pulses = pulsesRef.current;

      ctx.clearRect(0, 0, width, height);

      // Update expanding click pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const rp = pulses[i];
        rp.radius += 5.5;
        rp.alpha = Math.max(0, 0.55 * (1 - rp.radius / rp.maxRadius));

        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(22, 163, 74, ${rp.alpha * 0.45})`;
        ctx.lineWidth = 1.25;
        ctx.stroke();

        if (rp.radius >= rp.maxRadius || rp.alpha <= 0.01) {
          pulses.splice(i, 1);
        }
      }

      // Update point positions & cursor/pulse highlight intensities
      for (const p of points) {
        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x <= 0) {
            p.x = 0;
            p.vx = Math.abs(p.vx);
          } else if (p.x >= width) {
            p.x = width;
            p.vx = -Math.abs(p.vx);
          }
          if (p.y <= 0) {
            p.y = 0;
            p.vy = Math.abs(p.vy);
          } else if (p.y >= height) {
            p.y = height;
            p.vy = -Math.abs(p.vy);
          }
          p.xFrac = p.x / Math.max(1, width);
          p.yFrac = p.y / Math.max(1, height);
        }

        // Smooth decay so threads appear as mouse glides over and fade gently away
        p.highlight *= 0.92;

        if (mouse.active) {
          const dist = Math.hypot(mouse.x - p.x, mouse.y - p.y);
          if (dist < CURSOR_REVEAL_RADIUS) {
            const intensity = Math.pow(1 - dist / CURSOR_REVEAL_RADIUS, 1.3);
            p.highlight = Math.max(p.highlight, intensity);
          }
        }

        for (const rp of pulses) {
          const dRp = Math.hypot(p.x - rp.x, p.y - rp.y);
          if (Math.abs(dRp - rp.radius) < 32) {
            p.highlight = Math.max(p.highlight, 0.95);
          }
        }
      }

      // Draw multi-strand network edges radiating from each node
      const maxDistSq = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dSq = dx * dx + dy * dy;

          if (dSq < maxDistSq) {
            const dist = Math.sqrt(dSq);
            const distRatio = 1 - dist / LINK_DISTANCE;
            const pairHighlight = Math.max(a.highlight, b.highlight);

            // Whisper-quiet ambient web at rest; vividly revealed around mouse cursor
            const alpha = distRatio * (0.065 + pairHighlight * 0.46);
            if (alpha < 0.015) continue;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(22, 163, 74, ${alpha})`;
            ctx.lineWidth = 0.7 + pairHighlight * 0.95;
            ctx.stroke();
          }
        }

        // Connect nearby nodes directly to cursor to complete radiating strands
        if (mouse.active) {
          const mdx = mouse.x - a.x;
          const mdy = mouse.y - a.y;
          const mDist = Math.hypot(mdx, mdy);
          if (mDist < CURSOR_DIRECT_LINK_RADIUS) {
            const ratio = 1 - mDist / CURSOR_DIRECT_LINK_RADIUS;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(21, 128, 61, ${ratio * 0.45})`;
            ctx.lineWidth = 0.9 + ratio * 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw crisp network points (vertices)
      for (const p of points) {
        const dotAlpha = 0.14 + p.highlight * 0.72;
        const dotRadius = p.radius + p.highlight * 1.45;

        if (p.highlight > 0.25) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, dotRadius * 2.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34, 197, 94, ${p.highlight * 0.14})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22, 163, 74, ${dotAlpha})`;
        ctx.fill();
      }

      if (!reducedMotion) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, []);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
    mouseRef.current.active = true;
  }

  function handleMouseLeave() {
    mouseRef.current.active = false;
  }

  function handleClick(e: MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('input, button, a, label')) return;

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    pulsesRef.current.push({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      radius: 4,
      maxRadius: 240,
      alpha: 0.55,
    });
    if (pulsesRef.current.length > 10) {
      pulsesRef.current.splice(0, pulsesRef.current.length - 10);
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F5FAF7] px-4 py-10 text-[#141413]"
    >
      {/* Interactive Multi-Point Radiating Mesh Canvas (Revealed on Hover/Move) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Centered Card Content */}
      <div className="relative z-10 flex w-full flex-col items-center">
        <Logo className="mb-7" />
        <div className="w-full max-w-md rounded-2xl border border-[#DCE6DF] bg-white/95 p-7 shadow-xs backdrop-blur-[2px] sm:p-9">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 sm:text-sm">{subtitle}</p>
          )}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-sm text-slate-600">{footer}</div>}
      </div>
    </div>
  );
}

import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Logo } from '../../components/layout/AppShell';

interface NodeSpoke {
  angle: number;
  len: number;
  hasTip: boolean;
}

interface MeshPoint {
  xFrac: number;
  yFrac: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  highlight: number;
  phase: number;
  spokes: NodeSpoke[];
}

interface MeshPulse {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

const POINT_COUNT = 56;
const LINK_DISTANCE = 205;
const CURSOR_REVEAL_RADIUS = 270;
const CURSOR_DIRECT_LINK_RADIUS = 235;
const FRAME_INTERVAL_MS = 1000 / 30;

function createMeshPoints(width: number, height: number): MeshPoint[] {
  return Array.from({ length: POINT_COUNT }, (_, idx) => {
    const xFrac = Math.random();
    const yFrac = Math.random();
    const spokeCount = 6 + (idx % 4); // 6 to 9 radiating filaments per node
    const baseAngle = Math.random() * Math.PI * 2;
    const spokes: NodeSpoke[] = Array.from({ length: spokeCount }, (__, s) => ({
      angle: baseAngle + (s / spokeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.32,
      len: 12 + Math.random() * 18,
      hasTip: s % 2 === 0,
    }));

    return {
      xFrac,
      yFrac,
      x: xFrac * width,
      y: yFrac * height,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.5) * 0.42,
      radius: 1.8 + Math.random() * 1.4,
      highlight: 0,
      phase: Math.random() * Math.PI * 2,
      spokes,
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

    const startTime = performance.now();
    let lastRenderTime = startTime - FRAME_INTERVAL_MS;
    let isDisposed = false;

    const drawFrame = (now: number) => {
      if (isDisposed || document.hidden) return;

      if (!reducedMotion && now - lastRenderTime < FRAME_INTERVAL_MS) {
        rafId = requestAnimationFrame(drawFrame);
        return;
      }

      const dtScale = Math.min(2.5, Math.max(0.5, (now - lastRenderTime) / 16.67));
      lastRenderTime = now;
      const t = (now - startTime) / 1000;
      const mouse = mouseRef.current;
      const pulses = pulsesRef.current;

      ctx.clearRect(0, 0, width, height);

      // Update expanding click pulses
      for (let i = pulses.length - 1; i >= 0; i--) {
        const rp = pulses[i];
        rp.radius += 6 * dtScale;
        rp.alpha = Math.max(0, 0.55 * (1 - rp.radius / rp.maxRadius));

        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(22, 163, 74, ${rp.alpha * 0.48})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();

        if (rp.radius >= rp.maxRadius || rp.alpha <= 0.01) {
          pulses.splice(i, 1);
        }
      }

      // Update point positions & cursor/pulse highlight intensities
      const decay = Math.pow(0.93, dtScale);
      for (const p of points) {
        if (!reducedMotion) {
          p.x += p.vx * dtScale;
          p.y += p.vy * dtScale;
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
        p.highlight *= decay;

        if (mouse.active) {
          const mdx = mouse.x - p.x;
          const mdy = mouse.y - p.y;
          if (Math.abs(mdx) < CURSOR_REVEAL_RADIUS && Math.abs(mdy) < CURSOR_REVEAL_RADIUS) {
            const dist = Math.hypot(mdx, mdy);
            if (dist < CURSOR_REVEAL_RADIUS) {
              const intensity = Math.pow(1 - dist / CURSOR_REVEAL_RADIUS, 1.2);
              p.highlight = Math.max(p.highlight, intensity);
            }
          }
        }

        for (const rp of pulses) {
          const dRp = Math.hypot(p.x - rp.x, p.y - rp.y);
          if (Math.abs(dRp - rp.radius) < 36) {
            p.highlight = Math.max(p.highlight, 0.98);
          }
        }
      }

      // Draw dense multi-strand neural edges radiating between neighboring nodes
      const maxDistSq = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        for (let j = i + 1; j < points.length; j++) {
          const b = points[j];
          const dx = b.x - a.x;
          if (dx > LINK_DISTANCE || dx < -LINK_DISTANCE) continue;
          const dy = b.y - a.y;
          if (dy > LINK_DISTANCE || dy < -LINK_DISTANCE) continue;

          const dSq = dx * dx + dy * dy;
          if (dSq < maxDistSq) {
            const dist = Math.sqrt(dSq);
            const distRatio = 1 - dist / LINK_DISTANCE;
            const pairHighlight = Math.max(a.highlight, b.highlight);

            // Subtle ambient mesh at rest; rich multi-strand web around cursor/pulse
            const alpha = distRatio * (0.07 + pairHighlight * 0.5);
            if (alpha < 0.015) continue;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(22, 163, 74, ${alpha})`;
            ctx.lineWidth = 0.65 + pairHighlight * 0.95;
            ctx.stroke();

            // Travelling neural signal dot along active strands
            if (!reducedMotion && pairHighlight > 0.3 && (i + j) % 2 === 0) {
              const travel = ((t * 0.65 + a.phase) % 1 + 1) % 1;
              const px = a.x + dx * travel;
              const py = a.y + dy * travel;
              ctx.beginPath();
              ctx.arc(px, py, 1.35, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(16, 185, 129, ${pairHighlight * 0.85})`;
              ctx.fill();
            }
          }
        }

        // Connect nearby nodes directly to cursor for dense multi-spoke pointer web
        if (mouse.active) {
          const mdx = mouse.x - a.x;
          const mdy = mouse.y - a.y;
          if (Math.abs(mdx) < CURSOR_DIRECT_LINK_RADIUS && Math.abs(mdy) < CURSOR_DIRECT_LINK_RADIUS) {
            const mDist = Math.hypot(mdx, mdy);
            if (mDist < CURSOR_DIRECT_LINK_RADIUS) {
              const ratio = 1 - mDist / CURSOR_DIRECT_LINK_RADIUS;
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(mouse.x, mouse.y);
              ctx.strokeStyle = `rgba(21, 128, 61, ${ratio * 0.5})`;
              ctx.lineWidth = 0.85 + ratio * 0.85;
              ctx.stroke();
            }
          }
        }
      }

      // Draw each node + its own 6-9 radiating neural filaments (spokes)
      for (const p of points) {
        const dotAlpha = 0.16 + p.highlight * 0.75;
        const dotRadius = p.radius + p.highlight * 1.4;
        const driftRot = reducedMotion ? 0 : Math.sin(t * 0.7 + p.phase) * 0.12;

        // Radiating terminal filaments around every vertex
        const spokeAlpha = 0.06 + p.highlight * 0.52;
        if (spokeAlpha > 0.04) {
          for (const sp of p.spokes) {
            const ang = sp.angle + driftRot;
            const len = sp.len * (0.72 + p.highlight * 0.55);
            const sx = p.x + Math.cos(ang) * len;
            const sy = p.y + Math.sin(ang) * len;

            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(sx, sy);
            ctx.strokeStyle = `rgba(22, 163, 74, ${spokeAlpha})`;
            ctx.lineWidth = 0.55 + p.highlight * 0.55;
            ctx.stroke();

            if (sp.hasTip && p.highlight > 0.12) {
              ctx.beginPath();
              ctx.arc(sx, sy, 0.9 + p.highlight * 0.6, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(16, 185, 129, ${p.highlight * 0.7})`;
              ctx.fill();
            }
          }
        }

        if (p.highlight > 0.25) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, dotRadius * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34, 197, 94, ${p.highlight * 0.15})`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(22, 163, 74, ${dotAlpha})`;
        ctx.fill();
      }

      if (!reducedMotion && !document.hidden) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafId);
        return;
      }
      if (!reducedMotion && !isDisposed) {
        lastRenderTime = performance.now() - FRAME_INTERVAL_MS;
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    drawFrame(performance.now());

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
      maxRadius: 280,
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
      {/* Interactive Multi-Point Radiating Neural Mesh Canvas */}
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

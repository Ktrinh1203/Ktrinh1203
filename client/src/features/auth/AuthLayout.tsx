import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, Home } from 'lucide-react';

interface NeuralNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  phase: number;
  energy: number;
}

interface ImpulseRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

const NODE_COUNT = 65;
const LINK_DISTANCE = 145;
const CURSOR_LINK_DISTANCE = 180;

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
  const mouseRef = useRef<{ x: number; y: number; active: boolean; lastRippleAt: number }>({
    x: 0,
    y: 0,
    active: false,
    lastRippleAt: 0,
  });
  const ripplesRef = useRef<ImpulseRipple[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const nodes: NeuralNode[] = Array.from({ length: NODE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.5) * 0.42,
      radius: 1.4 + Math.random() * 1.9,
      phase: Math.random() * Math.PI * 2,
      energy: 0,
    }));

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const prevW = width || rect.width;
      const prevH = height || rect.height;
      width = rect.width;
      height = rect.height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Keep nodes proportionally distributed on resize
      if (prevW > 0 && prevH > 0) {
        const sx = width / prevW;
        const sy = height / prevH;
        for (const n of nodes) {
          n.x *= sx;
          n.y *= sy;
        }
      }
    };

    resize();
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    observer?.observe(container);

    const startTime = performance.now();

    const drawFrame = (now: number) => {
      const t = (now - startTime) / 1000;
      const mouse = mouseRef.current;
      const ripples = ripplesRef.current;

      // 1. Deep dark-emerald radial backdrop (#071912 center to #030906 edges)
      const bgGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.42,
        Math.min(width, height) * 0.08,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8,
      );
      bgGrad.addColorStop(0, '#091D14');
      bgGrad.addColorStop(0.55, '#05120C');
      bgGrad.addColorStop(1, '#030806');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle cursor aura glow
      if (mouse.active) {
        const cursorGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 190);
        cursorGlow.addColorStop(0, 'rgba(52, 211, 153, 0.14)');
        cursorGlow.addColorStop(0.5, 'rgba(16, 185, 129, 0.04)');
        cursorGlow.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = cursorGlow;
        ctx.fillRect(0, 0, width, height);
      }

      // 2. 5 translucent flowing cortical EEG wave ribbons reacting to cursor
      const waveConfigs = [
        { yFrac: 0.18, freq: 0.008, speed: 1.1, amp: 18, alpha: 0.14, color: '52, 211, 153' },
        { yFrac: 0.34, freq: 0.011, speed: 1.5, amp: 14, alpha: 0.11, color: '110, 231, 183' },
        { yFrac: 0.52, freq: 0.007, speed: 0.9, amp: 22, alpha: 0.12, color: '16, 185, 129' },
        { yFrac: 0.69, freq: 0.013, speed: 1.7, amp: 15, alpha: 0.10, color: '45, 212, 191' },
        { yFrac: 0.84, freq: 0.009, speed: 1.2, amp: 19, alpha: 0.13, color: '52, 211, 153' },
      ];

      const stepX = Math.max(10, Math.floor(width / 96));
      for (let wIdx = 0; wIdx < waveConfigs.length; wIdx++) {
        const w = waveConfigs[wIdx];
        const baseY = height * w.yFrac;
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${w.color}, ${w.alpha})`;
        ctx.lineWidth = 1.25;

        for (let x = 0; x <= width + stepX; x += stepX) {
          const clampedX = Math.min(x, width);
          let cursorBoost = 0;
          if (mouse.active) {
            const dx = clampedX - mouse.x;
            const dy = baseY - mouse.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < 48400) {
              const proximity = 1 - Math.sqrt(distSq) / 220;
              cursorBoost = proximity * 22 * Math.sin(clampedX * 0.045 - t * 6.5);
            }
          }

          const harmonic1 = Math.sin(clampedX * w.freq + t * w.speed + wIdx * 1.1) * w.amp;
          const harmonic2 =
            Math.sin(clampedX * (w.freq * 2.3) - t * (w.speed * 1.6) + wIdx) * (w.amp * 0.38);
          const y = baseY + harmonic1 + harmonic2 + cursorBoost;

          if (x === 0) ctx.moveTo(clampedX, y);
          else ctx.lineTo(clampedX, y);
        }
        ctx.stroke();
      }

      // 3. Update expanding cortical impulse ripples and excite nodes on wavefront
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += 4.2;
        rp.alpha = Math.max(0, 0.85 * (1 - rp.radius / rp.maxRadius));

        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(52, 211, 153, ${rp.alpha * 0.7})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        if (rp.radius > 18) {
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.radius - 14, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(110, 231, 183, ${rp.alpha * 0.28})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        if (rp.radius >= rp.maxRadius || rp.alpha <= 0.01) {
          ripples.splice(i, 1);
        }
      }

      // 4. Update neural nodes + interact with cursor and ripples
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) {
          n.x = 0;
          n.vx *= -1;
        } else if (n.x > width) {
          n.x = width;
          n.vx *= -1;
        }
        if (n.y < 0) {
          n.y = 0;
          n.vy *= -1;
        } else if (n.y > height) {
          n.y = height;
          n.vy *= -1;
        }

        n.energy *= 0.94;

        if (mouse.active) {
          const dx = mouse.x - n.x;
          const dy = mouse.y - n.y;
          const dist = Math.hypot(dx, dy);
          if (dist < CURSOR_LINK_DISTANCE) {
            const strength = 1 - dist / CURSOR_LINK_DISTANCE;
            n.energy = Math.max(n.energy, strength * 0.9);
          }
        }

        for (const rp of ripples) {
          const distToRipple = Math.hypot(n.x - rp.x, n.y - rp.y);
          if (Math.abs(distToRipple - rp.radius) < 26) {
            n.energy = 1;
            const angle = Math.atan2(n.y - rp.y, n.x - rp.x);
            n.x += Math.cos(angle) * 0.45;
            n.y += Math.sin(angle) * 0.45;
          }
        }
      }

      // 5. Draw dynamic axons & travelling action-potential packets
      const linkDistSq = LINK_DISTANCE * LINK_DISTANCE;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < linkDistSq) {
            const dist = Math.sqrt(dSq);
            const ratio = 1 - dist / LINK_DISTANCE;
            const pairEnergy = Math.max(a.energy, b.energy);
            const alpha = ratio * (0.14 + pairEnergy * 0.42);

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle =
              pairEnergy > 0.35
                ? `rgba(110, 231, 183, ${alpha})`
                : `rgba(52, 211, 153, ${alpha})`;
            ctx.lineWidth = pairEnergy > 0.35 ? 1.15 : 0.75;
            ctx.stroke();

            // Action-potential packet travelling along excited or deterministic pairs
            if (pairEnergy > 0.28 || (i + j) % 7 === 0) {
              const travel = ((t * (0.45 + ((i * 3) % 5) * 0.12) + a.phase) % 1 + 1) % 1;
              const px = a.x + dx * travel;
              const py = a.y + dy * travel;
              ctx.beginPath();
              ctx.arc(px, py, pairEnergy > 0.35 ? 1.8 : 1.15, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(167, 243, 208, ${0.25 + pairEnergy * 0.65})`;
              ctx.fill();
            }
          }
        }

        // Draw cursor-to-neuron bright synaptic filaments
        if (mouse.active) {
          const mdx = mouse.x - a.x;
          const mdy = mouse.y - a.y;
          const mDist = Math.hypot(mdx, mdy);
          if (mDist < CURSOR_LINK_DISTANCE) {
            const strength = 1 - mDist / CURSOR_LINK_DISTANCE;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(52, 211, 153, ${strength * 0.48})`;
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
        }
      }

      // 6. Draw glowing neuron somas
      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + n.phase);
        const r = n.radius + n.energy * 1.4;
        const alpha = 0.28 + pulse * 0.25 + n.energy * 0.45;

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(110, 231, 183, ${Math.min(1, alpha)})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(drawFrame);
    };

    rafId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, []);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();

    mouseRef.current.x = x;
    mouseRef.current.y = y;
    mouseRef.current.active = true;

    // Gentle micro-ripple while gliding across the neural canvas
    if (now - mouseRef.current.lastRippleAt > 260) {
      mouseRef.current.lastRippleAt = now;
      ripplesRef.current.push({ x, y, radius: 4, maxRadius: 115, alpha: 0.4 });
      if (ripplesRef.current.length > 18) {
        ripplesRef.current.splice(0, ripplesRef.current.length - 18);
      }
    }
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
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ripplesRef.current.push({ x, y, radius: 4, maxRadius: 260, alpha: 0.85 });
    if (ripplesRef.current.length > 18) {
      ripplesRef.current.splice(0, ripplesRef.current.length - 18);
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#040D09] text-white"
    >
      {/* Fullscreen Interactive Neural Synapse & Cortical EEG Wave Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Subtle vignette overlay matching dark glassmorphic depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/45"
      />

      {/* Top-Right Floating Pill Link */}
      <Link
        to="/"
        className="absolute top-5 right-5 z-50 flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-semibold text-slate-200 backdrop-blur-sm transition-all hover:border-emerald-400/40 hover:bg-black/50 hover:text-white"
      >
        <Home className="size-3.5 text-emerald-400" aria-hidden="true" />
        <span>Trang chủ</span>
      </Link>

      {/* Strictly Centered Single Glassmorphic Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="my-auto w-full max-w-[22rem] sm:max-w-[400px] md:max-w-[420px]">
          {/* Centered Brand Logo & Wordmark */}
          <Link
            to="/"
            className="mb-5 flex select-none items-center justify-center gap-3 sm:mb-6 group"
            aria-label="NeuroLink Trang chủ"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-500/20 shadow-[0_0_24px_rgba(16,185,129,0.35)] backdrop-blur-sm transition-transform group-hover:scale-105">
              <Activity className="size-6 text-emerald-300" aria-hidden="true" />
            </span>
            <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
              neuro<span className="text-emerald-400">link</span>
            </span>
          </Link>

          {/* Dark Glassmorphic Auth Card */}
          <div className="rounded-2xl border border-white/12 bg-black/45 p-5 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:p-6 md:p-8">
            <div className="mb-5 text-center sm:mb-6">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400 sm:text-sm">
                  {subtitle}
                </p>
              )}
            </div>

            <div>{children}</div>

            {footer && (
              <div className="mt-4 text-center text-sm text-slate-400">{footer}</div>
            )}

            <p className="mt-5 border-t border-white/10 pt-3.5 text-center text-[10px] text-slate-500 sm:mt-6 sm:pt-4 sm:text-xs">
              © 2026 NeuroLink Clinical &amp; BCI System. Bảo lưu mọi quyền.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

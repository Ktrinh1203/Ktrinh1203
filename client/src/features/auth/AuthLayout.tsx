import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, Home } from 'lucide-react';

interface NeuralAnchor {
  id: string;
  xFrac: number;
  yFrac: number;
}

interface TelemetryArc {
  from: string;
  to: string;
  bend: number;
  speed: number;
  offset: number;
}

interface MicroNeuron {
  xFrac: number;
  yFrac: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  phase: number;
  energy: number;
  isPyramidal: boolean;
  branchAngles: number[];
}

interface BioRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

const ANCHORS: NeuralAnchor[] = [
  { id: 'grandmother', xFrac: 0.18, yFrac: 0.62 },
  { id: 'cityYouth', xFrac: 0.21, yFrac: 0.28 },
  { id: 'cloudBrain', xFrac: 0.5, yFrac: 0.2 },
  { id: 'doctor', xFrac: 0.79, yFrac: 0.28 },
  { id: 'researcher', xFrac: 0.78, yFrac: 0.66 },
  { id: 'centerHub', xFrac: 0.5, yFrac: 0.54 },
];

const TELEMETRY_ARCS: TelemetryArc[] = [
  { from: 'grandmother', to: 'centerHub', bend: -42, speed: 0.34, offset: 0.1 },
  { from: 'cityYouth', to: 'cloudBrain', bend: -28, speed: 0.4, offset: 0.35 },
  { from: 'cloudBrain', to: 'doctor', bend: -28, speed: 0.38, offset: 0.6 },
  { from: 'centerHub', to: 'researcher', bend: 36, speed: 0.36, offset: 0.22 },
  { from: 'researcher', to: 'doctor', bend: 44, speed: 0.32, offset: 0.75 },
  { from: 'grandmother', to: 'cloudBrain', bend: -55, speed: 0.26, offset: 0.48 },
];

const MICRO_NEURON_COUNT = 18;
const CURSOR_EXCITE_RADIUS = 200;

function seeded(n: number): number {
  const v = Math.sin(n * 91.7 + 193.3) * 43758.5453;
  return v - Math.floor(v);
}

function createMicroNeurons(width: number, height: number): MicroNeuron[] {
  return Array.from({ length: MICRO_NEURON_COUNT }, (_, i) => {
    const t = i / MICRO_NEURON_COUNT;
    // Place micro-neurons along the outer pathways framing the artwork hubs
    const angle = t * Math.PI * 2 + seeded(i + 3) * 0.4;
    const rx = 0.24 + seeded(i + 17) * 0.22;
    const ry = 0.22 + seeded(i + 29) * 0.24;
    const xFrac = Math.min(0.93, Math.max(0.07, 0.5 + Math.cos(angle) * rx));
    const yFrac = Math.min(0.92, Math.max(0.1, 0.48 + Math.sin(angle) * ry));
    const branches = 4 + (i % 3);

    return {
      xFrac,
      yFrac,
      x: xFrac * width,
      y: yFrac * height,
      vx: (seeded(i + 41) - 0.5) * 0.16,
      vy: (seeded(i + 53) - 0.5) * 0.16,
      angle: seeded(i + 61) * Math.PI * 2,
      radius: 4.2 + seeded(i + 71) * 2.2,
      phase: seeded(i + 83) * Math.PI * 2,
      energy: 0,
      isPyramidal: i % 2 === 0,
      branchAngles: Array.from(
        { length: branches },
        (_, b) => (b / branches) * Math.PI * 2 + (seeded(i * 11 + b) - 0.5) * 0.4,
      ),
    };
  });
}

function evalQuad(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  t: number,
) {
  const mt = 1 - t;
  return {
    x: mt * mt * x0 + 2 * mt * t * cx + t * t * x1,
    y: mt * mt * y0 + 2 * mt * t * cy + t * t * y1,
  };
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  width: number,
  height: number,
) {
  const imgRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
  const canvasRatio = width / Math.max(1, height);
  let drawW = width;
  let drawH = height;
  let offsetX = 0;
  let offsetY = 0;

  if (canvasRatio > imgRatio) {
    drawW = width;
    drawH = width / imgRatio;
    offsetY = (height - drawH) * 0.5;
  } else {
    drawH = height;
    drawW = height * imgRatio;
    offsetX = (width - drawW) * 0.5;
  }

  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
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
  const mouseRef = useRef<{ x: number; y: number; active: boolean; lastRippleAt: number }>({
    x: 0,
    y: 0,
    active: false,
    lastRippleAt: 0,
  });
  const ripplesRef = useRef<BioRipple[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    const bgImage = new Image();
    let bgLoaded = false;
    bgImage.onload = () => {
      bgLoaded = true;
    };
    bgImage.src = '/images/neurolink-handdrawn-bg.png?v=2';

    const microNeurons = createMicroNeurons(width, height);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      width = rect.width;
      height = rect.height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (const n of microNeurons) {
        n.x = n.xFrac * width;
        n.y = n.yFrac * height;
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

      // 1. Hand-drawn connected-NeuroLink artwork background (with celadon-teal fallback)
      if (bgLoaded && bgImage.naturalWidth > 0) {
        drawCoverImage(ctx, bgImage, width, height);
      } else {
        const grad = ctx.createRadialGradient(
          width * 0.5,
          height * 0.25,
          40,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.75,
        );
        grad.addColorStop(0, '#4F9E93');
        grad.addColorStop(0.55, '#256B63');
        grad.addColorStop(1, '#144440');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      // Compute pixel positions of the illustration's 6 storytelling anchors
      const anchorMap = new Map<string, { x: number; y: number }>();
      for (const a of ANCHORS) {
        anchorMap.set(a.id, { x: a.xFrac * width, y: a.yFrac * height });
      }

      // 2. Subtle animated ECG/EEG mini-waveform shimmer around top-center Cloud-Brain hub
      const cloudHub = anchorMap.get('cloudBrain');
      if (cloudHub) {
        ctx.save();
        ctx.beginPath();
        const waveW = Math.min(180, width * 0.16);
        const startX = cloudHub.x - waveW * 0.5;
        for (let s = 0; s <= 40; s++) {
          const frac = s / 40;
          const wx = startX + frac * waveW;
          const env = Math.sin(frac * Math.PI);
          const wy =
            cloudHub.y +
            Math.sin(frac * 16 - t * 5.2) * 5.5 * env +
            Math.sin(frac * 32 - t * 8.5) * 2.5 * env;
          if (s === 0) ctx.moveTo(wx, wy);
          else ctx.lineTo(wx, wy);
        }
        ctx.strokeStyle = 'rgba(220, 252, 241, 0.55)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
      }

      // 3. Animated glowing neural telemetry arcs & bio-electric packets
      for (const arc of TELEMETRY_ARCS) {
        const p0 = anchorMap.get(arc.from);
        const p1 = anchorMap.get(arc.to);
        if (!p0 || !p1) continue;

        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;
        const cx = (p0.x + p1.x) * 0.5 + nx * arc.bend;
        const cy = (p0.y + p1.y) * 0.5 + ny * arc.bend;

        // Soft glowing mint arc shimmer
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.quadraticCurveTo(cx, cy, p1.x, p1.y);
        ctx.strokeStyle = 'rgba(167, 243, 208, 0.22)';
        ctx.lineWidth = 1.3;
        ctx.stroke();

        // Streaming bio-electric signal packet (#FFFFFF core + #6EE7B7 & #FEF08A halo)
        const progress = (t * arc.speed + arc.offset) % 1;
        const pt = evalQuad(p0.x, p0.y, cx, cy, p1.x, p1.y, progress);

        const halo = ctx.createRadialGradient(pt.x, pt.y, 1, pt.x, pt.y, 11);
        halo.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
        halo.addColorStop(0.35, 'rgba(254, 240, 138, 0.78)');
        halo.addColorStop(0.7, 'rgba(110, 231, 183, 0.42)');
        halo.addColorStop(1, 'rgba(110, 231, 183, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
      }

      // 4. Concentric glowing mint-cream bio-ripples (on mouse move & click)
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += 3.8;
        rp.alpha = Math.max(0, 0.85 * (1 - rp.radius / rp.maxRadius));

        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(167, 243, 208, ${rp.alpha * 0.55})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        if (rp.radius > 14) {
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.radius - 10, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(254, 249, 195, ${rp.alpha * 0.72})`;
          ctx.lineWidth = 1.15;
          ctx.stroke();
        }

        if (rp.radius >= rp.maxRadius || rp.alpha <= 0.01) {
          ripples.splice(i, 1);
        }
      }

      // 5. Delicate translucent stellate/pyramidal micro-neurons & cursor synaptic filaments
      for (const n of microNeurons) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < width * 0.05 || n.x > width * 0.95) n.vx *= -1;
        if (n.y < height * 0.08 || n.y > height * 0.94) n.vy *= -1;
        n.xFrac = n.x / Math.max(1, width);
        n.yFrac = n.y / Math.max(1, height);

        n.energy *= 0.93;

        if (mouse.active) {
          const dist = Math.hypot(mouse.x - n.x, mouse.y - n.y);
          if (dist < CURSOR_EXCITE_RADIUS) {
            const strength = 1 - dist / CURSOR_EXCITE_RADIUS;
            n.energy = Math.max(n.energy, strength);

            // Fire synaptic filament toward pointer
            const midX = (n.x + mouse.x) * 0.5 + Math.sin(t * 2.5 + n.phase) * 12;
            const midY = (n.y + mouse.y) * 0.5 + Math.cos(t * 2.5 + n.phase) * 12;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.quadraticCurveTo(midX, midY, mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(254, 240, 138, ${strength * 0.58})`;
            ctx.lineWidth = 1.15;
            ctx.stroke();
          }
        }

        for (const rp of ripples) {
          const dRp = Math.hypot(n.x - rp.x, n.y - rp.y);
          if (Math.abs(dRp - rp.radius) < 28) {
            n.energy = 1;
          }
        }

        const baseAlpha = 0.32 + n.energy * 0.58;
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(n.angle + Math.sin(t * 0.5 + n.phase) * 0.08);

        if (n.energy > 0.15) {
          const nGlow = ctx.createRadialGradient(0, 0, 1, 0, 0, n.radius * 3.4);
          nGlow.addColorStop(0, `rgba(254, 240, 138, ${n.energy * 0.55})`);
          nGlow.addColorStop(1, 'rgba(110, 231, 183, 0)');
          ctx.fillStyle = nGlow;
          ctx.beginPath();
          ctx.arc(0, 0, n.radius * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Branching micro-dendrites
        ctx.strokeStyle =
          n.energy > 0.35
            ? `rgba(254, 249, 195, ${baseAlpha})`
            : `rgba(209, 250, 229, ${baseAlpha * 0.85})`;
        ctx.lineWidth = 1.05;
        for (const ba of n.branchAngles) {
          const len = n.radius * (2.3 + n.energy * 0.7);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ba) * len, Math.sin(ba) * len);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(Math.cos(ba) * len, Math.sin(ba) * len, 1.3, 0, Math.PI * 2);
          ctx.fillStyle =
            n.energy > 0.35 ? 'rgba(254, 240, 138, 0.95)' : 'rgba(209, 250, 229, 0.72)';
          ctx.fill();
        }

        // Pyramidal or stellate micro-soma
        ctx.beginPath();
        if (n.isPyramidal) {
          ctx.moveTo(0, -n.radius * 1.25);
          ctx.lineTo(n.radius * 0.95, n.radius * 0.8);
          ctx.lineTo(-n.radius * 0.95, n.radius * 0.8);
          ctx.closePath();
        } else {
          ctx.arc(0, 0, n.radius * 0.82, 0, Math.PI * 2);
        }
        ctx.fillStyle =
          n.energy > 0.35
            ? `rgba(254, 240, 138, ${0.7 + n.energy * 0.25})`
            : `rgba(167, 243, 208, ${0.42 + n.energy * 0.4})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(236, 253, 245, ${0.5 + n.energy * 0.45})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        ctx.restore();
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

    if (now - mouseRef.current.lastRippleAt > 260) {
      mouseRef.current.lastRippleAt = now;
      ripplesRef.current.push({ x, y, radius: 6, maxRadius: 115, alpha: 0.42 });
      if (ripplesRef.current.length > 16) {
        ripplesRef.current.splice(0, ripplesRef.current.length - 16);
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

    ripplesRef.current.push({ x, y, radius: 6, maxRadius: 260, alpha: 0.88 });
    if (ripplesRef.current.length > 16) {
      ripplesRef.current.splice(0, ripplesRef.current.length - 16);
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#1D5C54]"
    >
      {/* Fullscreen Hand-Drawn Connected-NeuroLink Artwork + Live Interactive Neural Arcs Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Top-Left Compact Sticker-Outlined NeuroLink Wordmark (leaves top-center Cloud-Brain open) */}
      <Link
        to="/"
        className="absolute top-5 left-5 z-50 flex select-none items-center gap-2 group"
        aria-label="NeuroLink Trang chủ"
      >
        <span className="flex size-9 items-center justify-center rounded-xl border-2 border-white bg-[#154A45] shadow-md transition-transform group-hover:scale-105">
          <Activity className="size-4 text-[#80F0D6]" aria-hidden="true" />
        </span>
        <span className="text-xl sm:text-2xl font-black tracking-tight drop-shadow-md [paint-order:stroke_fill] [-webkit-text-stroke:6px_white]">
          <span className="text-[#12423D]">neuro</span>
          <span className="text-[#1B8A76]">link</span>
        </span>
      </Link>

      {/* Top-Right Floating Pill Link */}
      <Link
        to="/"
        className="absolute top-5 right-5 z-50 flex items-center gap-1.5 rounded-lg border border-white/35 bg-[#12423D]/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:border-white/60 hover:bg-[#12423D]/80"
      >
        <Home className="size-3.5 text-[#80F0D6]" aria-hidden="true" />
        <span>Trang chủ</span>
      </Link>

      {/* Centered Frosted Mint-Glass Card Positioned Cleanly Below Top-Center Cloud-Brain Hub */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="my-auto mt-20 w-full max-w-[22rem] sm:mt-24 sm:max-w-[400px] md:max-w-[420px]">
          <div className="rounded-[28px] border-2 border-white/65 bg-[#CBE8E2]/82 p-5 text-[#0F3834] shadow-[0_24px_60px_rgba(7,38,35,0.38)] backdrop-blur-md sm:p-7">
            <div className="mb-5 text-center sm:mb-6">
              <h1 className="text-xl font-bold tracking-tight text-[#0F3834] sm:text-2xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-xs leading-relaxed text-[#1E5650]/85 sm:text-sm">
                  {subtitle}
                </p>
              )}
            </div>

            <div>{children}</div>

            {footer && (
              <div className="mt-4 text-center text-sm text-[#1E5650]">{footer}</div>
            )}

            <p className="mt-4 border-t border-[#1E5650]/15 pt-3 text-center text-[11px] text-[#1E5650]/75">
              © 2026 NeuroLink Clinical &amp; BCI System. Bảo lưu mọi quyền.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

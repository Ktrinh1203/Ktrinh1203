import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Activity, Home } from 'lucide-react';

type NeuronMorphology = 'pyramidal' | 'multipolar' | 'bipolar' | 'purkinje';

interface SubBranch {
  cpX: number;
  cpY: number;
  endX: number;
  endY: number;
  spineRadius: number;
}

interface DendriteBranch {
  cpX: number;
  cpY: number;
  endX: number;
  endY: number;
  subBranches: SubBranch[];
}

interface BioNeuron {
  id: number;
  xFrac: number;
  yFrac: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  morphology: NeuronMorphology;
  angle: number;
  rotSpeed: number;
  somaRadius: number;
  phase: number;
  energy: number;
  dendrites: DendriteBranch[];
  axonDirAngle: number;
}

interface AxonConnection {
  fromIdx: number;
  toIdx: number;
  curveBend: number;
  sheathCount: number;
  pulseOffset: number;
  pulseSpeed: number;
}

interface SurfaceRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

const NEURON_COUNT = 28;
const AXON_MAX_DISTANCE = 240;
const CURSOR_EXCITE_RADIUS = 220;

const MORPHOLOGIES: NeuronMorphology[] = ['pyramidal', 'multipolar', 'bipolar', 'purkinje'];

/** Deterministic PRNG so neuron trees look organic yet consistent without allocation jitter. */
function seededVal(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/** Generate non-center-cluttering initial coordinates framing the central card + gently entering behind it. */
function pickFramingPosition(idx: number): { xFrac: number; yFrac: number } {
  const angle = (idx / NEURON_COUNT) * Math.PI * 2 + seededVal(idx + 3) * 0.38;
  // Bias toward perimeter and mid-ring while allowing 1 in 5 to drift behind the translucent card
  const isInner = idx % 5 === 0;
  const rx = isInner ? 0.16 + seededVal(idx + 17) * 0.22 : 0.28 + seededVal(idx + 17) * 0.21;
  const ry = isInner ? 0.18 + seededVal(idx + 29) * 0.24 : 0.27 + seededVal(idx + 29) * 0.22;
  const xFrac = Math.min(0.95, Math.max(0.05, 0.5 + Math.cos(angle) * rx));
  const yFrac = Math.min(0.94, Math.max(0.06, 0.5 + Math.sin(angle) * ry));
  return { xFrac, yFrac };
}

function createDendrites(id: number, morphology: NeuronMorphology, somaRadius: number): DendriteBranch[] {
  const branches: DendriteBranch[] = [];
  const count =
    morphology === 'purkinje' ? 7 : morphology === 'multipolar' ? 6 : morphology === 'bipolar' ? 5 : 6;

  for (let b = 0; b < count; b++) {
    const seed = id * 31 + b * 7;
    let baseAngle: number;
    if (morphology === 'purkinje') {
      // Fan-shaped dendritic crown on upper hemisphere
      baseAngle = -Math.PI * 0.85 + (b / Math.max(1, count - 1)) * (Math.PI * 0.7);
    } else if (morphology === 'bipolar') {
      // Opposite poles clustered
      const pole = b < 3 ? 0 : Math.PI;
      const spread = (b % 3 - 1) * 0.42;
      baseAngle = pole + spread;
    } else if (morphology === 'pyramidal' && b === 0) {
      // Long apical dendrite pointing upward
      baseAngle = -Math.PI / 2;
    } else {
      baseAngle = (b / count) * Math.PI * 2 + (seededVal(seed) - 0.5) * 0.35;
    }

    const lenScale = morphology === 'pyramidal' && b === 0 ? 3.5 : morphology === 'purkinje' ? 2.8 : 2.3;
    const len = somaRadius * (lenScale + seededVal(seed + 1) * 0.9);
    const bend = (seededVal(seed + 2) - 0.5) * 0.45;

    const cpX = Math.cos(baseAngle + bend) * (len * 0.55);
    const cpY = Math.sin(baseAngle + bend) * (len * 0.55);
    const endX = Math.cos(baseAngle) * len;
    const endY = Math.sin(baseAngle) * len;

    const subBranches: SubBranch[] = [];
    for (let s = 0; s < 2; s++) {
      const subAngle = baseAngle + (s === 0 ? -0.45 : 0.45) + (seededVal(seed + 4 + s) - 0.5) * 0.2;
      const subLen = len * (0.42 + seededVal(seed + 6 + s) * 0.25);
      subBranches.push({
        cpX: endX + Math.cos(subAngle - 0.15) * (subLen * 0.5),
        cpY: endY + Math.sin(subAngle - 0.15) * (subLen * 0.5),
        endX: endX + Math.cos(subAngle) * subLen,
        endY: endY + Math.sin(subAngle) * subLen,
        spineRadius: 1.5 + seededVal(seed + 8 + s) * 1.1,
      });
    }

    branches.push({ cpX, cpY, endX, endY, subBranches });
  }

  return branches;
}

function buildNeurons(width: number, height: number): BioNeuron[] {
  return Array.from({ length: NEURON_COUNT }, (_, id) => {
    const morphology = MORPHOLOGIES[id % MORPHOLOGIES.length];
    const somaRadius = 6.8 + seededVal(id + 11) * 3.4;
    const { xFrac, yFrac } = pickFramingPosition(id);
    const angle = (seededVal(id + 5) - 0.5) * 0.9;

    return {
      id,
      xFrac,
      yFrac,
      x: xFrac * width,
      y: yFrac * height,
      vx: (seededVal(id + 41) - 0.5) * 0.22,
      vy: (seededVal(id + 53) - 0.5) * 0.22,
      morphology,
      angle,
      rotSpeed: (seededVal(id + 67) - 0.5) * 0.0012,
      somaRadius,
      phase: seededVal(id + 79) * Math.PI * 2,
      energy: 0,
      dendrites: createDendrites(id, morphology, somaRadius),
      axonDirAngle: morphology === 'purkinje' || morphology === 'pyramidal' ? Math.PI / 2 : angle + Math.PI,
    };
  });
}

function buildAxonGraph(neurons: BioNeuron[]): AxonConnection[] {
  const links: AxonConnection[] = [];
  const maxDistSq = AXON_MAX_DISTANCE * AXON_MAX_DISTANCE;

  for (let i = 0; i < neurons.length; i++) {
    let added = 0;
    for (let j = i + 1; j < neurons.length; j++) {
      const dx = neurons[j].x - neurons[i].x;
      const dy = neurons[j].y - neurons[i].y;
      const dSq = dx * dx + dy * dy;
      if (dSq < maxDistSq && dSq > 4200 && added < 3) {
        links.push({
          fromIdx: i,
          toIdx: j,
          curveBend: ((i + j) % 2 === 0 ? 1 : -1) * (18 + seededVal(i * 19 + j) * 26),
          sheathCount: 4 + ((i + j) % 3),
          pulseOffset: seededVal(i * 37 + j * 13),
          pulseSpeed: 0.28 + seededVal(i * 23 + j) * 0.24,
        });
        added++;
      }
    }
  }
  return links;
}

/** Evaluate point & tangent on quadratic Bezier P0 -> P1 -> P2 at parameter t in [0, 1]. */
function evalQuadBezier(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  t: number,
) {
  const mt = 1 - t;
  const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
  const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
  const tx = 2 * mt * (cx - x0) + 2 * t * (x1 - cx);
  const ty = 2 * mt * (cy - y0) + 2 * t * (y1 - cy);
  return { x, y, angle: Math.atan2(ty, tx) };
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

function drawSomaShape(ctx: CanvasRenderingContext2D, morphology: NeuronMorphology, r: number) {
  ctx.beginPath();
  if (morphology === 'pyramidal') {
    // Classic cortical pyramidal pear/triangle soma
    ctx.moveTo(0, -r * 1.45);
    ctx.quadraticCurveTo(r * 0.95, -r * 0.2, r * 1.05, r * 0.72);
    ctx.quadraticCurveTo(0, r * 1.08, -r * 1.05, r * 0.72);
    ctx.quadraticCurveTo(-r * 0.95, -r * 0.2, 0, -r * 1.45);
  } else if (morphology === 'bipolar') {
    // Elongated spindle soma
    ctx.moveTo(-r * 1.45, 0);
    ctx.quadraticCurveTo(0, -r * 0.92, r * 1.45, 0);
    ctx.quadraticCurveTo(0, r * 0.92, -r * 1.45, 0);
  } else if (morphology === 'purkinje') {
    // Flask-shaped Purkinje soma
    ctx.moveTo(0, -r * 1.25);
    ctx.bezierCurveTo(r * 1.2, -r * 0.9, r * 1.15, r * 0.9, 0, r * 1.05);
    ctx.bezierCurveTo(-r * 1.15, r * 0.9, -r * 1.2, -r * 0.9, 0, -r * 1.25);
  } else {
    // Star-shaped multipolar soma with concave edges
    const pts = 6;
    for (let i = 0; i < pts; i++) {
      const a1 = (i / pts) * Math.PI * 2;
      const aMid = ((i + 0.5) / pts) * Math.PI * 2;
      const a2 = ((i + 1) / pts) * Math.PI * 2;
      const x1 = Math.cos(a1) * r * 1.2;
      const y1 = Math.sin(a1) * r * 1.2;
      const xm = Math.cos(aMid) * r * 0.68;
      const ym = Math.sin(aMid) * r * 0.68;
      const x2 = Math.cos(a2) * r * 1.2;
      const y2 = Math.sin(a2) * r * 1.2;
      if (i === 0) ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(xm, ym, x2, y2);
    }
  }
  ctx.closePath();
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
  const ripplesRef = useRef<SurfaceRipple[]>([]);

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
    bgImage.src = '/images/neurolink-handdrawn-bg.png';

    const neurons = buildNeurons(width, height);
    let axons = buildAxonGraph(neurons);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      width = rect.width;
      height = rect.height;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (const n of neurons) {
        n.x = n.xFrac * width;
        n.y = n.yFrac * height;
      }
      axons = buildAxonGraph(neurons);
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

      // 1. Bright Hand-Drawn Watercolor Background (image + fallback gradient)
      if (bgLoaded && bgImage.naturalWidth > 0) {
        drawCoverImage(ctx, bgImage, width, height);
      } else {
        const fallbackGrad = ctx.createLinearGradient(0, 0, width, height);
        fallbackGrad.addColorStop(0, '#CBE3DC');
        fallbackGrad.addColorStop(0.5, '#9BC3BB');
        fallbackGrad.addColorStop(1, '#76A89F');
        ctx.fillStyle = fallbackGrad;
        ctx.fillRect(0, 0, width, height);
      }

      // Subtle harmonizing tint to keep ink-drawn biological neurons cohesive
      ctx.fillStyle = 'rgba(22, 52, 45, 0.14)';
      ctx.fillRect(0, 0, width, height);

      // 2. Update surface ripples and excite neurons as wavefront passes
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.radius += 3.8;
        rp.alpha = Math.max(0, 0.85 * (1 - rp.radius / rp.maxRadius));

        // Double concentric hand-drawn ink + warm cream-mint surface ripple
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(29, 78, 69, ${rp.alpha * 0.45})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        if (rp.radius > 12) {
          ctx.beginPath();
          ctx.arc(rp.x, rp.y, rp.radius - 10, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(247, 244, 233, ${rp.alpha * 0.7})`;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }

        if (rp.radius >= rp.maxRadius || rp.alpha <= 0.01) {
          ripples.splice(i, 1);
        }
      }

      // 3. Gently drift biological neurons & respond to cursor/ripples
      for (const n of neurons) {
        n.x += n.vx;
        n.y += n.vy;
        n.angle += n.rotSpeed;

        if (n.x < width * 0.04 || n.x > width * 0.96) n.vx *= -1;
        if (n.y < height * 0.05 || n.y > height * 0.95) n.vy *= -1;
        n.xFrac = n.x / Math.max(1, width);
        n.yFrac = n.y / Math.max(1, height);

        n.energy *= 0.94;

        if (mouse.active) {
          const dist = Math.hypot(mouse.x - n.x, mouse.y - n.y);
          if (dist < CURSOR_EXCITE_RADIUS) {
            const strength = 1 - dist / CURSOR_EXCITE_RADIUS;
            n.energy = Math.max(n.energy, strength * 0.95);
          }
        }

        for (const rp of ripples) {
          const distToRipple = Math.hypot(n.x - rp.x, n.y - rp.y);
          if (Math.abs(distToRipple - rp.radius) < 28) {
            n.energy = 1;
          }
        }
      }

      // 4. Draw Curved Myelinated Axons, Nodes of Ranvier, Terminal Boutons & Saltatory Pulses
      for (const link of axons) {
        const a = neurons[link.fromIdx];
        const b = neurons[link.toIdx];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) continue;

        const nx = -dy / dist;
        const ny = dx / dist;
        const cx = (a.x + b.x) * 0.5 + nx * link.curveBend;
        const cy = (a.y + b.y) * 0.5 + ny * link.curveBend;

        // Target stops slightly before soma center (synaptic cleft at dendritic arbor)
        const targetPos = evalQuadBezier(a.x, a.y, cx, cy, b.x, b.y, 0.87);
        const startPos = evalQuadBezier(a.x, a.y, cx, cy, b.x, b.y, 0.08);
        const pairEnergy = Math.max(a.energy, b.energy);

        // Axon core ink fiber + inner glow
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.quadraticCurveTo(cx, cy, targetPos.x, targetPos.y);
        ctx.strokeStyle =
          pairEnergy > 0.35 ? 'rgba(20, 62, 54, 0.72)' : 'rgba(29, 78, 69, 0.42)';
        ctx.lineWidth = 1.6 + pairEnergy * 0.8;
        ctx.stroke();

        // Segmented Myelin Sheath Capsules with Nodes of Ranvier gaps
        const sheathCount = link.sheathCount;
        const spanStart = 0.14;
        const spanEnd = 0.81;
        const step = (spanEnd - spanStart) / sheathCount;

        for (let s = 0; s < sheathCount; s++) {
          const tMid = spanStart + (s + 0.5) * step;
          const pt = evalQuadBezier(a.x, a.y, cx, cy, b.x, b.y, tMid);
          const capLen = Math.max(8, (dist * step * 0.72) / 2);

          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(pt.angle);

          ctx.beginPath();
          ctx.roundRect(-capLen, -3.1, capLen * 2, 6.2, 3.1);
          ctx.fillStyle =
            pairEnergy > 0.35 ? 'rgba(247, 244, 233, 0.82)' : 'rgba(218, 241, 234, 0.62)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(24, 66, 58, 0.65)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.restore();
        }

        // Branching Axon Terminal Boutons (3 synaptic bulbs near dendritic cleft)
        const boutAngles = [-0.42, 0, 0.42];
        for (const ba of boutAngles) {
          const bAngle = targetPos.angle + ba;
          const bx = targetPos.x + Math.cos(bAngle) * 10;
          const by = targetPos.y + Math.sin(bAngle) * 10;

          ctx.beginPath();
          ctx.moveTo(targetPos.x, targetPos.y);
          ctx.lineTo(bx, by);
          ctx.strokeStyle = 'rgba(29, 78, 69, 0.58)';
          ctx.lineWidth = 1.1;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(bx, by, 2.3 + pairEnergy * 1.1, 0, Math.PI * 2);
          ctx.fillStyle =
            pairEnergy > 0.35
              ? `rgba(254, 240, 138, ${0.75 + pairEnergy * 0.25})`
              : 'rgba(167, 243, 208, 0.72)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(24, 66, 58, 0.7)';
          ctx.lineWidth = 0.85;
          ctx.stroke();
        }

        // Saltatory Action Potential hopping Node of Ranvier -> Node of Ranvier
        const speedBoost = 1 + pairEnergy * 2.1;
        const rawProgress = (t * link.pulseSpeed * speedBoost + link.pulseOffset) % 1;
        const tPulse = spanStart + rawProgress * (spanEnd - spanStart + 0.08);

        if (tPulse <= spanEnd + 0.04) {
          const pulsePt = evalQuadBezier(a.x, a.y, cx, cy, b.x, b.y, Math.min(0.87, tPulse));
          const glowR = 5.5 + pairEnergy * 4.5;
          const pGrad = ctx.createRadialGradient(
            pulsePt.x,
            pulsePt.y,
            0.5,
            pulsePt.x,
            pulsePt.y,
            glowR,
          );
          pGrad.addColorStop(0, 'rgba(254, 249, 195, 0.98)');
          pGrad.addColorStop(0.5, 'rgba(167, 243, 208, 0.75)');
          pGrad.addColorStop(1, 'rgba(167, 243, 208, 0)');
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(pulsePt.x, pulsePt.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Neurotransmitter vesicle burst at synaptic cleft!
          const burstFrac = (tPulse - (spanEnd + 0.04)) / 0.08;
          for (let v = 0; v < 3; v++) {
            const va = targetPos.angle + (v - 1) * 0.55;
            const vd = 10 + burstFrac * 12;
            const vx = targetPos.x + Math.cos(va) * vd;
            const vy = targetPos.y + Math.sin(va) * vd;
            ctx.beginPath();
            ctx.arc(vx, vy, 1.8 * (1 - burstFrac * 0.4), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(254, 240, 138, ${Math.max(0, 0.9 - burstFrac)})`;
            ctx.fill();
          }
        }
      }

      // 5. Cursor delicate branching dendritic filaments connecting excited neurons to cursor
      if (mouse.active) {
        for (const n of neurons) {
          const dist = Math.hypot(mouse.x - n.x, mouse.y - n.y);
          if (dist < CURSOR_EXCITE_RADIUS) {
            const strength = 1 - dist / CURSOR_EXCITE_RADIUS;
            const midX = (n.x + mouse.x) * 0.5 + Math.sin(t * 2 + n.phase) * 14;
            const midY = (n.y + mouse.y) * 0.5 + Math.cos(t * 2 + n.phase) * 14;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.quadraticCurveTo(midX, midY, mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(254, 240, 138, ${strength * 0.55})`;
            ctx.lineWidth = 1.25;
            ctx.stroke();
          }
        }
      }

      // 6. Draw 28 Detailed Biological Neurons (Dendritic Trees, Spines, Organic Somas, Nuclei)
      for (const n of neurons) {
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.rotate(n.angle);

        const inkAlpha = 0.62 + n.energy * 0.35;

        // Aura when excited by cursor/ripple
        if (n.energy > 0.12) {
          const eGrad = ctx.createRadialGradient(0, 0, n.somaRadius * 0.4, 0, 0, n.somaRadius * 3.4);
          eGrad.addColorStop(0, `rgba(254, 240, 138, ${n.energy * 0.45})`);
          eGrad.addColorStop(1, 'rgba(167, 243, 208, 0)');
          ctx.fillStyle = eGrad;
          ctx.beginPath();
          ctx.arc(0, 0, n.somaRadius * 3.4, 0, Math.PI * 2);
          ctx.fill();
        }

        // Branching primary & secondary dendritic arbors + terminal spine buds
        ctx.strokeStyle = `rgba(24, 68, 59, ${inkAlpha})`;
        for (const d of n.dendrites) {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.quadraticCurveTo(d.cpX, d.cpY, d.endX, d.endY);
          ctx.lineWidth = 1.65;
          ctx.stroke();

          for (const sub of d.subBranches) {
            ctx.beginPath();
            ctx.moveTo(d.endX, d.endY);
            ctx.quadraticCurveTo(sub.cpX, sub.cpY, sub.endX, sub.endY);
            ctx.lineWidth = 1.05;
            ctx.stroke();

            // Dendritic spine tip
            ctx.beginPath();
            ctx.arc(sub.endX, sub.endY, sub.spineRadius, 0, Math.PI * 2);
            ctx.fillStyle =
              n.energy > 0.35 ? 'rgba(254, 240, 138, 0.9)' : 'rgba(210, 244, 232, 0.8)';
            ctx.fill();
            ctx.strokeStyle = `rgba(24, 68, 59, ${inkAlpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }

        // Hand-drawn organic soma body
        drawSomaShape(ctx, n.morphology, n.somaRadius);
        ctx.fillStyle =
          n.energy > 0.35 ? 'rgba(167, 243, 208, 0.92)' : 'rgba(138, 214, 195, 0.85)';
        ctx.fill();
        ctx.strokeStyle = `rgba(20, 58, 50, ${0.78 + n.energy * 0.22})`;
        ctx.lineWidth = 1.45;
        ctx.stroke();

        // Inner cell nucleus
        ctx.beginPath();
        ctx.arc(0, 0, n.somaRadius * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = n.energy > 0.35 ? '#FEF08A' : '#F7F4E9';
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 58, 50, 0.75)';
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

    if (now - mouseRef.current.lastRippleAt > 240) {
      mouseRef.current.lastRippleAt = now;
      ripplesRef.current.push({ x, y, radius: 6, maxRadius: 125, alpha: 0.42 });
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

    ripplesRef.current.push({ x, y, radius: 6, maxRadius: 270, alpha: 0.88 });
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
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#9BC3BB] text-white"
    >
      {/* Fullscreen Hand-Drawn Storytelling Background + Interactive Biological Neurons Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Top-Right Floating Pill Link */}
      <Link
        to="/"
        className="absolute top-5 right-5 z-50 flex items-center gap-1.5 rounded-lg border border-white/25 bg-[#1D352F]/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition-all hover:border-white/45 hover:bg-[#1D352F]/75"
      >
        <Home className="size-3.5 text-[#7CE0CC]" aria-hidden="true" />
        <span>Trang chủ</span>
      </Link>

      {/* Strictly Centered Single Translucent Sage-Glass Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="my-auto w-full max-w-[22rem] sm:max-w-[400px] md:max-w-[420px]">
          {/* Sticker-Style White-Outlined NeuroLink Logo */}
          <Link
            to="/"
            className="mb-5 flex select-none items-center justify-center gap-2.5 sm:mb-6 group"
            aria-label="NeuroLink Trang chủ"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl border-4 border-white bg-[#1E3A34] shadow-md transition-transform group-hover:scale-105">
              <Activity className="size-5 text-[#7CE0CC]" aria-hidden="true" />
            </span>
            <span className="text-3xl sm:text-4xl font-black tracking-tight drop-shadow-md [paint-order:stroke_fill] [-webkit-text-stroke:8px_white]">
              <span className="text-[#1E3A34]">neuro</span>
              <span className="text-[#38A392]">link</span>
            </span>
          </Link>

          {/* Translucent Sage-Glass Auth Card */}
          <div className="rounded-2xl border border-white/25 bg-[#1D352F]/68 p-5 shadow-[0_20px_50px_rgba(10,32,27,0.32)] backdrop-blur-md sm:rounded-3xl sm:p-6 md:p-8">
            <div className="mb-5 text-center sm:mb-6">
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl md:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1.5 text-xs leading-relaxed text-white/75 sm:text-sm">
                  {subtitle}
                </p>
              )}
            </div>

            <div>{children}</div>

            {footer && (
              <div className="mt-4 text-center text-sm text-white/80">{footer}</div>
            )}

            <p className="mt-5 border-t border-white/15 pt-3.5 text-center text-[10px] text-white/65 sm:mt-6 sm:pt-4 sm:text-xs">
              © 2026 NeuroLink Clinical &amp; BCI System. Bảo lưu mọi quyền.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

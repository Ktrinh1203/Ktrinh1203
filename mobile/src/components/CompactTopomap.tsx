import { useEffect, useMemo, useRef, useState } from 'react';
import type { QeegTopomapNode } from '../api/types';

function intensityToRgb(t: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, t));
  if (c < 0.35) {
    const f = c / 0.35;
    return [Math.round(22 + (16 - 22) * f), Math.round(163 + (185 - 163) * f), Math.round(74 + (129 - 74) * f)];
  }
  if (c < 0.68) {
    const f = (c - 0.35) / 0.33;
    return [Math.round(16 + (245 - 16) * f), Math.round(185 + (158 - 185) * f), Math.round(129 + (11 - 129) * f)];
  }
  const f = (c - 0.68) / 0.32;
  return [Math.round(245 + (220 - 245) * f), Math.round(158 + (38 - 158) * f), Math.round(11 + (38 - 11) * f)];
}

export function CompactTopomap({
  nodes,
  plainLanguage = false,
}: {
  nodes: QeegTopomapNode[];
  plainLanguage?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const size = 188;
  const cx = 94;
  const cy = 98;
  const headR = 68;

  const normalized = useMemo(() => {
    const maxAbs = Math.max(...nodes.map((n) => Math.max(Math.abs(n.x), Math.abs(n.y))), 1);
    const scale = maxAbs > 1.05 ? 1 / maxAbs : 1;
    return nodes.map((n) => ({
      ...n,
      sx: cx + n.x * scale * headR * 0.84,
      sy: cy - n.y * scale * headR * 0.84,
      intensity: Math.max(0, Math.min(1, (n.value - 0.08) / 0.7)),
    }));
  }, [nodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || normalized.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        if (dist > headR) continue;
        let wSum = 0;
        let vSum = 0;
        for (const n of normalized) {
          const d2 = (x - n.sx) ** 2 + (y - n.sy) ** 2 + 120;
          const w = 1 / (d2 * d2);
          wSum += w;
          vSum += w * n.intensity;
        }
        const [r, g, b] = intensityToRgb(vSum / Math.max(wSum, 1e-9));
        const idx = (y * size + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = dist > headR - 2 ? 150 : 215;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [normalized]);

  const physicalNodes = useMemo(() => normalized.filter((n) => n.isPhysical), [normalized]);
  const active =
    physicalNodes.find((n) => n.name === selected) ?? physicalNodes[0] ?? normalized[0];

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[#DCE6DF] bg-white p-3.5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} width={size} height={size} className="block rounded-full" />
        <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full">
          {/* Nose triangle & head contour */}
          <text
            x={cx}
            y={12}
            textAnchor="middle"
            fontSize="7.5"
            fontWeight="700"
            letterSpacing="0.06em"
            fill="#5B6860"
          >
            {plainLanguage ? 'PHÍA TRƯỚC' : 'NASION'}
          </text>
          <path d={`M${cx - 8} ${cy - headR + 2} L${cx} ${cy - headR - 11} L${cx + 8} ${cy - headR + 2}`} fill="none" stroke="#1F2937" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={headR} fill="none" stroke="#1F2937" strokeWidth="1.5" />
          {normalized.filter((n) => n.isPhysical).map((n) => {
            const isSel = active?.name === n.name;
            return (
              <g
                key={n.name}
                onClick={() => setSelected(n.name)}
                role="button"
                tabIndex={0}
                aria-label={`Điện cực ${n.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(n.name);
                  }
                }}
                className="cursor-pointer outline-none focus:outline-none focus-visible:outline-none"
                style={{ outline: 'none' }}
              >
                <circle cx={n.sx} cy={n.sy} r={18} fill="transparent" />
                {isSel && (
                  <circle
                    cx={n.sx}
                    cy={n.sy}
                    r={14}
                    fill="none"
                    stroke="rgba(17,24,39,0.28)"
                    strokeWidth={1.5}
                  />
                )}
                <circle
                  cx={n.sx}
                  cy={n.sy}
                  r={isSel ? 11 : 9}
                  fill={isSel ? '#111827' : 'rgba(255,255,255,0.92)'}
                  stroke="#111827"
                  strokeWidth={isSel ? 1.8 : 1}
                />
                <text
                  x={n.sx}
                  y={n.sy + 3}
                  textAnchor="middle"
                  fontSize="7.5"
                  fontWeight="700"
                  fontFamily="JetBrains Mono, monospace"
                  fill={isSel ? '#FFFFFF' : '#111827'}
                >
                  {n.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {active && (
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-mono text-base font-bold text-[#111827]">{active.name}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[#5B6860]">{plainLanguage ? 'Sóng chậm' : 'DAR'}</span>
              <span className="font-mono font-semibold text-[#111827] tabular-nums">
                {active.dar.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#5B6860]">{plainLanguage ? 'Ngủ sâu' : 'Delta'}</span>
              <span className="font-mono font-semibold text-[#111827] tabular-nums">
                {(active.value * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <p className="text-[11px] text-[#5B6860]">
            {plainLanguage ? 'Chạm điểm đo để xem' : 'Chạm điện cực để soi'}
          </p>
        </div>
      )}
    </div>
  );
}

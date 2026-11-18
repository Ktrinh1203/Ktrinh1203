import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import type { HealthCheckInItem } from '../../api/types';
import { cn } from '../../components/ui';

export interface PhysiologicalTrendChartProps {
  checkIns: HealthCheckInItem[];
  isProfessional?: boolean;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

export function PhysiologicalTrendChart({
  checkIns,
  isProfessional = false,
}: PhysiologicalTrendChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Sort chronologically oldest -> newest for trend line
  const ordered = useMemo(() => {
    return [...checkIns]
      .sort((a, b) => new Date(a.recordedDate).getTime() - new Date(b.recordedDate).getTime())
      .slice(-14);
  }, [checkIns]);

  const activeIdx =
    selectedIndex !== null && selectedIndex < ordered.length
      ? selectedIndex
      : ordered.length > 0
        ? ordered.length - 1
        : null;
  const activeItem = activeIdx !== null ? ordered[activeIdx] ?? null : null;

  if (ordered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center text-xs text-slate-500">
        Chưa có dữ liệu nhật ký sinh lý nhiều ngày. Hãy ghi nhận lần kiểm tra đầu tiên ở biểu mẫu bên dưới để xem biểu đồ xu hướng.
      </div>
    );
  }

  const w = 720;
  const padL = 44;
  const padR = 24;
  const plotW = w - padL - padR;
  const topH = 140;
  const botH = 140;

  const xAt = (idx: number) =>
    ordered.length === 1 ? padL + plotW / 2 : padL + (idx / (ordered.length - 1)) * plotW;

  // Top panel: Focus Score (0..100) and Sleep Hours (0..10 mapped to 0..100)
  const yFocus = (score: number) => 16 + (1 - Math.max(0, Math.min(100, score)) / 100) * (topH - 32);
  const ySleep = (hrs: number) => 16 + (1 - Math.max(0, Math.min(10, hrs)) / 10) * (topH - 32);

  // Bottom panel: TAR (0..3.5) and BSI (0..0.35 mapped identically so 1.5 TAR & 0.15 BSI align cleanly!)
  const maxTar = Math.max(3.2, ...ordered.map((d) => d.fatigueIndexTar * 1.15));
  const maxBsi = Math.max(0.32, ...ordered.map((d) => d.hemisphericBsi * 1.15));
  const yTar = (tar: number) => 16 + (1 - Math.max(0, Math.min(maxTar, tar)) / maxTar) * (botH - 32);
  const yBsi = (bsi: number) => 16 + (1 - Math.max(0, Math.min(maxBsi, bsi)) / maxBsi) * (botH - 32);

  const buildPath = (pts: [number, number][]) =>
    pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const focusPath = buildPath(ordered.map((d, i) => [xAt(i), yFocus(d.focusScore)]));
  const sleepPath = buildPath(ordered.map((d, i) => [xAt(i), ySleep(d.sleepHours)]));
  const tarPath = buildPath(ordered.map((d, i) => [xAt(i), yTar(d.fatigueIndexTar)]));
  const bsiPath = buildPath(ordered.map((d, i) => [xAt(i), yBsi(d.hemisphericBsi)]));

  const tarThresholdY = yTar(1.5);
  const bsiThresholdY = yBsi(0.15);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Activity
            className={cn('size-4', isProfessional ? 'text-[#1E3A5F]' : 'text-teal-700')}
            aria-hidden
          />
          <h3 className="text-sm font-bold text-slate-900">
            {isProfessional
              ? `Biểu đồ Xu hướng Sinh lý Thần kinh Đa ngày (${ordered.length} ngày gần nhất)`
              : `Xu hướng 7 ngày (${ordered.length} ngày)`}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
          <span className="inline-flex items-center gap-1.5 text-teal-800">
            <span className="inline-block w-3 h-0.5 bg-teal-600" />{' '}
            {isProfessional ? 'Điểm Tập trung (0–100)' : 'Độ tỉnh táo (0–100)'}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sky-800">
            <span className="inline-block w-3 h-0.5 bg-sky-600" /> Giờ ngủ (giờ)
          </span>
          {isProfessional && (
            <>
              <span className="inline-flex items-center gap-1.5 text-amber-800">
                <span className="inline-block w-3 h-0.5 bg-amber-600" /> Mệt mỏi TAR
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-800">
                <span className="inline-block w-3 h-0.5 bg-rose-600" /> Đối xứng BSI
              </span>
            </>
          )}
        </div>
      </div>

      {/* Panel 1: Focus Score & Sleep Hours */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
        {isProfessional && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
            <span>Nhóm 1: Hiệu suất Tập trung (Focus) &amp; Thời lượng Giấc ngủ</span>
            <span className="font-mono text-slate-400">Di chuột hoặc chạm vào điểm để xem chi tiết</span>
          </div>
        )}
        <div
          tabIndex={0}
          role="region"
          aria-label="Biểu đồ xu hướng điểm tập trung và giờ ngủ"
          className="overflow-x-auto"
        >
          <svg viewBox={`0 0 ${w} ${topH + 22}`} className="w-full min-w-[520px] h-auto block select-none">
            {[0, 25, 50, 75, 100].map((v) => {
              const y = yFocus(v);
              return (
                <g key={`fg-${v}`}>
                  <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                  <text
                    x={padL - 8}
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize={9.5}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {v}
                  </text>
                </g>
              );
            })}

            {activeIdx !== null && (
              <line
                x1={xAt(activeIdx)}
                y1={12}
                x2={xAt(activeIdx)}
                y2={topH - 8}
                stroke="#cbd5e1"
                strokeDasharray="3 3"
              />
            )}

            <path d={sleepPath} fill="none" stroke="#0284c7" strokeWidth={2} strokeDasharray="5 3" />
            <path d={focusPath} fill="none" stroke="#0d9488" strokeWidth={2.4} />

            {ordered.map((item, idx) => {
              const cx = xAt(idx);
              const isSel = activeIdx === idx;
              return (
                <g
                  key={item.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => setSelectedIndex(idx)}
                >
                  <rect x={cx - 16} y={0} width={32} height={topH + 20} fill="transparent" />
                  <circle
                    cx={cx}
                    cy={yFocus(item.focusScore)}
                    r={isSel ? 5 : 3.5}
                    fill="#0d9488"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <circle
                    cx={cx}
                    cy={ySleep(item.sleepHours)}
                    r={isSel ? 4.5 : 3}
                    fill="#0284c7"
                    stroke="#ffffff"
                    strokeWidth={1.5}
                  />
                  <text
                    x={cx}
                    y={topH + 14}
                    textAnchor="middle"
                    fill={isSel ? '#0f172a' : '#64748b'}
                    fontWeight={isSel ? 700 : 500}
                    fontSize={9.5}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {formatShortDate(item.recordedDate)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Panel 2: Cognitive Fatigue TAR & Hemispheric BSI */}
      {(() => {
        const panel2Content = (
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-600">
              <span>Nhóm 2: Chỉ số Mệt mỏi Nhận thức (TAR) & Bất đối xứng Bán cầu (BSI)</span>
              <span className="font-mono text-amber-700">Ngưỡng mệt mỏi TAR &gt; 1.50 · Ngưỡng BSI &gt; 0.150</span>
            </div>
            <div
              tabIndex={0}
              role="region"
              aria-label="Biểu đồ xu hướng chỉ số mệt mỏi TAR và đối xứng BSI"
              className="overflow-x-auto"
            >
              <svg viewBox={`0 0 ${w} ${botH + 22}`} className="w-full min-w-[520px] h-auto block select-none">
                {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                  const val = frac * maxTar;
                  const y = yTar(val);
                  return (
                    <g key={`tg-${frac}`}>
                      <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="#f1f5f9" strokeWidth={1} />
                      <text
                        x={padL - 8}
                        y={y + 3}
                        textAnchor="end"
                        fill="#64748b"
                        fontSize={9.5}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* Clinical Thresholds */}
                <line
                  x1={padL}
                  y1={tarThresholdY}
                  x2={w - padR}
                  y2={tarThresholdY}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeOpacity={0.55}
                />
                <line
                  x1={padL}
                  y1={bsiThresholdY}
                  x2={w - padR}
                  y2={bsiThresholdY}
                  stroke="#e11d48"
                  strokeDasharray="2 4"
                  strokeOpacity={0.45}
                />

                {activeIdx !== null && (
                  <line
                    x1={xAt(activeIdx)}
                    y1={12}
                    x2={xAt(activeIdx)}
                    y2={botH - 8}
                    stroke="#cbd5e1"
                    strokeDasharray="3 3"
                  />
                )}

                <path d={tarPath} fill="none" stroke="#d97706" strokeWidth={2.2} />
                <path d={bsiPath} fill="none" stroke="#e11d48" strokeWidth={2.2} />

                {ordered.map((item, idx) => {
                  const cx = xAt(idx);
                  const isSel = activeIdx === idx;
                  return (
                    <g
                      key={`b-${item.id}`}
                      className="cursor-pointer"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => setSelectedIndex(idx)}
                    >
                      <rect x={cx - 16} y={0} width={32} height={botH + 20} fill="transparent" />
                      <circle
                        cx={cx}
                        cy={yTar(item.fatigueIndexTar)}
                        r={isSel ? 5 : 3.5}
                        fill="#d97706"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <circle
                        cx={cx}
                        cy={yBsi(item.hemisphericBsi)}
                        r={isSel ? 5 : 3.5}
                        fill="#e11d48"
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={cx}
                        y={botH + 14}
                        textAnchor="middle"
                        fill={isSel ? '#0f172a' : '#64748b'}
                        fontWeight={isSel ? 700 : 500}
                        fontSize={9.5}
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {formatShortDate(item.recordedDate)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        );

        if (isProfessional) return panel2Content;

        return (
          <details className="rounded-lg border border-slate-200 bg-slate-50/60">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100/60 rounded-lg">
              Chỉ số chuyên sâu (TAR &amp; BSI) ▾
            </summary>
            <div className="p-2.5 pt-1">{panel2Content}</div>
          </details>
        );
      })()}

      {/* Selected Day Readout */}
      {activeItem && (
        <div className="rounded-lg border border-teal-200/80 bg-[#F0FDFA] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-900">
              Ngày {formatShortDate(activeItem.recordedDate)}:
            </span>{' '}
            <span className="text-slate-700">{activeItem.notes}</span>
          </div>
          {isProfessional ? (
            <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-[11px]">
              <span className="rounded bg-white border border-teal-200 px-2 py-0.5 font-bold text-teal-800">
                Focus: {activeItem.focusScore}/100
              </span>
              <span className="rounded bg-white border border-sky-200 px-2 py-0.5 font-bold text-sky-800">
                Ngủ: {activeItem.sleepHours.toFixed(1)}h
              </span>
              <span className="rounded bg-white border border-amber-200 px-2 py-0.5 font-bold text-amber-800">
                TAR: {activeItem.fatigueIndexTar.toFixed(2)}
              </span>
              <span className="rounded bg-white border border-rose-200 px-2 py-0.5 font-bold text-rose-800">
                BSI: {activeItem.hemisphericBsi.toFixed(3)}
              </span>
              <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-slate-700">
                Alpha: {activeItem.alphaPeakHz.toFixed(1)}Hz
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded bg-white border border-teal-200 px-2.5 py-0.5 font-mono font-bold text-teal-800 tabular-nums">
                Độ tỉnh táo: {activeItem.focusScore}/100
              </span>
              <span className="rounded bg-white border border-sky-200 px-2.5 py-0.5 font-mono font-bold text-sky-800 tabular-nums">
                Giấc ngủ: {activeItem.sleepHours.toFixed(1)}h
              </span>
              {(() => {
                const needsRest =
                  activeItem.fatigueIndexTar > 1.5 ||
                  activeItem.hemisphericBsi > 0.15 ||
                  activeItem.sleepHours < 6.5;
                return (
                  <span
                    className={cn(
                      'rounded border px-2.5 py-0.5 font-bold',
                      needsRest
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800',
                    )}
                  >
                    Trạng thái: {needsRest ? 'Cần nghỉ ngơi' : 'Ổn định'}
                  </span>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

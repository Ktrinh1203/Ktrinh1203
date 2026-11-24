import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { selfServiceApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { WorkBlockType, WorkingPlanBlockItem } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { BottomSheet, EmptyView, PillTabs, Spinner, cn } from '../components/ui';

const MOODS = [
  { id: 'alert', label: 'Tỉnh táo', focus: 88, stress: 2, tar: 1.02 },
  { id: 'normal', label: 'Ổn định', focus: 75, stress: 4, tar: 1.22 },
  { id: 'tired', label: 'Mệt mỏi', focus: 52, stress: 7, tar: 1.68 },
] as const;

const SLEEPS = [5.5, 6.5, 7.5, 8] as const;
const DAYS = ['ALL', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const BLOCK_DAY_OPTIONS = ['Hằng ngày', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const BLOCK_TYPES: { id: WorkBlockType; label: string }[] = [
  { id: 'DEEP_WORK', label: 'Tập trung sâu' },
  { id: 'NEURO_RECOVERY', label: 'Phục hồi' },
  { id: 'SLEEP_TARGET', label: 'Giấc ngủ' },
  { id: 'LIGHT_ADMIN', label: 'Nhẹ nhàng' },
];

export function HealthPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [moodIdx, setMoodIdx] = useState(0);
  const [sleep, setSleep] = useState<number>(7.5);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [dayFilter, setDayFilter] = useState('ALL');

  const [addOpen, setAddOpen] = useState(false);
  const [bTitle, setBTitle] = useState('');
  const [bDay, setBDay] = useState('Hằng ngày');
  const [bSlot, setBSlot] = useState('08:30 - 10:00');
  const [bType, setBType] = useState<WorkBlockType>('DEEP_WORK');
  const [blockErr, setBlockErr] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: ['self-service-overview', user?.id],
    queryFn: () => selfServiceApi.getOverview(),
    enabled: Boolean(user),
  });

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    if (kind === 'ok') setTimeout(() => setToast(null), 2200);
  };

  const checkInMut = useMutation({
    mutationFn: () => {
      const m = MOODS[moodIdx]!;
      return selfServiceApi.addCheckIn({
        focusScore: m.focus,
        fatigueIndexTar: m.tar,
        hemisphericBsi: 0.07,
        alphaPeakHz: 10.2,
        sleepHours: sleep,
        stressLevel: m.stress,
        notes: note.trim() || `${m.label} · ngủ ${sleep}h`,
      });
    },
    onSuccess: () => {
      setNote('');
      showToast('ok', 'Đã lưu hôm nay');
      void queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
    },
    onError: (e) => showToast('err', errorMessage(e)),
  });

  const toggleBlockMut = useMutation({
    mutationFn: (b: WorkingPlanBlockItem) =>
      selfServiceApi.updateWorkBlock(b.id, { completed: !b.completed }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['self-service-overview'] }),
    onError: (e) => showToast('err', errorMessage(e)),
  });

  const delBlockMut = useMutation({
    mutationFn: (id: string) => selfServiceApi.deleteWorkBlock(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['self-service-overview'] }),
    onError: (e) => showToast('err', errorMessage(e)),
  });

  const addBlockMut = useMutation({
    mutationFn: () =>
      selfServiceApi.addWorkBlock({
        dayOfWeek: bDay,
        timeSlot: bSlot.trim() || '09:00 - 10:30',
        title: bTitle.trim(),
        blockType: bType,
        eegRationale: 'Tối ưu nhịp sinh học não bộ.',
      }),
    onSuccess: () => {
      setBTitle('');
      setBlockErr(null);
      setAddOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
    },
    onError: (e) => setBlockErr(errorMessage(e)),
  });

  const checkIns = overviewQuery.data?.checkIns ?? [];
  const workPlan = overviewQuery.data?.workPlan ?? [];
  const latest = checkIns[0];

  const focusScore = latest?.focusScore ?? 82;
  const sleepHours = latest?.sleepHours ?? 7.5;
  const needsRest = (latest?.fatigueIndexTar ?? 1.1) > 1.5;

  const ringCirc = 2 * Math.PI * 30;
  const ringOffset = ringCirc * (1 - Math.min(100, Math.max(0, focusScore)) / 100);

  const visibleBlocks = useMemo(
    () =>
      dayFilter === 'ALL'
        ? workPlan
        : workPlan.filter((b) => b.dayOfWeek === dayFilter || b.dayOfWeek === 'Hằng ngày'),
    [workPlan, dayFilter],
  );

  const doneCount = workPlan.filter((b) => b.completed).length;

  if (overviewQuery.isLoading) return <Spinner />;

  return (
    <div className="px-3.5 pt-3.5 space-y-3.5">
      {/* Oura-style Serene Readiness Hero */}
      <section className="rounded-[24px] border border-[#DCE6DF] bg-white p-4 flex items-center gap-4">
        <div className="relative size-[74px] shrink-0">
          <svg viewBox="0 0 74 74" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="37" cy="37" r="30" fill="none" stroke="#ECFDF3" strokeWidth="6.5" />
            <circle
              cx="37"
              cy="37"
              r="30"
              fill="none"
              stroke={needsRest ? '#F59E0B' : '#16A34A'}
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeDasharray={ringCirc}
              strokeDashoffset={ringOffset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-lg font-bold text-[#111827] tabular-nums">
            {focusScore}
          </span>
        </div>

        <div className="min-w-0 flex-1 grid grid-cols-2 gap-3">
          <div>
            <span className="block text-[11px] text-[#5B6860]">Trạng thái</span>
            <span
              className={cn(
                'mt-0.5 block text-[15px] font-bold',
                needsRest ? 'text-amber-700' : 'text-[#15803D]',
              )}
            >
              {needsRest ? 'Cần nghỉ' : 'Ổn định'}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-[#5B6860]">Giấc ngủ</span>
            <span className="mt-0.5 block font-mono text-[15px] font-bold text-[#111827] tabular-nums">
              {sleepHours.toFixed(1)}h
            </span>
          </div>
          <div className="col-span-2 flex items-center justify-between pt-2 border-t border-[#EDF3EF] text-xs text-[#5B6860]">
            <span>Lịch hôm nay</span>
            <span className="font-mono font-semibold text-[#111827] tabular-nums">
              {doneCount}/{workPlan.length}
            </span>
          </div>
        </div>
      </section>

      {/* 2-Tap Daily Check-in */}
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          checkInMut.mutate();
        }}
        className="rounded-2xl border border-[#DCE6DF] bg-white p-4 space-y-3"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#111827]">Ghi nhanh hôm nay</h2>
          {toast && (
            <span
              role={toast.kind === 'err' ? 'alert' : 'status'}
              className={cn(
                'inline-flex items-center gap-1 text-xs font-semibold animate-fade-in truncate',
                toast.kind === 'err' ? 'text-red-600' : 'text-[#16A34A]',
              )}
            >
              {toast.kind === 'ok' && <Check className="size-3.5 shrink-0" aria-hidden />}
              <span className="truncate">{toast.text}</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {MOODS.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={moodIdx === idx}
              onClick={() => setMoodIdx(idx)}
              className={cn(
                'h-10 rounded-xl text-xs font-semibold transition-colors cursor-pointer',
                moodIdx === idx
                  ? 'bg-[#16A34A] text-white'
                  : 'bg-[#F5FAF7] text-[#374151] border border-[#DCE6DF]',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {SLEEPS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={sleep === h}
              onClick={() => setSleep(h)}
              className={cn(
                'h-9.5 rounded-xl font-mono text-xs font-semibold tabular-nums transition-colors cursor-pointer',
                sleep === h
                  ? 'bg-[#14532D] text-white'
                  : 'bg-[#F5FAF7] text-[#374151] border border-[#DCE6DF]',
              )}
            >
              {h === 8 ? '8h+' : `${h}h`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Ghi chú ngắn..."
            aria-label="Ghi chú sức khỏe"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="flex-1 h-10.5 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-3.5 text-xs focus:bg-white focus:border-[#16A34A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={checkInMut.isPending}
            className="shrink-0 rounded-full bg-[#16A34A] px-5 h-10.5 text-xs font-semibold text-white active:scale-95 transition-transform cursor-pointer disabled:opacity-50"
          >
            Lưu
          </button>
        </div>
      </form>

      {/* Daily Routine Plan */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-[#111827]">Nhịp sinh học</h2>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 rounded-full border border-[#DCE6DF] bg-white px-3 h-8 text-xs font-semibold text-[#15803D] cursor-pointer"
          >
            <Plus className="size-3.5" aria-hidden />
            <span>Thêm</span>
          </button>
        </div>

        <div
          style={{
            maskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
          }}
        >
          <PillTabs
            items={DAYS.map((d) => ({ id: d, label: d === 'ALL' ? 'Tất cả' : d }))}
            value={dayFilter}
            onChange={setDayFilter}
            className="pr-5"
          />
        </div>

        {visibleBlocks.length === 0 ? (
          <EmptyView title="Chưa có lịch trình" />
        ) : (
          <div className="divide-y divide-[#EDF3EF] rounded-2xl border border-[#DCE6DF] bg-white overflow-hidden">
            {visibleBlocks.map((b) => (
              <div key={b.id} className="flex items-center gap-3 px-3.5 py-3">
                <button
                  type="button"
                  onClick={() => toggleBlockMut.mutate(b)}
                  aria-label={b.completed ? 'Đánh dấu chưa xong' : 'Đánh dấu hoàn thành'}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#16A34A] active:scale-90 transition-transform cursor-pointer"
                >
                  {b.completed ? (
                    <CheckCircle2 className="size-5.5 fill-[#ECFDF3]" aria-hidden />
                  ) : (
                    <Circle className="size-5.5 text-[#94A39B]" aria-hidden />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'text-sm font-semibold truncate',
                      b.completed ? 'line-through text-[#8A9790]' : 'text-[#111827]',
                    )}
                  >
                    {b.title}
                  </p>
                  <p className="font-mono text-[11px] text-[#5B6860] tabular-nums">
                    {b.dayOfWeek} · {b.timeSlot}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => delBlockMut.mutate(b.id)}
                  aria-label="Xóa khối lịch"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#94A39B] hover:text-red-600 cursor-pointer"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Compact Recent History */}
      {checkIns.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold text-[#111827]">Gần đây</h2>
          <div className="divide-y divide-[#EDF3EF] rounded-2xl border border-[#DCE6DF] bg-white overflow-hidden">
            {checkIns.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span className="font-mono text-[#5B6860] tabular-nums">
                  {new Date(c.recordedDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                </span>
                <span className="flex-1 truncate text-[#374151]">{c.notes}</span>
                <span className="font-mono font-bold text-[#15803D] tabular-nums shrink-0">
                  {c.focusScore} · {c.sleepHours}h
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add Block Sheet */}
      <BottomSheet
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setBlockErr(null);
        }}
        title="Thêm lịch trình"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (bTitle.trim().length < 2) {
              setBlockErr('Nhập tên hoạt động (≥2 ký tự).');
              return;
            }
            addBlockMut.mutate();
          }}
          className="space-y-3"
        >
          {blockErr && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {blockErr}
            </p>
          )}
          <input
            type="text"
            placeholder="Hoạt động (vd: Đọc tài liệu sâu)"
            value={bTitle}
            onChange={(e) => setBTitle(e.target.value)}
            className="w-full h-11 rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] px-4 text-sm focus:bg-white focus:border-[#16A34A] focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Ngày trong tuần"
              value={bDay}
              onChange={(e) => setBDay(e.target.value)}
              className="h-11 rounded-2xl border border-[#DCE6DF] bg-white px-3 text-xs"
            >
              {BLOCK_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={bSlot}
              onChange={(e) => setBSlot(e.target.value)}
              placeholder="08:30 - 10:00"
              aria-label="Khung giờ"
              className="h-11 rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] px-3.5 font-mono text-xs"
            />
          </div>
          <PillTabs items={BLOCK_TYPES} value={bType} onChange={setBType} />
          <button
            type="submit"
            disabled={bTitle.trim().length < 2 || addBlockMut.isPending}
            className="w-full h-11 rounded-full bg-[#16A34A] text-sm font-semibold text-white disabled:opacity-40 cursor-pointer"
          >
            Thêm vào lịch
          </button>
        </form>
      </BottomSheet>
    </div>
  );
}

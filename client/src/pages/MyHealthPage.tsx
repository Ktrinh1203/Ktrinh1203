import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Brain,
  CheckCircle2,
  ChevronRight,
  Circle,
  MessageSquarePlus,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { eegDatasetsApi, neuralDbApi, selfServiceApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { WorkBlockType, WorkingPlanBlockItem } from '../api/types';
import { Alert, Button, Card, Input, Spinner, Textarea, cn } from '../components/ui';
import { useMode } from '../context/ModeContext';
import { useAuth } from '../features/auth/AuthContext';
import { PhysiologicalTrendChart } from '../features/eeg/PhysiologicalTrendChart';
import { CLINICAL_CATEGORY_META, WORK_BLOCK_META, WORK_BLOCK_ORDER } from '../features/eeg/eegLabels';

const DAYS_OF_WEEK = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const MOOD_PRESETS = [
  { label: 'Tỉnh táo', focus: '88', stress: '2', tar: '1.02' },
  { label: 'Bình thường', focus: '75', stress: '4', tar: '1.22' },
  { label: 'Mệt mỏi', focus: '52', stress: '7', tar: '1.68' },
] as const;

const SLEEP_PRESETS = [
  { label: '5.5h', value: '5.5' },
  { label: '6.5h', value: '6.5' },
  { label: '7.5h', value: '7.5' },
  { label: '8h+', value: '8' },
] as const;

export function MyHealthPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [activeLowerTab, setActiveLowerTab] = useState<'schedule' | 'trends'>('schedule');

  // Modals (sequential UX)
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);

  // Check-in Form State
  const [focusScore, setFocusScore] = useState('82');
  const [fatigueIndexTar, setFatigueIndexTar] = useState('1.15');
  const [hemisphericBsi, setHemisphericBsi] = useState('0.07');
  const [alphaPeakHz, setAlphaPeakHz] = useState('10.2');
  const [sleepHours, setSleepHours] = useState('7.5');
  const [stressLevel, setStressLevel] = useState('3');
  const [neuralSampleId, setNeuralSampleId] = useState('');
  const [notes, setNotes] = useState('');

  // Working Plan CRUD State
  const [dayFilter, setDayFilter] = useState<string>('ALL');
  const [blockDay, setBlockDay] = useState('Thứ 2');
  const [blockSlot, setBlockSlot] = useState('08:30 - 10:30');
  const [blockTitle, setBlockTitle] = useState('');
  const [blockType, setBlockType] = useState<WorkBlockType>('DEEP_WORK');
  const [blockRationale, setBlockRationale] = useState(WORK_BLOCK_META.DEEP_WORK.defaultRationale);

  useEffect(() => {
    if (!showCheckInModal && !showAddBlockModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddBlockModal) setShowAddBlockModal(false);
        else if (showCheckInModal) setShowCheckInModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showCheckInModal, showAddBlockModal]);

  const overviewQuery = useQuery({
    queryKey: ['self-service-overview', user?.id],
    queryFn: () => selfServiceApi.getOverview(),
    enabled: Boolean(user),
  });

  const myEegQuery = useQuery({
    queryKey: ['my-eeg-health-summary', user?.id],
    queryFn: () => eegDatasetsApi.getMyDatasets(),
    enabled: Boolean(user),
  });

  const samplesQuery = useQuery({
    queryKey: ['neural-db-samples-for-checkin'],
    queryFn: () => neuralDbApi.listSamples(),
    enabled: Boolean(user),
  });

  const addCheckInMutation = useMutation({
    mutationFn: (payload: {
      neuralSampleId?: string;
      focusScore: number;
      fatigueIndexTar: number;
      hemisphericBsi: number;
      alphaPeakHz: number;
      sleepHours: number;
      stressLevel: number;
      notes: string;
    }) => selfServiceApi.addCheckIn(payload),
    onSuccess: () => {
      setNotes('');
      setShowCheckInModal(false);
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
      setFeedback({
        tone: 'success',
        text: isProfessional
          ? 'Đã lưu nhật ký sinh lý thần kinh hôm nay và cập nhật biểu đồ xu hướng.'
          : 'Đã lưu nhật ký hôm nay.',
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const addWorkBlockMutation = useMutation({
    mutationFn: () =>
      selfServiceApi.addWorkBlock({
        dayOfWeek: blockDay,
        timeSlot: blockSlot.trim() || '09:00 - 10:30',
        title: blockTitle.trim(),
        blockType,
        eegRationale: isProfessional
          ? blockRationale.trim() || WORK_BLOCK_META[blockType].defaultRationale
          : WORK_BLOCK_META[blockType].defaultRationale,
      }),
    onSuccess: () => {
      setShowAddBlockModal(false);
      setBlockTitle('');
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
      setFeedback({
        tone: 'success',
        text: isProfessional
          ? 'Đã thêm khối lịch làm việc & phục hồi theo nhịp sóng não.'
          : 'Đã thêm lịch mới vào kế hoạch trong ngày của bạn.',
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const toggleBlockMutation = useMutation({
    mutationFn: (block: WorkingPlanBlockItem) =>
      selfServiceApi.updateWorkBlock(block.id, { completed: !block.completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: (id: string) => selfServiceApi.deleteWorkBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['self-service-overview'] });
      setFeedback({
        tone: 'success',
        text: 'Đã xóa khối lịch khỏi kế hoạch tuần.',
      });
    },
    onError: (err) => {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    },
  });

  const checkIns = overviewQuery.data?.checkIns ?? [];
  const workPlan = overviewQuery.data?.workPlan ?? [];
  const myDatasets = myEegQuery.data?.datasets ?? [];
  const latestDataset = myDatasets[0];
  const latestCheckIn = checkIns[0];

  const summaryStats = useMemo(() => {
    if (checkIns.length === 0) {
      return {
        focus: 82,
        tar: 1.15,
        bsi: 0.07,
        sleep: 7.5,
      };
    }
    const n = checkIns.length;
    return {
      focus: Math.round(checkIns.reduce((s, c) => s + c.focusScore, 0) / n),
      tar: checkIns.reduce((s, c) => s + c.fatigueIndexTar, 0) / n,
      bsi: checkIns.reduce((s, c) => s + c.hemisphericBsi, 0) / n,
      sleep: checkIns.reduce((s, c) => s + c.sleepHours, 0) / n,
    };
  }, [checkIns]);

  const availableDays = useMemo(() => {
    const set = new Set<string>(DAYS_OF_WEEK);
    workPlan.forEach((b) => {
      if (b.dayOfWeek) set.add(b.dayOfWeek);
    });
    return Array.from(set);
  }, [workPlan]);

  const filteredBlocks = useMemo(() => {
    if (dayFilter === 'ALL') return workPlan;
    return workPlan.filter((b) => b.dayOfWeek === dayFilter);
  }, [workPlan, dayFilter]);

  const completedCount = workPlan.filter((b) => b.completed).length;

  const handleSampleChange = (sampleId: string) => {
    setNeuralSampleId(sampleId);
    const found = samplesQuery.data?.samples.find((s) => s.id === sampleId);
    if (found) {
      setFatigueIndexTar(found.tar.toFixed(2));
      setHemisphericBsi(found.bsi.toFixed(3));
    }
  };

  const handleBlockTypeChange = (nextType: WorkBlockType) => {
    setBlockType(nextType);
    setBlockRationale(WORK_BLOCK_META[nextType].defaultRationale);
  };

  const handleCheckInSubmit = (e: FormEvent) => {
    e.preventDefault();
    addCheckInMutation.mutate({
      neuralSampleId: neuralSampleId || undefined,
      focusScore: Math.max(0, Math.min(100, Math.round(Number(focusScore) || 75))),
      fatigueIndexTar: Math.max(0.1, Number(fatigueIndexTar) || 1.1),
      hemisphericBsi: Math.max(0, Number(hemisphericBsi) || 0.06),
      alphaPeakHz: Math.max(5, Math.min(16, Number(alphaPeakHz) || 10.0)),
      sleepHours: Math.max(0, Math.min(16, Number(sleepHours) || 7.5)),
      stressLevel: Math.max(1, Math.min(10, Math.round(Number(stressLevel) || 3))),
      notes: notes.trim() || 'Theo dõi hàng ngày.',
    });
  };

  const handleAddBlockSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (blockTitle.trim().length < 3) {
      setFeedback({
        tone: 'error',
        text: 'Vui lòng nhập tiêu đề khối công việc tối thiểu 3 ký tự.',
      });
      return;
    }
    addWorkBlockMutation.mutate();
  };

  const recoveryScore = latestCheckIn ? latestCheckIn.focusScore : summaryStats.focus;
  const sleepVal = latestCheckIn ? latestCheckIn.sleepHours : summaryStats.sleep;
  const needsRest =
    (latestCheckIn ? latestCheckIn.fatigueIndexTar : summaryStats.tar) > 1.5 ||
    (latestCheckIn ? latestCheckIn.hemisphericBsi : summaryStats.bsi) > 0.15 ||
    sleepVal < 6.5;

  return (
    <div className={cn('mx-auto space-y-5', isProfessional ? 'max-w-7xl' : 'max-w-5xl')}>
      {/* Clean Page Header with 1 Unified Detailed Check-in Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#DCE6DF] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-[#141413] tracking-tight">
            Nhật ký sức khỏe
          </h1>
          {isProfessional && (
            <span className="text-xs font-medium text-[#6E6D68]">
              · {user?.displayName || 'Thành viên'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowCheckInModal(true)}
            icon={<SlidersHorizontal className="size-3.5 text-[#16A34A]" aria-hidden />}
          >
            Ghi nhận chi tiết
          </Button>
          {isProfessional && (
            <Link to="/eeg-hub">
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Brain className="size-3.5 text-[#16A34A]" aria-hidden />}
              >
                Đo sóng não
              </Button>
            </Link>
          )}
          <Link to={isProfessional ? '/consultations' : '/consultations?ask=1'}>
            <Button
              type="button"
              size="sm"
              variant="primary"
              icon={<MessageSquarePlus className="size-3.5" aria-hidden />}
            >
              Hỏi bác sĩ
            </Button>
          </Link>
        </div>
      </div>

      {feedback && <Alert tone={feedback.tone}>{feedback.text}</Alert>}

      {overviewQuery.isLoading ? (
        <Spinner label="Đang tải..." />
      ) : (
        <div className="space-y-5">
          {/* Focal Point #1: 3 Core KPIs + 1-Tap Plug & Play Check-in Bar */}
          <Card className="overflow-hidden border-[#DCE6DF] bg-white">
            {/* 3 Core KPIs */}
            <div className="grid grid-cols-3 divide-x divide-[#DCE6DF]">
              <div className="px-4 py-3.5">
                <span className="block text-xs text-[#6E6D68]">Điểm phục hồi</span>
                <span className="mt-0.5 block font-mono text-xl sm:text-2xl font-semibold text-[#141413] tabular-nums">
                  {recoveryScore}/100
                </span>
              </div>

              <div className="px-4 py-3.5">
                <span className="block text-xs text-[#6E6D68]">Giấc ngủ</span>
                <span className="mt-0.5 block font-mono text-xl sm:text-2xl font-semibold text-[#141413] tabular-nums">
                  {sleepVal.toFixed(1)}h
                </span>
              </div>

              <div className="px-4 py-3.5">
                <span className="block text-xs text-[#6E6D68]">Trạng thái</span>
                <span
                  className={cn(
                    'mt-0.5 block text-lg sm:text-2xl font-semibold tabular-nums truncate',
                    needsRest ? 'text-amber-700' : 'text-[#15803D]',
                  )}
                >
                  {needsRest ? 'Cần nghỉ ngơi' : 'Ổn định'}
                </span>
              </div>
            </div>

            {/* 1-Tap Quick Check-in Bar */}
            <form
              onSubmit={handleCheckInSubmit}
              className="border-t border-[#DCE6DF] bg-[#F5FAF7] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-[#262624]">Check-in nhanh:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {MOOD_PRESETS.map((preset) => {
                    const isActive =
                      focusScore === preset.focus &&
                      stressLevel === preset.stress &&
                      fatigueIndexTar === preset.tar;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setFocusScore(preset.focus);
                          setStressLevel(preset.stress);
                          setFatigueIndexTar(preset.tar);
                        }}
                        className={cn(
                          'rounded-lg px-3 py-1.5 font-medium transition-colors',
                          isActive
                            ? 'bg-[#16A34A] text-white font-semibold'
                            : 'bg-white border border-[#DCE6DF] text-[#374151] hover:bg-[#EFF6F1]',
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <span className="hidden sm:inline text-[#DCE6DF]">|</span>

                <div className="flex flex-wrap items-center gap-1.5">
                  {SLEEP_PRESETS.map((preset) => {
                    const isActive = sleepHours === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setSleepHours(preset.value)}
                        className={cn(
                          'rounded-lg px-2.5 py-1.5 font-mono font-medium transition-colors',
                          isActive
                            ? 'bg-[#16A34A] text-white font-semibold'
                            : 'bg-white border border-[#DCE6DF] text-[#374151] hover:bg-[#EFF6F1]',
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                type="submit"
                size="sm"
                variant="primary"
                loading={addCheckInMutation.isPending}
              >
                Lưu ngay
              </Button>
            </form>
          </Card>

          {/* Main Lower Grid: 8 cols Tabbed Workspace + 4 cols Compact Reference */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 8 Columns: Clean 2-Tab Switcher (Lịch hôm nay | Xu hướng 7 ngày) */}
            <div className="lg:col-span-8 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DCE6DF]">
                <div className="flex items-center gap-6" role="tablist" aria-label="Chi tiết nhật ký">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeLowerTab === 'schedule'}
                    onClick={() => setActiveLowerTab('schedule')}
                    className={cn(
                      'border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap',
                      activeLowerTab === 'schedule'
                        ? 'border-[#16A34A] font-bold text-[#15803D]'
                        : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]',
                    )}
                  >
                    {isProfessional
                      ? `Kế hoạch làm việc (${completedCount}/${workPlan.length})`
                      : `Lịch hôm nay (${completedCount}/${workPlan.length})`}
                  </button>

                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeLowerTab === 'trends'}
                    onClick={() => setActiveLowerTab('trends')}
                    className={cn(
                      'border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap',
                      activeLowerTab === 'trends'
                        ? 'border-[#16A34A] font-bold text-[#15803D]'
                        : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]',
                    )}
                  >
                    Xu hướng 7 ngày
                  </button>
                </div>

                {activeLowerTab === 'schedule' && (
                  <div className="pb-2">
                    <Button
                      type="button"
                      size="xs"
                      variant="primary"
                      onClick={() => setShowAddBlockModal(true)}
                      icon={<Plus className="size-3.5" aria-hidden />}
                    >
                      Thêm lịch
                    </Button>
                  </div>
                )}
              </div>

              {activeLowerTab === 'schedule' ? (
                <Card className="p-4 sm:p-5 border-[#DCE6DF] space-y-4">
                  {/* Day Filter Pills */}
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc lịch làm việc theo ngày">
                    <button
                      type="button"
                      aria-pressed={dayFilter === 'ALL'}
                      onClick={() => setDayFilter('ALL')}
                      className={cn(
                        'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                        dayFilter === 'ALL'
                          ? 'bg-[#16A34A] text-white font-semibold'
                          : 'bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6]',
                      )}
                    >
                      Tất cả ({workPlan.length})
                    </button>
                    {availableDays.map((day) => {
                      const count = workPlan.filter((b) => b.dayOfWeek === day).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={day}
                          type="button"
                          aria-pressed={dayFilter === day}
                          onClick={() => setDayFilter(day)}
                          className={cn(
                            'rounded-lg px-3 py-1 text-xs font-medium transition-colors',
                            dayFilter === day
                              ? 'bg-[#16A34A] text-white font-semibold'
                              : 'bg-[#EFF6F1] text-[#374151] hover:bg-[#E2EFE6]',
                          )}
                        >
                          {day} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Clean Blocks List with Hover/Focus Minimal Delete Icon */}
                  {filteredBlocks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#DCE6DF] p-6 text-center text-xs text-[#6E6D68]">
                      Chưa có lịch nào.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#DCE6DF] rounded-xl border border-[#DCE6DF] overflow-hidden">
                      {filteredBlocks.map((block) => {
                        const meta = WORK_BLOCK_META[block.blockType];
                        return (
                          <div
                            key={block.id}
                            className={cn(
                              'group px-3.5 py-3 transition-colors flex items-center justify-between gap-3',
                              block.completed ? 'bg-[#F5FAF7]' : 'bg-white hover:bg-[#FAFDFB]',
                            )}
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={() => toggleBlockMutation.mutate(block)}
                                aria-label={
                                  block.completed
                                    ? `Đánh dấu chưa hoàn thành ${block.title}`
                                    : `Đánh dấu hoàn thành ${block.title}`
                                }
                                className="mt-0.5 text-[#16A34A] hover:text-[#15803D] shrink-0"
                              >
                                {block.completed ? (
                                  <CheckCircle2 className="size-5 text-[#16A34A]" aria-hidden />
                                ) : (
                                  <Circle className="size-5 text-[#C5C3BC]" aria-hidden />
                                )}
                              </button>

                              <div className="space-y-0.5 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#6E6D68]">
                                  <span className="font-mono font-medium text-[#575652]">
                                    {block.dayOfWeek} · {block.timeSlot}
                                  </span>
                                  <span>· {meta.label}</span>
                                </div>
                                <div
                                  className={cn(
                                    'text-sm font-semibold text-[#141413]',
                                    block.completed && 'line-through text-[#6E6D68]',
                                  )}
                                >
                                  {block.title}
                                </div>
                                {isProfessional && block.eegRationale && (
                                  <p className="text-xs text-[#575652] line-clamp-1">
                                    {block.eegRationale}
                                  </p>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => deleteBlockMutation.mutate(block.id)}
                              aria-label={`Xóa khối lịch ${block.title}`}
                              title="Xóa lịch"
                              className="p-1.5 rounded-md text-[#8A8882] hover:text-red-600 hover:bg-red-50 transition-all opacity-40 sm:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 shrink-0"
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ) : (
                <Card className="p-4 sm:p-5 border-[#DCE6DF] space-y-4">
                  {/* Hide repeated "Ngày 28-11" KPI readout box inside chart */}
                  <div className="[&_.bg-\[\#F0FDFA\]]:hidden">
                    <PhysiologicalTrendChart checkIns={checkIns} isProfessional={isProfessional} />
                  </div>

                  {checkIns.length > 0 && (
                    <div
                      tabIndex={0}
                      role="region"
                      aria-label="Lịch sử check-in sức khỏe"
                      className="overflow-x-auto rounded-xl border border-[#DCE6DF] focus-visible:outline-2 focus-visible:outline-[#16A34A]"
                    >
                      {isProfessional ? (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                              <th className="py-2 px-3 whitespace-nowrap">Ngày</th>
                              <th className="py-2 px-3">Ghi chú</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Focus</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">TAR</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">BSI</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Ngủ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/80 bg-white">
                            {checkIns.slice(0, 7).map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/80">
                                <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap tabular-nums">
                                  {new Date(item.recordedDate).toLocaleDateString('vi-VN')}
                                </td>
                                <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={item.notes}>
                                  {item.notes}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                                  {item.focusScore}
                                </td>
                                <td
                                  className={cn(
                                    'py-2 px-3 text-right font-mono whitespace-nowrap tabular-nums',
                                    item.fatigueIndexTar > 1.5
                                      ? 'font-bold text-amber-700'
                                      : 'text-slate-600',
                                  )}
                                >
                                  {item.fatigueIndexTar.toFixed(2)}
                                </td>
                                <td
                                  className={cn(
                                    'py-2 px-3 text-right font-mono whitespace-nowrap tabular-nums',
                                    item.hemisphericBsi > 0.15
                                      ? 'font-bold text-rose-700'
                                      : 'text-slate-600',
                                  )}
                                >
                                  {item.hemisphericBsi.toFixed(3)}
                                </td>
                                <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap tabular-nums">
                                  {item.sleepHours.toFixed(1)}h
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                              <th className="py-2 px-3 whitespace-nowrap">Ngày</th>
                              <th className="py-2 px-3">Cảm nhận</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Phục hồi</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Giấc ngủ</th>
                              <th className="py-2 px-3 text-right whitespace-nowrap">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/80 bg-white">
                            {checkIns.slice(0, 7).map((item) => {
                              const itemNeedsRest =
                                item.fatigueIndexTar > 1.5 ||
                                item.hemisphericBsi > 0.15 ||
                                item.sleepHours < 6.5;
                              return (
                                <tr key={item.id} className="hover:bg-slate-50/80">
                                  <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap tabular-nums">
                                    {new Date(item.recordedDate).toLocaleDateString('vi-VN')}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={item.notes}>
                                    {item.notes}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                                    {item.focusScore}/100
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap tabular-nums">
                                    {item.sleepHours.toFixed(1)}h
                                  </td>
                                  <td className="py-2 px-3 text-right whitespace-nowrap">
                                    <span
                                      className={cn(
                                        'inline-block rounded border px-2 py-0.5 text-[11px] font-semibold',
                                        itemNeedsRest
                                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                                          : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                                      )}
                                    >
                                      {itemNeedsRest ? 'Cần nghỉ ngơi' : 'Ổn định'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </Card>
              )}
            </div>

            {/* Right 4 Columns: Latest EEG Record Summary & Compact Index Guide */}
            <div className="lg:col-span-4 space-y-4">
              <Card className="p-4 sm:p-5 border-[#DCE6DF] bg-white space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <Activity className="size-4 text-[#16A34A] shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-[#141413]">Bản ghi sóng não gần nhất</h2>
                    <p className="text-[11px] text-[#6E6D68] truncate">
                      {latestDataset
                        ? `${latestDataset.patientCode} · ${latestDataset.date}`
                        : 'Chưa có bản ghi cá nhân'}
                    </p>
                  </div>
                </div>
                {latestDataset ? (
                  <div className="space-y-1.5 text-xs text-[#575652]">
                    {latestDataset.title && (
                      <p className="font-medium text-[#141413] truncate">{latestDataset.title}</p>
                    )}
                    {latestDataset.clinicalNote && (
                      <p className="line-clamp-2">{latestDataset.clinicalNote}</p>
                    )}
                    <Link
                      to="/eeg-hub?tab=personal"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#15803D] hover:underline pt-0.5"
                    >
                      <span>Xem chi tiết hồ sơ</span>
                      <ChevronRight className="size-3.5" aria-hidden />
                    </Link>
                  </div>
                ) : (
                  <p className="text-xs text-[#6E6D68]">
                    Lưu kết quả từ mục Đo sóng não để theo dõi tiến triển tại đây.
                  </p>
                )}
              </Card>

              <Card className="p-0 overflow-hidden border-[#DCE6DF]">
                <details>
                  <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#141413] hover:bg-[#F5FAF7] flex items-center justify-between">
                    <span>Ý nghĩa chỉ số ▾</span>
                  </summary>
                  <div className="px-4 pb-3 pt-1 space-y-2 divide-y divide-[#DCE6DF] text-xs">
                    <p className="text-[#575652]">
                      <strong className="text-[#141413]">
                        {isProfessional ? 'TAR > 1.50:' : 'Mệt mỏi (> 1.50):'}
                      </strong>{' '}
                      Dấu hiệu mệt mỏi, nên nghỉ 15 phút.
                    </p>
                    <p className="pt-2 text-[#575652]">
                      <strong className="text-[#141413]">
                        {isProfessional ? 'Giấc ngủ (Delta N3):' : 'Giấc ngủ sâu:'}
                      </strong>{' '}
                      Ngủ đúng giờ để phục hồi sâu.
                    </p>
                    <p className="pt-2 text-[#575652]">
                      <strong className="text-[#141413]">
                        {isProfessional ? 'BSI > 0.15:' : 'Cân bằng 2 bên (> 0.15):'}
                      </strong>{' '}
                      Lệch bán cầu, cần theo dõi chuyên khoa.
                    </p>
                  </div>
                </details>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Check-in Pop-up Modal */}
      {showCheckInModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4"
          onClick={() => setShowCheckInModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkin-modal-title"
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl border border-[#DCE6DF] bg-white shadow-xl text-[#141413]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#DCE6DF] bg-white px-5 py-3.5">
              <h2 id="checkin-modal-title" className="text-base font-semibold text-[#141413]">
                Ghi nhận chi tiết hôm nay
              </h2>
              <button
                type="button"
                onClick={() => setShowCheckInModal(false)}
                aria-label="Đóng cửa sổ ghi nhận chi tiết"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#6E6D68] hover:bg-[#EFF6F1] hover:text-[#141413] transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={handleCheckInSubmit} className="p-5 space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="mh-focus" className="font-semibold text-[#262624] block">
                    Điểm phục hồi (0–100)
                  </label>
                  <Input
                    id="mh-focus"
                    type="number"
                    min={0}
                    max={100}
                    value={focusScore}
                    onChange={(e) => setFocusScore(e.target.value)}
                    className="bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="mh-sleep" className="font-semibold text-[#262624] block">
                    Giấc ngủ (giờ)
                  </label>
                  <Input
                    id="mh-sleep"
                    type="number"
                    step="0.5"
                    min={0}
                    max={16}
                    value={sleepHours}
                    onChange={(e) => setSleepHours(e.target.value)}
                    className="bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="mh-stress" className="font-semibold text-[#262624] block">
                    Căng thẳng (1–10)
                  </label>
                  <Input
                    id="mh-stress"
                    type="number"
                    min={1}
                    max={10}
                    value={stressLevel}
                    onChange={(e) => setStressLevel(e.target.value)}
                    className="bg-white font-mono"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label htmlFor="mh-tar" className="font-semibold text-[#262624] block">
                    {isProfessional ? 'TAR' : 'Mệt mỏi'}
                  </label>
                  <Input
                    id="mh-tar"
                    type="number"
                    step="0.01"
                    min={0.1}
                    max={8}
                    value={fatigueIndexTar}
                    onChange={(e) => setFatigueIndexTar(e.target.value)}
                    className="bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="mh-bsi" className="font-semibold text-[#262624] block">
                    {isProfessional ? 'BSI' : 'Cân bằng 2 bên'}
                  </label>
                  <Input
                    id="mh-bsi"
                    type="number"
                    step="0.001"
                    min={0}
                    max={1}
                    value={hemisphericBsi}
                    onChange={(e) => setHemisphericBsi(e.target.value)}
                    className="bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="mh-alpha" className="font-semibold text-[#262624] block">
                    {isProfessional ? 'Alpha (Hz)' : 'Nhịp thư thái'}
                  </label>
                  <Input
                    id="mh-alpha"
                    type="number"
                    step="0.1"
                    min={5}
                    max={15}
                    value={alphaPeakHz}
                    onChange={(e) => setAlphaPeakHz(e.target.value)}
                    className="bg-white font-mono"
                  />
                </div>

                {samplesQuery.data?.samples && samplesQuery.data.samples.length > 0 && (
                  <div className="sm:col-span-3 space-y-1">
                    <label htmlFor="mh-sample-link" className="font-semibold text-[#262624] block">
                      {isProfessional ? 'Chọn mẫu EEG' : 'Chọn mẫu tham khảo'}
                    </label>
                    <select
                      id="mh-sample-link"
                      value={neuralSampleId}
                      onChange={(e) => handleSampleChange(e.target.value)}
                      className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-3 text-xs text-[#141413]"
                    >
                      <option value="">-- Nhập thủ công --</option>
                      {samplesQuery.data.samples.slice(0, 12).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.subjectCode} ·{' '}
                          {CLINICAL_CATEGORY_META[s.clinicalCategory]?.shortLabel ?? s.clinicalCategory} ·{' '}
                          {isProfessional
                            ? `TAR ${s.tar.toFixed(2)} · BSI ${s.bsi.toFixed(3)}`
                            : `Mệt mỏi ${s.tar.toFixed(2)} · Cân bằng 2 bên ${s.bsi.toFixed(3)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label htmlFor="mh-notes" className="font-semibold text-[#262624] block">
                  Ghi chú cảm nhận
                </label>
                <Textarea
                  id="mh-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú giấc ngủ, triệu chứng hoặc mức độ tập trung hôm nay..."
                  className="bg-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#DCE6DF]">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCheckInModal(false)}>
                  Hủy
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={addCheckInMutation.isPending}
                >
                  Lưu ghi nhận
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Working Plan Block Pop-up Modal */}
      {showAddBlockModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4"
          onClick={() => setShowAddBlockModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-block-modal-title"
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[#DCE6DF] bg-white shadow-xl text-[#141413]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#DCE6DF] bg-white px-5 py-3.5">
              <h2 id="add-block-modal-title" className="text-base font-semibold text-[#141413]">
                Thêm lịch mới
              </h2>
              <button
                type="button"
                onClick={() => setShowAddBlockModal(false)}
                aria-label="Đóng cửa sổ thêm lịch"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#6E6D68] hover:bg-[#EFF6F1] hover:text-[#141413] transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <form onSubmit={handleAddBlockSubmit} className="p-5 grid gap-3.5 sm:grid-cols-2 text-xs">
              <div className="space-y-1">
                <label htmlFor="wp-day" className="font-semibold text-[#262624] block">
                  Ngày
                </label>
                <select
                  id="wp-day"
                  value={blockDay}
                  onChange={(e) => setBlockDay(e.target.value)}
                  className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs text-[#141413]"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="wp-slot" className="font-semibold text-[#262624] block">
                  Khung giờ
                </label>
                <Input
                  id="wp-slot"
                  value={blockSlot}
                  onChange={(e) => setBlockSlot(e.target.value)}
                  placeholder="08:30 - 10:30"
                  className="bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="wp-type" className="font-semibold text-[#262624] block">
                  Loại hoạt động
                </label>
                <select
                  id="wp-type"
                  value={blockType}
                  onChange={(e) => handleBlockTypeChange(e.target.value as WorkBlockType)}
                  className="h-9.5 w-full rounded-lg border border-[#DCE6DF] bg-white px-2.5 text-xs text-[#141413]"
                >
                  {WORK_BLOCK_ORDER.map((wt) => (
                    <option key={wt} value={wt}>
                      {WORK_BLOCK_META[wt].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label htmlFor="wp-title" className="font-semibold text-[#262624] block">
                  Tiêu đề *
                </label>
                <Input
                  id="wp-title"
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="Nhập tên hoạt động..."
                  className="bg-white"
                  required
                />
              </div>

              {isProfessional && (
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="wp-rationale" className="font-semibold text-[#262624] block">
                    Cơ sở EEG
                  </label>
                  <Textarea
                    id="wp-rationale"
                    rows={2}
                    value={blockRationale}
                    onChange={(e) => setBlockRationale(e.target.value)}
                    className="bg-white"
                  />
                </div>
              )}

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-[#DCE6DF]">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowAddBlockModal(false)}>
                  Hủy
                </Button>
                <Button type="submit" size="sm" variant="primary" loading={addWorkBlockMutation.isPending}>
                  Lưu lịch
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

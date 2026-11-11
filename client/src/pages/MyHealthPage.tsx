import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Brain,
  ChevronRight,
  Heart,
  Moon,
  Plus,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Button, Card, Input } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';
import { eegDatasetsApi } from '../api/endpoints';

const DEFAULT_SYMPTOM_LOG = [
  {
    id: 's-01',
    date: 'Hôm nay, 09/11',
    symptom: 'Giấc ngủ sâu cải thiện, tinh thần tỉnh táo buổi sáng, không có triệu chứng đau đầu.',
    type: 'Tích cực',
    score: 'Tốt',
  },
  {
    id: 's-02',
    date: '06/11/2026',
    symptom: 'Mỏi mắt và căng thẳng nhẹ vùng trán sau 4 giờ làm việc liên tục trước màn hình.',
    type: 'Theo dõi',
    score: 'Ổn định',
  },
  {
    id: 's-03',
    date: '02/11/2026',
    symptom: 'Thực hiện bài tập thở sâu điều hòa nhịp sóng não Alpha 15 phút trước khi ngủ.',
    type: 'Thư giãn',
    score: 'Rất tốt',
  },
];

export function MyHealthPage() {
  const { user } = useAuth();
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState<'Tích cực' | 'Thư giãn' | 'Theo dõi'>('Tích cực');
  const storageKey = `neurolink_health_diary_${user?.id || 'guest'}`;

  const [symptomLog, setSymptomLog] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as typeof DEFAULT_SYMPTOM_LOG;
    } catch {
      // ignore storage read error
    }
    return DEFAULT_SYMPTOM_LOG;
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setSymptomLog(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, [storageKey]);

  const { data: myEegData } = useQuery({
    queryKey: ['my-eeg-health-summary', user?.id],
    queryFn: () => eegDatasetsApi.getMyDatasets(),
    enabled: Boolean(user),
  });

  const myDatasets = myEegData?.datasets ?? [];
  const latestDataset = myDatasets[0];
  const uniqueDoctorsCount = new Set(
    myDatasets.flatMap((d) => d.consentedProfessionals.map((p) => p.username)),
  ).size;

  const handleAddEntry = (e: FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSymptomLog((prev) => {
      const updated = [
        {
          id: `s-${Date.now()}`,
          date: 'Vừa xong',
          symptom: newNote.trim(),
          type: newTag,
          score: newTag === 'Theo dõi' ? 'Lưu ý' : 'Tốt',
        },
        ...prev,
      ];
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    setNewNote('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Friendly, White & Soft Neutral Header with Teal & Light Blue Accents (No Dark Gradients) */}
      <div className="rounded-lg border border-teal-200/80 bg-white p-6 sm:p-7 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-800">
              Sức khỏe Cá nhân của {user?.displayName || 'Bạn'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Không gian thân thiện giúp bạn theo dõi giấc ngủ, trạng thái thư giãn tinh thần và lưu giữ nhật ký sức khỏe hàng ngày để chia sẻ cùng bác sĩ khi cần thiết.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/eeg-hub?view=personal">
              <Button
                size="sm"
                variant="outline"
                className="border-sky-200 bg-sky-50/70 text-sky-900 hover:bg-sky-100"
                icon={<Brain className="size-4 text-sky-600" />}
              >
                Hồ sơ My EEG
              </Button>
            </Link>
            <Link to="/search?category=professionals">
              <Button
                size="sm"
                className="bg-teal-700 hover:bg-teal-800 text-white"
                icon={<Heart className="size-4 text-teal-100" />}
              >
                Tìm Bác sĩ Tư vấn
              </Button>
            </Link>
          </div>
        </div>

        {/* Soft Neutral Summary Strip (Low Information Density, Easy to Read) */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-slate-100">
          <div className="flex items-center gap-3.5 rounded-lg bg-[#F0FDFA] border border-teal-200/60 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700 border border-teal-200/60">
              <Zap className="size-5" />
            </div>
            <div>
              <span className="block text-xs font-medium text-teal-900/80">Trạng thái Thư giãn</span>
              <span className="text-base font-bold text-slate-800">Ổn định (88%)</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-lg bg-[#F0F9FF] border border-sky-200/60 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700 border border-sky-200/60">
              <Moon className="size-5" />
            </div>
            <div>
              <span className="block text-xs font-medium text-sky-900/80">Giấc ngủ Trung bình</span>
              <span className="text-base font-bold text-slate-800">7.5 giờ / đêm</span>
            </div>
          </div>

          <div className="flex items-center gap-3.5 rounded-lg bg-slate-50 border border-slate-200/80 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-teal-700 border border-slate-200/80">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <span className="block text-xs font-medium text-slate-600">Hồ sơ EEG & Quyền riêng tư</span>
              <span className="text-base font-bold text-slate-800">
                {myDatasets.length} bản ghi · {uniqueDoctorsCount} bác sĩ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content-Oriented 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Personal Symptom & Sleep Diary */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="p-6 border-slate-200/80 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Nhật ký Cảm nhận & Triệu chứng Hàng ngày
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Ghi chú ngắn gọn về giấc ngủ, sự tập trung hoặc cảm giác của bạn để tiện theo dõi theo thời gian.
              </p>
            </div>

            {/* Simple Add Note Form */}
            <form onSubmit={handleAddEntry} className="rounded-lg bg-slate-50/80 border border-slate-200/80 p-3.5 space-y-3">
              <Input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Hôm nay bạn cảm thấy giấc ngủ và sự tập trung thế nào?"
                className="bg-white"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Nhãn cảm nhận:</span>
                  {(['Tích cực', 'Thư giãn', 'Theo dõi'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewTag(t)}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        newTag === t
                          ? 'bg-teal-700 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-teal-700 hover:bg-teal-800 text-white"
                  icon={<Plus className="size-3.5" />}
                >
                  Lưu nhật ký
                </Button>
              </div>
            </form>

            {/* Readable Diary Entries List */}
            <div className="divide-y divide-slate-100">
              {symptomLog.map((log) => (
                <div key={log.id} className="py-4 first:pt-1 last:pb-1 flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-800">{log.date}</span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          log.type === 'Tích cực'
                            ? 'bg-teal-50 text-teal-800 border border-teal-200'
                            : log.type === 'Thư giãn'
                              ? 'bg-sky-50 text-sky-800 border border-sky-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {log.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">{log.symptom}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 shrink-0">{log.score}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Accessible EEG Summary Block */}
          <Card className="p-6 border-sky-200/80 bg-[#F8FCFF] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-sky-100/80 text-sky-700 border border-sky-200">
                  <Activity className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">
                    Bản ghi Điện não đồ (EEG) Gần nhất của Bạn
                  </h2>
                  <p className="text-xs text-slate-500">
                    {latestDataset
                      ? `Mã hồ sơ ${latestDataset.patientCode} · Đo ngày ${latestDataset.date}`
                      : 'Chưa có bản ghi nào · Nhấn Quản lý My EEG để tải lên'}
                  </p>
                </div>
              </div>
              <Link to="/eeg-hub?view=personal">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white border-sky-200 text-sky-800 hover:bg-sky-50"
                  icon={<ChevronRight className="size-3.5" />}
                >
                  Quản lý My EEG
                </Button>
              </Link>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {latestDataset
                ? latestDataset.clinicalNote
                : 'Bạn có thể tải lên bản ghi EEG cá nhân và chủ động cấp quyền cho bác sĩ chuyên khoa đọc kết quả.'}
            </p>
          </Card>
        </div>

        {/* Right 4 Columns: Plain-Language Brain Health Guides */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-5 border-slate-200/80 space-y-4">
            <h2 className="text-base font-bold text-slate-800">
              Cẩm nang Não bộ Dễ hiểu
            </h2>
            <div className="space-y-4 divide-y divide-slate-100 text-xs sm:text-sm">
              <div className="space-y-1">
                <span className="text-xs font-bold text-teal-700">Sóng não Alpha (8 – 12 Hz)</span>
                <h3 className="font-bold text-slate-800">Vì sao nhắm mắt thư giãn giúp giảm căng thẳng?</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Khi bạn thả lỏng và hít thở đều, sóng Alpha xuất hiện tự nhiên giúp não bộ nghỉ ngơi và phục hồi sự tập trung.
                </p>
              </div>

              <div className="pt-3.5 space-y-1">
                <span className="text-xs font-bold text-sky-700">Giấc ngủ Sâu (Pha N3)</span>
                <h3 className="font-bold text-slate-800">Thói quen giúp não bộ đi vào giấc ngủ sâu</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Tắt thiết bị phát ánh sáng xanh 45 phút trước khi ngủ giúp cơ thể điều hòa nhịp sinh học tự nhiên.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-5 border-teal-200/80 bg-[#F0FDFA] space-y-3">
            <div className="flex items-center gap-2 text-teal-900 font-bold text-sm">
              <ShieldCheck className="size-4.5 text-teal-700" />
              <span>Quyền Làm chủ Dữ liệu của Bạn</span>
            </div>
            <p className="text-xs text-teal-900/85 leading-relaxed">
              Không bác sĩ hay chuyên gia nào có thể tự ý xem dữ liệu EEG của bạn nếu chưa được bạn đồng ý cấp quyền trong mục My EEG.
            </p>
            <Link to="/eeg-hub?view=personal" className="block">
              <Button
                size="sm"
                className="w-full bg-teal-700 hover:bg-teal-800 text-white text-xs"
              >
                Kiểm tra quyền truy cập bác sĩ
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}

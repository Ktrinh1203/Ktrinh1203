import { Link } from 'react-router';
import { Logo } from '../components/layout/AppShell';
import { Button } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';

const ECOSYSTEM_PILLARS = [
  {
    num: '01',
    label: 'Cộng đồng y khoa',
    title: 'Mạng xã hội Y khoa & Não bộ',
    text: 'Thảo luận sức khỏe não bộ và hội chẩn ca bệnh ẩn danh.',
  },
  {
    num: '02',
    label: 'qEEG 10-20',
    title: 'Trạm Đo & Đọc Sóng Não Cortical',
    text: 'Phân tích DAR, BSI, TAR, wPLI và bản đồ vỏ não 2D.',
  },
  {
    num: '03',
    label: 'Data Bank',
    title: 'Kho Dữ liệu & CSDL Mạng Nơ-ron',
    text: 'Chia sẻ dữ liệu EEG chuẩn 4-split và nhận credit bản quyền.',
  },
  {
    num: '04',
    label: 'Tư vấn từ xa',
    title: 'Hỏi Bác sĩ & Đọc Ca Ngoài Giờ',
    text: 'Đính kèm bản ghi sóng não để bác sĩ đọc và tư vấn.',
  },
];

const CLINICAL_CATEGORIES = [
  {
    title: 'Đột quỵ & Mạch máu não',
    metric: 'DAR · BSI · tPA',
    desc: 'Phát hiện sớm sóng chậm khu trú và cảnh báo cấp cứu 115.',
  },
  {
    title: 'Động kinh & Hồi sức ICU',
    metric: 'Spike · Phóng điện',
    desc: 'Theo dõi ổ kịch phát thùy thái dương qua dải tần chuẩn hóa.',
  },
  {
    title: 'Giấc ngủ & Tập trung',
    metric: 'TAR · Đỉnh Alpha',
    desc: 'Đánh giá giấc ngủ sâu N3 và mức độ mệt mỏi thần kinh.',
  },
  {
    title: 'Phần cứng ADS1299 & BCI',
    metric: '500 Hz · Motor Imagery',
    desc: 'Thu tín hiệu 10-20, lọc nhiễu 50 Hz cho giao diện não-máy.',
  },
];

const HONORARIA_POLICIES = [
  {
    item: 'Hỏi đáp & Đọc ca từ xa',
    policy: 'Nhận credit thù lao ngay khi người hỏi nghiệm thu.',
    credit: '+50 credit',
  },
  {
    item: 'Bản quyền Data Bank',
    policy: 'Nhận credit khi đồng nghiệp mở khóa bộ dữ liệu.',
    credit: '+60 credit',
  },
  {
    item: 'Bình duyệt CME',
    policy: 'Tích lũy credit CME qua công bố ca lâm sàng.',
    credit: '+30 credit',
  },
];

export function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5FAF7] text-[#262624]">
      {/* Sticky Navigation Header */}
      <header className="sticky top-0 z-30 border-b border-[#DCE6DF] bg-[#F5FAF7]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#575652]">
              <a href="#ecosystem" className="hover:text-[#15803D] transition-colors">
                Hệ sinh thái
              </a>
              <a href="#categories" className="hover:text-[#15803D] transition-colors">
                4 Nhóm bệnh lý
              </a>
              <a href="#honoraria-cme" className="hover:text-[#15803D] transition-colors">
                Credit & Thù lao
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <Link to="/feed">
                <Button size="sm" variant="primary">
                  Vào Bảng tin
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Đăng nhập
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm" variant="primary">
                    Tham gia miễn phí
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Section 1: Editorial Hero */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
        <div className="grid items-start gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-5">
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#141413] leading-[1.12]">
              Kết nối sức khỏe não bộ, dữ liệu qEEG và bác sĩ chuyên khoa
            </h1>
            <p className="max-w-xl text-base text-[#575652] leading-relaxed">
              Kiểm tra sóng não, hỏi bác sĩ chuyên khoa và theo dõi giấc ngủ mỗi ngày trên một nền tảng gọn gàng, minh bạch.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-2.5">
              <Link to={user ? '/feed' : '/register'}>
                <Button size="lg" variant="primary">
                  {user ? 'Vào Trang chủ' : 'Bắt đầu miễn phí'}
                </Button>
              </Link>
              <Link
                to="/login"
                className="inline-flex h-11 items-center rounded-lg border border-[#DCE6DF] bg-white px-5 text-sm font-medium text-[#141413] hover:bg-[#EFF6F1] transition-colors"
              >
                Đăng nhập
              </Link>
              <a
                href="/clinical-workstation?mode=general"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center rounded-lg border border-[#DCE6DF] bg-white px-5 text-sm font-medium text-[#575652] hover:text-[#15803D] hover:bg-[#EFF6F1] transition-colors"
              >
                Trạm qEEG
              </a>
            </div>
          </div>

          {/* Understated Doctor Q&A Quote Card */}
          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#DCE6DF] bg-white p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#DCE6DF]">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#141413] truncate">
                    Ca hội chẩn #NL-409 · 10-20 EEG
                  </p>
                  <p className="text-[11px] text-[#6E6D68] font-mono tabular-nums mt-0.5">
                    6 kênh · 500 Hz · Đỉnh Alpha 9.8 Hz
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#15803D] shrink-0">
                  <span className="size-1.5 rounded-full bg-[#16A34A]" aria-hidden />
                  Đã phản hồi
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="text-sm sm:text-base font-semibold text-[#141413] leading-snug">
                  Đọc sóng chậm bán cầu trái (F3/C3) và đánh giá mệt mỏi Alpha
                </h2>
                <p className="text-xs text-[#6E6D68] font-mono tabular-nums">
                  DAR 1.85 · BSI 0.14 · TAR 1.12
                </p>
              </div>

              <blockquote className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-4 space-y-2">
                <p className="text-xs sm:text-sm text-[#262624] leading-relaxed">
                  “Chỉ số BSI 0.14 nằm dưới ngưỡng lệch bán cầu cấp tính. Sóng chậm nhẹ vùng F3/C3 phù hợp trạng thái thiếu ngủ kéo dài; nên nghỉ ngơi đủ 7.5 giờ và đo kiểm tra lại sau 7 ngày.”
                </p>
                <footer className="flex items-center justify-between gap-2 pt-1 text-[11px] text-[#6E6D68]">
                  <span className="font-medium text-[#141413]">BS.CKII Trần Thanh Hải · Nội Thần kinh</span>
                  <span className="font-mono text-[#16A34A] font-semibold shrink-0">+50 credit</span>
                </footer>
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1.5: 3-Step Simple Onboarding Strip */}
      <section className="border-t border-[#DCE6DF] bg-white py-12 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#141413]">
              Cách sử dụng đơn giản trong 3 bước
            </h2>
            <Link to="/login" className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline shrink-0">
              Đăng nhập ngay →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 rounded-xl border border-[#DCE6DF] bg-white divide-y md:divide-y-0 md:divide-x divide-[#DCE6DF]">
            <div className="p-5 sm:p-6 space-y-2">
              <span className="block font-mono text-xs font-medium text-[#16A34A]">01</span>
              <h3 className="text-base font-semibold text-[#141413]">
                Đo hoặc chọn mẫu sóng não
              </h3>
              <p className="text-sm text-[#575652] leading-relaxed">
                Chọn mẫu thử hoặc tải tệp .csv để kiểm tra độ tỉnh táo.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-2">
              <span className="block font-mono text-xs font-medium text-[#16A34A]">02</span>
              <h3 className="text-base font-semibold text-[#141413]">
                Xem kết quả &amp; Hỏi Bác sĩ
              </h3>
              <p className="text-sm text-[#575652] leading-relaxed">
                Xem giải thích dễ hiểu và gửi triệu chứng để bác sĩ tư vấn.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-2">
              <span className="block font-mono text-xs font-medium text-[#16A34A]">03</span>
              <h3 className="text-base font-semibold text-[#141413]">
                Ghi nhật ký &amp; Lịch hôm nay
              </h3>
              <p className="text-sm text-[#575652] leading-relaxed">
                Chấm nhanh giấc ngủ mỗi ngày để nhận gợi ý giờ nghỉ ngơi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: 4 Core Ecosystem Pillars */}
      <section id="ecosystem" className="border-t border-[#DCE6DF] bg-[#F5FAF7] py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413]">
              Từ theo dõi cá nhân đến trạm đọc qEEG và dữ liệu nghiên cứu
            </h2>
          </div>

          <ol className="rounded-xl border border-[#DCE6DF] divide-y divide-[#DCE6DF] bg-white px-4 sm:px-6">
            {ECOSYSTEM_PILLARS.map(({ num, label, title, text }) => (
              <li
                key={num}
                className="py-5 sm:py-6 grid gap-2 sm:grid-cols-12 sm:items-baseline sm:gap-6"
              >
                <span className="font-mono text-xs font-semibold text-[#16A34A] tabular-nums sm:col-span-1">
                  {num}
                </span>
                <div className="sm:col-span-4 space-y-0.5">
                  <h3 className="font-semibold text-[#141413] text-base leading-snug">{title}</h3>
                  <p className="text-xs text-[#6E6D68]">{label}</p>
                </div>
                <p className="text-sm text-[#575652] leading-relaxed sm:col-span-7">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Section 3: 4 Clinical Categories */}
      <section id="categories" className="border-t border-[#DCE6DF] bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413]">
              4 nhóm bệnh lý &amp; tín hiệu điện não trọng tâm
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 rounded-xl overflow-hidden border border-[#DCE6DF] bg-white">
            {CLINICAL_CATEGORIES.map((cat) => (
              <div
                key={cat.title}
                className="border-b md:odd:border-r border-[#DCE6DF] last:border-b-0 md:nth-[3]:border-b-0 p-6 sm:p-7 space-y-2"
              >
                <p className="text-xs font-mono text-[#16A34A] font-semibold">{cat.metric}</p>
                <h3 className="font-semibold text-[#141413] text-base">{cat.title}</h3>
                <p className="text-sm text-[#575652] leading-relaxed">{cat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Honoraria, Consultation & Data Bank Royalty */}
      <section id="honoraria-cme" className="border-t border-[#DCE6DF] bg-[#F5FAF7] py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="rounded-xl border border-[#DCE6DF] divide-y divide-[#DCE6DF] bg-white px-5 sm:px-6">
                {HONORARIA_POLICIES.map((row) => (
                  <div
                    key={row.item}
                    className="py-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 sm:gap-6"
                  >
                    <div className="space-y-1">
                      <h3 className="text-sm sm:text-base font-semibold text-[#141413]">{row.item}</h3>
                      <p className="text-xs sm:text-sm text-[#575652] leading-relaxed">{row.policy}</p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-[#16A34A] tabular-nums">
                      {row.credit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4 lg:pl-4">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413] leading-tight">
                Ghi nhận xứng đáng cho bác sĩ và người đóng góp dữ liệu
              </h2>
              <p className="text-sm sm:text-base text-[#575652] leading-relaxed">
                Tặng 250 credit khởi đầu cho thành viên mới; bác sĩ nhận thù lao qua đọc ca và CME.
              </p>
              <div className="pt-2">
                <Link to={user ? '/rewards' : '/register'}>
                  <Button size="lg" variant="primary">
                    {user ? 'Mở Ví Credit' : 'Đăng ký ngay'}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#DCE6DF] bg-[#F5FAF7] text-[#575652]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>
            Thông tin trên NeuroLink hỗ trợ theo dõi sức khỏe và nghiên cứu học thuật, không thay thế cấp cứu hoặc khám trực tiếp tại bệnh viện.
          </p>
          <p className="font-semibold text-[#141413] shrink-0">NeuroLink Clinical &amp; BCI Platform</p>
        </div>
      </footer>
    </div>
  );
}

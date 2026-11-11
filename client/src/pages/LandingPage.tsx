import { Link } from 'react-router';
import {
  Activity,
  Award,
  Brain,
  CheckCircle2,
  MessageCircle,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Logo } from '../components/layout/AppShell';
import { Button } from '../components/ui';
import { useAuth } from '../features/auth/AuthContext';

const FEATURES = [
  {
    icon: Stethoscope,
    badge: 'SOLVED • LÂM SÀNG',
    badgeClass: 'bg-accent-50 text-accent-700 border-accent-100',
    title: 'Hội chẩn Ca bệnh Thực tế',
    text: 'Thảo luận ca bệnh khó, chia sẻ hình ảnh MRI/CT/EEG đã ẩn danh và nhận phác đồ đồng thuận từ hàng trăm bác sĩ chuyên khoa.',
  },
  {
    icon: Award,
    badge: 'HONORARIA & CME',
    badgeClass: 'bg-brand-50 text-brand-700 border-brand-200',
    title: 'Tích lũy Tín chỉ & Thù lao',
    text: 'Nhận điểm tín chỉ CME và quyền lợi học thuật khi đóng góp bài phân tích chuyên môn, khảo sát y tế và phản biện khoa học.',
  },
  {
    icon: Brain,
    badge: 'BCI & NEUROSCIENCE',
    badgeClass: 'bg-brand-50 text-brand-700 border-brand-200',
    title: 'Hợp tác Nghiên cứu Thần kinh',
    text: 'Kết nối trực tiếp giữa Bác sĩ lâm sàng và Nhà nghiên cứu giao diện não - máy (BCI), giải mã tín hiệu EEG/fMRI.',
  },
  {
    icon: Users,
    badge: 'VERIFIED HCP',
    badgeClass: 'bg-accent-50 text-accent-700 border-accent-100',
    title: 'Mạng lưới Chuyên gia Xác thực',
    text: '100% chuyên gia y tế và nhà nghiên cứu được cấp huy hiệu xác minh dựa trên chứng chỉ hành nghề (CCHN) và hồ sơ ORCID.',
  },
];

export function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-slate-800">
      {/* Sermo-style Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-[1280px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-700">
              <a href="#clinical-cases" className="hover:text-brand-600 transition-colors">
                Hội chẩn Ca bệnh
              </a>
              <a href="#honoraria-cme" className="hover:text-brand-600 transition-colors">
                Honoraria & CME
              </a>
              <a href="#verified-network" className="hover:text-brand-600 transition-colors">
                Mạng lưới Bác sĩ & BCI
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            {user ? (
              <Link to="/feed">
                <Button size="md" className="px-5 bg-brand-600 hover:bg-brand-700 text-white">
                  Vào bảng tin HCP
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="md" className="font-bold text-slate-800 hover:text-brand-600">
                    Đăng nhập
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="md" className="px-5 bg-brand-600 hover:bg-brand-700 text-white">
                    Tham gia miễn phí
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Section 1: Sermo 2-Column Hero */}
      <section className="mx-auto max-w-[1280px] px-4 pt-10 pb-16 sm:px-6 lg:pt-16 lg:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Typography & Call to Action */}
          <div className="lg:col-span-6 space-y-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-600">
              YOUR PEERS. YOUR PERSPECTIVE. YOUR COMMUNITY.
            </p>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 leading-[1.12]">
              Biến tri thức lâm sàng &{' '}
              <span className="text-brand-600">khoa học thần kinh</span> thành hành động
            </h1>
            <p className="max-w-xl text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              NeuroLink là nền tảng hội chẩn y khoa, thảo luận nghiên cứu BCI và tích lũy tín chỉ CME dành riêng cho Bác sĩ lâm sàng, Chuyên gia Y tế và Nhà nghiên cứu đã xác thực.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              {user ? (
                <Link to="/feed">
                  <Button size="lg" className="px-7 bg-brand-600 hover:bg-brand-700 text-white">
                    Mở Bảng tin Lâm sàng
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg" className="px-7 shadow-sm bg-brand-600 hover:bg-brand-700 text-white">
                      Đăng ký Tài khoản Chuyên gia
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button size="lg" variant="outline" className="px-6 border-slate-300 text-slate-700">
                      Đăng nhập thành viên
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-6 text-xs font-semibold text-slate-500 border-t border-slate-200/80">
              <span className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="size-4 text-accent-600" /> Xác thực CCHN & ORCID
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="size-4 text-brand-600" /> Tích lũy Honoraria & CME
              </span>
              <span className="flex items-center gap-1.5 text-slate-700">
                <CheckCircle2 className="size-4 text-accent-600" /> Thảo luận Ca bệnh Chuyên sâu
              </span>
            </div>
          </div>

          {/* Right Column: Sermo Clinical Case & X-Ray/EEG Discussion Showcase */}
          <div id="clinical-cases" className="lg:col-span-6 relative">
            <div className="rounded-xl border border-slate-200 bg-[#F4F5F8] p-4 sm:p-6 shadow-sm">
              {/* Clinical Case Card (Sermo Motif) */}
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      BS
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">PGS.TS. Nguyễn Minh Quân</span>
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-200">
                          Nội Thần kinh
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">Ca lâm sàng #NL-409 · 18 phút trước</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded bg-accent-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-accent-700 border border-accent-100">
                    <CheckCircle2 className="size-3 text-accent-600" /> SOLVED
                  </span>
                </div>

                <h3 className="mt-3 text-sm sm:text-base font-bold text-slate-800">
                  Rối loạn vận động tinh kèm dao động sóng Beta bất thường vùng vỏ não vận động
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Bệnh nhân nam 54 tuổi, ghi nhận cụm sóng Beta (18–26 Hz) tăng đồng bộ kéo dài trên điện não đồ bề mặt. Xin ý kiến hội chẩn phác đồ kết hợp kích thích từ xuyên sọ (rTMS).
                </p>

                {/* Dark Clinical MRI / EEG Viewer Frame (Calm Slate Viewer) */}
                <div className="mt-3.5 rounded-lg bg-slate-900 p-3.5 text-white border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-2 border-b border-slate-800">
                    <span className="flex items-center gap-1.5 text-accent-300 font-bold">
                      <Activity className="size-3.5" /> EEG / C3-C4 MOTOR CORTEX SPECTRUM
                    </span>
                    <span>250 Hz · Δβ +42%</span>
                  </div>
                  <svg
                    viewBox="0 0 420 68"
                    className="w-full h-14 mt-2 overflow-visible"
                    aria-hidden="true"
                  >
                    <path
                      d="M0 34 L25 34 L35 16 L45 52 L55 10 L65 56 L75 28 L95 34 L130 34 L142 12 L152 58 L162 8 L172 54 L184 34 L230 34 L242 18 L252 50 L262 12 L272 55 L285 34 L330 34 L342 14 L352 54 L362 18 L374 34 L420 34"
                      fill="none"
                      stroke="#5AA39A"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M0 52 L60 52 L80 42 L100 58 L120 46 L160 52 L210 52 L230 38 L250 60 L270 48 L320 52 L420 52"
                      fill="none"
                      stroke="#94A3B8"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Peer Chat Bubble Responses (Calm Slate Tint) */}
                <div className="mt-3.5 space-y-2">
                  <div className="flex items-start gap-2.5 rounded-lg bg-brand-50 border border-brand-200/80 p-3 text-slate-800">
                    <MessageCircle className="size-4 shrink-0 mt-0.5 text-brand-600" />
                    <div className="text-xs leading-snug">
                      <span className="font-bold text-brand-800">BS.CKII Trần Thanh Hải:</span> Đáp ứng rất tốt với rTMS tần số thấp 1Hz kết hợp hiệu chỉnh liều Dopaminergic sau 14 ngày.
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600 border border-slate-200/80">
                    <span>48 Bác sĩ & Nhà nghiên cứu đã tham gia hội chẩn</span>
                    <span className="text-brand-700 font-bold">+30 CME</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Sermo "EARN / Get rewarded for what you know" Split-Card Showcase */}
      <section id="honoraria-cme" className="border-y border-slate-200/80 bg-[#F4F6F8] py-16">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            {/* Left Column: Sermo 3 Stacked Split-Cards */}
            <div className="lg:col-span-6 space-y-3.5">
              {/* Card 1 */}
              <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <div className="flex-1 p-4 sm:p-5">
                  <span className="inline-block rounded bg-accent-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-700">
                    Hội chẩn Lâm sàng
                  </span>
                  <h3 className="mt-1.5 text-sm sm:text-base font-bold text-slate-800">
                    Phân tích Ca bệnh Thần kinh & Đột quỵ cấp
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Chia sẻ phác đồ xử trí lâm sàng được Hội đồng chuyên môn phê duyệt
                  </p>
                </div>
                <div className="flex w-28 sm:w-32 shrink-0 flex-col items-center justify-center bg-accent-50 border-l border-accent-100 px-3 text-accent-700">
                  <span className="text-xl sm:text-2xl font-black leading-none">+30</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">Tín chỉ CME</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="flex items-stretch overflow-hidden rounded-xl border border-brand-300 bg-white shadow-xs sm:translate-x-3">
                <div className="flex-1 p-4 sm:p-5">
                  <span className="inline-block rounded bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    Nghiên cứu BCI & EEG
                  </span>
                  <h3 className="mt-1.5 text-sm sm:text-base font-bold text-slate-800">
                    Công bố Báo cáo & Giải mã Tín hiệu Thần kinh
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Đóng góp dữ liệu học thuật, thuật toán DSP/EEG hoặc bài tổng quan hệ thống
                  </p>
                </div>
                <div className="flex w-28 sm:w-32 shrink-0 flex-col items-center justify-center bg-brand-600 px-3 text-white">
                  <span className="text-xl sm:text-2xl font-black leading-none">+50</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">Tín chỉ CME</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="flex items-stretch overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-xs">
                <div className="flex-1 p-4 sm:p-5">
                  <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                    Phản biện Học thuật
                  </span>
                  <h3 className="mt-1.5 text-sm sm:text-base font-bold text-slate-800">
                    Giải đáp Chuyên gia & Thẩm định Hồ sơ Khoa học
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Tham gia phản biện đồng cấp (Peer Review) và hướng dẫn bác sĩ nội trú
                  </p>
                </div>
                <div className="flex w-28 sm:w-32 shrink-0 flex-col items-center justify-center bg-slate-100 border-l border-slate-200 px-3 text-slate-700">
                  <span className="text-xl sm:text-2xl font-black leading-none">+20</span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider">Tín chỉ CME</span>
                </div>
              </div>
            </div>

            {/* Right Column: Sermo EARN Headline & Explanation */}
            <div className="lg:col-span-6 space-y-4 lg:pl-6">
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-600">
                EARN • HONORARIA & CME CREDITS
              </p>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-800 leading-tight">
                Nhận sự ghi nhận và quyền lợi xứng đáng với tri thức y khoa của bạn
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Mọi bài phân tích ca lâm sàng, báo cáo nghiên cứu thần kinh học và đóng góp học thuật được duyệt trên NeuroLink đều được quy đổi minh bạch vào Sổ cái Tín chỉ (Credit Wallet) để đổi khóa học CME, vé hội nghị y khoa và tài nguyên nghiên cứu.
              </p>
              <div className="pt-2">
                <Link to={user ? '/contributions' : '/register'}>
                  <Button size="lg" className="px-6 bg-brand-600 hover:bg-brand-700 text-white">
                    Khám phá Chương trình Honoraria & CME
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: 4 Core Pillars */}
      <section id="verified-network" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-600">
            HYBRID HEALTHCARE & NEUROSCIENCE PLATFORM
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-slate-800">
            Thiết kế chuyên biệt cho Y khoa & Khoa học Thần kinh
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, badge, badgeClass, title, text }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs hover:border-brand-300 transition-colors"
            >
              <div className="mb-3.5 flex items-center justify-between">
                <div className="inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-600">
                  <Icon className="size-5" />
                </div>
                <span className={`rounded border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${badgeClass}`}>
                  {badge}
                </span>
              </div>
              <h3 className="font-bold text-slate-800 text-base">{title}</h3>
              <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200/80 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3 px-4 py-8 text-xs text-slate-400 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2 text-slate-300">
            <ShieldCheck className="size-4 text-accent-500 shrink-0" />
            Nội dung thảo luận chuyên môn trên NeuroLink phục vụ mục đích học thuật và tham khảo lâm sàng, không thay thế chỉ định y khoa trực tiếp.
          </p>
          <p className="font-semibold text-white">NeuroLink HCP & BCI Community · PBL4_Web</p>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDown, ArrowRight, Menu, X } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { assetUrl } from '../lib/assets';
import { LANDING_COPY, type ExperienceTabId, type LandingLang } from './landingContent';

const LANG_STORAGE_KEY = 'neurolink_landing_lang';

function resolveInitialLang(urlLang: string | null): LandingLang {
  if (urlLang === 'en' || urlLang === 'vi') return urlLang;
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {
    // Ignore storage access errors in restricted contexts
  }
  return 'en';
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

function RevealBlock({
  children,
  className = '',
  reducedMotion,
}: {
  children: ReactNode;
  className?: string;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState<boolean>(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setRevealed(true);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.95) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.06, rootMargin: '60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className={[
        reducedMotion
          ? 'opacity-100'
          : 'transition-[opacity,transform] duration-600 ease-[cubic-bezier(0.16,1,0.3,1)]',
        revealed || reducedMotion ? 'opacity-100 translate-y-0' : 'opacity-90 translate-y-3',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}

function LandingLogo({ href = '#top' }: { href?: string }) {
  return (
    <a
      href={href}
      className="group inline-flex shrink-0 items-center gap-2 sm:gap-2.5 select-none rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16A34A]"
    >
      <img
        src={assetUrl('logo.svg')}
        alt="NeuroLink"
        width={34}
        height={34}
        className="size-7.5 sm:size-8.5 shrink-0"
      />
      <div className="flex flex-col items-start min-w-0">
        <span className="text-[18px] sm:text-[21px] leading-none font-extrabold tracking-[-0.04em] text-[#111827]">
          neuro<span className="text-[#16A34A]">link</span>
        </span>
        <svg
          viewBox="0 0 112 12"
          fill="none"
          aria-hidden="true"
          className="w-[68px] sm:w-[84px] h-[9px] sm:h-[10px] -mt-0.5 overflow-visible text-[#16A34A]"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M2 6 H44 L49 1.5 L55 10.5 L60 3.5 L63.5 6 H108"
            pathLength={48}
            strokeDasharray={48}
            className="group-hover:animate-[ecg-flow_750ms_cubic-bezier(0.16,1,0.3,1)]"
          />
        </svg>
      </div>
    </a>
  );
}

function AlphaWaveLine({
  label,
  caption,
  reducedMotion,
}: {
  label: string;
  caption: string;
  reducedMotion: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#F6FAF7] px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between gap-4 mb-2.5">
        <span className="text-xs font-medium text-[#15803D]">{caption}</span>
        <span className="size-2 rounded-full bg-[#16A34A]" aria-hidden="true" />
      </div>
      <svg
        viewBox="0 0 420 56"
        fill="none"
        role="img"
        aria-label={label}
        className="block h-12 w-full overflow-hidden"
      >
        <defs>
          <linearGradient id="alpha-wave-fade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0.18" />
            <stop offset="22%" stopColor="#16A34A" stopOpacity="0.9" />
            <stop offset="78%" stopColor="#15803D" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path
          d="M-52 28 C -34 10, -18 10, 0 28 C 18 46, 34 46, 52 28 C 70 10, 86 10, 104 28 C 122 46, 138 46, 156 28 C 174 10, 190 10, 208 28 C 226 46, 242 46, 260 28 C 278 10, 294 10, 312 28 C 330 46, 346 46, 364 28 C 382 10, 398 10, 416 28 C 434 46, 450 46, 468 28"
          stroke="url(#alpha-wave-fade)"
          strokeWidth="2.25"
          strokeLinecap="round"
          style={
            reducedMotion
              ? undefined
              : {
                  animation: 'alpha-slide 5s linear infinite',
                }
          }
        />
      </svg>
    </div>
  );
}

function BrowserFrame({
  title,
  src,
  alt,
}: {
  title: string;
  src: string;
  alt: string;
}) {
  return (
    <div className="rounded-2xl border border-[#DCE6DF] bg-white shadow-[0_24px_60px_-26px_rgba(20,83,45,0.18)] overflow-hidden">
      <div className="flex h-8 items-center gap-3 border-b border-[#DCE6DF] bg-[#F8FAF9] px-3.5">
        <span className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
          <span className="size-2 rounded-full bg-[#DCE6DF]" />
          <span className="size-2 rounded-full bg-[#DCE6DF]" />
          <span className="size-2 rounded-full bg-[#DCE6DF]" />
        </span>
        <span className="truncate text-[11px] font-medium text-[#526058]">{title}</span>
      </div>
      <div className="aspect-[16/10] w-full bg-[#F5FAF7]">
        <img
          key={src}
          src={src}
          alt={alt}
          width={1440}
          height={900}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}

function PhoneFrame({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="rounded-[28px] border-[5px] border-[#111827] bg-white shadow-[0_24px_48px_-16px_rgba(17,24,39,0.28)] overflow-hidden">
      <div className="flex h-4 items-center justify-center bg-[#111827]" aria-hidden="true">
        <span className="h-1 w-10 rounded-full bg-[#374151]" />
      </div>
      <div className="aspect-[375/812] w-full bg-[#F5FAF7]">
        <img
          key={src}
          src={src}
          alt={alt}
          width={375}
          height={812}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover object-top"
        />
      </div>
    </div>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();

  const [lang, setLang] = useState<LandingLang>(() => resolveInitialLang(searchParams.get('lang')));
  const [activeExpId, setActiveExpId] = useState<ExperienceTabId>('brainwave');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const tabRefs = useRef<Partial<Record<ExperienceTabId, HTMLButtonElement | null>>>({});

  const urlLang = searchParams.get('lang');
  useEffect(() => {
    if (urlLang === 'en' || urlLang === 'vi') {
      setLang(urlLang);
    }
  }, [urlLang]);

  const copy = LANDING_COPY[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = copy.metaTitle;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage access errors
    }
  }, [lang, copy.metaTitle]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  function switchLanguage(nextLang: LandingLang) {
    if (nextLang === lang) return;
    setLang(nextLang);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('lang', nextLang);
        return next;
      },
      { replace: true },
    );
  }

  const activeExperience =
    copy.experience.items.find((item) => item.id === activeExpId) ?? copy.experience.items[0];

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, currentIdx: number) {
    const items = copy.experience.items;
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (currentIdx + 1) % items.length;
    if (e.key === 'ArrowLeft') nextIdx = (currentIdx - 1 + items.length) % items.length;
    if (e.key === 'Home') nextIdx = 0;
    if (e.key === 'End') nextIdx = items.length - 1;
    if (nextIdx === null) return;
    e.preventDefault();
    const nextTab = items[nextIdx];
    setActiveExpId(nextTab.id);
    tabRefs.current[nextTab.id]?.focus();
  }

  const primaryDestination = user ? '/feed' : '/register';

  return (
    <div id="top" className="min-h-screen bg-white text-[#1F2937] overflow-x-clip">
      <style>{`
        @keyframes alpha-slide {
          from { transform: translateX(0); }
          to { transform: translateX(-104px); }
        }
      `}</style>

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[#14532D] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {copy.nav.skipToContent}
      </a>

      {/* Sticky Minimal Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#DCE6DF]/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-8 min-w-0">
            <LandingLogo href="#top" />
            <nav
              aria-label={copy.nav.primaryAria}
              className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#374151] whitespace-nowrap"
            >
              <a href="#why" className="hover:text-[#15803D] transition-colors">
                {copy.nav.why}
              </a>
              <a href="#signal" className="hover:text-[#15803D] transition-colors">
                {copy.nav.signal}
              </a>
              <a href="#experience" className="hover:text-[#15803D] transition-colors">
                {copy.nav.experience}
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Language Switcher EN | VI */}
            <div
              role="group"
              aria-label={copy.nav.langToggleLabel}
              className="inline-flex items-center rounded-lg border border-[#DCE6DF] bg-[#F8FAF9] p-0.5"
            >
              <button
                type="button"
                aria-pressed={lang === 'en'}
                onClick={() => switchLanguage('en')}
                className={[
                  'min-h-8 min-w-9 rounded-md px-2.5 text-xs font-semibold transition-colors cursor-pointer',
                  lang === 'en'
                    ? 'bg-[#15803D] text-white'
                    : 'text-[#374151] hover:text-[#14532D]',
                ].join(' ')}
              >
                EN
              </button>
              <button
                type="button"
                aria-pressed={lang === 'vi'}
                onClick={() => switchLanguage('vi')}
                className={[
                  'min-h-8 min-w-9 rounded-md px-2.5 text-xs font-semibold transition-colors cursor-pointer',
                  lang === 'vi'
                    ? 'bg-[#15803D] text-white'
                    : 'text-[#374151] hover:text-[#14532D]',
                ].join(' ')}
              >
                VI
              </button>
            </div>

            {/* Desktop & Tablet Auth Actions */}
            <div className="hidden sm:flex items-center gap-2 whitespace-nowrap">
              {user ? (
                <Link
                  to="/feed"
                  className="inline-flex h-9 items-center rounded-lg bg-[#15803D] px-4 text-sm font-semibold text-white hover:bg-[#166534] transition-colors"
                >
                  {copy.nav.openWorkspace}
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-[#374151] hover:bg-[#F5FAF7] hover:text-[#14532D] transition-colors"
                  >
                    {copy.nav.signIn}
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex h-9 items-center rounded-lg bg-[#15803D] px-3.5 lg:px-4 text-sm font-semibold text-white hover:bg-[#166534] transition-colors"
                  >
                    {copy.nav.getStarted}
                  </Link>
                </>
              )}
            </div>

            {/* Mobile & Tablet Menu Toggle (< 1024px) */}
            <button
              type="button"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? copy.nav.menuCloseLabel : copy.nav.menuOpenLabel}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex size-10 items-center justify-center rounded-lg border border-[#DCE6DF] bg-white text-[#111827] hover:bg-[#F5FAF7] lg:hidden"
            >
              {mobileMenuOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Drawer */}
        {mobileMenuOpen && (
          <div
            id="mobile-nav-drawer"
            className="border-t border-[#DCE6DF] bg-white px-4 py-4 lg:hidden"
          >
            <nav aria-label={copy.nav.mobileAria} className="flex flex-col gap-1">
              <a
                href="#why"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1F2937] hover:bg-[#F5FAF7]"
              >
                {copy.nav.why}
              </a>
              <a
                href="#signal"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1F2937] hover:bg-[#F5FAF7]"
              >
                {copy.nav.signal}
              </a>
              <a
                href="#experience"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#1F2937] hover:bg-[#F5FAF7]"
              >
                {copy.nav.experience}
              </a>
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-[#DCE6DF] pt-3 sm:hidden">
              {user ? (
                <Link
                  to="/feed"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-[#15803D] px-4 text-sm font-semibold text-white"
                >
                  {copy.nav.openWorkspace}
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg bg-[#15803D] px-4 text-sm font-semibold text-white"
                  >
                    {copy.nav.getStarted}
                  </Link>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex h-10 items-center justify-center rounded-lg border border-[#DCE6DF] bg-white px-4 text-sm font-medium text-[#111827]"
                  >
                    {copy.nav.signIn}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main id="main-content">
        {/* SECTION 01 — HERO (Full-Bleed Editorial Poster) */}
        <section className="relative overflow-hidden bg-[#F7FAF8]">
          <div className="relative z-10 mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-10 lg:flex lg:min-h-[620px] xl:min-h-[660px] lg:items-center lg:py-24">
            <div className="max-w-[540px] space-y-6">
              <h1 className="text-[clamp(2.35rem,5vw,4rem)] font-bold tracking-[-0.035em] leading-[1.06] text-[#111827]">
                {copy.hero.headline}
              </h1>
              <p className="max-w-[44ch] text-base sm:text-lg leading-relaxed text-[#2D3B32]">
                {copy.hero.support}
              </p>
              <div className="flex flex-wrap items-center gap-5 pt-2">
                <Link
                  to={primaryDestination}
                  className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#15803D] px-6 text-sm sm:text-base font-semibold text-white hover:bg-[#166534] transition-colors shadow-[0_12px_28px_-12px_rgba(21,128,61,0.45)]"
                >
                  <span>{user ? copy.hero.primaryCtaAuthed : copy.hero.primaryCta}</span>
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <a
                  href="#why"
                  className="inline-flex h-12 items-center gap-1.5 text-sm sm:text-base font-medium text-[#14532D] hover:text-[#15803D] transition-colors"
                >
                  <span>{copy.hero.scrollCta}</span>
                  <ArrowDown className="size-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <div className="relative aspect-[16/9] w-full lg:aspect-auto lg:absolute lg:inset-0 lg:z-0">
            <img
              src={assetUrl('landing/story/hero-editorial.jpg')}
              alt={copy.hero.imageAlt}
              width={1920}
              height={1080}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="block h-full w-full object-cover object-[76%_20%] lg:object-[78%_28%]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none hidden lg:block lg:absolute lg:inset-0 bg-[linear-gradient(90deg,#F8FAF9_0%,#F8FAF9_38%,rgba(248,250,249,0.92)_48%,rgba(248,250,249,0.34)_62%,rgba(248,250,249,0)_74%)]"
            />
          </div>
        </section>

        {/* SECTION 02 — WHY BRAIN HEALTH MATTERS (Forest Emerald Editorial Poster) */}
        <section id="why" className="scroll-mt-16 relative overflow-hidden bg-[#0E341E] text-white">
          <div className="relative aspect-[16/9] w-full md:aspect-auto md:absolute md:inset-0 md:z-0">
            <img
              src={assetUrl('landing/story/why-brain-poster.jpg')}
              alt={copy.why.imageAlt}
              width={1920}
              height={1080}
              loading="lazy"
              decoding="async"
              className="block h-full w-full object-cover object-[28%_center] md:object-left"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,#0E341E_0%,rgba(14,52,30,0.45)_35%,rgba(14,52,30,0)_70%)] md:bg-[linear-gradient(270deg,rgba(14,52,30,0.96)_0%,rgba(14,52,30,0.9)_42%,rgba(14,52,30,0.42)_64%,rgba(14,52,30,0.08)_86%)]"
            />
          </div>

          <RevealBlock
            reducedMotion={reducedMotion}
            className="relative z-10 mx-auto max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-20 md:flex md:min-h-[560px] lg:min-h-[620px] md:items-center md:py-24"
          >
            <div className="md:ml-auto md:max-w-[390px] lg:max-w-[530px] space-y-6">
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-[-0.03em] leading-[1.12] text-white">
                {copy.why.headline}
              </h2>
              <p className="max-w-[52ch] text-base sm:text-lg leading-relaxed text-[#E6F4EB]">
                {copy.why.body}
              </p>
            </div>
          </RevealBlock>
        </section>

        {/* SECTION 03 — THE DEVICE AND SIGNAL EXPERIENCE */}
        <section id="signal" className="scroll-mt-16 bg-white py-20 sm:py-28">
          <RevealBlock reducedMotion={reducedMotion} className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center space-y-4 mb-12 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-[-0.03em] leading-[1.12] text-[#111827]">
                {copy.signal.headline}
              </h2>
              <p className="mx-auto max-w-[56ch] text-base sm:text-lg leading-relaxed text-[#374151]">
                {copy.signal.lead}
              </p>
            </div>

            <div className="grid items-stretch gap-6 lg:grid-cols-12">
              <div className="lg:col-span-8 overflow-hidden rounded-3xl bg-[#F5F7F5] shadow-[0_24px_60px_-28px_rgba(14,52,30,0.16)]">
                <img
                  src={assetUrl('landing/story/device-prototype-studio.jpg')}
                  alt={copy.signal.studioImageAlt}
                  width={1920}
                  height={1080}
                  loading="lazy"
                  decoding="async"
                  className="block h-full w-full object-cover"
                />
              </div>

              <div className="lg:col-span-4 flex flex-col gap-5">
                <div className="flex-1 overflow-hidden rounded-3xl bg-[#F5F7F5] shadow-[0_20px_50px_-26px_rgba(14,52,30,0.14)] aspect-[4/3] lg:aspect-auto">
                  <img
                    src={assetUrl('landing/story/device-sensor-macro.jpg')}
                    alt={copy.signal.macroImageAlt}
                    width={1200}
                    height={900}
                    loading="lazy"
                    decoding="async"
                    className="block h-full w-full object-cover"
                  />
                </div>
                <AlphaWaveLine
                  label={copy.signal.waveLabel}
                  caption={copy.signal.waveCaption}
                  reducedMotion={reducedMotion}
                />
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-2xl text-center text-xs sm:text-sm leading-relaxed text-[#526058]">
              {copy.signal.prototypeNote}
            </p>
          </RevealBlock>
        </section>

        {/* SECTION 04 — ONE CONNECTED ECOSYSTEM */}
        <section id="ecosystem" className="scroll-mt-16 bg-[#F6FAF7] py-20 sm:py-28">
          <RevealBlock reducedMotion={reducedMotion} className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center space-y-4 mb-14 sm:mb-16">
              <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-[-0.03em] leading-[1.12] text-[#111827]">
                {copy.ecosystem.headline}
              </h2>
              <p className="mx-auto max-w-[54ch] text-base sm:text-lg leading-relaxed text-[#374151]">
                {copy.ecosystem.lead}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-10 md:grid-cols-3 lg:gap-12">
              {copy.ecosystem.items.map((item) => (
                <article key={item.id} className="flex flex-col">
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#E8EFEA] shadow-[0_18px_44px_-24px_rgba(14,52,30,0.16)]">
                    <img
                      src={assetUrl(item.image)}
                      alt={item.imageAlt}
                      width={1200}
                      height={900}
                      loading="lazy"
                      decoding="async"
                      className="block h-full w-full object-cover object-[50%_20%]"
                    />
                  </div>
                  <h3 className="mt-6 text-xl font-bold tracking-[-0.02em] text-[#111827]">
                    {item.role}
                  </h3>
                  <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-[#374151]">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>

            <p className="mt-14 text-center text-sm sm:text-base font-medium text-[#15803D]">
              {copy.ecosystem.closingNote}
            </p>
          </RevealBlock>
        </section>

        {/* SECTION 05 — EXPERIENCE NEUROLINK (ONLY Software UI Showcase) */}
        <section id="experience" className="scroll-mt-16 bg-white py-20 sm:py-28">
          <RevealBlock reducedMotion={reducedMotion} className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl space-y-3">
                <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-[-0.03em] leading-[1.12] text-[#111827]">
                  {copy.experience.headline}
                </h2>
                <p className="text-base sm:text-lg leading-relaxed text-[#374151]">
                  {copy.experience.lead}
                </p>
              </div>

              <div
                role="tablist"
                aria-label={copy.experience.tabsLabel}
                className="flex flex-wrap sm:inline-flex sm:flex-nowrap shrink-0 items-center gap-1 rounded-xl border border-[#DCE6DF] bg-[#F8FAF9] p-1"
              >
                {copy.experience.items.map((tab, idx) => {
                  const selected = tab.id === activeExperience.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        tabRefs.current[tab.id] = el;
                      }}
                      id={`exp-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="experience-preview-panel"
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setActiveExpId(tab.id)}
                      onKeyDown={(e) => onTabKeyDown(e, idx)}
                      className={[
                        'min-h-9 whitespace-nowrap rounded-lg px-3.5 py-2 text-center text-xs sm:text-sm font-semibold transition-colors cursor-pointer',
                        selected
                          ? 'bg-[#15803D] text-white'
                          : 'text-[#374151] hover:bg-white hover:text-[#14532D]',
                      ].join(' ')}
                    >
                      {tab.tabLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              id="experience-preview-panel"
              role="tabpanel"
              aria-labelledby={`exp-tab-${activeExperience.id}`}
              className="mt-10 rounded-3xl border border-[#DCE6DF] bg-[#F8FAF9] p-5 sm:p-8 lg:p-10"
            >
              <div className="grid items-center gap-8 lg:grid-cols-12">
                <div className="lg:col-span-8 space-y-2.5">
                  <span className="inline-block text-xs font-semibold text-[#15803D]">
                    {copy.experience.desktopBadge}
                  </span>
                  <BrowserFrame
                    title={activeExperience.desktopPath}
                    src={assetUrl(activeExperience.desktopImage)}
                    alt={activeExperience.desktopAlt}
                  />
                </div>

                <div className="lg:col-span-4 flex flex-col items-center space-y-2.5">
                  <span className="text-xs font-semibold text-[#15803D]">
                    {copy.experience.mobileBadge}
                  </span>
                  <div className="w-[216px] sm:w-[236px]">
                    <PhoneFrame
                      src={assetUrl(activeExperience.mobileImage)}
                      alt={activeExperience.mobileAlt}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-7 border-t border-[#DCE6DF] pt-5 space-y-1">
                <h3 className="text-base sm:text-lg font-semibold text-[#111827]">
                  {activeExperience.title}
                </h3>
                <p className="text-sm sm:text-base text-[#374151] max-w-[68ch]">
                  {activeExperience.caption}
                </p>
              </div>
            </div>
          </RevealBlock>
        </section>

        {/* SECTION 06 — FINAL CALL TO ACTION */}
        <section className="bg-[#F5FAF7] py-24 sm:py-32">
          <RevealBlock
            reducedMotion={reducedMotion}
            className="mx-auto max-w-3xl px-4 text-center sm:px-6 space-y-6"
          >
            <img
              src={assetUrl('logo.svg')}
              alt=""
              aria-hidden="true"
              width={44}
              height={44}
              className="mx-auto size-11"
            />
            <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-[-0.03em] leading-[1.12] text-[#111827]">
              {copy.ctaFooter.headline}
            </h2>
            <p className="mx-auto max-w-[48ch] text-base sm:text-lg leading-relaxed text-[#374151]">
              {copy.ctaFooter.support}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-5 pt-2">
              <Link
                to={primaryDestination}
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#15803D] px-7 text-sm sm:text-base font-semibold text-white hover:bg-[#166534] transition-colors shadow-[0_12px_28px_-12px_rgba(21,128,61,0.45)]"
              >
                <span>{user ? copy.ctaFooter.primaryCtaAuthed : copy.ctaFooter.primaryCta}</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              {!user && (
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center px-3 text-sm sm:text-base font-medium text-[#14532D] hover:text-[#15803D] hover:underline underline-offset-4 transition-colors"
                >
                  {copy.ctaFooter.secondaryCta}
                </Link>
              )}
            </div>
          </RevealBlock>
        </section>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-[#DCE6DF] bg-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-8 py-10 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2.5 max-w-sm">
              <LandingLogo href="#top" />
              <p className="text-xs sm:text-sm leading-relaxed text-[#4B5563]">
                {copy.ctaFooter.brandTagline}
              </p>
            </div>

            <nav
              aria-label={copy.nav.footerAria}
              className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-sm font-medium text-[#374151]"
            >
              <a href="#why" className="hover:text-[#15803D] transition-colors">
                {copy.ctaFooter.links.why}
              </a>
              <a href="#signal" className="hover:text-[#15803D] transition-colors">
                {copy.ctaFooter.links.signal}
              </a>
              <a href="#experience" className="hover:text-[#15803D] transition-colors">
                {copy.ctaFooter.links.experience}
              </a>
              {user ? (
                <Link to="/feed" className="font-semibold text-[#15803D] hover:underline">
                  {copy.ctaFooter.links.workspace}
                </Link>
              ) : (
                <>
                  <Link to="/login" className="hover:text-[#15803D] transition-colors">
                    {copy.ctaFooter.links.signIn}
                  </Link>
                  <Link to="/register" className="font-semibold text-[#15803D] hover:underline">
                    {copy.ctaFooter.links.register}
                  </Link>
                </>
              )}
            </nav>
          </div>

          <div className="border-t border-[#DCE6DF] py-6">
            <p className="text-xs leading-relaxed text-[#4B5563]">{copy.ctaFooter.disclaimer}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

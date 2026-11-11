import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Users,
  Newspaper,
  ShieldAlert,
  Stethoscope,
  ChevronRight,
  Tag,
  Award,
  Gift,
  Activity,
  Heart,
  Brain,
  LayoutDashboard,
} from 'lucide-react';
import { postsApi, searchApi, messagesApi, rewardsApi, communitiesApi } from '../api/endpoints';
import { FALLBACK_COMMUNITIES } from './CommunitiesPage';
import { Avatar, Button, Card, EmptyState, Spinner } from '../components/ui';
import { ProfessionalBadge } from '../components/user/ProfessionalBadge';
import { useAuth } from '../features/auth/AuthContext';
import { useMode } from '../context/ModeContext';
import { CreatePostCard } from '../features/feed/CreatePostCard';
import { PostCard } from '../features/feed/PostCard';

const COMMUNITY_TOPICS = [
  { tag: '#LâmSàngThầnKinh', desc: 'Chẩn đoán & phác đồ', count: '142 ca' },
  { tag: '#BCI_Neurotech', desc: 'Giao diện não - máy tính', count: '89 bài' },
  { tag: '#HìnhẢnhHọcNão', desc: 'fMRI, CT, PET scan', count: '64 ca' },
  { tag: '#KhoaHọcNhậnThức', desc: 'Trí nhớ & hành vi', count: '51 bài' },
  { tag: '#ĐộtQuỵNão', desc: 'Cấp cứu & phục hồi chức năng', count: '77 ca' },
];

export function FeedPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [feedType, setFeedType] = useState<'community' | 'following'>('community');

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['posts', feedType],
    queryFn: ({ pageParam }) => postsApi.getFeed(feedType, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  const { data: searchProfData, isLoading: loadingProfs } = useQuery({
    queryKey: ['search', 'professionals-suggested'],
    queryFn: () => searchApi.search({ category: 'professionals' }),
    staleTime: 60 * 1000,
  });

  const { data: walletData } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user && isProfessional),
  });

  const { data: communitiesData } = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
    initialData: { communities: FALLBACK_COMMUNITIES },
    staleTime: 30 * 1000,
  });

  const recommendedGeneralCommunities = (communitiesData?.communities ?? FALLBACK_COMMUNITIES)
    .filter((c) => !c.isVerifiedOnly)
    .slice(0, 3);

  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  const suggestedProfessionals = (searchProfData?.professionals ?? [])
    .filter((p) => p.user.id !== user?.id)
    .slice(0, 4);

  const handleStartChat = async (targetUserId: string) => {
    try {
      const res = await messagesApi.startConversation(targetUserId);
      navigate(`/messages?conv=${res.conversation.id}`);
    } catch {
      navigate('/messages');
    }
  };

  /* ======================================================================== */
  /* EXPERIENCE A: GENERAL MODE (Content-Oriented, Low Density, Teal/Sky)     */
  /* ======================================================================== */
  if (!isProfessional) {
    return (
      <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-7 items-start">
        {/* Main Content Stream (Low Density, Readable Typography) */}
        <div className="space-y-5 min-w-0">
          {/* Clean, Friendly Welcome Strip */}
          <div className="rounded-lg border border-teal-200/70 bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
                Cộng đồng Sức khỏe & Khoa học Não bộ
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                Khám phá kiến thức y khoa dễ hiểu từ các bác sĩ chuyên khoa, chia sẻ câu chuyện sức khỏe và quản lý hồ sơ sóng não cá nhân.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/my-health"
                className="inline-flex items-center gap-1.5 rounded-md bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 border border-teal-200/80 hover:bg-teal-100/80 transition-colors"
              >
                <Heart className="size-3.5 text-teal-600" />
                <span>Sức khỏe của tôi</span>
              </Link>
              <Link
                to="/eeg-hub?view=personal"
                className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800 border border-sky-200/80 hover:bg-sky-100/80 transition-colors"
              >
                <Brain className="size-3.5 text-sky-600" />
                <span>My EEG</span>
              </Link>
            </div>
          </div>

          {/* Topic Filter Pills (Simple, Accessible) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {COMMUNITY_TOPICS.map((item) => (
              <Link
                key={item.tag}
                to={`/search?q=${encodeURIComponent(item.tag)}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-300 hover:bg-teal-50/50 hover:text-teal-800 transition-colors shrink-0"
              >
                <span className="text-teal-600 font-semibold">{item.tag}</span>
              </Link>
            ))}
          </div>

          {/* Post Composer */}
          <CreatePostCard onPostCreated={() => void refetch()} />

          {/* Simple Feed Switcher */}
          <div className="flex items-center gap-6 border-b border-slate-200/90 px-1">
            <button
              type="button"
              onClick={() => setFeedType('community')}
              className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${
                feedType === 'community'
                  ? 'text-teal-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="size-4 text-teal-600" />
              <span>Dành cho bạn & Cộng đồng</span>
              {feedType === 'community' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setFeedType('following')}
              className={`relative flex items-center gap-2 pb-3 text-sm font-semibold transition-colors ${
                feedType === 'following'
                  ? 'text-teal-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="size-4 text-teal-600" />
              <span>Đang theo dõi</span>
              {feedType === 'following' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Posts Stream */}
          {isLoading ? (
            <Spinner label="Đang tải bài viết..." />
          ) : isError ? (
            <Card className="p-6">
              <EmptyState
                title="Không thể tải bảng tin"
                description="Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau."
                action={
                  <Button size="sm" onClick={() => void refetch()}>
                    Thử lại ngay
                  </Button>
                }
              />
            </Card>
          ) : posts.length === 0 ? (
            <Card className="p-8">
              <EmptyState
                icon={<Newspaper className="size-8" />}
                title={
                  feedType === 'following'
                    ? 'Chưa có bài viết từ người bạn theo dõi'
                    : 'Bảng tin chưa có bài đăng nào'
                }
                description="Hãy theo dõi các bác sĩ chuyên khoa hoặc chia sẻ câu hỏi đầu tiên của bạn cùng cộng đồng."
                action={
                  feedType === 'following' ? (
                    <Button size="sm" variant="outline" onClick={() => setFeedType('community')}>
                      Xem Bảng tin cộng đồng
                    </Button>
                  ) : null
                }
              />
            </Card>
          ) : (
            <div className="space-y-5">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDeleted={(id) => {
                    queryClient.setQueryData(['posts', feedType], (oldData: any) => {
                      if (!oldData) return oldData;
                      return {
                        ...oldData,
                        pages: oldData.pages.map((page: any) => ({
                          ...page,
                          items: page.items.filter((item: any) => item.id !== id),
                        })),
                      };
                    });
                  }}
                />
              ))}

              {hasNextPage && (
                <div className="text-center pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    loading={isFetchingNextPage}
                    onClick={() => void fetchNextPage()}
                    className="px-5"
                  >
                    Xem thêm bài viết
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar (Friendly, Low Density, No Professional Clutter) */}
        <aside className="hidden lg:block sticky top-22 space-y-5">
          {/* Recommended Communities for General Users */}
          <Card className="p-4.5 border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Nhóm Cộng đồng Gợi ý</h2>
              <Link to="/communities" className="text-xs font-semibold text-teal-700 hover:underline">
                Tất cả →
              </Link>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {recommendedGeneralCommunities.map((comm) => (
                <Link
                  key={comm.id}
                  to="/communities"
                  className="block py-2.5 first:pt-0 last:pb-0 hover:text-teal-700"
                >
                  <p className="font-semibold text-slate-800">{comm.name}</p>
                  <p className="text-slate-500 mt-0.5">
                    {comm.membersCount.toLocaleString()} thành viên · {comm.specialtyLabel}
                  </p>
                </Link>
              ))}
            </div>
          </Card>

          {/* Verified Specialists Directory */}
          <Card className="p-4.5 border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Bác sĩ & Chuyên gia</h2>
              <Link
                to="/search?category=professionals"
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                Khám phá →
              </Link>
            </div>

            {loadingProfs ? (
              <Spinner label="Đang tải..." className="py-4 text-xs" />
            ) : (
              <div className="space-y-3 divide-y divide-slate-100">
                {suggestedProfessionals.map((prof) => (
                  <div key={prof.id} className="pt-2.5 first:pt-0 flex items-start gap-2.5">
                    <Link to={`/u/${prof.user.username}`} className="shrink-0 mt-0.5">
                      <Avatar name={prof.user.displayName} src={prof.user.avatarUrl} size="sm" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/u/${prof.user.username}`}
                        className="block truncate text-xs font-bold text-slate-800 hover:text-teal-700"
                      >
                        {prof.user.displayName}
                      </Link>
                      <div className="mt-0.5">
                        <ProfessionalBadge
                          type={prof.type}
                          status={prof.verificationStatus}
                          compact
                        />
                      </div>
                      {prof.institution && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {prof.institution}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Gentle Medical Disclaimer */}
          <div className="rounded-lg border border-sky-200/70 bg-sky-50/50 p-4 space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-sky-900">
              <ShieldAlert className="size-4 text-sky-700 shrink-0" />
              <span>Lưu ý Y khoa An toàn</span>
            </div>
            <p className="leading-relaxed">
              Nội dung trên NeuroLink nhằm mục đích giáo dục và tham khảo sức khỏe, không thay thế cho việc khám và chẩn đoán trực tiếp tại bệnh viện.
            </p>
          </div>
        </aside>
      </div>
    );
  }

  /* ======================================================================== */
  /* EXPERIENCE B: PROFESSIONAL MODE (Structured, High Density, Navy/Teal)    */
  /* ======================================================================== */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_330px] gap-5 items-start">
      {/* 1. LEFT SIDEBAR: Structured Clinical Dossier & Specialty Index */}
      <aside className="hidden lg:block sticky top-28 space-y-4">
        {user && (
          <Card className="overflow-hidden border-slate-300/80 shadow-2xs rounded-md">
            <div className="bg-[#162B47] px-4 py-3 text-white flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-300">
                Hồ sơ Chuyên gia
              </span>
              <Link to={`/u/${user.username}`} className="text-[11px] text-slate-200 hover:text-white">
                Chi tiết →
              </Link>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
                <div className="min-w-0">
                  <Link
                    to={`/u/${user.username}`}
                    className="block truncate font-bold text-slate-900 hover:text-brand-600 text-sm"
                  >
                    {user.displayName}
                  </Link>
                  <p className="truncate text-xs text-slate-500 font-mono">@{user.username}</p>
                </div>
              </div>

              {user.professionalProfiles && user.professionalProfiles.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {user.professionalProfiles.map((p, idx) => (
                    <ProfessionalBadge key={idx} type={p.type} status={p.verificationStatus} compact />
                  ))}
                </div>
              )}

              {/* Compact Tabular Telemetry inside Dossier */}
              <div className="grid grid-cols-2 divide-x divide-slate-200 rounded border border-slate-200 bg-slate-50 text-center py-2 text-xs tabular-nums">
                <div>
                  <span className="block text-[10px] uppercase text-slate-500 font-semibold">
                    Tín chỉ CME
                  </span>
                  <Link to="/rewards" className="font-bold text-brand-700 hover:underline">
                    {walletData?.wallet?.balance ?? 300}
                  </Link>
                </div>
                <div>
                  <span className="block text-[10px] uppercase text-slate-500 font-semibold">
                    Ca EEG Uỷ quyền
                  </span>
                  <Link to="/eeg-hub?view=workspace" className="font-bold text-accent-700 hover:underline">
                    2 bản ghi
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Structured Specialty Boards Index Table */}
        <Card className="overflow-hidden border-slate-300/80 shadow-2xs rounded-md">
          <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2.5 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Tag className="size-3.5 text-brand-600" />
              <span>Chuyên khoa & Phân ban</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Ca lâm sàng</span>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {COMMUNITY_TOPICS.map((item) => (
              <Link
                key={item.tag}
                to={`/search?q=${encodeURIComponent(item.tag)}`}
                className="flex items-center justify-between px-3.5 py-2 hover:bg-brand-50/40 transition-colors"
              >
                <div className="min-w-0">
                  <span className="block font-semibold text-brand-700 truncate">{item.tag}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{item.desc}</span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-600 shrink-0 tabular-nums">
                  {item.count}
                </span>
              </Link>
            ))}
          </div>
        </Card>

        {/* Quick Workspace Navigation */}
        <Card className="p-2 border-slate-300/80 shadow-2xs space-y-0.5 rounded-md">
          <Link
            to="/dashboard"
            className="flex items-center justify-between rounded px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <LayoutDashboard className="size-3.5 text-brand-600" />
              <span>Bảng điều khiển Lâm sàng</span>
            </span>
            <ChevronRight className="size-3.5 text-slate-400" />
          </Link>
          <Link
            to="/contributions"
            className="flex items-center justify-between rounded px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Award className="size-3.5 text-accent-600" />
              <span>Research Hub & Bình duyệt</span>
            </span>
            <ChevronRight className="size-3.5 text-slate-400" />
          </Link>
          <Link
            to="/eeg-hub?view=workspace"
            className="flex items-center justify-between rounded px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Activity className="size-3.5 text-brand-600" />
              <span>EEG Signal Workspace</span>
            </span>
            <ChevronRight className="size-3.5 text-slate-400" />
          </Link>
          <Link
            to="/rewards"
            className="flex items-center justify-between rounded px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Gift className="size-3.5 text-brand-600" />
              <span>Sổ cái Tín chỉ CME</span>
            </span>
            <ChevronRight className="size-3.5 text-slate-400" />
          </Link>
        </Card>
      </aside>

      {/* 2. CENTER COLUMN: Clinical Case Discussions & Research Updates */}
      <div className="space-y-4 min-w-0">
        {/* Structured Clinical Feed Header Bar */}
        <div className="rounded-md border border-slate-300/80 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Diễn đàn Hội chẩn Lâm sàng & Công bố Khoa học Thần kinh
            </h1>
            <p className="text-xs text-slate-500">
              Trao đổi ca bệnh đã khử định danh (PHI Anonymized), thảo luận phác đồ điều trị và thử nghiệm BCI.
            </p>
          </div>
          <Link
            to="/contributions"
            className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-700 transition-colors shrink-0"
          >
            <Award className="size-3.5" />
            <span>Nộp bài Bình duyệt CME</span>
          </Link>
        </div>

        {/* Post Composer */}
        <CreatePostCard onPostCreated={() => void refetch()} />

        {/* Structured Filter Bar */}
        <div className="flex items-center justify-between border-b border-slate-300/80 bg-white px-4 rounded-t-md">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setFeedType('community')}
              className={`relative flex items-center gap-2 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                feedType === 'community'
                  ? 'text-brand-700'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Globe className="size-3.5 text-brand-600" />
              <span>Tất cả Ca bệnh & Thảo luận Học thuật</span>
              {feedType === 'community' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setFeedType('following')}
              className={`relative flex items-center gap-2 py-2.5 text-xs sm:text-sm font-bold transition-colors ${
                feedType === 'following'
                  ? 'text-brand-700'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="size-3.5 text-brand-600" />
              <span>Đồng nghiệp Đang theo dõi</span>
              {feedType === 'following' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
              )}
            </button>
          </div>
          <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
            Chuẩn bảo mật: HIPAA / NĐ-13
          </span>
        </div>

        {/* Feed Stream */}
        {isLoading ? (
          <Spinner label="Đang tải dữ liệu hội chẩn..." />
        ) : isError ? (
          <Card className="p-6">
            <EmptyState
              title="Không thể tải bảng tin chuyên môn"
              description="Vui lòng kiểm tra lại kết nối mạng hoặc thử lại sau."
              action={
                <Button size="sm" onClick={() => void refetch()}>
                  Thử lại
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="space-y-3.5">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={(id) => {
                  queryClient.setQueryData(['posts', feedType], (oldData: any) => {
                    if (!oldData) return oldData;
                    return {
                      ...oldData,
                      pages: oldData.pages.map((page: any) => ({
                        ...page,
                        items: page.items.filter((item: any) => item.id !== id),
                      })),
                    };
                  });
                }}
              />
            ))}

            {hasNextPage && (
              <div className="text-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  loading={isFetchingNextPage}
                  onClick={() => void fetchNextPage()}
                >
                  Tải thêm ca lâm sàng
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. RIGHT SIDEBAR: Structured CME/Honoraria Table & Specialist Registry */}
      <aside className="hidden xl:block sticky top-28 space-y-4">
        {/* Structured Honoraria & CME Schedule Table */}
        <Card className="overflow-hidden border-slate-300/80 shadow-2xs rounded-md">
          <div className="bg-[#162B47] px-4 py-2.5 text-white flex items-center justify-between">
            <span className="text-xs font-bold">Danh mục Thẩm định & Tín chỉ CME</span>
            <Link to="/contributions" className="text-[11px] text-teal-300 hover:underline">
              Nộp bài →
            </Link>
          </div>
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                <th className="py-2 px-3">Hạng mục Chuyên môn</th>
                <th className="py-2 px-3 text-right">Định mức</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/80">
                <td className="py-2.5 px-3">
                  <Link to="/contributions" className="font-semibold text-slate-800 hover:text-brand-600 block">
                    Hội chẩn Ca lâm sàng
                  </Link>
                  <span className="text-[10px] text-slate-500">Chẩn đoán & phác đồ thực tế</span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-accent-700">+30 CME</td>
              </tr>
              <tr className="hover:bg-slate-50/80">
                <td className="py-2.5 px-3">
                  <Link to="/contributions" className="font-semibold text-slate-800 hover:text-brand-600 block">
                    Công bố Nghiên cứu BCI
                  </Link>
                  <span className="text-[10px] text-brand-600 font-medium">Ưu tiên bình duyệt</span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-brand-700">+50 CME</td>
              </tr>
              <tr className="hover:bg-slate-50/80">
                <td className="py-2.5 px-3">
                  <Link to="/rewards" className="font-semibold text-slate-800 hover:text-brand-600 block">
                    Phản biện Thuật toán DSP/EEG
                  </Link>
                  <span className="text-[10px] text-slate-500">Đánh giá đồng cấp 5 tiêu chí</span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">+20 CME</td>
              </tr>
            </tbody>
          </table>
        </Card>

        {/* Verified Specialists Directory Panel */}
        <Card className="overflow-hidden border-slate-300/80 shadow-2xs rounded-md">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Stethoscope className="size-3.5 text-brand-600" />
              <span>Đồng nghiệp Chuyên khoa</span>
            </h2>
            <Link
              to="/search?category=professionals"
              className="text-[11px] font-semibold text-brand-700 hover:underline"
            >
              Danh bạ →
            </Link>
          </div>

          <div className="p-3.5 divide-y divide-slate-100">
            {suggestedProfessionals.map((prof) => (
              <div key={prof.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start gap-2.5">
                <Link to={`/u/${prof.user.username}`} className="shrink-0 mt-0.5">
                  <Avatar name={prof.user.displayName} src={prof.user.avatarUrl} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/u/${prof.user.username}`}
                    className="block truncate text-xs font-bold text-slate-900 hover:text-brand-600"
                  >
                    {prof.user.displayName}
                  </Link>
                  <div className="mt-0.5">
                    <ProfessionalBadge type={prof.type} status={prof.verificationStatus} compact />
                  </div>
                  {prof.institution && (
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{prof.institution}</p>
                  )}
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleStartChat(prof.user.id)}
                  className="shrink-0 text-[10px] px-2.5 h-6.5 font-semibold"
                >
                  Hội chẩn
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </aside>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Newspaper } from 'lucide-react';
import {
  postsApi,
  rewardsApi,
  communitiesApi,
  communityInsightsApi,
} from '../api/endpoints';
import { FALLBACK_COMMUNITIES } from './CommunitiesPage';
import { Avatar, Button, EmptyState, Spinner, cn } from '../components/ui';
import { ProfessionalBadge } from '../components/user/ProfessionalBadge';
import { useAuth } from '../features/auth/AuthContext';
import { useMode } from '../context/ModeContext';
import { CreatePostCard } from '../features/feed/CreatePostCard';
import { PostCard } from '../features/feed/PostCard';
import { useChatPopup } from '../features/messages/ChatPopupContext';
import type {
  ClinicalCategory,
  CommunitySpotlightProfessional,
  PostItem,
} from '../api/types';

const MEDICAL_CATEGORY_FILTERS: {
  id: 'ALL' | ClinicalCategory;
  selectLabel: string;
  label: string;
  pattern?: RegExp;
}[] = [
  {
    id: 'ALL',
    selectLabel: 'Tất cả chủ đề',
    label: 'Tất cả',
  },
  {
    id: 'VASCULAR_STROKE',
    selectLabel: 'Đột quỵ',
    label: 'Đột quỵ & Mạch máu',
    pattern: /đột quỵ|stroke|ischemic|hemorrhagic|xuất huyết|thiếu máu|dar|bsi|tpa|mạch máu/i,
  },
  {
    id: 'EPILEPSY_ICU',
    selectLabel: 'Động kinh',
    label: 'Động kinh',
    pattern: /động kinh|epilep|co giật|kịch phát|thái dương|icu|pnes|sóng nhọn/i,
  },
  {
    id: 'SLEEP_COGNITIVE',
    selectLabel: 'Giấc ngủ',
    label: 'Giấc ngủ & Tập trung',
    pattern: /giấc ngủ|sleep|mệt mỏi|fatigue|nhận thức|tập trung|alpha|tar|trí nhớ|n3|mất ngủ/i,
  },
  {
    id: 'HARDWARE_BCI',
    selectLabel: 'Thiết bị EEG',
    label: 'Thiết bị EEG',
    pattern: /ads1299|bci|phần cứng|thiết bị|dsp|ica|10-20|điện cực|esp32|motor imagery|mu|beta|eeg/i,
  },
];

function SpotlightSection({
  title,
  professionals,
  isLoading,
}: {
  title: string;
  professionals: CommunitySpotlightProfessional[];
  isLoading: boolean;
}) {
  const { user } = useAuth();
  const { startChatWithUser } = useChatPopup();

  return (
    <section className="border-b border-[#DCE6DF] pb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
          {title}
        </h2>
        <Link to="/consultations" className="text-[11px] font-medium text-[#16A34A] hover:text-[#15803D] hover:underline">
          Tất cả
        </Link>
      </div>

      {isLoading ? (
        <Spinner label="Đang tải..." className="py-3 text-xs" />
      ) : professionals.length === 0 ? (
        <p className="text-xs text-[#8A8882] py-1">Chưa có dữ liệu trực tuyến.</p>
      ) : (
        <div className="space-y-3">
          {professionals.slice(0, 4).map((item) => {
            const subtitle = item.user.specialty || item.user.institution || 'Thần kinh học & BCI';
            return (
              <div key={item.user.id} className="flex items-center gap-2.5">
                <Link to={`/u/${item.user.username}`} className="relative shrink-0">
                  <Avatar name={item.user.displayName} src={item.user.avatarUrl} size="xs" />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-[#16A34A] ring-2 ring-[#F5FAF7]"
                    aria-hidden
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/u/${item.user.username}`}
                    className="block truncate text-[13px] font-medium text-[#141413] hover:underline"
                  >
                    {item.user.displayName}
                  </Link>
                  <p className="truncate text-[11px] text-[#6E6D68]">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.user.id !== user?.id && (
                    <button
                      type="button"
                      onClick={() => void startChatWithUser(item.user.id)}
                      className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline"
                    >
                      Chat
                    </button>
                  )}
                  <Link
                    to="/consultations?ask=1"
                    className="text-xs font-medium text-[#16A34A] hover:text-[#15803D] hover:underline"
                  >
                    Hỏi
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function FeedPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const [feedType, setFeedType] = useState<'community' | 'following'>('community');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | ClinicalCategory>('ALL');

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

  const { data: spotlightData, isLoading: loadingSpotlight } = useQuery({
    queryKey: ['community-spotlight'],
    queryFn: () => communityInsightsApi.getSpotlight(),
    staleTime: 60 * 1000,
  });

  const recommendedGeneralCommunities = (communitiesData?.communities ?? FALLBACK_COMMUNITIES)
    .filter((c) => !c.isVerifiedOnly)
    .slice(0, 3);

  const rawPosts = data?.pages.flatMap((page) => page.items) ?? [];
  const activeCategoryMeta = MEDICAL_CATEGORY_FILTERS.find((c) => c.id === selectedCategory);
  const posts =
    selectedCategory === 'ALL' || !activeCategoryMeta?.pattern
      ? rawPosts
      : rawPosts.filter((post) => activeCategoryMeta.pattern!.test(post.content));
  const spotlightProfessionals = spotlightData?.professionals ?? [];

  const handleDeletePost = (id: string) => {
    queryClient.setQueryData<{ pages: { items: PostItem[] }[] }>(
      ['posts', feedType],
      (oldData) => {
        if (!oldData?.pages) return oldData;
        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => item.id !== id),
          })),
        };
      },
    );
  };

  const renderStreamSheet = (isProMode: boolean) => (
    <div className="space-y-3.5">
      {/* Top Tabs + Inline Composer Card */}
      <div className="rounded-xl border border-[#DCE6DF] bg-white shadow-[0_1px_2px_rgba(16,26,20,0.04)] overflow-hidden">
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-5 border-b border-[#EDF3EF]">
          <div className="flex items-center gap-3.5 sm:gap-5 min-w-0 overflow-x-auto no-scrollbar scroll-smooth">
            <button
              type="button"
              onClick={() => setFeedType('community')}
              className={cn(
                'py-3 text-sm transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.98] -mb-px whitespace-nowrap shrink-0',
                feedType === 'community'
                  ? 'border-b-2 border-[#16A34A] font-bold text-[#15803D]'
                  : 'text-[#6E6D68] hover:text-[#15803D]',
              )}
            >
              {isProMode ? 'Ca lâm sàng' : 'Dành cho bạn'}
            </button>
            <button
              type="button"
              onClick={() => setFeedType('following')}
              className={cn(
                'py-3 text-sm transition-[color,border-color,transform] duration-150 ease-out active:scale-[0.98] -mb-px whitespace-nowrap shrink-0',
                feedType === 'following'
                  ? 'border-b-2 border-[#16A34A] font-bold text-[#15803D]'
                  : 'text-[#6E6D68] hover:text-[#15803D]',
              )}
            >
              Đang theo dõi
            </button>
          </div>

          <select
            aria-label="Lọc chủ đề"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as 'ALL' | ClinicalCategory)}
            className="shrink-0 text-xs text-[#575652] bg-transparent border border-[#DCE6DF] rounded-md px-2 py-1 transition-colors focus:outline-none focus:border-[#16A34A]"
          >
            {MEDICAL_CATEGORY_FILTERS.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.selectLabel}
              </option>
            ))}
          </select>
        </div>

        {/* Inline Composer */}
        <CreatePostCard onPostCreated={() => void refetch()} />
      </div>

      {/* Posts Stream (Separated Individual Cards) */}
      {isLoading ? (
        <div className="rounded-xl border border-[#DCE6DF] bg-white p-6">
          <Spinner label={isProMode ? 'Đang tải...' : 'Đang tải bài viết...'} />
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#DCE6DF] bg-white p-6">
          <EmptyState
            title="Không thể tải bảng tin"
            description="Kiểm tra kết nối và thử lại."
            action={
              <Button size="sm" onClick={() => void refetch()}>
                Thử lại
              </Button>
            }
          />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-[#DCE6DF] bg-white p-6">
          <EmptyState
            icon={<Newspaper className="size-6" />}
            title={
              selectedCategory !== 'ALL'
                ? `Chưa có bài viết nhóm ${activeCategoryMeta?.label ?? ''}`
                : feedType === 'following'
                  ? 'Chưa có bài viết từ người đang theo dõi'
                  : 'Chưa có bài đăng nào'
            }
            description={
              selectedCategory !== 'ALL'
                ? 'Chọn "Tất cả" để xem toàn bộ.'
                : 'Theo dõi chuyên gia hoặc chia sẻ ghi chú đầu tiên.'
            }
            action={
              selectedCategory !== 'ALL' ? (
                <Button size="xs" variant="outline" onClick={() => setSelectedCategory('ALL')}>
                  Xem tất cả
                </Button>
              ) : feedType === 'following' ? (
                <Button size="xs" variant="outline" onClick={() => setFeedType('community')}>
                  {isProMode ? 'Xem ca lâm sàng' : 'Xem bảng tin'}
                </Button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="space-y-3.5">
          {posts.map((post) => (
            <div key={post.id} className="feed-card-optimize">
              <PostCard post={post} onDeleted={handleDeletePost} />
            </div>
          ))}

          {hasNextPage && (
            <div className="py-2 text-center">
              <Button
                variant="outline"
                size="xs"
                loading={isFetchingNextPage}
                onClick={() => void fetchNextPage()}
              >
                Xem thêm bài viết
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (!isProfessional) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,620px)_256px] gap-8 items-start">
        {renderStreamSheet(false)}

        {/* Right Editorial Sidebar */}
        <aside className="hidden lg:block space-y-6 sticky top-[76px] text-xs">
          <section className="border-b border-[#DCE6DF] pb-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68] mb-2.5">
              Công cụ
            </h2>
            <div className="divide-y divide-[#DCE6DF]/60">
              <Link
                to="/eeg-hub"
                className="py-1.5 flex items-center justify-between text-[13px] font-medium text-[#262624] hover:text-[#15803D] transition-colors"
              >
                <span>Đọc file sóng não (.csv)</span>
                <span className="text-[#8A8882]">→</span>
              </Link>
              <Link
                to="/consultations?ask=1"
                className="py-1.5 flex items-center justify-between text-[13px] font-medium text-[#262624] hover:text-[#15803D] transition-colors"
              >
                <span>Gửi câu hỏi cho bác sĩ</span>
                <span className="text-[#8A8882]">→</span>
              </Link>
              <Link
                to="/my-health"
                className="py-1.5 flex items-center justify-between text-[13px] font-medium text-[#262624] hover:text-[#15803D] transition-colors"
              >
                <span>Ghi nhật ký giấc ngủ</span>
                <span className="text-[#8A8882]">→</span>
              </Link>
            </div>
          </section>

          <SpotlightSection
            title="Bác sĩ trực tuyến"
            professionals={spotlightProfessionals}
            isLoading={loadingSpotlight}
          />

          <section className="pb-2">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                Cộng đồng
              </h2>
              <Link to="/communities" className="text-[11px] font-medium text-[#16A34A] hover:text-[#15803D] hover:underline">
                Xem hết
              </Link>
            </div>
            <div className="space-y-2.5">
              {recommendedGeneralCommunities.map((comm) => (
                <Link key={comm.id} to="/communities" className="block group">
                  <p className="text-[13px] font-medium text-[#262624] group-hover:text-[#15803D] group-hover:underline truncate">
                    {comm.name}
                  </p>
                  <p className="text-[11px] text-[#8A8882]">
                    {comm.membersCount.toLocaleString()} thành viên
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,620px)_256px] gap-8 items-start">
      {renderStreamSheet(true)}

      {/* Professional Right Editorial Sidebar */}
      <aside className="hidden lg:block space-y-6 sticky top-[76px] text-xs">
        {user && (
          <section className="border-b border-[#DCE6DF] pb-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                Hồ sơ chuyên môn
              </h2>
              <Link to={`/u/${user.username}`} className="text-[11px] font-medium text-[#16A34A] hover:text-[#15803D] hover:underline">
                Hồ sơ
              </Link>
            </div>

            <div className="flex items-center gap-2.5">
              <Avatar name={user.displayName} src={user.avatarUrl} size="xs" />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-[#141413]">{user.displayName}</p>
                <p className="truncate text-[11px] text-[#6E6D68]">@{user.username}</p>
              </div>
            </div>

            {user.professionalProfiles && user.professionalProfiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {user.professionalProfiles.map((p, idx) => (
                  <ProfessionalBadge key={idx} type={p.type} status={p.verificationStatus} compact />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[#6E6D68]">Credit CME</span>
              <Link to="/rewards" className="font-semibold text-[#141413] tabular-nums hover:underline">
                {walletData?.wallet?.balance ?? 0} điểm
              </Link>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6E6D68]">Đóng góp học thuật</span>
              <Link to="/contributions" className="font-medium text-[#16A34A] hover:text-[#15803D] hover:underline">
                Nộp bài →
              </Link>
            </div>
          </section>
        )}

        <SpotlightSection
          title="Chuyên gia trực tuyến"
          professionals={spotlightProfessionals}
          isLoading={loadingSpotlight}
        />

        <section className="pb-2">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
              Định mức CME
            </h2>
            <Link to="/contributions" className="text-[11px] font-medium text-[#16A34A] hover:text-[#15803D] hover:underline">
              Nộp bài
            </Link>
          </div>
          <p className="text-xs text-[#575652] leading-relaxed tabular-nums">
            Hội chẩn <span className="font-semibold text-[#141413]">+30</span> · Nghiên cứu BCI{' '}
            <span className="font-semibold text-[#141413]">+50</span> · Phản biện{' '}
            <span className="font-semibold text-[#141413]">+20 CME</span>
          </p>
        </section>
      </aside>
    </div>
  );
}

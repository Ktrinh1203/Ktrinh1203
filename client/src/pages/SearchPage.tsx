import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Users,
  Stethoscope,
  FileText,
  MessageCircle,
  Building2,
  UserX,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { searchApi, messagesApi, communitiesApi } from '../api/endpoints';
import { Avatar, Button, Card, EmptyState, Spinner } from '../components/ui';
import { ProfessionalBadge } from '../components/user/ProfessionalBadge';
import { PostCard } from '../features/feed/PostCard';
import { useAuth } from '../features/auth/AuthContext';
import { useMode } from '../context/ModeContext';

const PRO_SPECIALTIES = [
  'Thần kinh học lâm sàng',
  'Giao diện não - máy tính (BCI)',
  'Chẩn đoán hình ảnh não',
  'Đột quỵ não',
  'Hồi sức thần kinh',
  'Động kinh & Sóng não',
  'Kỹ thuật Y sinh',
];

const GENERAL_TOPICS = [
  'Giấc ngủ',
  'Đau đầu',
  'Động kinh',
  'Đột quỵ',
  'Trí nhớ',
  'Sóng não',
];

const PRO_TAGS = [
  '#LâmSàngThầnKinh',
  '#BCI_Neurotech',
  '#HìnhẢnhHọcNão',
  '#NghiênCứuKhoaHọc',
  '#ĐộtQuỵNão',
  '#ĐộngKinhLâmSàng',
];

export function SearchPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const urlQ = searchParams.get('q') || '';
  const urlCategory = (searchParams.get('category') as 'all' | 'professionals' | 'users' | 'posts' | 'communities') || 'all';

  const [searchTerm, setSearchTerm] = useState(urlQ);
  const [activeCategory, setActiveCategory] = useState<'all' | 'professionals' | 'users' | 'posts' | 'communities'>(urlCategory);
  const [specialty, setSpecialty] = useState('');

  useEffect(() => {
    if (urlQ !== searchTerm) setSearchTerm(urlQ);
    if (urlCategory && urlCategory !== activeCategory) setActiveCategory(urlCategory);
  }, [urlQ, urlCategory]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', searchTerm, activeCategory, specialty],
    queryFn: () =>
      searchApi.search({
        q: searchTerm || undefined,
        category: activeCategory === 'communities' ? 'all' : activeCategory,
        specialty: specialty || undefined,
      }),
    enabled: Boolean(searchTerm.trim() || specialty.trim() || activeCategory === 'professionals'),
  });

  const { data: communitiesData } = useQuery({
    queryKey: ['communities', searchTerm],
    queryFn: () => communitiesApi.list({ q: searchTerm || undefined }),
  });

  const { data: recommendedData, isLoading: loadingRecommended } = useQuery({
    queryKey: ['recommended-professionals-landing'],
    queryFn: () => searchApi.search({ category: 'professionals' }),
    staleTime: 60 * 1000,
  });

  const handleStartChat = async (targetUserId: string) => {
    try {
      const res = await messagesApi.startConversation(targetUserId);
      navigate(`/messages?conv=${res.conversation.id}`);
    } catch {
      navigate('/messages');
    }
  };

  const handleCategoryChange = (cat: 'all' | 'professionals' | 'users' | 'posts' | 'communities') => {
    setActiveCategory(cat);
    const next = new URLSearchParams(searchParams);
    if (cat === 'all') next.delete('category');
    else next.set('category', cat);
    setSearchParams(next);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (searchTerm.trim()) next.set('q', searchTerm.trim());
    else next.delete('q');
    setSearchParams(next);
  };

  const handleSelectSpecialty = (spec: string) => {
    setSpecialty(spec);
    setActiveCategory('professionals');
    const next = new URLSearchParams(searchParams);
    next.set('category', 'professionals');
    setSearchParams(next);
  };

  const handleSelectTag = (tag: string) => {
    setSearchTerm(tag);
    setActiveCategory('all');
    const next = new URLSearchParams(searchParams);
    next.set('q', tag);
    next.delete('category');
    setSearchParams(next);
  };

  const users = activeCategory === 'communities' ? [] : (data?.users ?? []);
  const professionals = activeCategory === 'communities' ? [] : (data?.professionals ?? []);
  const posts = activeCategory === 'communities' ? [] : (data?.posts ?? []);
  const matchedCommunities = (communitiesData?.communities ?? []).filter((c) =>
    isProfessional ? true : !c.isVerifiedOnly,
  );

  const recommendedSpecialists = (recommendedData?.professionals ?? []).filter(
    (p) => p.user.id !== user?.id,
  );

  const hasResults =
    users.length > 0 ||
    professionals.length > 0 ||
    posts.length > 0 ||
    (activeCategory === 'communities' && matchedCommunities.length > 0);
  const hasSearched = Boolean(searchTerm.trim() || specialty.trim() || activeCategory === 'communities');

  const showSpecialtyInput = isProfessional || activeCategory === 'professionals';

  return (
    <div className={isProfessional ? 'mx-auto max-w-5xl space-y-5' : 'mx-auto max-w-4xl space-y-5'}>
      {/* Clean Compact Header */}
      <Card className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-[#141413] tracking-tight">
            Tìm kiếm
          </h1>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#6E6D68]" aria-hidden />
            <input
              type="text"
              placeholder={isProfessional ? 'Tìm bác sĩ, chuyên khoa, bài viết...' : 'Tìm bác sĩ, cộng đồng, bài viết...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] pl-10 pr-3.5 py-2 text-xs sm:text-sm text-[#141413] placeholder:text-[#6E6D68] transition-colors focus:bg-white focus:border-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20"
            />
          </div>
          <Button type="submit" size="md" variant="primary" className="rounded-lg px-5">
            Tìm
          </Button>
        </form>

        {/* Filter Tabs & Specialty Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DCE6DF] pt-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: 'Tất cả' },
                { id: 'professionals', label: 'Bác sĩ', icon: Stethoscope },
                { id: 'users', label: 'Thành viên', icon: Users },
                { id: 'posts', label: 'Bài viết', icon: FileText },
                { id: 'communities', label: 'Cộng đồng', icon: Users },
              ] as const
            ).map((tab) => {
              const Icon = 'icon' in tab ? tab.icon : null;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleCategoryChange(tab.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                    activeCategory === tab.id
                      ? 'bg-[#16A34A] text-white border-[#16A34A]'
                      : 'bg-white text-[#6E6D68] border-[#DCE6DF] hover:bg-[#EFF6F1] hover:text-[#15803D]'
                  }`}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden />}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {showSpecialtyInput && (
            <div className="w-full sm:w-auto">
              <input
                type="text"
                placeholder="Lọc chuyên khoa..."
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full sm:w-56 rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] px-3 py-1.5 text-xs text-[#141413] placeholder:text-[#6E6D68] focus:outline-none focus:border-[#16A34A] focus:bg-white focus:ring-2 focus:ring-[#16A34A]/20 transition-colors"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Results Section */}
      {isLoading ? (
        <Spinner label="Đang tìm kiếm..." />
      ) : !hasSearched && activeCategory !== 'professionals' ? (
        <div className="space-y-5">
          {/* Quick Topic / Specialty Filters */}
          <Card className="p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6E6D68]">
              <Stethoscope className="size-3.5 text-[#16A34A]" aria-hidden />
              <span>{isProfessional ? 'Chuyên khoa gợi ý' : 'Chủ đề phổ biến'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {(isProfessional ? PRO_SPECIALTIES : GENERAL_TOPICS).map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => (isProfessional ? handleSelectSpecialty(topic) : handleSelectTag(topic))}
                  className="rounded-lg border border-[#DCE6DF] bg-[#EFF6F1] hover:bg-[#DCFCE7] hover:text-[#15803D] px-3 py-1.5 text-xs font-medium text-[#262624] transition-colors cursor-pointer"
                >
                  {topic}
                </button>
              ))}
            </div>
          </Card>

          {/* Recommended Doctors & Specialists Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#141413] flex items-center gap-2">
                <Stethoscope className="size-4 text-[#16A34A]" aria-hidden />
                <span>Bác sĩ đề xuất</span>
              </h2>
              <button
                type="button"
                onClick={() => handleCategoryChange('professionals')}
                className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="size-3.5" aria-hidden />
              </button>
            </div>

            {loadingRecommended ? (
              <Spinner label="Đang tải..." />
            ) : recommendedSpecialists.length === 0 ? (
              <Card className="p-6">
                <EmptyState
                  icon={<Stethoscope className="size-6 text-[#16A34A]" />}
                  title="Chưa có bác sĩ đề xuất"
                  description="Nhập từ khóa để tìm kiếm."
                />
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {recommendedSpecialists.map((prof) => (
                  <Card
                    key={prof.id}
                    className="p-4 sm:p-5 flex flex-col justify-between hover:border-[#86EFAC] transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/u/${prof.user.username}`} className="flex items-center gap-3 min-w-0">
                          <Avatar name={prof.user.displayName} src={prof.user.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#141413] truncate hover:text-[#16A34A] text-sm">
                              {prof.user.displayName}
                            </p>
                            <p className="text-xs text-[#6E6D68] truncate">@{prof.user.username}</p>
                          </div>
                        </Link>
                        <ProfessionalBadge type={prof.type} status={prof.verificationStatus} compact />
                      </div>

                      <div className="mt-3 text-xs space-y-1 text-[#575652]">
                        <p className="font-semibold text-[#141413]">
                          {prof.title} · <span className="text-[#15803D]">{prof.specialty}</span>
                        </p>
                        {prof.institution && (
                          <p className="flex items-center gap-1.5 text-[#6E6D68]">
                            <Building2 className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{prof.institution}</span>
                          </p>
                        )}
                        {isProfessional && prof.researchInterests.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {prof.researchInterests.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] text-[#15803D] bg-[#EFF6F1] border border-[#DCE6DF] rounded-full px-2 py-0.5 font-medium">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-[#DCE6DF] pt-3">
                      <Link to={`/u/${prof.user.username}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          Xem hồ sơ
                        </Button>
                      </Link>
                      {user && user.id !== prof.user.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStartChat(prof.user.id)}
                          icon={<MessageCircle className="size-3.5" aria-hidden />}
                          className="text-xs px-4"
                        >
                          Nhắn tin
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Discover Communities Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#141413] flex items-center gap-2">
                <Users className="size-4 text-[#16A34A]" aria-hidden />
                <span>Cộng đồng</span>
              </h2>
              <Link
                to="/communities"
                className="text-xs font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline flex items-center gap-1"
              >
                <span>Xem tất cả</span>
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {matchedCommunities.slice(0, 4).map((c) => (
                <Card key={c.id} className="p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded-full bg-[#EFF6F1] border border-[#DCE6DF] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
                        {c.specialtyLabel}
                      </span>
                      <span className="text-[11px] text-[#6E6D68] tabular-nums">
                        {c.membersCount.toLocaleString('vi-VN')} thành viên
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-[#141413] leading-snug">{c.name}</h3>
                    <p className="mt-1 text-xs text-[#6E6D68] line-clamp-2">{c.description}</p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#DCE6DF] flex items-center justify-between text-xs">
                    <span className="text-[#6E6D68]">{c.discussionsCount} thảo luận</span>
                    <Link
                      to="/communities"
                      className="font-semibold text-[#16A34A] hover:text-[#15803D] hover:underline"
                    >
                      {c.isMember ? 'Đã tham gia →' : 'Tham gia →'}
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {isProfessional && (
            <Card className="p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#6E6D68]">
                <TrendingUp className="size-3.5 text-[#16A34A]" aria-hidden />
                <span>Chủ đề lâm sàng</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRO_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleSelectTag(tag)}
                    className="rounded-lg bg-[#EFF6F1] hover:bg-[#DCFCE7] hover:text-[#15803D] px-2.5 py-1 text-xs font-medium text-[#262624] transition-colors cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : !hasResults ? (
        <Card className="p-8">
          <EmptyState
            icon={<UserX className="size-7 text-[#16A34A]" />}
            title="Không tìm thấy kết quả"
            description="Thử từ khóa khác hoặc đổi bộ lọc."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Professionals List */}
          {professionals.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6E6D68] flex items-center gap-1.5">
                <Stethoscope className="size-4 text-[#16A34A]" aria-hidden />
                <span>Bác sĩ &amp; Chuyên gia ({professionals.length})</span>
              </h2>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {professionals.map((prof) => (
                  <Card
                    key={prof.id}
                    className="p-4 sm:p-5 flex flex-col justify-between hover:border-[#86EFAC] transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/u/${prof.user.username}`} className="flex items-center gap-3 min-w-0">
                          <Avatar name={prof.user.displayName} src={prof.user.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <p className="font-semibold text-[#141413] truncate hover:text-[#16A34A] text-sm">
                              {prof.user.displayName}
                            </p>
                            <p className="text-xs text-[#6E6D68] truncate">@{prof.user.username}</p>
                          </div>
                        </Link>
                        <ProfessionalBadge type={prof.type} status={prof.verificationStatus} compact />
                      </div>

                      <div className="mt-3 text-xs space-y-1 text-[#575652]">
                        <p className="font-semibold text-[#141413]">
                          {prof.title} · <span className="text-[#15803D]">{prof.specialty}</span>
                        </p>
                        {prof.institution && (
                          <p className="flex items-center gap-1 text-[#6E6D68]">
                            <Building2 className="size-3.5 shrink-0" aria-hidden /> {prof.institution}
                          </p>
                        )}
                        {isProfessional && prof.researchInterests.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {prof.researchInterests.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] text-[#15803D] bg-[#EFF6F1] border border-[#DCE6DF] rounded-full px-2 py-0.5 font-medium">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-[#DCE6DF] pt-3">
                      <Link to={`/u/${prof.user.username}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          Xem hồ sơ
                        </Button>
                      </Link>
                      {user && user.id !== prof.user.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStartChat(prof.user.id)}
                          icon={<MessageCircle className="size-3.5" aria-hidden />}
                          className="text-xs"
                        >
                          Nhắn tin
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* General Users List */}
          {users.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6E6D68] flex items-center gap-1.5">
                <Users className="size-4 text-[#16A34A]" aria-hidden />
                <span>Thành viên ({users.length})</span>
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {users.map((u) => (
                  <Card key={u.id} className="p-4 flex items-center justify-between gap-3">
                    <Link to={`/u/${u.username}`} className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.displayName} src={u.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold text-[#141413] truncate hover:text-[#16A34A] text-sm">
                          {u.displayName}
                        </p>
                        <p className="text-xs text-[#6E6D68] truncate">@{u.username}</p>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2">
                      <Link to={`/u/${u.username}`}>
                        <Button variant="outline" size="xs">
                          Xem
                        </Button>
                      </Link>
                      {user && user.id !== u.id && (
                        <Button size="xs" variant="secondary" onClick={() => handleStartChat(u.id)}>
                          Nhắn tin
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Communities List */}
          {(activeCategory === 'all' || activeCategory === 'communities') &&
            matchedCommunities.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6E6D68] flex items-center gap-1.5">
                  <Users className="size-4 text-[#16A34A]" aria-hidden />
                  <span>Cộng đồng ({matchedCommunities.length})</span>
                </h2>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {matchedCommunities.map((c) => (
                    <Card key={c.id} className="p-4 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex rounded-full bg-[#EFF6F1] border border-[#DCE6DF] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
                            {c.specialtyLabel}
                          </span>
                          <span className="text-[11px] text-[#6E6D68] tabular-nums">
                            {c.membersCount.toLocaleString('vi-VN')} thành viên
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-semibold text-[#141413] leading-snug">{c.name}</h3>
                        <p className="mt-1 text-xs text-[#6E6D68] line-clamp-2">{c.description}</p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-[#DCE6DF] flex items-center justify-between text-xs">
                        <span className="text-[#6E6D68]">{c.discussionsCount} thảo luận</span>
                        <Link to="/communities" className="font-semibold text-[#16A34A] hover:underline">
                          {c.isMember ? 'Đã tham gia →' : 'Tham gia →'}
                        </Link>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

          {/* Posts List */}
          {posts.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6E6D68] flex items-center gap-1.5">
                <FileText className="size-4 text-[#16A34A]" aria-hidden />
                <span>Bài viết ({posts.length})</span>
              </h2>
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

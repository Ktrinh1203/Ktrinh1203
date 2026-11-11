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
  Sparkles,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { searchApi, messagesApi, communitiesApi } from '../api/endpoints';
import { Avatar, Button, Card, EmptyState, Spinner } from '../components/ui';
import { ProfessionalBadge } from '../components/user/ProfessionalBadge';
import { PostCard } from '../features/feed/PostCard';
import { useAuth } from '../features/auth/AuthContext';
import { useMode } from '../context/ModeContext';

const POPULAR_SPECIALTIES = [
  'Thần kinh học lâm sàng',
  'Giao diện não - máy tính (BCI)',
  'Chẩn đoán hình ảnh não',
  'Đột quỵ não',
  'Hồi sức thần kinh',
  'Động kinh & Sóng não',
  'Kỹ thuật Y sinh',
];

const POPULAR_TAGS = [
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

  // Keep state in sync with URL
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

  // Recommended specialists query for initial landing view
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

  return (
    <div className={isProfessional ? 'space-y-5' : 'mx-auto max-w-4xl space-y-6'}>
      {/* Mode-Differentiated Search Header */}
      {isProfessional ? (
        <section className="rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden">
          <div className="bg-[#162B47] px-5 py-4 text-white flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Danh bạ Chuyên gia Lâm sàng & Nhà Nghiên cứu BCI</span>
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Tra cứu đồng nghiệp theo chuyên khoa Thần kinh, đơn vị bệnh viện, mã CCHN/ORCID và thảo luận học thuật (Doximity Registry).
              </p>
            </div>
            <span className="font-mono text-[11px] text-teal-200 bg-[#2C6865] px-2.5 py-1 rounded border border-teal-400/30 shrink-0">
              Verified HCP & ORCID Directory
            </span>
          </div>
        </section>
      ) : (
        <div className="rounded-xl border border-teal-200/80 bg-white p-5 sm:p-6 shadow-2xs">
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Khám phá Bác sĩ, Cộng đồng & Kiến thức Não bộ</span>
            <Sparkles className="size-5 text-teal-600" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1">
            Tìm kiếm bác sĩ chuyên khoa thần kinh đã xác minh, kết nối cộng đồng hỗ trợ người bệnh và đọc các bài viết sức khỏe dễ hiểu.
          </p>
        </div>
      )}

      {/* Search Form Card (Doximity & Facebook Clean Architecture) */}
      <Card className="p-4 sm:p-5 border-slate-200/90 shadow-xs space-y-3.5 rounded-xl">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Nhập tên chuyên gia, bác sĩ, bệnh viện, từ khoá bài viết..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-10 pr-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 transition-colors hover:bg-slate-100/50 focus:bg-white focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <Button type="submit" size="md" className="rounded-lg px-5 bg-brand-600 hover:bg-brand-700 text-white font-semibold">
            Tìm kiếm
          </Button>
        </form>

        {/* Filter Tabs & Specialty Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleCategoryChange('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeCategory === 'all'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('professionals')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeCategory === 'professionals'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Stethoscope className="size-3.5" /> Bác sĩ & Chuyên gia
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('users')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeCategory === 'users'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="size-3.5" /> Thành viên
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('posts')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeCategory === 'posts'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <FileText className="size-3.5" /> {isProfessional ? 'Bài viết lâm sàng' : 'Bài viết'}
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('communities')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                activeCategory === 'communities'
                  ? 'bg-brand-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users className="size-3.5" /> {isProfessional ? 'Hội đồng & Cộng đồng' : 'Cộng đồng'}
            </button>
          </div>

          {/* Specialty Filter */}
          <div className="w-full sm:w-auto">
            <input
              type="text"
              placeholder="Lọc chuyên khoa (vd: Thần kinh, BCI)..."
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              className="w-full sm:w-64 rounded-md border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-500/20 transition-colors"
            />
          </div>
        </div>
      </Card>

      {/* Results Section */}
      {isLoading ? (
        <Spinner label="Đang đối chiếu dữ liệu tìm kiếm..." />
      ) : !hasSearched && activeCategory !== 'professionals' ? (
        <div className="space-y-6">
          {/* Quick Specialty Filters */}
          <Card className="p-4 sm:p-5 border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Stethoscope className="size-4 text-brand-600" />
              <span>Chuyên khoa gợi ý tìm kiếm nhanh:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SPECIALTIES.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => handleSelectSpecialty(spec)}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 hover:text-brand-700 px-3 py-1.5 text-xs font-medium text-slate-700 transition-all cursor-pointer"
                >
                  {spec}
                </button>
              ))}
            </div>
          </Card>

          {/* Recommended Doctors & Specialists Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Bác sĩ & Chuyên gia đề xuất cho bạn</h2>
                  <p className="text-xs text-slate-500">Kết nối cùng các chuyên gia thần kinh học và nhà nghiên cứu não bộ tiêu biểu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCategoryChange('professionals')}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Xem tất cả danh bạ</span>
                <ChevronRight className="size-3.5" />
              </button>
            </div>

            {loadingRecommended ? (
              <Spinner label="Đang tải danh sách chuyên gia đề xuất..." />
            ) : recommendedSpecialists.length === 0 ? (
              <Card className="p-6">
                <EmptyState
                  icon={<Stethoscope className="size-6 text-slate-400" />}
                  title="Chưa có chuyên gia nào được đề xuất"
                  description="Hãy thử nhập từ khoá tìm kiếm hoặc xem danh bạ tổng hợp."
                />
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {recommendedSpecialists.map((prof) => (
                  <Card
                    key={prof.id}
                    className="p-5 flex flex-col justify-between border-slate-200/70 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.03)] hover:border-brand-300 hover:shadow-[0_8px_30px_-4px_rgba(15,23,42,0.06)] transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/u/${prof.user.username}`} className="flex items-center gap-3 min-w-0">
                          <Avatar name={prof.user.displayName} src={prof.user.avatarUrl} size="md" className="ring-2 ring-slate-100" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate hover:text-brand-600 text-sm">
                              {prof.user.displayName}
                            </p>
                            <p className="text-xs text-slate-400 truncate">@{prof.user.username}</p>
                          </div>
                        </Link>
                        <ProfessionalBadge type={prof.type} status={prof.verificationStatus} compact />
                      </div>

                      <div className="mt-3.5 text-xs space-y-1.5 text-slate-600">
                        <p className="font-semibold text-slate-800">
                          {prof.title} · <span className="text-brand-700">{prof.specialty}</span>
                        </p>
                        {prof.institution && (
                          <p className="flex items-center gap-1.5 text-slate-500">
                            <Building2 className="size-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{prof.institution}</span>
                          </p>
                        )}
                        {prof.researchInterests.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {prof.researchInterests.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] text-teal-800 bg-teal-50/80 border border-teal-200/60 rounded-full px-2 py-0.5 font-medium">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                      <Link to={`/u/${prof.user.username}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs font-semibold">
                          Xem hồ sơ
                        </Button>
                      </Link>
                      {user && user.id !== prof.user.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStartChat(prof.user.id)}
                          icon={<MessageCircle className="size-3.5" />}
                          className="text-xs font-semibold px-4"
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

          {/* Discover Communities Section (Explore Requirement: Discover Communities) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 border border-teal-200">
                  <Users className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    {isProfessional
                      ? 'Hội đồng Chuyên khoa & Nhóm Nghiên cứu BCI'
                      : 'Cộng đồng Sức khỏe & Hỗ trợ Người bệnh'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {isProfessional
                      ? 'Tham gia các hội đồng bình duyệt ca lâm sàng và liên minh giải mã sóng não'
                      : 'Kết nối cùng cộng đồng chia sẻ kinh nghiệm chăm sóc giấc ngủ, động kinh và não bộ'}
                  </p>
                </div>
              </div>
              <Link
                to="/communities"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline flex items-center gap-1"
              >
                <span>Mở trang Cộng đồng</span>
                <ChevronRight className="size-3.5" />
              </Link>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2">
              {matchedCommunities.slice(0, 4).map((c) => (
                <Card key={c.id} className="p-4 flex flex-col justify-between border-slate-200/90 shadow-2xs">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10.5px] font-bold text-teal-800">
                        {c.specialtyLabel}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {c.membersCount.toLocaleString('vi-VN')} thành viên
                      </span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-slate-900 leading-snug">{c.name}</h3>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">{c.description}</p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{c.discussionsCount} thảo luận</span>
                    <Link
                      to="/communities"
                      className="font-bold text-brand-700 hover:underline"
                    >
                      {c.isMember ? 'Đang tham gia →' : 'Tìm hiểu & Tham gia →'}
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Trending Clinical Topics Card */}
          <Card className="p-4 border-slate-200/90 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <TrendingUp className="size-3.5 text-teal-600" />
              <span>Chủ đề thảo luận lâm sàng tiêu biểu:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleSelectTag(tag)}
                  className="rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-700 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </Card>
        </div>
      ) : !hasResults ? (
        <Card className="p-8">
          <EmptyState
            icon={<UserX className="size-8" />}
            title="Không tìm thấy kết quả phù hợp"
            description="Hãy thử tìm kiếm với từ khoá mở rộng hơn hoặc kiểm tra danh mục bộ lọc."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Professionals List */}
          {professionals.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Stethoscope className="size-4 text-brand-600" />
                  <span>Bác sĩ & Nhà nghiên cứu thần kinh ({professionals.length})</span>
                </h2>
              </div>

              <div className="grid gap-3.5 sm:grid-cols-2">
                {professionals.map((prof) => (
                  <Card
                    key={prof.id}
                    className="p-4 sm:p-5 flex flex-col justify-between border-slate-200/90 shadow-2xs hover:border-brand-300 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <Link to={`/u/${prof.user.username}`} className="flex items-center gap-3 min-w-0">
                          <Avatar name={prof.user.displayName} src={prof.user.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate hover:text-brand-600 text-sm">
                              {prof.user.displayName}
                            </p>
                            <p className="text-xs text-slate-400 truncate">@{prof.user.username}</p>
                          </div>
                        </Link>
                        <ProfessionalBadge type={prof.type} status={prof.verificationStatus} compact />
                      </div>

                      <div className="mt-3.5 text-xs space-y-1 text-slate-600">
                        <p className="font-semibold text-slate-800">
                          {prof.title} · <span className="text-brand-700">{prof.specialty}</span>
                        </p>
                        {prof.institution && (
                          <p className="flex items-center gap-1 text-slate-500">
                            <Building2 className="size-3.5 text-slate-400" /> {prof.institution}
                          </p>
                        )}
                        {prof.researchInterests.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {prof.researchInterests.slice(0, 3).map((tag) => (
                              <span key={tag} className="text-[10px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
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
                          icon={<MessageCircle className="size-3.5" />}
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="size-4 text-accent-600" />
                <span>Thành viên ({users.length})</span>
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {users.map((u) => (
                  <Card key={u.id} className="p-4 flex items-center justify-between gap-3 border-slate-200/90 shadow-2xs">
                    <Link to={`/u/${u.username}`} className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.displayName} src={u.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate hover:text-brand-600 text-sm">
                          {u.displayName}
                        </p>
                        <p className="text-xs text-slate-400 truncate">@{u.username}</p>
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
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Users className="size-4 text-teal-600" />
                  <span>Cộng đồng & Hội đồng phù hợp ({matchedCommunities.length})</span>
                </h2>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {matchedCommunities.map((c) => (
                    <Card key={c.id} className="p-4 flex flex-col justify-between border-slate-200/90 shadow-2xs">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex rounded bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10.5px] font-bold text-teal-800">
                            {c.specialtyLabel}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {c.membersCount.toLocaleString('vi-VN')} thành viên
                          </span>
                        </div>
                        <h3 className="mt-2 text-sm font-bold text-slate-900 leading-snug">{c.name}</h3>
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{c.description}</p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500">{c.discussionsCount} thảo luận</span>
                        <Link to="/communities" className="font-bold text-brand-700 hover:underline">
                          {c.isMember ? 'Đang tham gia →' : 'Tham gia nhóm →'}
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
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="size-4 text-slate-600" />
                <span>Bài viết liên quan ({posts.length})</span>
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

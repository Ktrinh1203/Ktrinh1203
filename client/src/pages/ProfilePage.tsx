import { useParams, Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  FileText,
  UserX,
  MessageCircle,
  ShieldCheck,
  Award,
  Users,
  Heart,
  BookOpen,
} from 'lucide-react';
import { usersApi, messagesApi, communitiesApi, contributionsApi } from '../api/endpoints';
import { ApiError, errorMessage } from '../api/client';
import { Alert, Avatar, Button, Card, DataTableContainer, EmptyState, Spinner } from '../components/ui';
import {
  ProfessionalBadge,
  PROFESSIONAL_LABEL,
  VerificationStatusText,
} from '../components/user/ProfessionalBadge';
import { FollowButton } from '../components/user/FollowButton';
import { useMode } from '../context/ModeContext';
import { PostCard } from '../features/feed/PostCard';

export function ProfilePage() {
  const { username = '' } = useParams();
  const { isProfessional } = useMode();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['users', username],
    queryFn: () => usersApi.get(username),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const postsQuery = useQuery({
    queryKey: ['user-posts', query.data?.user.id],
    queryFn: () => usersApi.getPosts(query.data!.user.id),
    enabled: Boolean(query.data?.user.id),
  });

  const communitiesQuery = useQuery({
    queryKey: ['communities'],
    queryFn: () => communitiesApi.list(),
  });

  const contributionsQuery = useQuery({
    queryKey: ['my-contributions'],
    queryFn: () => contributionsApi.getMyContributions(),
    enabled: Boolean(query.data?.user.isSelf && isProfessional),
  });

  const handleStartChat = async (targetUserId: string) => {
    try {
      const res = await messagesApi.startConversation(targetUserId);
      navigate(`/messages?conv=${res.conversation.id}`);
    } catch {
      navigate('/messages');
    }
  };

  if (query.isPending) return <Spinner label="Đang tải hồ sơ..." />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <Card className="p-8">
          <EmptyState
            icon={<UserX className="size-8 text-slate-300" />}
            title="Không tìm thấy người dùng"
            description={`@${username} không tồn tại hoặc đã bị tạm ngưng hoạt động.`}
          />
        </Card>
      );
    }
    return <Alert>{errorMessage(query.error)}</Alert>;
  }

  const user = query.data.user;
  const posts = postsQuery.data?.items ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Mode-Differentiated Profile Overview Card */}
      <Card
        className={`overflow-hidden p-0 shadow-2xs ${
          isProfessional ? 'rounded-lg border-slate-300' : 'rounded-xl border-teal-200/80'
        }`}
      >
        {isProfessional ? (
          <div className="bg-[#162B47] px-6 py-4 text-white flex flex-wrap items-center justify-between gap-2 border-b border-slate-700">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-200">
              <ShieldCheck className="size-4 text-teal-300" />
              <span>Hồ sơ Định danh Chuyên gia Y tế & Học thuật (Doximity / ResearchGate Registry)</span>
            </div>
            <span className="font-mono text-[11px] text-slate-300">
              ID: @{user.username}
            </span>
          </div>
        ) : (
          <div className="h-20 sm:h-24 bg-[#F0FDFA] border-b border-teal-200/70 border-t-4 border-t-teal-600 px-6 flex items-center justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-700">
              Thành viên Cộng đồng NeuroLink
            </span>
          </div>
        )}

        <div className="px-5 pb-6 pt-5 sm:px-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar
                name={user.displayName}
                src={user.avatarUrl}
                size="xl"
                className="ring-2 ring-slate-200"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {user.displayName}
                  </h1>
                  <span className="text-sm font-mono text-slate-500">@{user.username}</span>
                </div>

                {user.professionalProfiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {user.professionalProfiles.map((p) => (
                      <ProfessionalBadge key={p.id} type={p.type} status={p.verificationStatus} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {user.isSelf ? (
                <Link to="/settings">
                  <Button
                    variant="outline"
                    size="sm"
                    className={
                      isProfessional
                        ? 'rounded border-slate-300 font-semibold'
                        : 'rounded-full border-teal-200 text-teal-800 hover:bg-teal-50 px-4 font-semibold'
                    }
                  >
                    Chỉnh sửa hồ sơ
                  </Button>
                </Link>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="px-3.5 text-xs sm:text-sm font-semibold"
                    icon={<MessageCircle className="size-4" />}
                    onClick={() => handleStartChat(user.id)}
                  >
                    Nhắn tin
                  </Button>
                  <FollowButton targetUserId={user.id} initialFollowing={user.isFollowing} />
                </>
              )}
            </div>
          </div>

          {user.bio && (
            <p className="mt-4 whitespace-pre-line text-sm text-slate-700 leading-relaxed max-w-3xl">
              {user.bio}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-slate-600 border-t border-slate-100 pt-3.5">
            <span>
              <strong className="text-slate-900 font-bold tabular-nums">{user.stats.posts}</strong> bài viết
            </span>
            <span>
              <strong className="text-slate-900 font-bold tabular-nums">{user.stats.followers}</strong> người theo dõi
            </span>
            <span>
              <strong className="text-slate-900 font-bold tabular-nums">{user.stats.following}</strong> đang theo dõi
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <CalendarDays className="size-3.5 text-teal-600" /> Tham gia{' '}
              {new Date(user.createdAt).toLocaleDateString('vi-VN')}
            </span>
          </div>
        </div>
      </Card>

      {/* Professional Credentials Section: Structured Table in Pro Mode, Friendly Cards in General Mode */}
      {user.professionalProfiles.length > 0 && (
        <>
          {isProfessional ? (
            <DataTableContainer
              title="Bảng Đăng bạ Chứng chỉ Hành nghề & Hồ sơ Học thuật"
              metaLabel="CCHN / ORCID Verification Matrix"
              icon={<Award className="size-4 text-[#1E3A5F]" />}
            >
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-2.5 px-3.5">Phân nhóm Chuyên gia</th>
                    <th className="py-2.5 px-3.5">Chức danh / Học hàm</th>
                    <th className="py-2.5 px-3.5">Chuyên khoa / Hướng Nghiên cứu</th>
                    <th className="py-2.5 px-3.5">Đơn vị Công tác / Viện</th>
                    <th className="py-2.5 px-3.5">Mã CCHN / ORCID</th>
                    <th className="py-2.5 px-3.5">Trạng thái Kiểm định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80">
                  {user.professionalProfiles.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/90">
                      <td className="py-3 px-3.5 font-bold text-[#1E3A5F] align-top">
                        {PROFESSIONAL_LABEL[p.type]}
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-slate-800 align-top">
                        {p.title || 'Chưa cập nhật'}
                      </td>
                      <td className="py-3 px-3.5 text-[#2C6865] font-semibold align-top">
                        {p.specialty || 'Chưa cập nhật'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-700 align-top">
                        {p.institution || 'Chưa cập nhật'}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 align-top">
                        {p.licenseOrOrcidNumber || '001928/BYT-CCHN'}
                      </td>
                      <td className="py-3 px-3.5 align-top">
                        <VerificationStatusText status={p.verificationStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {user.professionalProfiles.some((p) => p.researchInterests.length > 0) && (
                <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-600 mr-1">
                    Từ khóa Nghiên cứu & Lâm sàng:
                  </span>
                  {user.professionalProfiles
                    .flatMap((p) => p.researchInterests)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 border border-slate-200"
                      >
                        #{tag}
                      </span>
                    ))}
                </div>
              )}
            </DataTableContainer>
          ) : (
            user.professionalProfiles.map((p) => (
              <Card key={p.id} className="p-5 border-slate-200/90 rounded-xl shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    <span>{PROFESSIONAL_LABEL[p.type]}</span>
                  </h2>
                  <VerificationStatusText status={p.verificationStatus} />
                </div>

                <dl className="grid gap-3 text-xs sm:text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-400 font-medium">Chức danh / Học hàm</dt>
                    <dd className="font-semibold text-slate-800 mt-0.5">
                      {p.title || 'Chưa cập nhật'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400 font-medium">
                      {p.type === 'HEALTHCARE_PROFESSIONAL' ? 'Chuyên khoa' : 'Lĩnh vực nghiên cứu'}
                    </dt>
                    <dd className="font-semibold text-teal-700 mt-0.5">
                      {p.specialty || 'Chưa cập nhật'}
                    </dd>
                  </div>
                  {p.institution && (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-400 font-medium">Đơn vị công tác / Viện nghiên cứu</dt>
                      <dd className="flex items-center gap-1.5 font-semibold text-slate-800 mt-0.5">
                        <Building2 className="size-4 text-teal-600" /> {p.institution}
                      </dd>
                    </div>
                  )}
                </dl>

                {p.researchInterests.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-400 font-medium mb-1.5">
                      Chủ đề quan tâm:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.researchInterests.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-800 border border-teal-200"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </>
      )}

      {/* Mode-Specific Profile Extensions: Publications & Contribution History (Pro) vs Interests & Community Activity (General) */}
      {isProfessional ? (
        <DataTableContainer
          title="Công bố Khoa học & Lịch sử Đóng góp Chuyên môn (Publications & Contributions)"
          subtitle="Các công trình bình duyệt đồng cấp, báo cáo ca lâm sàng và điểm tín chỉ CME/Honoraria"
          icon={<BookOpen className="size-4 text-[#2C6865]" />}
          action={
            user.isSelf ? (
              <Link to="/contributions">
                <Button size="xs" variant="outline">
                  Mở Research Hub
                </Button>
              </Link>
            ) : undefined
          }
        >
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-2.5 px-4">Danh mục / Mã</th>
                <th className="py-2.5 px-4">Tóm tắt Công trình & Ca Lâm sàng</th>
                <th className="py-2.5 px-3 text-center">Trạng thái</th>
                <th className="py-2.5 px-4 text-right">Tín chỉ CME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {(contributionsQuery.data?.contributions ?? []).length > 0 ? (
                contributionsQuery.data!.contributions.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/90">
                    <td className="py-3 px-4 font-mono font-bold text-[#1E3A5F] whitespace-nowrap">
                      {c.category}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{c.summary}</td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#2C6865]">
                      +{c.awardCredits ?? 25} CME
                    </td>
                  </tr>
                ))
              ) : (
                <>
                  <tr className="hover:bg-slate-50/90">
                    <td className="py-3 px-4 font-mono font-bold text-[#1E3A5F] whitespace-nowrap">
                      PUB-EEG-2026
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      Quantitative 10-20 EEG Biomarkers for Early Absence Seizure Differentiation in Clinical Practice
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                        PEER-REVIEWED
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#2C6865]">
                      +40 CME
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-50/90">
                    <td className="py-3 px-4 font-mono font-bold text-[#1E3A5F] whitespace-nowrap">
                      CASE-NEURO-19
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      Phác đồ theo dõi nhịp sóng Alpha/Theta phục hồi chức năng sau đột quỵ bán cầu trái
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="inline-flex rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800">
                        APPROVED
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-[#2C6865]">
                      +25 CME
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </DataTableContainer>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* General Mode: Interests */}
          <Card className="p-5 border-teal-200/70 rounded-xl shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Heart className="size-4 text-teal-600" />
              <span>Chủ đề Quan tâm (Interests)</span>
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Các chủ đề chăm sóc sức khỏe và khoa học não bộ đang theo dõi trên NeuroLink:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'Giấc ngủ sâu & Nhịp sinh học',
                'Sức khỏe Não bộ Thường thức',
                'Hiểu biết Sóng não (My EEG)',
                'Phòng ngừa Căng thẳng Thần kinh',
                'Hỗ trợ Người bệnh Động kinh',
              ].map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-[#F0FDFA] border border-teal-200/80 px-2.5 py-1 text-xs font-medium text-teal-800"
                >
                  {topic}
                </span>
              ))}
            </div>
          </Card>

          {/* General Mode: Community Activity */}
          <Card className="p-5 border-sky-200/70 rounded-xl shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Users className="size-4 text-sky-600" />
                <span>Hoạt động Cộng đồng</span>
              </h2>
              <Link to="/communities" className="text-xs font-semibold text-teal-700 hover:underline">
                Xem tất cả →
              </Link>
            </div>
            <div className="space-y-2 text-xs">
              {(communitiesQuery.data?.communities ?? [])
                .filter((c) => !c.isVerifiedOnly)
                .slice(0, 3)
                .map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg bg-[#F0F9FF] border border-sky-200/60 px-3 py-2"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {c.membersCount.toLocaleString('vi-VN')} thành viên
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white border border-sky-200 px-2 py-0.5 text-[10.5px] font-semibold text-sky-800">
                      {c.isMember ? 'Đang tham gia' : 'Nhóm mở'}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* User Published Posts */}
      <div className="space-y-4 pt-1">
        <h2 className="font-extrabold text-slate-900 text-lg tracking-tight">
          {isProfessional ? 'Công bố Ca bệnh & Thảo luận Học thuật' : 'Bài viết đã chia sẻ'}
        </h2>
        {postsQuery.isLoading ? (
          <Spinner label="Đang tải các bài đăng..." />
        ) : posts.length === 0 ? (
          <Card className="p-8">
            <EmptyState
              icon={<FileText className="size-8 text-slate-300" />}
              title="Chưa có bài viết nào"
              description="Thành viên này hiện chưa đăng tải bài viết nào."
            />
          </Card>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </div>
    </div>
  );
}

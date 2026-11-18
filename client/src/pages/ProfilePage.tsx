import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  BookOpen,
  Camera,
  FileText,
  ImagePlus,
  Loader2,
  MessageCircle,
  UserX,
} from 'lucide-react';
import { contributionsApi, usersApi } from '../api/endpoints';
import { ApiError, errorMessage } from '../api/client';
import type { SelfUser } from '../api/types';
import { Alert, Avatar, Button, Card, EmptyState, Spinner } from '../components/ui';
import { FollowButton } from '../components/user/FollowButton';
import { useMode } from '../context/ModeContext';
import { useAuth } from '../features/auth/AuthContext';
import { PostCard } from '../features/feed/PostCard';
import { useChatPopup } from '../features/messages/ChatPopupContext';

export function ProfilePage() {
  const { username = '' } = useParams();
  const { user: authUser, setUser } = useAuth();
  const { isProfessional } = useMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startChatWithUser } = useChatPopup();

  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const verifiedProfiles = (query.data?.user.professionalProfiles ?? []).filter(
    (p) => p.verificationStatus === 'VERIFIED',
  );

  const contributionsQuery = useQuery({
    queryKey: ['my-contributions'],
    queryFn: () => contributionsApi.getMyContributions(),
    enabled: Boolean(query.data?.user.isSelf && isProfessional && verifiedProfiles.length > 0),
  });

  function syncAfterUpload(updated: SelfUser) {
    setUser(updated);
    void queryClient.invalidateQueries({ queryKey: ['posts'] });
    void queryClient.invalidateQueries({ queryKey: ['user'] });
    void queryClient.invalidateQueries({ queryKey: ['users', username] });
    void query.refetch();
  }

  async function handleCoverUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setUploadingCover(true);
    try {
      const res = await usersApi.uploadCover(file);
      syncAfterUpload(res.user);
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploadingCover(false);
    }
  }

  async function handleAvatarUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError(null);
    setUploadingAvatar(true);
    try {
      const res = await usersApi.uploadAvatar(file);
      syncAfterUpload(res.user);
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploadingAvatar(false);
    }
  }

  const handleStartChat = async (targetUserId: string) => {
    try {
      await startChatWithUser(targetUserId);
    } catch {
      navigate('/messages');
    }
  };

  if (query.isPending) return <Spinner label="Đang tải hồ sơ..." />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return (
        <Card className="p-8 border-[#DCE6DF]">
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

  const profile = query.data.user;
  const posts = postsQuery.data?.items ?? [];
  const contributions = contributionsQuery.data?.contributions ?? [];

  const displayCoverUrl = profile.isSelf ? (authUser?.coverUrl ?? profile.coverUrl) : profile.coverUrl;
  const displayAvatarUrl = profile.isSelf
    ? (authUser?.avatarUrl ?? profile.avatarUrl)
    : profile.avatarUrl;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Profile Header Card */}
      <div className="rounded-xl border border-[#DCE6DF] bg-white overflow-hidden">
        {/* Cover Photo Banner */}
        <div className="relative h-36 sm:h-48 bg-[#E8F3EC]">
          {displayCoverUrl && (
            <img
              src={displayCoverUrl}
              alt={`Ảnh bìa của ${profile.displayName}`}
              className="h-full w-full object-cover"
            />
          )}
          {profile.isSelf && (
            <>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleCoverUpload}
              />
              <Button
                type="button"
                size="xs"
                variant="outline"
                loading={uploadingCover}
                onClick={() => coverInputRef.current?.click()}
                icon={<ImagePlus className="size-3.5 text-[#15803D]" />}
                className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs border-[#DCE6DF] text-[#111827] hover:bg-white"
              >
                Đổi ảnh bìa
              </Button>
            </>
          )}
        </div>

        <div className="px-5 pb-5">
          {/* Avatar + Action Row */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="-mt-10 sm:-mt-12 relative shrink-0">
              <Avatar
                name={profile.displayName}
                src={displayAvatarUrl}
                size="xl"
                className="size-20 sm:size-24 rounded-full ring-4 ring-white"
              />
              {profile.isSelf && (
                <>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <button
                    type="button"
                    disabled={uploadingAvatar}
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="Đổi ảnh đại diện"
                    title="Đổi ảnh đại diện"
                    className="absolute bottom-0 right-0 flex size-7 sm:size-8 items-center justify-center rounded-full border border-[#DCE6DF] bg-white text-[#15803D] shadow-xs hover:bg-[#F5FAF7] disabled:opacity-60"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Camera className="size-3.5 sm:size-4" />
                    )}
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3">
              {profile.isSelf ? (
                <Link to="/settings">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#DCE6DF] text-[#15803D] hover:bg-[#F5FAF7] font-semibold"
                  >
                    Chỉnh sửa hồ sơ
                  </Button>
                </Link>
              ) : (
                <>
                  <FollowButton targetUserId={profile.id} initialFollowing={profile.isFollowing} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-[#DCE6DF] text-[#111827] hover:bg-[#F5FAF7]"
                    icon={<MessageCircle className="size-4 text-[#16A34A]" />}
                    onClick={() => handleStartChat(profile.id)}
                  >
                    Nhắn tin
                  </Button>
                </>
              )}
            </div>
          </div>

          {uploadError && (
            <Alert tone="error" className="mt-3">
              {uploadError}
            </Alert>
          )}

          {/* Clean User Info */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-xl font-bold text-[#111827] tracking-tight">
                {profile.displayName}
              </h1>
              {verifiedProfiles.length > 0 && (
                <BadgeCheck
                  className="size-5 text-[#16A34A] shrink-0"
                  aria-label="Chuyên gia đã xác minh"
                />
              )}
            </div>
            <p className="text-sm text-[#6B7280]">@{profile.username}</p>

            {verifiedProfiles.length > 0 && (
              <div className="space-y-0.5 pt-0.5 text-xs sm:text-sm text-[#15803D]">
                {verifiedProfiles.slice(0, 2).map((p) => (
                  <p key={p.id} className="font-medium">
                    {p.title}
                    {p.specialty ? ` · ${p.specialty}` : ''}
                    {p.institution ? ` · ${p.institution}` : ''}
                  </p>
                ))}
              </div>
            )}

            {profile.bio && (
              <p className="pt-1 whitespace-pre-line text-sm text-[#374151] leading-relaxed">
                {profile.bio}
              </p>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-[#6B7280]">
              <span>
                <strong className="font-semibold text-[#111827] tabular-nums">
                  {profile.stats.posts}
                </strong>{' '}
                bài viết
              </span>
              <span>·</span>
              <span>
                <strong className="font-semibold text-[#111827] tabular-nums">
                  {profile.stats.followers}
                </strong>{' '}
                người theo dõi
              </span>
              <span>·</span>
              <span>
                <strong className="font-semibold text-[#111827] tabular-nums">
                  {profile.stats.following}
                </strong>{' '}
                đang theo dõi
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Concise Publications Section (Verified Professionals only when data exists) */}
      {verifiedProfiles.length > 0 && contributions.length > 0 && (
        <div className="rounded-xl border border-[#DCE6DF] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#111827]">
              <BookOpen className="size-4 text-[#16A34A]" />
              <span>Công bố &amp; Đóng góp</span>
            </h2>
            {profile.isSelf && (
              <Link
                to="/contributions"
                className="text-xs font-semibold text-[#15803D] hover:underline"
              >
                Xem tất cả
              </Link>
            )}
          </div>
          <div className="divide-y divide-[#DCE6DF]">
            {contributions.slice(0, 5).map((c) => (
              <div key={c.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-[#111827] truncate">{c.summary}</p>
                  <p className="text-[#6B7280]">{c.category}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#F5FAF7] border border-[#DCE6DF] px-2.5 py-0.5 text-[11px] font-semibold text-[#15803D]">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Posts Feed */}
      <div className="space-y-3.5">
        <h2 className="text-base font-bold text-[#111827]">Bài viết</h2>
        {postsQuery.isLoading ? (
          <Spinner label="Đang tải bài viết..." />
        ) : posts.length === 0 ? (
          <div className="rounded-xl border border-[#DCE6DF] bg-white p-8">
            <EmptyState
              icon={<FileText className="size-8 text-[#16A34A]/40" />}
              title="Chưa có bài viết nào"
              description="Chưa có bài viết nào được chia sẻ."
            />
          </div>
        ) : (
          <div className="space-y-3.5">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageCircle, Pencil, UserCheck, UserPlus } from 'lucide-react';
import { messagesApi, usersApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  Avatar,
  BottomSheet,
  EmptyView,
  Spinner,
  VerifiedCheck,
  cn,
  isUserVerified,
  relativeTime,
} from '../components/ui';

export function ProfilePage() {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { setUser } = useAuth();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);

  const userQuery = useQuery({
    queryKey: ['users', username],
    queryFn: () => usersApi.get(username),
  });

  const postsQuery = useQuery({
    queryKey: ['user-posts', userQuery.data?.user.id],
    queryFn: () => usersApi.getPosts(userQuery.data!.user.id),
    enabled: Boolean(userQuery.data?.user.id),
  });

  const followMut = useMutation({
    mutationFn: ({ id, following }: { id: string; following: boolean }) =>
      following ? usersApi.unfollow(id) : usersApi.follow(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['users', username] }),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      usersApi.updateMe({
        displayName: editName.trim(),
        bio: editBio.trim() || null,
      }),
    onSuccess: (res) => {
      setUser(res.user);
      setEditErr(null);
      setEditOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['users', username] });
    },
    onError: (e) => setEditErr(errorMessage(e)),
  });

  const startChat = async (target: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    professionalProfiles: { type: 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER'; verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED'; title: string }[];
  }) => {
    try {
      const res = await messagesApi.startConversation(target.id);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate(`/chat?conv=${res.conversation.id}`, {
        state: { otherUser: res.conversation.otherUser ?? target },
      });
    } catch {
      navigate('/chat');
    }
  };

  if (userQuery.isLoading) return <Spinner />;
  const profile = userQuery.data?.user;
  if (!profile) return <EmptyView title="Không tìm thấy hồ sơ" />;

  const verifiedProfile = profile.professionalProfiles.find((p) => p.verificationStatus === 'VERIFIED');
  const posts = postsQuery.data?.items ?? [];

  const openEdit = () => {
    setEditName(profile.displayName);
    setEditBio(profile.bio ?? '');
    setEditErr(null);
    setEditOpen(true);
  };

  return (
    <div className="space-y-3">
      {/* Compact Profile Hero */}
      <section className="bg-white border-b border-[#DCE6DF] pb-5">
        <div className="h-24 bg-[#E6F4EA] overflow-hidden">
          {profile.coverUrl && (
            <img src={profile.coverUrl} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="px-4 -mt-8 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <span className="inline-flex rounded-full ring-4 ring-white">
              <Avatar name={profile.displayName} src={profile.avatarUrl} size="xl" />
            </span>

            {profile.isSelf ? (
              <div className="pb-1">
                <button
                  type="button"
                  onClick={openEdit}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-4 h-10 text-xs font-semibold text-[#111827] hover:border-[#86EFAC] active:scale-95 transition-all cursor-pointer"
                >
                  <Pencil className="size-3.5 text-[#15803D]" aria-hidden />
                  <span>Chỉnh sửa</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => void startChat(profile)}
                  aria-label="Nhắn tin"
                  className="flex size-10 items-center justify-center rounded-full border border-[#DCE6DF] bg-white text-[#15803D] active:scale-95 transition-transform cursor-pointer"
                >
                  <MessageCircle className="size-4.5" aria-hidden />
                </button>
                <button
                  type="button"
                  disabled={followMut.isPending}
                  onClick={() => followMut.mutate({ id: profile.id, following: profile.isFollowing })}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-4 h-10 text-xs font-semibold transition-colors cursor-pointer',
                    profile.isFollowing
                      ? 'border border-[#DCE6DF] bg-[#F5FAF7] text-[#111827]'
                      : 'bg-[#16A34A] text-white',
                  )}
                >
                  {profile.isFollowing ? (
                    <>
                      <UserCheck className="size-3.5" aria-hidden />
                      <span>Đang theo dõi</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-3.5" aria-hidden />
                      <span>Theo dõi</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div>
            <h2 className="flex items-center gap-1.5 text-lg font-bold text-[#111827]">
              <span>{profile.displayName}</span>
              {isUserVerified(profile) && <VerifiedCheck className="size-4" />}
            </h2>
            <p className="text-xs text-[#5B6860]">@{profile.username}</p>
            {verifiedProfile && (
              <p className="mt-1 text-xs font-medium text-[#15803D]">
                {verifiedProfile.title}
                {verifiedProfile.institution ? ` · ${verifiedProfile.institution}` : ''}
              </p>
            )}
            {profile.bio && (
              <p className="mt-2 text-sm leading-relaxed text-[#374151]">{profile.bio}</p>
            )}
          </div>

          <div className="flex items-center gap-5 pt-1 text-xs tabular-nums">
            <span>
              <strong className="font-mono text-[#111827]">{profile.stats.posts}</strong>{' '}
              <span className="text-[#5B6860]">bài</span>
            </span>
            <span>
              <strong className="font-mono text-[#111827]">{profile.stats.followers}</strong>{' '}
              <span className="text-[#5B6860]">theo dõi</span>
            </span>
            <span>
              <strong className="font-mono text-[#111827]">{profile.stats.following}</strong>{' '}
              <span className="text-[#5B6860]">đang theo dõi</span>
            </span>
          </div>
        </div>
      </section>

      {/* Posts List */}
      <section className="divide-y divide-[#E6EFE9] bg-white border-y border-[#E6EFE9]">
        {postsQuery.isLoading ? (
          <Spinner />
        ) : posts.length === 0 ? (
          <EmptyView title="Chưa có bài viết" />
        ) : (
          posts.map((p) => (
            <article key={p.id} className="px-4 py-3.5 space-y-2">
              <p className="text-[11px] text-[#7A8880]">{relativeTime(p.createdAt)}</p>
              <p className="text-sm leading-relaxed text-[#1F2937] line-clamp-4 whitespace-pre-wrap break-words">
                {p.content}
              </p>
              {p.media.length > 0 && (
                <div className={cn('grid gap-1.5', p.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                  {p.media.map((m) => (
                    <img
                      key={m.id}
                      src={m.url}
                      alt=""
                      loading="lazy"
                      className="w-full max-h-52 rounded-2xl object-cover border border-[#DCE6DF]"
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 pt-0.5 text-[11px] font-semibold text-[#7A8880] tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Heart className={cn('size-3.5', p.isLiked && 'fill-[#E11D48] text-[#E11D48]')} aria-hidden />
                  {p.likesCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3.5" aria-hidden />
                  {p.commentsCount}
                </span>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Edit Own Profile Sheet */}
      <BottomSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Chỉnh sửa hồ sơ"
        headerRight={
          <button
            type="button"
            disabled={!editName.trim() || updateMut.isPending}
            onClick={() => updateMut.mutate()}
            className="rounded-full bg-[#16A34A] px-4 h-9 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
          >
            {updateMut.isPending ? 'Đang lưu...' : 'Lưu'}
          </button>
        }
      >
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (editName.trim()) updateMut.mutate();
          }}
          className="space-y-3"
        >
          {editErr && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {editErr}
            </p>
          )}
          <input
            type="text"
            maxLength={80}
            placeholder="Tên hiển thị"
            aria-label="Tên hiển thị"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="w-full h-11 rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] px-4 text-sm focus:bg-white focus:border-[#16A34A] focus:outline-none"
          />
          <textarea
            rows={3}
            maxLength={300}
            placeholder="Giới thiệu ngắn..."
            aria-label="Giới thiệu ngắn"
            value={editBio}
            onChange={(e) => setEditBio(e.target.value)}
            className="w-full rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] p-3.5 text-sm focus:bg-white focus:border-[#16A34A] focus:outline-none resize-none"
          />
        </form>
      </BottomSheet>
    </div>
  );
}

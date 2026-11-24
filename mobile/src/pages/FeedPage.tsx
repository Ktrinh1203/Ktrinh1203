import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Heart,
  ImagePlus,
  MessageCircle,
  PenSquare,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { communityInsightsApi, messagesApi, postsApi } from '../api/endpoints';
import { errorMessage } from '../api/client';
import type { ClinicalCategory, CommentItem, PaginatedPosts, PostItem, UserSummary } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';
import {
  Avatar,
  BottomSheet,
  EmptyView,
  PillTabs,
  Spinner,
  VerifiedCheck,
  cn,
  isUserVerified,
  relativeTime,
} from '../components/ui';

type InfinitePostsData = { pages: PaginatedPosts[]; pageParams: unknown[] };

interface AttachedImage {
  id: string;
  file: File;
  url: string;
}

const TOPICS: { id: 'ALL' | ClinicalCategory; label: string; pattern?: RegExp }[] = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'VASCULAR_STROKE', label: 'Đột quỵ', pattern: /đột quỵ|stroke|ischemic|hemorrhagic|dar|bsi|tpa|mạch máu/i },
  { id: 'EPILEPSY_ICU', label: 'Động kinh', pattern: /động kinh|epilep|co giật|kịch phát|thái dương|icu|pnes/i },
  { id: 'SLEEP_COGNITIVE', label: 'Giấc ngủ', pattern: /giấc ngủ|sleep|mệt mỏi|tập trung|alpha|tar|n3|mất ngủ/i },
  { id: 'HARDWARE_BCI', label: 'EEG & BCI', pattern: /ads1299|bci|phần cứng|thiết bị|dsp|10-20|điện cực|eeg/i },
];

function CommentsSheet({
  post,
  onClose,
  onCountChange,
}: {
  post: PostItem | null;
  onClose: () => void;
  onCountChange: (postId: string, delta: number) => void;
}) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    setText('');
    setErr(null);
  }, [post?.id]);

  const { data, isLoading } = useQuery({
    queryKey: ['post-comments', post?.id],
    queryFn: () => postsApi.getComments(post!.id),
    enabled: Boolean(post?.id),
  });

  const sendMut = useMutation({
    mutationFn: (content: string) => postsApi.createComment(post!.id, content),
    onSuccess: (res) => {
      setText('');
      setErr(null);
      queryClient.setQueryData<{ comments: CommentItem[] }>(
        ['post-comments', post!.id],
        (old) => ({ comments: [...(old?.comments ?? []), res.comment] }),
      );
      onCountChange(post!.id, 1);
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (commentId: string) => postsApi.deleteComment(commentId),
    onSuccess: (_res, commentId) => {
      setErr(null);
      queryClient.setQueryData<{ comments: CommentItem[] }>(
        ['post-comments', post!.id],
        (old) => ({ comments: (old?.comments ?? []).filter((c) => c.id !== commentId) }),
      );
      onCountChange(post!.id, -1);
    },
    onError: (e) => setErr(errorMessage(e)),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !post) return;
    sendMut.mutate(text.trim());
  };

  const comments = data?.comments ?? [];

  return (
    <BottomSheet open={Boolean(post)} onClose={onClose} title={`Bình luận (${comments.length})`}>
      <div className="space-y-4">
        {isLoading ? (
          <Spinner />
        ) : comments.length === 0 ? (
          <EmptyView title="Chưa có bình luận" />
        ) : (
          <div className="space-y-3.5">
            {comments.map((c) => {
              const canDel = c.isAuthor || user?.id === c.author.id || user?.role === 'ADMIN';
              return (
                <div key={c.id} className="flex items-start gap-2.5">
                  <Link to={`/u/${c.author.username}`} onClick={onClose}>
                    <Avatar name={c.author.displayName} src={c.author.avatarUrl} size="sm" />
                  </Link>
                  <div className="min-w-0 flex-1 rounded-2xl bg-[#F5FAF7] px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/u/${c.author.username}`}
                        onClick={onClose}
                        className="text-xs font-bold text-[#111827] truncate"
                      >
                        {c.author.displayName}
                      </Link>
                      {isUserVerified(c.author) && <VerifiedCheck />}
                      <span className="text-[11px] text-[#7A8880] ml-auto shrink-0">
                        {relativeTime(c.createdAt)}
                      </span>
                      {canDel && (
                        <button
                          type="button"
                          disabled={deleteMut.isPending}
                          onClick={() => deleteMut.mutate(c.id)}
                          aria-label="Xóa bình luận"
                          className="ml-0.5 flex size-7 items-center justify-center rounded-full text-[#94A39B] hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-[14px] leading-relaxed text-[#1F2937] whitespace-pre-wrap break-words">
                      {c.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {err && (
          <p role="alert" className="text-xs text-red-600">
            {err}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2 border-t border-[#EDF3EF]">
          <input
            type="text"
            maxLength={2000}
            placeholder="Viết bình luận..."
            aria-label="Viết bình luận"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 h-11 rounded-full border border-[#DCE6DF] bg-[#F5FAF7] px-4 text-sm text-[#111827] placeholder:text-[#8A9790] focus:bg-white focus:border-[#16A34A] focus:outline-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || sendMut.isPending}
            aria-label="Gửi bình luận"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-white disabled:opacity-40 active:scale-95 transition-all cursor-pointer"
          >
            <Send className="size-4.5" aria-hidden />
          </button>
        </form>
      </div>
    </BottomSheet>
  );
}

function FeedItem({
  post,
  onOpenComments,
  onDeleted,
  onLikeSynced,
}: {
  post: PostItem;
  onOpenComments: (post: PostItem) => void;
  onDeleted: (id: string) => void;
  onLikeSynced: (postId: string, liked: boolean, likesCount: number) => void;
}) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.isLiked);
  const [likes, setLikes] = useState(post.likesCount);
  const [pop, setPop] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [itemErr, setItemErr] = useState<string | null>(null);

  useEffect(() => {
    setLiked(post.isLiked);
    setLikes(post.likesCount);
  }, [post.id, post.isLiked, post.likesCount]);

  const likeMut = useMutation({
    mutationFn: (next: boolean) => (next ? postsApi.like(post.id) : postsApi.unlike(post.id)),
    onMutate: (next) => {
      const nextLikes = next ? likes + 1 : Math.max(0, likes - 1);
      setLiked(next);
      setLikes(nextLikes);
      onLikeSynced(post.id, next, nextLikes);
      if (next) {
        setPop(true);
        setTimeout(() => setPop(false), 240);
      }
      return { prevLiked: liked, prevLikes: likes };
    },
    onError: (_e, _next, ctx) => {
      if (ctx) {
        setLiked(ctx.prevLiked);
        setLikes(ctx.prevLikes);
        onLikeSynced(post.id, ctx.prevLiked, ctx.prevLikes);
      }
    },
    onSuccess: (res) => {
      setLiked(res.liked);
      setLikes(res.likesCount);
      onLikeSynced(post.id, res.liked, res.likesCount);
    },
  });

  const delMut = useMutation({
    mutationFn: () => postsApi.delete(post.id),
    onSuccess: () => onDeleted(post.id),
    onError: (e) => {
      setConfirmDel(false);
      setItemErr(errorMessage(e));
    },
  });

  const canDelete = user?.id === post.author.id || user?.role === 'ADMIN';
  const isLong = post.content.length > 180;

  return (
    <article className="bg-white px-4 py-4 border-b border-[#E6EFE9]">
      {/* Author row */}
      <div className="flex items-center gap-2.5">
        <Link to={`/u/${post.author.username}`}>
          <Avatar name={post.author.displayName} src={post.author.avatarUrl} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Link
              to={`/u/${post.author.username}`}
              className="text-[14px] font-bold text-[#111827] truncate"
            >
              {post.author.displayName}
            </Link>
            {isUserVerified(post.author) && <VerifiedCheck />}
          </div>
          <p className="text-[12px] text-[#7A8880]">
            @{post.author.username} · {relativeTime(post.createdAt)}
          </p>
        </div>

        {canDelete && (
          confirmDel ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                disabled={delMut.isPending}
                onClick={() => delMut.mutate()}
                className="rounded-full bg-red-600 px-3 h-8 text-[11px] font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                {delMut.isPending ? 'Đang xóa...' : 'Xóa'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDel(false)}
                aria-label="Hủy xóa"
                className="flex size-8 items-center justify-center rounded-full bg-[#F5FAF7] text-[#5B6860] cursor-pointer"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDel(true)}
              aria-label="Xóa bài"
              className="flex size-9 items-center justify-center rounded-full text-[#94A39B] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )
        )}
      </div>

      {itemErr && (
        <p role="alert" className="mt-2 ml-[46px] text-xs text-red-600">
          {itemErr}
        </p>
      )}

      {/* Concise readable body */}
      <div className="mt-2.5 pl-[46px]">
        <p
          className={cn(
            'text-[15px] leading-[1.58] text-[#1F2937] whitespace-pre-wrap break-words',
            !expanded && isLong && 'line-clamp-4',
          )}
        >
          {post.content}
        </p>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-semibold text-[#16A34A] cursor-pointer"
          >
            {expanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        )}

        {/* Attached Media */}
        {post.media.length > 0 && (
          <div
            className={cn(
              'mt-3 grid gap-1.5',
              post.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
            )}
          >
            {post.media.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setLightbox(m.url)}
                className="overflow-hidden rounded-2xl border border-[#DCE6DF] bg-[#F5FAF7] cursor-pointer"
              >
                <img
                  src={m.url}
                  alt=""
                  loading="lazy"
                  className="w-full max-h-64 object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Minimal Thumb-Friendly Action Row */}
        <div className="mt-2.5 -ml-2 flex items-center gap-3 text-[#5B6860]">
          <button
            type="button"
            disabled={likeMut.isPending}
            onClick={() => likeMut.mutate(!liked)}
            aria-label={liked ? 'Bỏ thích' : 'Thích'}
            aria-pressed={liked}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 h-10 text-xs font-semibold transition-colors cursor-pointer',
              liked ? 'text-[#E11D48]' : 'hover:text-[#111827]',
            )}
          >
            <Heart
              className={cn(
                'size-[18px]',
                liked && 'fill-current',
                pop && 'animate-pop-like',
              )}
              aria-hidden
            />
            <span className="tabular-nums">{likes > 0 ? likes : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenComments(post)}
            aria-label="Bình luận"
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-10 text-xs font-semibold hover:text-[#111827] transition-colors cursor-pointer"
          >
            <MessageCircle className="size-[18px]" aria-hidden />
            <span className="tabular-nums">{post.commentsCount > 0 ? post.commentsCount : ''}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}/feed#${post.id}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}
            aria-label="Chia sẻ"
            className="inline-flex items-center gap-1 rounded-full px-2.5 h-10 text-xs font-medium hover:text-[#111827] transition-colors cursor-pointer ml-auto"
          >
            {copied ? (
              <Check className="size-[17px] text-[#16A34A]" aria-hidden />
            ) : (
              <Share2 className="size-[17px]" aria-hidden />
            )}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Đóng ảnh"
            className="absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/15 text-white cursor-pointer"
          >
            <X className="size-5" aria-hidden />
          </button>
          <img src={lightbox} alt="" className="max-h-[85dvh] max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </article>
  );
}

export function FeedPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [feedType, setFeedType] = useState<'community' | 'following'>('community');
  const [topic, setTopic] = useState<'ALL' | ClinicalCategory>('ALL');
  const [composeOpen, setComposeOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const attachmentsRef = useRef<AttachedImage[]>([]);
  attachmentsRef.current = attachments;
  const [composeErr, setComposeErr] = useState<string | null>(null);
  const [commentPost, setCommentPost] = useState<PostItem | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach((a) => URL.revokeObjectURL(a.url));
    };
  }, []);

  const clearAttachments = () => {
    setAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.url));
      return [];
    });
  };

  const feedQuery = useInfiniteQuery({
    queryKey: ['posts', feedType],
    queryFn: ({ pageParam }) => postsApi.getFeed(feedType, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  });

  const spotlightQuery = useQuery({
    queryKey: ['community-spotlight'],
    queryFn: () => communityInsightsApi.getSpotlight(),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('content', draft.trim());
      attachments.forEach((a) => fd.append('media', a.file));
      return postsApi.create(fd);
    },
    onSuccess: () => {
      setDraft('');
      clearAttachments();
      setComposeErr(null);
      setComposeOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (e) => setComposeErr(errorMessage(e)),
  });

  const startChat = async (targetUser: UserSummary) => {
    try {
      const res = await messagesApi.startConversation(targetUser.id);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate(`/chat?conv=${res.conversation.id}`, {
        state: { otherUser: res.conversation.otherUser ?? targetUser },
      });
    } catch {
      navigate('/chat');
    }
  };

  const allPosts = feedQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const activeTopic = TOPICS.find((t) => t.id === topic);
  const posts =
    topic === 'ALL' || !activeTopic?.pattern
      ? allPosts
      : allPosts.filter((p) => activeTopic.pattern!.test(p.content));

  const doctors = (spotlightQuery.data?.professionals ?? []).filter(
    (item) => item.user.id !== user?.id && item.user.username !== user?.username,
  );

  const handleDeleteLocal = (id: string) => {
    queryClient.setQueriesData<InfinitePostsData>({ queryKey: ['posts'] }, (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((pg) => ({ ...pg, items: pg.items.filter((x) => x.id !== id) })),
      };
    });
  };

  const handleLikeSynced = (postId: string, liked: boolean, likesCount: number) => {
    queryClient.setQueriesData<InfinitePostsData>({ queryKey: ['posts'] }, (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((pg) => ({
          ...pg,
          items: pg.items.map((x) => (x.id === postId ? { ...x, isLiked: liked, likesCount } : x)),
        })),
      };
    });
  };

  const handleCommentDelta = (postId: string, delta: number) => {
    queryClient.setQueriesData<InfinitePostsData>({ queryKey: ['posts'] }, (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((pg) => ({
          ...pg,
          items: pg.items.map((x) =>
            x.id === postId ? { ...x, commentsCount: Math.max(0, x.commentsCount + delta) } : x,
          ),
        })),
      };
    });
  };

  const onFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) {
      setAttachments((prev) => {
        const remaining = Math.max(0, 4 - prev.length);
        const nextItems: AttachedImage[] = picked.slice(0, remaining).map((file, idx) => ({
          id: `${file.name}-${file.lastModified}-${Date.now()}-${idx}`,
          file,
          url: URL.createObjectURL(file),
        }));
        return [...prev, ...nextItems];
      });
    }
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((a) => a.id !== id);
    });
  };

  return (
    <div className="relative">
      {/* Compact Active Doctors Avatar Rail (Instagram / Telegram Story Strip) */}
      {doctors.length > 0 && (
        <div className="bg-white border-b border-[#E6EFE9]">
          <div
            data-story-strip="true"
            className="flex items-center gap-3.5 overflow-x-auto no-scrollbar px-4 pt-3.5 pb-3"
          >
            {doctors.map((item) => {
              const shortName = item.user.displayName.split(' ').slice(-2).join(' ');
              return (
                <button
                  key={item.user.id}
                  type="button"
                  onClick={() => void startChat(item.user)}
                  className="flex flex-col items-center gap-1.5 shrink-0 w-16 group cursor-pointer active:scale-95 transition-transform"
                >
                  <Avatar
                    name={item.user.displayName}
                    src={item.user.avatarUrl}
                    size="md"
                    online
                    storyRing
                  />
                  <span className="w-full truncate text-center text-[11px] font-medium text-[#1F2937]">
                    {shortName}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed Tabs + Topic Pill Filter */}
      <div className="bg-white border-b border-[#E6EFE9]">
        <div className="grid grid-cols-2 border-b border-[#EDF3EF]">
          {[
            { id: 'community' as const, label: isProfessional ? 'Ca lâm sàng' : 'Dành cho bạn' },
            { id: 'following' as const, label: 'Đang theo dõi' },
          ].map((t) => {
            const active = feedType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setFeedType(t.id)}
                className={cn(
                  'relative h-11 text-[14px] transition-colors cursor-pointer',
                  active ? 'font-bold text-[#111827]' : 'font-medium text-[#7A8880]',
                )}
              >
                {t.label}
                {active && (
                  <span
                    className={cn(
                      'absolute bottom-0 left-1/2 -translate-x-1/2 h-[2.5px] w-14 rounded-full',
                      isProfessional ? 'bg-[#14532D]' : 'bg-[#16A34A]',
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="px-3.5 py-1.5 bg-[#F5FAF7]">
          <div
            style={{
              maskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent 100%)',
            }}
          >
            <PillTabs
              items={TOPICS.map(({ id, label }) => ({ id, label }))}
              value={topic}
              onChange={setTopic}
              dark={isProfessional}
              className="pr-5"
            />
          </div>
        </div>
      </div>

      {/* Hairline Stream */}
      {feedQuery.isLoading ? (
        <Spinner />
      ) : feedQuery.isError ? (
        <EmptyView
          title="Không tải được bảng tin"
          action={
            <button
              type="button"
              onClick={() => void feedQuery.refetch()}
              className="rounded-full bg-[#16A34A] px-4 h-10 text-xs font-semibold text-white cursor-pointer"
            >
              Thử lại
            </button>
          }
        />
      ) : posts.length === 0 ? (
        <EmptyView
          title={topic !== 'ALL' ? 'Chưa có bài viết chủ đề này' : 'Chưa có bài viết nào'}
          action={
            topic !== 'ALL' ? (
              <button
                type="button"
                onClick={() => setTopic('ALL')}
                className="rounded-full border border-[#DCE6DF] bg-white px-4 h-10 text-xs font-semibold text-[#15803D] cursor-pointer"
              >
                Xem tất cả
              </button>
            ) : null
          }
        />
      ) : (
        <div>
          {posts.map((post) => (
            <FeedItem
              key={post.id}
              post={post}
              onOpenComments={setCommentPost}
              onDeleted={handleDeleteLocal}
              onLikeSynced={handleLikeSynced}
            />
          ))}

          {feedQuery.hasNextPage && (
            <div className="py-5 text-center">
              <button
                type="button"
                disabled={feedQuery.isFetchingNextPage}
                onClick={() => void feedQuery.fetchNextPage()}
                className="rounded-full border border-[#DCE6DF] bg-white px-5 h-10 text-xs font-semibold text-[#15803D] cursor-pointer"
              >
                {feedQuery.isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Thumb-Zone Compose FAB (Constrained inside 430px frame + safe-area aware) */}
      <div
        className="fixed inset-x-0 z-20 flex justify-center pointer-events-none"
        style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="w-full max-w-[430px] flex justify-end px-4">
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            aria-label="Viết bài mới"
            className={cn(
              'pointer-events-auto flex size-12 items-center justify-center rounded-full text-white shadow-[0_8px_22px_-4px_rgba(22,163,74,0.45)] active:scale-95 transition-transform cursor-pointer',
              isProfessional ? 'bg-[#14532D] hover:bg-[#166534]' : 'bg-[#16A34A] hover:bg-[#15803D]',
            )}
          >
            <PenSquare className="size-5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Create Post Bottom Sheet */}
      <BottomSheet
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        title={isProfessional ? 'Chia sẻ ca lâm sàng' : 'Bài viết mới'}
        headerRight={
          <button
            type="button"
            disabled={!draft.trim() || createMut.isPending}
            onClick={() => createMut.mutate()}
            className="rounded-full bg-[#16A34A] px-4 h-9 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer"
          >
            {createMut.isPending ? 'Đang đăng...' : 'Đăng'}
          </button>
        }
      >
        <div className="space-y-3">
          {composeErr && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
              {composeErr}
            </p>
          )}
          <div className="flex items-start gap-2.5">
            {user && <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />}
            <textarea
              rows={4}
              maxLength={5000}
              autoFocus
              placeholder={
                isProfessional ? 'Ghi chú ca bệnh hoặc nhận định qEEG...' : 'Chia sẻ ghi chú sức khỏe não bộ...'
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 resize-none border-0 bg-transparent text-[15px] leading-relaxed text-[#111827] placeholder:text-[#8A9790] focus:outline-none"
            />
          </div>

          {attachments.length > 0 && (
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pt-2 pr-2 pb-0.5">
              {attachments.map((att) => (
                <div key={att.id} className="relative shrink-0">
                  <img
                    src={att.url}
                    alt=""
                    className="size-20 rounded-xl object-cover border border-[#DCE6DF]"
                  />
                  <button
                    type="button"
                    aria-label="Xóa ảnh"
                    onClick={() => removeAttachment(att.id)}
                    className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-[#111827] text-white cursor-pointer"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#EDF3EF]">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFilePick}
            />
            <button
              type="button"
              disabled={attachments.length >= 4}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-3.5 h-9 text-xs font-semibold text-[#15803D] disabled:opacity-40 cursor-pointer"
            >
              <ImagePlus className="size-4" aria-hidden />
              <span>Thêm ảnh{attachments.length > 0 ? ` (${attachments.length}/4)` : ''}</span>
            </button>
            <span className="font-mono text-[11px] text-[#7A8880] tabular-nums">
              {draft.length}/5000
            </span>
          </div>
        </div>
      </BottomSheet>

      {/* Comments Bottom Sheet */}
      <CommentsSheet
        post={commentPost}
        onClose={() => setCommentPost(null)}
        onCountChange={handleCommentDelta}
      />
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { searchApi } from '../api/endpoints';
import type { PostItem } from '../api/types';
import { Avatar, BottomSheet, EmptyView, Spinner, VerifiedCheck, isUserVerified, relativeTime } from '../components/ui';

export function SearchPage() {
  const [q, setQ] = useState('');
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null);
  const trimmed = q.trim();

  const query = useQuery({
    queryKey: ['mobile-search', trimmed],
    queryFn: () => searchApi.search({ q: trimmed }),
    enabled: trimmed.length >= 1,
  });

  const users = query.data?.users ?? [];
  const posts = query.data?.posts ?? [];

  return (
    <div className="px-3.5 pt-3.5 space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#7A8880]" aria-hidden />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoFocus
          placeholder="Tìm bác sĩ, người dùng, bài viết..."
          aria-label="Tìm kiếm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full h-11 rounded-full border border-[#DCE6DF] bg-white pl-10 pr-10 text-sm text-[#111827] placeholder:text-[#8A9790] focus:border-[#16A34A] focus:outline-none"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            aria-label="Xóa"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full text-[#7A8880] cursor-pointer"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {!trimmed ? (
        <div className="flex flex-wrap gap-1.5">
          {['đột quỵ', 'giấc ngủ', 'động kinh', 'ADS1299', 'dr_minh'].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => setQ(term)}
              className="rounded-full border border-[#DCE6DF] bg-white px-3.5 h-9 text-xs font-medium text-[#374151] cursor-pointer"
            >
              {term}
            </button>
          ))}
        </div>
      ) : query.isLoading ? (
        <Spinner />
      ) : users.length === 0 && posts.length === 0 ? (
        <EmptyView title="Không tìm thấy kết quả" />
      ) : (
        <div className="space-y-4">
          {users.length > 0 && (
            <div className="divide-y divide-[#EDF3EF] rounded-2xl border border-[#DCE6DF] bg-white overflow-hidden">
              {users.slice(0, 6).map((u) => (
                <Link
                  key={u.id}
                  to={`/u/${u.username}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#F5FAF7]"
                >
                  <Avatar name={u.displayName} src={u.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-bold text-[#111827] truncate">
                      <span className="truncate">{u.displayName}</span>
                      {isUserVerified(u) && <VerifiedCheck />}
                    </p>
                    <p className="text-xs text-[#5B6860] truncate">@{u.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {posts.length > 0 && (
            <div className="divide-y divide-[#EDF3EF] rounded-2xl border border-[#DCE6DF] bg-white overflow-hidden">
              {posts.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPost(p)}
                  className="w-full text-left block px-4 py-3 hover:bg-[#F5FAF7] cursor-pointer"
                >
                  <p className="text-xs font-bold text-[#111827]">{p.author.displayName}</p>
                  <p className="mt-1 text-xs text-[#374151] line-clamp-2">{p.content}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post Preview Sheet */}
      <BottomSheet
        open={Boolean(selectedPost)}
        onClose={() => setSelectedPost(null)}
        title="Chi tiết bài viết"
      >
        {selectedPost && (
          <div className="space-y-3">
            <Link
              to={`/u/${selectedPost.author.username}`}
              onClick={() => setSelectedPost(null)}
              className="flex items-center gap-2.5"
            >
              <Avatar name={selectedPost.author.displayName} src={selectedPost.author.avatarUrl} size="sm" />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-bold text-[#111827] truncate">
                  <span className="truncate">{selectedPost.author.displayName}</span>
                  {isUserVerified(selectedPost.author) && <VerifiedCheck />}
                </p>
                <p className="text-xs text-[#7A8880]">
                  @{selectedPost.author.username} · {relativeTime(selectedPost.createdAt)}
                </p>
              </div>
            </Link>
            <p className="text-[14.5px] leading-relaxed text-[#1F2937] whitespace-pre-wrap break-words">
              {selectedPost.content}
            </p>
            {selectedPost.media.length > 0 && (
              <div className="space-y-2">
                {selectedPost.media.map((m) => (
                  <img
                    key={m.id}
                    src={m.url}
                    alt=""
                    className="w-full max-h-64 rounded-2xl object-cover border border-[#DCE6DF]"
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

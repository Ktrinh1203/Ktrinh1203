import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Award,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  PlusCircle,
  FileText,
  Send,
  Star,
  BookOpen,
  Users,
} from 'lucide-react';
import { contributionsApi, searchApi } from '../api/endpoints';
import { useAuth } from '../features/auth/AuthContext';
import { Avatar, Button, Card, DataTableContainer, EmptyState, Spinner, TelemetryStrip, Textarea } from '../components/ui';
import { errorMessage } from '../api/client';
import type {
  ContributionCategory,
  ContributionStatus,
} from '../api/types';

export const CONTRIBUTION_CATEGORY_LABELS: Record<ContributionCategory, { label: string; desc: string }> = {
  HEALTHCARE_EDUCATION: {
    label: 'Giáo dục & Nhận thức Y tế',
    desc: 'Giải thích ca lâm sàng, phác đồ điều trị, nâng cao hiểu biết sức khỏe cộng đồng',
  },
  RESEARCH_CONTRIBUTION: {
    label: 'Công bố & Tóm tắt Nghiên cứu',
    desc: 'Báo cáo kết quả thử nghiệm tiền lâm sàng, mô hình BCI, giải mã tín hiệu thần kinh',
  },
  EXPERT_QA: {
    label: 'Hỏi đáp Chuyên gia Y khoa',
    desc: 'Giải đáp câu hỏi bệnh học, phân tích triệu chứng từ góc nhìn chuyên gia',
  },
  RESEARCH_DISCUSSION: {
    label: 'Thảo luận & Phản biện Học thuật',
    desc: 'Phân tích phương pháp, thuật toán DSP/EEG, trao đổi học thuật liên ngành',
  },
  EDUCATIONAL_RESOURCE: {
    label: 'Học liệu & Tài nguyên Chuyên sâu',
    desc: 'Infographic y khoa, tài liệu hướng dẫn lâm sàng, slide báo cáo khoa học',
  },
};

export const CONTRIBUTION_STATUS_META: Record<
  ContributionStatus,
  { label: string; className: string }
> = {
  DRAFT: { label: 'Bản nháp', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  SUBMITTED: { label: 'Đã nộp chờ duyệt', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  UNDER_REVIEW: { label: 'Đang thẩm định', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  NEEDS_REVISION: { label: 'Yêu cầu bổ sung', className: 'bg-orange-50 text-orange-800 border-orange-200' },
  APPROVED: { label: 'Đã phê duyệt', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Đã từ chối', className: 'bg-red-50 text-red-800 border-red-200' },
  WITHDRAWN: { label: 'Đã rút bài', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export function ContributionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedPostId = searchParams.get('postId');
  const [activeTab, setActiveTab] = useState<'my' | 'submit' | 'projects' | 'researchers'>(
    preselectedPostId ? 'submit' : 'my',
  );
  const [selectedPostId, setSelectedPostId] = useState<string>(preselectedPostId ?? '');
  const [category, setCategory] = useState<ContributionCategory>('HEALTHCARE_EDUCATION');
  const [summary, setSummary] = useState('');
  const [resubmitId, setResubmitId] = useState<string | null>(null);
  const [resubmitSummary, setResubmitSummary] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isVerified = (user?.professionalProfiles ?? []).some(
    (p) => p.verificationStatus === 'VERIFIED',
  );

  useEffect(() => {
    if (preselectedPostId && isVerified) {
      setActiveTab('submit');
      setSelectedPostId(preselectedPostId);
    }
  }, [preselectedPostId, isVerified]);

  const { data: researchersData } = useQuery({
    queryKey: ['research-hub-specialists'],
    queryFn: () => searchApi.search({ category: 'professionals' }),
    staleTime: 60 * 1000,
  });

  // My contributions query
  const { data: myData, isLoading: loadingMy } = useQuery({
    queryKey: ['my-contributions'],
    queryFn: () => contributionsApi.getMyContributions(),
    enabled: Boolean(user && isVerified),
  });

  // Public peer-reviewed publications query
  const { data: publicData } = useQuery({
    queryKey: ['public-contributions'],
    queryFn: () => contributionsApi.getPublications(),
    enabled: Boolean(user),
  });

  // Eligible posts query
  const { data: eligibleData, isLoading: loadingEligible } = useQuery({
    queryKey: ['eligible-posts-contributions'],
    queryFn: () => contributionsApi.getEligiblePosts(),
    enabled: Boolean(user && isVerified && activeTab === 'submit'),
  });

  const submitMutation = useMutation({
    mutationFn: (data: { postId: string; category: string; summary: string }) =>
      contributionsApi.create(data),
    onSuccess: () => {
      setError(null);
      setSuccessMsg('Đã nộp bài viết vào quy trình xét duyệt khen thưởng thành công!');
      setSelectedPostId('');
      setSummary('');
      void queryClient.invalidateQueries({ queryKey: ['my-contributions'] });
      void queryClient.invalidateQueries({ queryKey: ['eligible-posts-contributions'] });
      setActiveTab('my');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const resubmitMutation = useMutation({
    mutationFn: ({ id, summary }: { id: string; summary: string }) =>
      contributionsApi.resubmit(id, { summary }),
    onSuccess: () => {
      setError(null);
      setSuccessMsg('Đã cập nhật và nộp lại bài đóng góp thành công!');
      setResubmitId(null);
      setResubmitSummary('');
      void queryClient.invalidateQueries({ queryKey: ['my-contributions'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => contributionsApi.withdraw(id),
    onSuccess: () => {
      setError(null);
      setSuccessMsg('Đã rút bài đóng góp khỏi quy trình xét duyệt.');
      void queryClient.invalidateQueries({ queryKey: ['my-contributions'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const myContributions = myData?.contributions ?? [];
  const eligiblePosts = eligibleData?.posts ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header Banner - Research Hub (Reference: ResearchGate & Sermo) */}
      <section className="rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden">
        <div className="bg-[#162B47] p-6 sm:p-7 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Trung tâm Nghiên cứu Khoa học & Đóng góp Chuyên môn
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded bg-[#2C6865] px-2.5 py-0.5 text-[11px] font-bold text-teal-50 border border-teal-400/30">
                <Sparkles className="size-3 text-amber-300" /> ResearchGate & Sermo Peer Review
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal">
              Không gian công bố báo cáo tiền lâm sàng, thử nghiệm mô hình BCI, giải thích ca bệnh chuyên sâu và phản biện đồng cấp (Peer Review) nhận tín chỉ khen thưởng Honoraria & CME.
            </p>
          </div>
        </div>
        <TelemetryStrip
          items={[
            { label: 'Bài đóng góp của tôi', value: myContributions.length, valueClassName: 'text-[#1E3A5F]' },
            { label: 'Ấn phẩm & Preprint', value: 14, valueClassName: 'text-[#2C6865]' },
            { label: 'Đề tài Hợp tác Mở', value: 6 },
            { label: 'Chuyên gia & Nhà nghiên cứu', value: researchersData?.professionals?.length ?? 8 },
          ]}
        />
      </section>

      {/* Verification Status Warning / Card */}
      {!isVerified && (
        <Card className="p-4 sm:p-5 border-amber-300 bg-amber-50/70 text-amber-900 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <AlertCircle className="size-5 text-amber-600 shrink-0" />
            Yêu cầu Xác minh Tích xanh Chuyên môn
          </div>
          <p className="text-xs text-amber-800/90 leading-relaxed">
            Chương trình Khen thưởng Đóng góp hiện áp dụng độc quyền cho các chuyên gia Y tế (Bác sĩ có CCHN) và Nhà nghiên cứu khoa học (có hồ sơ ORCID) đã được Hội đồng Thẩm định duyệt tích xanh.
          </p>
          <div className="pt-1">
            <a
              href="/settings"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700 hover:underline"
            >
              Đến trang Cài đặt để nộp hồ sơ xác minh chuyên gia →
            </a>
          </div>
        </Card>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline ml-2">
            Đóng
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-xl flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-semibold underline ml-2">
            Đóng
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('my')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'my'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="size-4" /> Bài đóng góp của tôi ({myContributions.length})
        </button>
        <button
          type="button"
          disabled={!isVerified}
          onClick={() => setActiveTab('submit')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            !isVerified
              ? 'opacity-50 cursor-not-allowed border-transparent text-slate-400'
              : activeTab === 'submit'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <PlusCircle className="size-4" /> Nộp bài viết mới
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'projects'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BookOpen className="size-4" /> Công bố & Đề tài Hợp tác
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('researchers')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'researchers'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="size-4" /> Nhà nghiên cứu & Thảo luận Học thuật
        </button>
      </div>

      {/* Tab 1: My Contributions */}
      {activeTab === 'my' && (
        <div className="space-y-4">
          {!isVerified ? (
            <Card className="p-8 text-center text-slate-500 text-sm">
              Bạn chưa có hồ sơ chuyên môn xác minh tích xanh.
            </Card>
          ) : loadingMy ? (
            <Spinner label="Đang tải danh sách bài nộp đóng góp..." />
          ) : myContributions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Award className="size-8 text-brand-600" />}
                title="Chưa có bài đóng góp nào được nộp"
                description="Hãy chọn một bài viết chuyên môn có sẵn của bạn để nộp vào chương trình xét duyệt và nhận tín chỉ khen thưởng."
                action={
                  <Button size="sm" onClick={() => setActiveTab('submit')} icon={<PlusCircle className="size-4" />}>
                    Nộp bài viết ngay
                  </Button>
                }
              />
            </Card>
          ) : (
            myContributions.map((contrib) => {
              const statusMeta = CONTRIBUTION_STATUS_META[contrib.status];
              const categoryMeta = CONTRIBUTION_CATEGORY_LABELS[contrib.category];
              const latestReview = contrib.reviews[0] ?? null;

              return (
                <Card key={contrib.id} className="p-5 space-y-4 border-slate-200 shadow-2xs">
                  {/* Top Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                        {categoryMeta?.label ?? contrib.category}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Nộp: {new Date(contrib.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {contrib.status === 'APPROVED' && contrib.awardCredits && contrib.awardCredits > 0 && (
                        <span className="inline-flex items-center gap-1 font-bold text-xs text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <Star className="size-3.5 fill-amber-500 text-amber-500" /> +{contrib.awardCredits} Tín chỉ
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>

                  {/* Post Content Snippet */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">
                      Bài viết gốc trên NeuroLink:
                    </span>
                    <p className="text-slate-800 line-clamp-2 italic">"{contrib.post.content}"</p>
                  </div>

                  {/* Summary of Contribution */}
                  <div>
                    <span className="text-xs font-bold text-slate-500 block mb-1">
                      Giá trị đóng góp tác giả khai báo:
                    </span>
                    <p className="text-xs text-slate-800 leading-relaxed">{contrib.summary}</p>
                  </div>

                  {/* Latest Review Feedback & 5 Criteria Scores */}
                  {latestReview && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 text-xs space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <CheckCircle2 className="size-3.5 text-brand-600" /> Kết quả đánh giá từ Hội đồng Thẩm định:
                        </span>
                        <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                          Điểm tổng hợp: {latestReview.scoreOverall}/5.0
                        </span>
                      </div>

                      {/* 5 Criteria Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px] text-center font-medium">
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <div className="text-slate-400">Độ chính xác</div>
                          <div className="font-bold text-slate-800">{latestReview.scoreAccuracy}/5</div>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <div className="text-slate-400">Độ phù hợp</div>
                          <div className="font-bold text-slate-800">{latestReview.scoreRelevance}/5</div>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <div className="text-slate-400">Tính hữu ích</div>
                          <div className="font-bold text-slate-800">{latestReview.scoreUsefulness}/5</div>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <div className="text-slate-400">Tính nguyên bản</div>
                          <div className="font-bold text-slate-800">{latestReview.scoreOriginality}/5</div>
                        </div>
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <div className="text-slate-400">Tác động</div>
                          <div className="font-bold text-slate-800">{latestReview.scoreImpact}/5</div>
                        </div>
                      </div>

                      {latestReview.feedback && (
                        <p className="text-slate-700 bg-white p-2.5 rounded border border-slate-200">
                          <strong>Nhận xét:</strong> {latestReview.feedback}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions (Resubmit / Withdraw) */}
                  <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    {(contrib.status === 'SUBMITTED' || contrib.status === 'NEEDS_REVISION') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={withdrawMutation.isPending}
                        onClick={() => {
                          if (confirm('Bạn có chắc muốn rút bài nộp này?')) {
                            withdrawMutation.mutate(contrib.id);
                          }
                        }}
                      >
                        Rút bài
                      </Button>
                    )}

                    {contrib.status === 'NEEDS_REVISION' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setResubmitId(contrib.id);
                          setResubmitSummary(contrib.summary);
                        }}
                        icon={<RotateCcw className="size-3.5" />}
                      >
                        Bổ sung & Nộp lại
                      </Button>
                    )}
                  </div>

                  {/* Resubmit Inline Form */}
                  {resubmitId === contrib.id && (
                    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4 space-y-3">
                      <h4 className="font-bold text-xs text-brand-900">
                        Cập nhật nội dung tóm tắt giá trị đóng góp theo phản hồi của Reviewer:
                      </h4>
                      <Textarea
                        rows={3}
                        value={resubmitSummary}
                        onChange={(e) => setResubmitSummary(e.target.value)}
                        placeholder="Nêu rõ các nội dung và tài liệu đã bổ sung..."
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setResubmitId(null)}>
                          Hủy
                        </Button>
                        <Button
                          size="sm"
                          loading={resubmitMutation.isPending}
                          onClick={() => {
                            if (resubmitSummary.trim().length < 10) {
                              setError('Mô tả tóm tắt tối thiểu 10 ký tự');
                              return;
                            }
                            resubmitMutation.mutate({ id: contrib.id, summary: resubmitSummary.trim() });
                          }}
                          icon={<Send className="size-3.5" />}
                        >
                          Xác nhận nộp lại
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Submit New Contribution */}
      {activeTab === 'submit' && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Chọn bài viết có sẵn để nộp xét khen thưởng</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Bạn không cần đăng bài trùng lặp. Chỉ cần chọn một bài viết chất lượng đã đăng và giải trình giá trị chuyên môn mang lại.
            </p>
          </div>

          {loadingEligible ? (
            <Spinner label="Đang tải danh sách bài viết của bạn..." />
          ) : eligiblePosts.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-6 text-slate-400" />}
              title="Bạn chưa có bài viết nào trên NeuroLink"
              description="Hãy đăng bài chia sẻ kiến thức trên Bảng tin trước khi gửi xét thưởng."
            />
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">
                  1. Chọn bài viết từ hồ sơ của bạn ({eligiblePosts.length} bài viết):
                </label>
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                  {eligiblePosts.map((p) => {
                    const isSelected = selectedPostId === p.id;
                    const isDisabled = p.hasActiveContribution;

                    return (
                      <div
                        key={p.id}
                        onClick={() => !isDisabled && setSelectedPostId(p.id)}
                        className={`p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                          isDisabled
                            ? 'opacity-50 bg-slate-100 border-slate-200 cursor-not-allowed'
                            : isSelected
                              ? 'border-brand-600 bg-brand-50/60 ring-2 ring-brand-500/20'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
                          <span>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>
                          {isDisabled && (
                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Đã nộp ({p.activeContribution?.status})
                            </span>
                          )}
                        </div>
                        <p className="text-slate-800 line-clamp-2">{p.content}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedPostId && (
                <div className="space-y-4 border-t border-slate-100 pt-4 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      2. Chọn Danh mục Đóng góp Chuyên môn:
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ContributionCategory)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-brand-500 focus:outline-none"
                    >
                      {Object.entries(CONTRIBUTION_CATEGORY_LABELS).map(([catKey, catVal]) => (
                        <option key={catKey} value={catKey}>
                          {catVal.label} — {catVal.desc}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 block">
                      3. Tóm tắt Giá trị Đóng góp (Hữu ích gì cho thực hành y khoa / nghiên cứu):
                    </label>
                    <Textarea
                      rows={4}
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      placeholder="Nêu tóm tắt kết quả phân tích ca bệnh, giải mã dữ liệu hoặc ý nghĩa thực tiễn đối với cộng đồng y tế..."
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      loading={submitMutation.isPending}
                      onClick={() => {
                        if (!summary.trim() || summary.trim().length < 10) {
                          setError('Vui lòng nhập mô tả tóm tắt giá trị đóng góp tối thiểu 10 ký tự.');
                          return;
                        }
                        submitMutation.mutate({
                          postId: selectedPostId,
                          category,
                          summary: summary.trim(),
                        });
                      }}
                      icon={<Send className="size-4" />}
                    >
                      Gửi hồ sơ xét duyệt đóng góp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Publications, Research Projects & Collaboration Opportunities */}
      {activeTab === 'projects' && (
        <div className="space-y-5">
          <DataTableContainer
            title="Ấn phẩm Khoa học & Báo cáo Bình duyệt (Publications Registry)"
            subtitle="Các công bố khoa học thần kinh, điện não đồ định lượng (qEEG) và mô hình BCI"
            icon={<BookOpen className="size-4 text-[#1E3A5F]" />}
            metaLabel="DOI / ORCID Indexed"
          >
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-4">Mã / Năm</th>
                  <th className="py-2.5 px-4">Tên Ấn phẩm & Tác giả Chính</th>
                  <th className="py-2.5 px-3">Chuyên ngành</th>
                  <th className="py-2.5 px-4 text-right">Trích dẫn / CME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {[
                  ...(publicData?.contributions ?? []).map((c, idx) => ({
                    code: `NL-${new Date(c.createdAt).getFullYear()}-${String(idx + 1).padStart(2, '0')}`,
                    title: c.summary,
                    authors: `${c.user.displayName} (@${c.user.username})`,
                    field: CONTRIBUTION_CATEGORY_LABELS[c.category]?.label || c.category,
                    metric: `${c.status} · +${c.awardCredits || 30} CME`,
                  })),
                  {
                    code: 'PUB-2026-01',
                    title: 'Spatio-Temporal Graph Attention Networks for 10-20 Motor Imagery EEG Decoding',
                    authors: 'PGS. TS. Trần Mai Lan, BS. CKII Nguyễn Văn Minh',
                    field: 'BCI & Neural DSP',
                    metric: '18 citations · +45 CME',
                  },
                  {
                    code: 'PUB-2026-02',
                    title: 'Clinical Utility of Ambulatory Video-EEG in Differentiating PNES from Temporal Lobe Epilepsy',
                    authors: 'BS. CKII Nguyễn Văn Minh, TS. BS. Lê Hoàng Nam',
                    field: 'Epilepsy & Clinical EEG',
                    metric: '12 citations · +35 CME',
                  },
                  {
                    code: 'PUB-2025-19',
                    title: 'Sleep Spindle Density and N3 Slow-Wave Coherence in Post-Stroke Cognitive Recovery',
                    authors: 'TS. Vũ Quốc Huy, PGS. TS. Trần Mai Lan',
                    field: 'Sleep & Neuro-Rehab',
                    metric: '24 citations · +40 CME',
                  },
                ].map((pub) => (
                  <tr key={pub.code} className="hover:bg-slate-50/90">
                    <td className="py-3 px-4 font-mono font-bold text-[#1E3A5F] whitespace-nowrap">
                      {pub.code}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{pub.title}</span>
                      <span className="text-[11px] text-slate-500">{pub.authors}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700">
                        {pub.field}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#2C6865] whitespace-nowrap">
                      {pub.metric}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableContainer>

          <DataTableContainer
            title="Dự án Nghiên cứu & Cơ hội Hợp tác Đa trung tâm (Research Projects & Collaboration)"
            subtitle="Các đề tài đang mở tuyển đồng tác giả lâm sàng, kỹ sư giải mã tín hiệu và bác sĩ đọc bản đồ não"
            icon={<Award className="size-4 text-[#2C6865]" />}
            metaLabel="Multi-Center Consortia"
          >
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-4">Mã Dự án</th>
                  <th className="py-2.5 px-4">Đề tài & Đơn vị Chủ trì</th>
                  <th className="py-2.5 px-3">Vị trí Hợp tác Cần tuyển</th>
                  <th className="py-2.5 px-4 text-right">Liên hệ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {[
                  {
                    id: 'PRJ-BCI-2026',
                    name: 'Giải mã ERD/ERS thời gian thực hỗ trợ phục hồi vận động chi trên sau đột quỵ',
                    unit: 'Phòng thí nghiệm Trọng điểm BCI & BV Bạch Mai (n = 128 bản ghi)',
                    role: 'Bác sĩ Thần kinh thẩm định nhãn lâm sàng',
                  },
                  {
                    id: 'PRJ-EPIL-09',
                    name: 'Chuẩn hóa cơ sở dữ liệu sóng nhọn kịch phát ngoài cơn (Interictal Spike) đa trung tâm',
                    unit: 'Liên viện ĐH Y Hà Nội & BV Chợ Rẫy (n = 310 bản ghi)',
                    role: 'Chuyên gia đọc Video-EEG độc lập (Peer Reviewer)',
                  },
                ].map((prj) => (
                  <tr key={prj.id} className="hover:bg-slate-50/90">
                    <td className="py-3 px-4 font-mono font-bold text-[#2C6865] whitespace-nowrap">
                      {prj.id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{prj.name}</span>
                      <span className="text-[11px] text-slate-500">{prj.unit}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{prj.role}</td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <Link
                        to="/messages"
                        className="inline-flex rounded bg-[#162B47] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#1E3A5F]"
                      >
                        Đăng ký hợp tác
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableContainer>
        </div>
      )}

      {/* Tab 4: Researcher Profiles & Academic Discussions */}
      {activeTab === 'researchers' && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {(researchersData?.professionals ?? []).map((prof) => (
              <Card key={prof.id} className="p-4 border-slate-300 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/u/${prof.user.username}`} className="flex items-center gap-3 min-w-0">
                      <Avatar name={prof.user.displayName} src={prof.user.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate hover:text-brand-600">
                          {prof.user.displayName}
                        </p>
                        <p className="text-xs text-slate-500 truncate">{prof.title}</p>
                      </div>
                    </Link>
                    <span className="rounded bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                      ORCID / CCHN
                    </span>
                  </div>
                  <p className="mt-2.5 text-xs font-semibold text-[#1E3A5F]">
                    {prof.specialty} · {prof.institution}
                  </p>
                  {prof.researchInterests.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {prof.researchInterests.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10.5px] font-mono text-slate-700"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <Link to={`/u/${prof.user.username}`} className="font-bold text-brand-700 hover:underline">
                    Hồ sơ Học thuật →
                  </Link>
                  <Link to="/feed" className="text-slate-600 hover:text-slate-900 font-medium">
                    Thảo luận học thuật
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

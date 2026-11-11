import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gift,
  Coins,
  History,
  GraduationCap,
  Ticket,
  BookOpen,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Lock,
  Award,
} from 'lucide-react';
import { rewardsApi, contributionsApi } from '../api/endpoints';
import { useAuth } from '../features/auth/AuthContext';
import { Button, Card, DataTableContainer, EmptyState, Spinner, Textarea } from '../components/ui';
import { errorMessage } from '../api/client';
import type {
  RedemptionStatus,
  RewardCatalogItem,
  RewardCategory,
} from '../api/types';

const REWARD_CATEGORY_CONFIG: Record<
  RewardCategory,
  { label: string; icon: any; colorClass: string }
> = {
  PROFESSIONAL_COURSE: { label: 'Khóa học Y khoa & CME', icon: GraduationCap, colorClass: 'text-brand-600 bg-brand-50' },
  CONFERENCE_ACCESS: { label: 'Vé Hội nghị & Workshop', icon: Ticket, colorClass: 'text-purple-600 bg-purple-50' },
  ACADEMIC_RESOURCE: { label: 'Cơ sở dữ liệu Học thuật', icon: BookOpen, colorClass: 'text-blue-600 bg-blue-50' },
  MENTORING: { label: 'Cố vấn Chuyên gia 1:1', icon: Users, colorClass: 'text-teal-600 bg-teal-50' },
  PROFESSIONAL_EVENT: { label: 'Sự kiện Kết nối Chuyên ngành', icon: Calendar, colorClass: 'text-amber-600 bg-amber-50' },
  OTHER_BENEFIT: { label: 'Quyền lợi Chuyên môn Khác', icon: Gift, colorClass: 'text-slate-600 bg-slate-50' },
  MONETARY_REWARD: { label: 'Kinh phí Công bố Bài báo (Chờ kích hoạt)', icon: Coins, colorClass: 'text-slate-400 bg-slate-100' },
};

const REDEMPTION_STATUS_META: Record<
  RedemptionStatus,
  { label: string; className: string }
> = {
  REQUESTED: { label: 'Đang chờ xử lý', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  UNDER_REVIEW: { label: 'Đang xét duyệt', className: 'bg-blue-50 text-blue-800 border-blue-200' },
  APPROVED: { label: 'Đã duyệt cấp', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  PROCESSING: { label: 'Đang giải ngân', className: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  FULFILLED: { label: 'Đã hoàn tất bàn giao', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  REJECTED: { label: 'Từ chối (Đã hoàn tín chỉ)', className: 'bg-red-50 text-red-800 border-red-200' },
  CANCELLED: { label: 'Đã hủy (Đã hoàn tín chỉ)', className: 'bg-slate-100 text-slate-700 border-slate-300' },
  REFUNDED: { label: 'Đã hoàn trả tín chỉ', className: 'bg-purple-50 text-purple-800 border-purple-200' },
};

export function RewardsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'catalog' | 'contributions' | 'history' | 'my-redemptions'>('catalog');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'benefits' | 'monetary'>('all');
  const [selectedReward, setSelectedReward] = useState<RewardCatalogItem | null>(null);
  const [userNote, setUserNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 1. Fetch Wallet & Transactions
  const { data: walletData, isLoading: loadingWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user),
  });

  // 2. Fetch Catalog
  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ['rewards-catalog'],
    queryFn: () => rewardsApi.getCatalog(),
  });

  // 3. Fetch My Redemptions
  const { data: redemptionsData, isLoading: loadingRedemptions } = useQuery({
    queryKey: ['my-redemptions'],
    queryFn: () => rewardsApi.getMyRedemptions(),
    enabled: Boolean(user && activeTab === 'my-redemptions'),
  });

  // 4. Fetch My Contributions for Contribution History tab
  const { data: myContributionsData, isLoading: loadingContributions } = useQuery({
    queryKey: ['my-contributions'],
    queryFn: () => contributionsApi.getMyContributions(),
    enabled: Boolean(user),
  });

  const redeemMutation = useMutation({
    mutationFn: (data: { rewardId: string; userNote?: string }) => rewardsApi.redeem(data),
    onSuccess: (res) => {
      setError(null);
      setSuccessMsg(`Đổi phần thưởng thành công! Số dư khả dụng còn lại: ${res.remainingBalance} tín chỉ.`);
      setSelectedReward(null);
      setUserNote('');
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['rewards-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['my-redemptions'] });
      setActiveTab('my-redemptions');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const wallet = walletData?.wallet;
  const transactions = walletData?.transactions ?? [];
  const catalog = catalogData?.items ?? [];
  const filteredCatalog = catalog.filter((item) => {
    if (catalogFilter === 'monetary') return item.isMonetary || item.category === 'MONETARY_REWARD';
    if (catalogFilter === 'benefits') return !item.isMonetary && item.category !== 'MONETARY_REWARD';
    return true;
  });
  const redemptions = redemptionsData?.redemptions ?? [];
  const myContributions = myContributionsData?.contributions ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Banner & Wallet Balance Card (Sermo Electric Royal Violet) */}
      <div className="grid gap-4.5 md:grid-cols-3">
        {/* Wallet Overview Card */}
        <div className="md:col-span-2 rounded-lg bg-[#162B47] p-6 sm:p-7 text-white border border-slate-700 shadow-2xs relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                Quyền lợi & Khen thưởng (CME & Honoraria)
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded bg-[#2C6865] px-2.5 py-0.5 text-[11px] font-bold text-teal-50 border border-teal-400/30">
                <Sparkles className="size-3 text-amber-300" /> Sermo Honoraria Wallet
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed">
              Tích lũy tín chỉ từ các bài đóng góp chuyên môn đã qua kiểm duyệt để đổi các khóa đào tạo y khoa liên tục (CME), vé hội nghị khoa học và tài nguyên học thuật.
            </p>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3 pt-5 border-t border-white/15 mt-4 tabular-nums">
            <div>
              <span className="text-[11px] text-slate-300 block uppercase font-semibold">Số dư khả dụng</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-300">
                {loadingWallet ? '...' : wallet?.balance ?? 0}
              </span>
              <span className="text-[11px] text-slate-200 ml-1">tín chỉ</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-300 block uppercase font-semibold">Tổng tích lũy</span>
              <span className="text-lg sm:text-xl font-bold text-white">
                {loadingWallet ? '...' : wallet?.totalEarned ?? 0}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-300 block uppercase font-semibold">Tổng đã đổi</span>
              <span className="text-lg sm:text-xl font-bold text-white">
                {loadingWallet ? '...' : wallet?.totalSpent ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Program Policy Card */}
        <Card className="p-6 flex flex-col justify-between border-slate-200/70 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.03)] bg-white rounded-2xl">
          <div className="space-y-2.5">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Coins className="size-4 text-brand-600" /> Quy định & Bảo vệ Giá trị
            </h3>
            <ul className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">✓</span>
                Tín chỉ được ghi nhận bất biến trong Sổ cái giao dịch (Transaction Ledger).
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">✓</span>
                Hoàn trả 100% tín chỉ nếu yêu cầu đổi thưởng bị từ chối hoặc hết suất.
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-500 font-bold">⚠️</span>
                Tín chỉ gắn liền danh tính chuyên gia, không thể chuyển nhượng hoặc mua bán chợ đen.
              </li>
            </ul>
          </div>
          <div className="pt-3.5 border-t border-slate-100">
            <a
              href="/contributions"
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 hover:underline"
            >
              Gửi bài viết để tích lũy thêm tín chỉ →
            </a>
          </div>
        </Card>
      </div>

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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'catalog'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Gift className="size-4" /> Danh mục Phần thưởng ({catalog.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('contributions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'contributions'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Award className="size-4" /> Lịch sử Đóng góp ({myContributions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'history'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="size-4" /> Sổ cái Giao dịch ({transactions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('my-redemptions')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'my-redemptions'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="size-4" /> Lịch sử Đổi thưởng ({redemptions.length})
        </button>
      </div>

      {/* Tab 1: Reward Catalog */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'all', label: 'Tất cả Danh mục' },
                { key: 'benefits', label: 'Quyền lợi Chuyên môn & CME (Professional Benefits)' },
                { key: 'monetary', label: 'Thù lao & Kinh phí Công bố (Monetary Rewards)' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCatalogFilter(tab.key as 'all' | 'benefits' | 'monetary')}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors border ${
                    catalogFilter === tab.key
                      ? 'bg-[#162B47] text-white border-[#162B47]'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loadingCatalog ? (
            <Spinner label="Đang tải danh mục phần thưởng..." />
          ) : filteredCatalog.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Gift className="size-8 text-slate-400" />}
                title="Chưa có phần thưởng nào trong phân mục này"
                description="Hội đồng Quản trị đang cập nhật các đợt tài trợ khóa học, kinh phí công bố và vé hội nghị mới."
              />
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filteredCatalog.map((item) => {
                const catConfig = REWARD_CATEGORY_CONFIG[item.category];
                const IconComponent = catConfig?.icon ?? Gift;
                const canAfford = (wallet?.balance ?? 0) >= item.creditCost;
                const isOutOfStock = item.stockQuantity !== null && item.redeemedCount >= item.stockQuantity;
                const isLockedMonetary = item.isMonetary && !item.payoutEnabled;

                return (
                  <Card key={item.id} className="p-5 flex flex-col justify-between space-y-4 border-slate-200 shadow-2xs hover:border-slate-300 transition-all">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${catConfig?.colorClass}`}>
                          <IconComponent className="size-3.5" /> {catConfig?.label}
                        </span>
                        <span className="font-extrabold text-sm text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                          {item.creditCost} Tín chỉ
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">{item.name}</h3>
                        <p className="text-xs text-slate-600 mt-1 line-clamp-3 leading-relaxed">{item.description}</p>
                      </div>

                      {item.terms && (
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-500">
                          <strong>Điều kiện:</strong> {item.terms}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400">
                        {item.stockQuantity === null
                          ? 'Không giới hạn suất'
                          : `Còn ${Math.max(0, item.stockQuantity - item.redeemedCount)} / ${item.stockQuantity} suất`}
                      </span>

                      {isLockedMonetary ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <Lock className="size-3" /> Chưa kích hoạt giải ngân
                        </span>
                      ) : isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                          Hết suất đợt này
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          disabled={!canAfford}
                          onClick={() => {
                            setError(null);
                            setSelectedReward(item);
                          }}
                        >
                          {canAfford ? 'Đổi phần thưởng' : 'Không đủ tín chỉ'}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Modal / Confirmation Dialog for Redemption */}
          {selectedReward && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
              <Card className="w-full max-w-lg p-6 space-y-4 shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">Xác nhận Đổi Phần thưởng</h3>
                    <p className="text-xs text-slate-500">Tín chỉ sẽ được trừ từ ví và đưa vào hàng đợi cấp quyền lợi.</p>
                  </div>
                  <span className="font-bold text-sm text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-0.5 rounded-full">
                    -{selectedReward.creditCost} Tín chỉ
                  </span>
                </div>

                <div className="space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-800">{selectedReward.name}</p>
                  <p className="text-slate-600">{selectedReward.description}</p>
                  <div className="flex justify-between pt-1 border-t border-slate-200 text-slate-500 text-[11px]">
                    <span>Số dư hiện tại: {wallet?.balance ?? 0}</span>
                    <span className="font-bold text-brand-700">
                      Số dư sau khi đổi: {(wallet?.balance ?? 0) - selectedReward.creditCost}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    Ghi chú / Thông tin nhận quyền lợi (VD: Email nhận vé, link tài khoản học tập):
                  </label>
                  <Textarea
                    rows={3}
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Nhập thông tin liên hệ hoặc nhu cầu cụ thể..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReward(null)}>
                    Hủy bỏ
                  </Button>
                  <Button
                    size="sm"
                    loading={redeemMutation.isPending}
                    onClick={() => {
                      redeemMutation.mutate({
                        rewardId: selectedReward.id,
                        userNote: userNote.trim() || undefined,
                      });
                    }}
                    icon={<Gift className="size-4" />}
                  >
                    Xác nhận đổi ngay
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Transaction Ledger History */}
      {activeTab === 'history' && (
        <Card className="overflow-hidden border-slate-200">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Sổ cái Giao dịch Bất biến (Immutable Credit Ledger)
            </h3>
            <span className="text-[11px] text-slate-400">Hiển thị tối đa 50 giao dịch gần nhất</span>
          </div>

          {loadingWallet ? (
            <div className="p-8"><Spinner label="Đang tải lịch sử giao dịch..." /></div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">Chưa có giao dịch tín chỉ nào được ghi nhận.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Thời gian</th>
                    <th className="py-2.5 px-4 font-semibold">Loại giao dịch</th>
                    <th className="py-2.5 px-4 font-semibold">Nội dung diễn giải</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Biến động tín chỉ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-800 font-medium">
                          {tx.description}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap font-bold">
                          <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                            {isPositive ? `+${tx.amount}` : tx.amount}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: My Redemptions */}
      {activeTab === 'my-redemptions' && (
        <div className="space-y-4">
          {loadingRedemptions ? (
            <Spinner label="Đang tải lịch sử đổi thưởng..." />
          ) : redemptions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Clock className="size-8 text-slate-400" />}
                title="Chưa có yêu cầu đổi thưởng nào"
                description="Bạn có thể duyệt Danh mục Phần thưởng để chọn các khóa học và quyền lợi phù hợp."
                action={
                  <Button size="sm" onClick={() => setActiveTab('catalog')} icon={<Gift className="size-4" />}>
                    Duyệt danh mục ngay
                  </Button>
                }
              />
            </Card>
          ) : (
            redemptions.map((redemption) => {
              const statusMeta = REDEMPTION_STATUS_META[redemption.status];

              return (
                <Card key={redemption.id} className="p-5 space-y-3 border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{redemption.reward.name}</h4>
                      <p className="text-[11px] text-slate-400">
                        Yêu cầu lúc: {new Date(redemption.createdAt).toLocaleString('vi-VN')} · Chi phí:{' '}
                        <strong>{redemption.creditCost} tín chỉ</strong>
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {redemption.userNote && (
                    <p className="text-xs text-slate-600">
                      <strong>Ghi chú của bạn:</strong> {redemption.userNote}
                    </p>
                  )}

                  {redemption.adminNote && (
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700">
                      <strong>Phản hồi từ Hội đồng Quản trị:</strong> {redemption.adminNote}
                    </div>
                  )}

                  {redemption.fulfillmentInfo && (
                    <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-emerald-600" /> Thông tin Nhận quyền lợi / Vé / Tài khoản:
                      </div>
                      <p className="font-mono bg-white p-2 rounded border border-emerald-200 select-all">
                        {redemption.fulfillmentInfo}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Tab: Contribution History */}
      {activeTab === 'contributions' && (
        <DataTableContainer
          title="Lịch sử Đóng góp Chuyên môn & Quy đổi Tín chỉ (Contribution History)"
          subtitle="Danh sách các bài báo cáo ca bệnh, nghiên cứu BCI và hỏi đáp chuyên gia đã nộp xét duyệt"
          icon={<Award className="size-4 text-[#1E3A5F]" />}
          metaLabel="Peer-Reviewed Contributions"
        >
          {loadingContributions ? (
            <div className="p-6">
              <Spinner label="Đang tải lịch sử đóng góp..." />
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-[10.5px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-4">Danh mục</th>
                  <th className="py-2.5 px-4">Tóm tắt Đóng góp Chuyên môn</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right">Tín chỉ Nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80">
                {myContributions.length > 0 ? (
                  myContributions.map((c) => (
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
                        {c.awardCredits ? `+${c.awardCredits} tín chỉ` : 'Đang xét duyệt'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 px-4 text-center text-slate-500">
                      Chưa có đóng góp nào được ghi nhận. Bạn có thể nộp bài viết chuyên môn tại mục{' '}
                      <a href="/contributions" className="font-bold text-brand-700 hover:underline">
                        Research Hub
                      </a>
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </DataTableContainer>
      )}
    </div>
  );
}

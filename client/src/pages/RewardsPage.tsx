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
  Lock,
  Award,
} from 'lucide-react';
import { rewardsApi, contributionsApi } from '../api/endpoints';
import { useAuth } from '../features/auth/AuthContext';
import { useMode } from '../context/ModeContext';
import { Button, Card, DataTableContainer, EmptyState, Spinner, Textarea } from '../components/ui';
import { errorMessage } from '../api/client';
import type {
  CreditTransactionType,
  RedemptionStatus,
  RewardCatalogItem,
  RewardCategory,
} from '../api/types';

const TRANSACTION_TYPE_LABELS: Record<CreditTransactionType, { label: string; className: string }> = {
  CONTRIBUTION_REWARD: { label: 'Thưởng CME', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  REWARD_REDEMPTION: { label: 'Đổi ưu đãi', className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]' },
  ADMIN_ADJUSTMENT: { label: 'Điều chỉnh', className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]' },
  REWARD_REVERSAL: { label: 'Thu hồi', className: 'bg-red-50 text-red-700 border-red-200' },
  REFUND: { label: 'Hoàn Credit', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  CONSULTATION_ESCROW: { label: 'Tạm giữ hỏi bác sĩ', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  CONSULTATION_EARNING: { label: 'Thù lao đọc ca', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  CONSULTATION_REFUND: { label: 'Hoàn Credit tư vấn', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  DATABANK_PURCHASE: { label: 'Mở khóa dữ liệu', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  DATABANK_ROYALTY: { label: 'Chia sẻ dữ liệu', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  STARTER_GRANT: { label: 'Quà khởi đầu', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
};

const REWARD_CATEGORY_CONFIG: Record<
  RewardCategory,
  { label: string; icon: typeof Gift; colorClass: string }
> = {
  PROFESSIONAL_COURSE: { label: 'Khóa học', icon: GraduationCap, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  CONFERENCE_ACCESS: { label: 'Hội nghị & Workshop', icon: Ticket, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  ACADEMIC_RESOURCE: { label: 'Tài liệu chuyên môn', icon: BookOpen, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  MENTORING: { label: 'Cố vấn 1:1', icon: Users, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  PROFESSIONAL_EVENT: { label: 'Sự kiện', icon: Calendar, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  OTHER_BENEFIT: { label: 'Ưu đãi khác', icon: Gift, colorClass: 'text-[#15803D] bg-[#EFF6F1]' },
  MONETARY_REWARD: { label: 'Kinh phí nghiên cứu', icon: Coins, colorClass: 'text-[#6E6D68] bg-[#F5FAF7]' },
};

const REDEMPTION_STATUS_META: Record<
  RedemptionStatus,
  { label: string; className: string }
> = {
  REQUESTED: { label: 'Chờ xử lý', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  UNDER_REVIEW: { label: 'Đang duyệt', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Đã duyệt', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
  PROCESSING: { label: 'Đang xử lý', className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]' },
  FULFILLED: { label: 'Đã hoàn tất', className: 'bg-[#ECFDF3] text-[#15803D] border-[#86EFAC]' },
  REJECTED: { label: 'Từ chối (Đã hoàn Credit)', className: 'bg-red-50 text-red-700 border-red-200' },
  CANCELLED: { label: 'Đã hủy (Đã hoàn Credit)', className: 'bg-[#F5FAF7] text-[#6E6D68] border-[#DCE6DF]' },
  REFUNDED: { label: 'Đã hoàn Credit', className: 'bg-[#EFF6F1] text-[#15803D] border-[#DCE6DF]' },
};

export function RewardsPage() {
  const { user } = useAuth();
  const { isProfessional } = useMode();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'catalog' | 'contributions' | 'history' | 'my-redemptions'>('catalog');
  const [catalogFilter, setCatalogFilter] = useState<'all' | 'benefits' | 'monetary'>('all');
  const [selectedReward, setSelectedReward] = useState<RewardCatalogItem | null>(null);
  const [userNote, setUserNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const effectiveTab =
    !isProfessional && (activeTab === 'contributions' || activeTab === 'my-redemptions')
      ? 'catalog'
      : activeTab;

  const { data: walletData, isLoading: loadingWallet } = useQuery({
    queryKey: ['my-wallet'],
    queryFn: () => rewardsApi.getWallet(),
    enabled: Boolean(user),
  });

  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ['rewards-catalog'],
    queryFn: () => rewardsApi.getCatalog(),
  });

  const { data: redemptionsData, isLoading: loadingRedemptions } = useQuery({
    queryKey: ['my-redemptions'],
    queryFn: () => rewardsApi.getMyRedemptions(),
    enabled: Boolean(user && (effectiveTab === 'my-redemptions' || effectiveTab === 'history')),
  });

  const { data: myContributionsData, isLoading: loadingContributions } = useQuery({
    queryKey: ['my-contributions'],
    queryFn: () => contributionsApi.getMyContributions(),
    enabled: Boolean(user && isProfessional),
  });

  const redeemMutation = useMutation({
    mutationFn: (data: { rewardId: string; userNote?: string }) => rewardsApi.redeem(data),
    onSuccess: (res) => {
      setError(null);
      setSuccessMsg(`Đổi ưu đãi thành công! Số dư còn lại: ${res.remainingBalance} Credit.`);
      setSelectedReward(null);
      setUserNote('');
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['rewards-catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['my-redemptions'] });
      setActiveTab(isProfessional ? 'my-redemptions' : 'history');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const claimStarterGrantMutation = useMutation({
    mutationFn: () => rewardsApi.claimOnboardingGrant(),
    onSuccess: (res) => {
      setError(null);
      setSuccessMsg(
        res.granted
          ? `Đã nhận +${res.amount} Credit miễn phí vào ví!`
          : 'Tài khoản đã nhận gói khởi đầu trước đó.',
      );
      void queryClient.invalidateQueries({ queryKey: ['my-wallet'] });
      void queryClient.invalidateQueries({ queryKey: ['rewards', 'wallet'] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const wallet = walletData?.wallet;
  const transactions = walletData?.transactions ?? [];
  const hasClaimedStarterGrant = transactions.some((tx) => tx.type === 'STARTER_GRANT');
  const cmeEarned = transactions
    .filter((tx) => tx.type === 'CONTRIBUTION_REWARD' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const consultationEarned = transactions
    .filter((tx) => tx.type === 'CONSULTATION_EARNING' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const dataBankRoyaltyEarned = transactions
    .filter((tx) => tx.type === 'DATABANK_ROYALTY' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const starterEarned = transactions
    .filter((tx) => tx.type === 'STARTER_GRANT' && tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const catalog = catalogData?.items ?? [];
  const filteredCatalog = catalog.filter((item) => {
    if (!isProfessional) return !item.isMonetary || item.payoutEnabled;
    if (catalogFilter === 'monetary') return item.isMonetary || item.category === 'MONETARY_REWARD';
    if (catalogFilter === 'benefits') return !item.isMonetary && item.category !== 'MONETARY_REWARD';
    return true;
  });
  const redemptions = redemptionsData?.redemptions ?? [];
  const myContributions = myContributionsData?.contributions ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Compact White Wallet Card */}
      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#141413]">
            Ví Credit
          </h1>

          {!loadingWallet && wallet && wallet.balance === 0 && !hasClaimedStarterGrant && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={claimStarterGrantMutation.isPending}
              onClick={() => claimStarterGrantMutation.mutate()}
              icon={<Coins className="size-3.5" aria-hidden />}
            >
              Nhận 250 Credit miễn phí
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-t border-[#DCE6DF] pt-4 tabular-nums">
          <div>
            <span className="text-xs font-medium text-[#6E6D68] block">Số dư khả dụng</span>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-bold text-[#16A34A]">
                {loadingWallet ? '...' : wallet?.balance ?? 0}
              </span>
              <span className="text-sm font-semibold text-[#141413]">Credit</span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-[#6E6D68] block">Đã nhận</span>
              <span className="font-semibold text-sm text-[#141413]">
                {loadingWallet ? '...' : wallet?.totalEarned ?? 0} Credit
              </span>
            </div>
            <div>
              <span className="text-[#6E6D68] block">Đã dùng</span>
              <span className="font-semibold text-sm text-[#141413]">
                {loadingWallet ? '...' : wallet?.totalSpent ?? 0} Credit
              </span>
            </div>
          </div>
        </div>

        {isProfessional && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#DCE6DF] text-xs tabular-nums">
            <div className="rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] px-3 py-2">
              <span className="text-[11px] text-[#6E6D68] block">Thưởng CME</span>
              <span className="font-mono font-semibold text-[#141413]">+{cmeEarned}</span>
            </div>
            <div className="rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] px-3 py-2">
              <span className="text-[11px] text-[#6E6D68] block">Đọc ca từ xa</span>
              <span className="font-mono font-semibold text-[#15803D]">+{consultationEarned}</span>
            </div>
            <div className="rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] px-3 py-2">
              <span className="text-[11px] text-[#6E6D68] block">Dữ liệu EEG</span>
              <span className="font-mono font-semibold text-[#141413]">+{dataBankRoyaltyEarned}</span>
            </div>
            <div className="rounded-lg bg-[#F5FAF7] border border-[#DCE6DF] px-3 py-2">
              <span className="text-[11px] text-[#6E6D68] block">Khởi đầu</span>
              <span className="font-mono font-semibold text-[#141413]">+{starterEarned}</span>
            </div>
          </div>
        )}
      </Card>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline ml-2">
            Đóng
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-[#EFF6F1] border border-[#DCE6DF] text-[#15803D] text-xs sm:text-sm rounded-xl flex items-center justify-between">
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-xs font-semibold underline ml-2">
            Đóng
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 overflow-x-auto border-b border-[#DCE6DF]">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0 ${
            effectiveTab === 'catalog'
              ? 'border-[#16A34A] font-bold text-[#15803D]'
              : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]'
          }`}
        >
          <Gift className="size-4" aria-hidden /> Đổi ưu đãi ({filteredCatalog.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0 ${
            effectiveTab === 'history'
              ? 'border-[#16A34A] font-bold text-[#15803D]'
              : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]'
          }`}
        >
          <History className="size-4" aria-hidden /> Lịch sử giao dịch ({transactions.length})
        </button>

        {isProfessional && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('contributions')}
              className={`flex items-center gap-2 border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0 ${
                effectiveTab === 'contributions'
                  ? 'border-[#16A34A] font-bold text-[#15803D]'
                  : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]'
              }`}
            >
              <Award className="size-4" aria-hidden /> Đóng góp CME ({myContributions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('my-redemptions')}
              className={`flex items-center gap-2 border-b-2 pb-2.5 text-sm transition-colors whitespace-nowrap shrink-0 ${
                effectiveTab === 'my-redemptions'
                  ? 'border-[#16A34A] font-bold text-[#15803D]'
                  : 'border-transparent font-normal text-[#6E6D68] hover:text-[#15803D]'
              }`}
            >
              <Clock className="size-4" aria-hidden /> Đã đổi ({redemptions.length})
            </button>
          </>
        )}
      </div>

      {/* Tab 1: Reward Catalog */}
      {effectiveTab === 'catalog' && (
        <div className="space-y-4">
          {isProfessional && (
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'benefits', label: 'Ưu đãi & CME' },
                { key: 'monetary', label: 'Kinh phí công bố' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCatalogFilter(tab.key as 'all' | 'benefits' | 'monetary')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors border ${
                    catalogFilter === tab.key
                      ? 'bg-[#16A34A] text-white border-[#16A34A]'
                      : 'bg-white text-[#6E6D68] border-[#DCE6DF] hover:bg-[#EFF6F1] hover:text-[#15803D]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {loadingCatalog ? (
            <Spinner label="Đang tải ưu đãi..." />
          ) : filteredCatalog.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Gift className="size-7 text-[#16A34A]" />}
                title="Chưa có ưu đãi nào"
                description="Các ưu đãi mới sẽ sớm được cập nhật."
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
                  <Card key={item.id} className="p-5 flex flex-col justify-between space-y-4 hover:border-[#86EFAC] transition-colors">
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium border border-[#DCE6DF] ${catConfig?.colorClass}`}>
                          <IconComponent className="size-3.5" aria-hidden /> {catConfig?.label}
                        </span>
                        <span className="font-bold text-xs text-[#15803D] bg-[#EFF6F1] border border-[#DCE6DF] px-2.5 py-0.5 rounded-full tabular-nums shrink-0">
                          {item.creditCost} Credit
                        </span>
                      </div>

                      <div>
                        <h3 className="font-semibold text-sm text-[#141413] leading-snug">{item.name}</h3>
                        <p className="text-xs text-[#6E6D68] mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                      </div>

                      {item.terms && (
                        <div className="bg-[#F5FAF7] px-2.5 py-2 rounded-lg border border-[#DCE6DF] text-[11px] text-[#575652] line-clamp-2">
                          {item.terms}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#DCE6DF] flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#6E6D68] tabular-nums">
                        {item.stockQuantity === null
                          ? 'Không giới hạn'
                          : `Còn ${Math.max(0, item.stockQuantity - item.redeemedCount)}/${item.stockQuantity} suất`}
                      </span>

                      {isLockedMonetary ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6E6D68] bg-[#F5FAF7] border border-[#DCE6DF] px-2.5 py-1 rounded-lg">
                          <Lock className="size-3" aria-hidden /> Chưa mở
                        </span>
                      ) : isOutOfStock ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
                          Hết suất
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!canAfford}
                          onClick={() => {
                            setError(null);
                            setSelectedReward(item);
                          }}
                        >
                          {canAfford ? 'Đổi ngay' : 'Chưa đủ Credit'}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Confirmation Dialog for Redemption */}
          {selectedReward && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
              <Card className="w-full max-w-md p-5 space-y-4 shadow-xl">
                <div className="flex items-start justify-between gap-3 border-b border-[#DCE6DF] pb-3">
                  <h3 className="font-bold text-base text-[#141413]">Xác nhận đổi ưu đãi</h3>
                  <span className="font-bold text-xs text-[#15803D] bg-[#EFF6F1] border border-[#DCE6DF] px-2.5 py-0.5 rounded-full tabular-nums">
                    -{selectedReward.creditCost} Credit
                  </span>
                </div>

                <div className="space-y-1.5 text-xs bg-[#F5FAF7] p-3.5 rounded-xl border border-[#DCE6DF]">
                  <p className="font-semibold text-[#141413]">{selectedReward.name}</p>
                  <p className="text-[#6E6D68] line-clamp-2">{selectedReward.description}</p>
                  <div className="flex justify-between pt-2 border-t border-[#DCE6DF] text-[#6E6D68] text-[11px] tabular-nums">
                    <span>Hiện có: {wallet?.balance ?? 0} Credit</span>
                    <span className="font-semibold text-[#15803D]">
                      Còn lại: {(wallet?.balance ?? 0) - selectedReward.creditCost} Credit
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="reward-redeem-note" className="text-xs font-semibold text-[#262624] block">
                    Thông tin nhận ưu đãi
                  </label>
                  <Textarea
                    id="reward-redeem-note"
                    rows={3}
                    value={userNote}
                    onChange={(e) => setUserNote(e.target.value)}
                    placeholder="Email hoặc ghi chú nhận ưu đãi..."
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE6DF]">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedReward(null)}>
                    Hủy
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    loading={redeemMutation.isPending}
                    onClick={() => {
                      redeemMutation.mutate({
                        rewardId: selectedReward.id,
                        userNote: userNote.trim() || undefined,
                      });
                    }}
                    icon={<Gift className="size-4" aria-hidden />}
                  >
                    Đổi ngay
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Transaction Ledger History */}
      {effectiveTab === 'history' && (
        <div className="space-y-4">
          {!isProfessional && redemptions.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm text-[#141413]">Ưu đãi đã đổi ({redemptions.length})</h3>
              <div className="space-y-2.5">
                {redemptions.map((redemption) => {
                  const statusMeta = REDEMPTION_STATUS_META[redemption.status];
                  return (
                    <div key={redemption.id} className="rounded-lg border border-[#DCE6DF] bg-[#F5FAF7] p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-xs sm:text-sm text-[#141413]">{redemption.reward.name}</p>
                          <p className="text-[11px] text-[#6E6D68] tabular-nums">
                            {new Date(redemption.createdAt).toLocaleString('vi-VN')} · {redemption.creditCost} Credit
                          </p>
                        </div>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      {redemption.fulfillmentInfo && (
                        <p className="font-mono text-xs bg-white p-2 rounded border border-[#DCE6DF] select-all text-[#141413]">
                          {redemption.fulfillmentInfo}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-[#DCE6DF] bg-[#F5FAF7] flex items-center justify-between">
              <h3 className="font-semibold text-xs sm:text-sm text-[#141413]">
                Lịch sử giao dịch Credit
              </h3>
              <span className="text-[11px] text-[#6E6D68]">50 giao dịch gần nhất</span>
            </div>

            {loadingWallet ? (
              <div className="p-8"><Spinner label="Đang tải lịch sử..." /></div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6E6D68]">Chưa có giao dịch nào.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F5FAF7] text-[#6E6D68] border-b border-[#DCE6DF]">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Thời gian</th>
                      <th className="py-2.5 px-4 font-semibold">Loại</th>
                      <th className="py-2.5 px-4 font-semibold">Nội dung</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Credit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE6DF]">
                    {transactions.map((tx) => {
                      const isPositive = tx.amount > 0;
                      const typeMeta = TRANSACTION_TYPE_LABELS[tx.type] ?? {
                        label: tx.type,
                        className: 'bg-[#F5FAF7] text-[#262624] border-[#DCE6DF]',
                      };
                      return (
                        <tr key={tx.id} className="hover:bg-[#F5FAF7]/60">
                          <td className="py-2.5 px-4 text-[#6E6D68] whitespace-nowrap tabular-nums">
                            {new Date(tx.createdAt).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${typeMeta.className}`}>
                              {typeMeta.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-[#141413] font-medium">
                            {tx.description}
                          </td>
                          <td className="py-2.5 px-4 text-right whitespace-nowrap font-bold font-mono tabular-nums">
                            <span className={isPositive ? 'text-[#16A34A]' : 'text-red-600'}>
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
        </div>
      )}

      {/* Tab 3 (Pro only): My Redemptions */}
      {isProfessional && effectiveTab === 'my-redemptions' && (
        <div className="space-y-4">
          {loadingRedemptions ? (
            <Spinner label="Đang tải..." />
          ) : redemptions.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Clock className="size-7 text-[#16A34A]" />}
                title="Chưa có yêu cầu đổi ưu đãi"
                description="Chọn ưu đãi phù hợp tại danh mục Đổi ưu đãi."
                action={
                  <Button size="sm" onClick={() => setActiveTab('catalog')} icon={<Gift className="size-4" aria-hidden />}>
                    Xem ưu đãi
                  </Button>
                }
              />
            </Card>
          ) : (
            redemptions.map((redemption) => {
              const statusMeta = REDEMPTION_STATUS_META[redemption.status];

              return (
                <Card key={redemption.id} className="p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DCE6DF] pb-3">
                    <div>
                      <h4 className="font-semibold text-sm text-[#141413]">{redemption.reward.name}</h4>
                      <p className="text-[11px] text-[#6E6D68] tabular-nums">
                        {new Date(redemption.createdAt).toLocaleString('vi-VN')} ·{' '}
                        <strong>{redemption.creditCost} Credit</strong>
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>

                  {redemption.userNote && (
                    <p className="text-xs text-[#575652]">
                      <strong>Ghi chú:</strong> {redemption.userNote}
                    </p>
                  )}

                  {redemption.adminNote && (
                    <div className="bg-[#F5FAF7] p-2.5 rounded-lg border border-[#DCE6DF] text-xs text-[#262624]">
                      <strong>Phản hồi:</strong> {redemption.adminNote}
                    </div>
                  )}

                  {redemption.fulfillmentInfo && (
                    <div className="bg-[#EFF6F1] p-3 rounded-xl border border-[#DCE6DF] text-xs text-[#15803D] space-y-1">
                      <div className="font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="size-4 text-[#16A34A]" aria-hidden /> Thông tin nhận ưu đãi:
                      </div>
                      <p className="font-mono bg-white p-2 rounded border border-[#DCE6DF] select-all text-[#141413]">
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

      {/* Tab 4 (Pro only): Contribution History */}
      {isProfessional && effectiveTab === 'contributions' && (
        <DataTableContainer
          title="Đóng góp CME"
          icon={<Award className="size-4 text-[#16A34A]" />}
          className="border-[#DCE6DF]"
        >
          {loadingContributions ? (
            <div className="p-6">
              <Spinner label="Đang tải..." />
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="border-b border-[#DCE6DF] bg-[#F5FAF7] text-[11px] font-semibold uppercase tracking-wider text-[#6E6D68]">
                  <th className="py-2.5 px-4">Danh mục</th>
                  <th className="py-2.5 px-4">Tóm tắt</th>
                  <th className="py-2.5 px-3 text-center">Trạng thái</th>
                  <th className="py-2.5 px-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE6DF]">
                {myContributions.length > 0 ? (
                  myContributions.map((c) => (
                    <tr key={c.id} className="hover:bg-[#F5FAF7]/60">
                      <td className="py-3 px-4 font-mono font-semibold text-[#141413] whitespace-nowrap">
                        {c.category}
                      </td>
                      <td className="py-3 px-4 text-[#262624] font-medium">{c.summary}</td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="inline-flex rounded bg-[#EFF6F1] border border-[#DCE6DF] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#15803D]">
                        {c.awardCredits ? `+${c.awardCredits} Credit` : 'Chờ duyệt'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 px-4 text-center text-[#6E6D68]">
                      Chưa có đóng góp nào. Nộp bài tại{' '}
                      <a href="/contributions" className="font-semibold text-[#16A34A] hover:underline">
                        Đóng góp chuyên môn
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

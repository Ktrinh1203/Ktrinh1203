import { api } from './client';
import type {
  AuthResponse,
  CommentItem,
  PaginatedPosts,
  PostItem,
  SelfUser,
  UserProfile,
} from './types';

export const authApi = {
  me: () => api<AuthResponse>('/auth/me'),
  login: (body: { identifier: string; password: string }) =>
    api<AuthResponse>('/auth/login', { method: 'POST', body }),
  register: (body: { email: string; username: string; displayName: string; password: string }) =>
    api<AuthResponse>('/auth/register', { method: 'POST', body }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api<void>('/auth/change-password', { method: 'POST', body }),
};

export const usersApi = {
  get: (idOrUsername: string) =>
    api<{ user: UserProfile }>(`/users/${encodeURIComponent(idOrUsername)}`),
  updateMe: (body: { displayName?: string; bio?: string | null }) =>
    api<{ user: SelfUser }>('/users/me', { method: 'PATCH', body }),
  follow: (userId: string) =>
    api<{ following: boolean }>(`/users/${userId}/follow`, { method: 'POST' }),
  unfollow: (userId: string) =>
    api<{ following: boolean }>(`/users/${userId}/follow`, { method: 'DELETE' }),
  getPosts: (userId: string, cursor?: string | null) =>
    api<PaginatedPosts>(`/users/${userId}/posts`, { query: { cursor: cursor || undefined } }),
};

export const postsApi = {
  getFeed: (feedType: 'community' | 'following', cursor?: string | null) =>
    api<PaginatedPosts>('/posts', { query: { feedType, cursor: cursor || undefined } }),
  getById: (id: string) => api<{ post: PostItem }>(`/posts/${id}`),
  create: (formData: FormData) =>
    api<{ post: PostItem }>('/posts', { method: 'POST', body: formData }),
  update: (id: string, body: { content: string }) =>
    api<{ post: PostItem }>(`/posts/${id}`, { method: 'PATCH', body }),
  delete: (id: string) => api<void>(`/posts/${id}`, { method: 'DELETE' }),
  like: (id: string) =>
    api<{ liked: boolean; likesCount: number }>(`/posts/${id}/like`, { method: 'POST' }),
  unlike: (id: string) =>
    api<{ liked: boolean; likesCount: number }>(`/posts/${id}/like`, { method: 'DELETE' }),
  getComments: (id: string) =>
    api<{ comments: CommentItem[] }>(`/posts/${id}/comments`),
  createComment: (id: string, content: string) =>
    api<{ comment: CommentItem }>(`/posts/${id}/comments`, { method: 'POST', body: { content } }),
  updateComment: (commentId: string, content: string) =>
    api<{ comment: CommentItem }>(`/posts/comments/${commentId}`, { method: 'PATCH', body: { content } }),
  deleteComment: (commentId: string) =>
    api<void>(`/posts/comments/${commentId}`, { method: 'DELETE' }),
};

export const messagesApi = {
  getConversations: () =>
    api<{ conversations: import('./types').ConversationItem[] }>('/conversations'),
  startConversation: (targetUserId: string) =>
    api<{ conversation: import('./types').ConversationItem }>('/conversations', {
      method: 'POST',
      body: { targetUserId },
    }),
  getDetails: (conversationId: string) =>
    api<{ conversation: import('./types').ConversationItem }>(`/conversations/${conversationId}`),
  getMessages: (conversationId: string, cursor?: string | null) =>
    api<{ items: import('./types').MessageItem[]; nextCursor: string | null; hasMore: boolean }>(
      `/conversations/${conversationId}/messages`,
      { query: { cursor: cursor || undefined } },
    ),
  sendMessage: (conversationId: string, content: string) =>
    api<{ message: import('./types').MessageItem }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { content },
    }),
};

export const notificationsApi = {
  getAll: (limit = 30) =>
    api<{ items: import('./types').NotificationItem[]; unreadCount: number }>('/notifications', {
      query: { limit },
    }),
  markRead: (id: string) =>
    api<{ id: string; read: boolean }>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => api<{ success: boolean }>('/notifications/read-all', { method: 'POST' }),
};

export const searchApi = {
  search: (query: { q?: string; category?: string; type?: string; specialty?: string }) =>
    api<import('./types').SearchResults>('/search', { query }),
};

export const reportsApi = {
  create: (body: {
    targetType: 'POST' | 'COMMENT' | 'USER';
    targetId: string;
    reason: string;
    details?: string;
  }) => api<{ report: any }>('/reports', { method: 'POST', body }),
};

export const verificationsApi = {
  getMyRequests: () =>
    api<{ requests: import('./types').VerificationRequestItem[] }>('/verifications/my'),
  submitRequest: (formData: FormData) =>
    api<{ request: import('./types').VerificationRequestItem }>('/verifications', {
      method: 'POST',
      body: formData,
    }),
};

export const contributionsApi = {
  getEligiblePosts: () =>
    api<{ posts: import('./types').EligiblePostItem[] }>('/contributions/eligible-posts'),
  getMyContributions: () =>
    api<{ contributions: import('./types').ContributionItem[] }>('/contributions/my'),
  getPublications: () =>
    api<{ contributions: import('./types').ContributionItem[] }>('/contributions/publications'),
  getById: (id: string) =>
    api<{ contribution: import('./types').ContributionItem }>(`/contributions/${id}`),
  create: (body: { postId: string; category: string; summary: string }) =>
    api<{ contribution: import('./types').ContributionItem }>('/contributions', {
      method: 'POST',
      body,
    }),
  resubmit: (id: string, body: { category?: string; summary: string }) =>
    api<{ contribution: import('./types').ContributionItem }>(`/contributions/${id}/resubmit`, {
      method: 'PATCH',
      body,
    }),
  withdraw: (id: string) =>
    api<{ contribution: import('./types').ContributionItem }>(`/contributions/${id}/withdraw`, {
      method: 'POST',
    }),
};

export const rewardsApi = {
  getWallet: () =>
    api<{ wallet: import('./types').CreditWalletItem; transactions: import('./types').CreditTransactionItem[] }>(
      '/rewards/wallet',
    ),
  getCatalog: (category?: string) =>
    api<{ items: import('./types').RewardCatalogItem[] }>('/rewards/catalog', {
      query: { category: category || undefined },
    }),
  redeem: (body: { rewardId: string; userNote?: string }) =>
    api<{ redemption: import('./types').RewardRedemptionItem; remainingBalance: number }>(
      '/rewards/redeem',
      { method: 'POST', body },
    ),
  getMyRedemptions: () =>
    api<{ redemptions: import('./types').RewardRedemptionItem[] }>('/rewards/my-redemptions'),
  claimOnboardingGrant: () =>
    api<{ granted: boolean; amount: number; wallet: import('./types').CreditWalletItem }>(
      '/rewards/claim-onboarding-grant',
      { method: 'POST' },
    ),
};

export const adminRewardsApi = {
  getOverview: () =>
    api<{ stats: import('./types').AdminRewardsOverviewStats }>('/admin/rewards/overview'),
  getContributions: (query?: { status?: string; category?: string }) =>
    api<{ contributions: import('./types').ContributionItem[] }>('/admin/rewards/contributions', {
      query,
    }),
  claimContribution: (id: string) =>
    api<{ contribution: import('./types').ContributionItem }>(
      `/admin/rewards/contributions/${id}/claim`,
      { method: 'POST' },
    ),
  reviewContribution: (
    id: string,
    body: {
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_REVISION';
      scoreAccuracy: number;
      scoreRelevance: number;
      scoreUsefulness: number;
      scoreOriginality: number;
      scoreImpact: number;
      awardedCredits: number;
      feedback: string;
      supportingEvidence?: string;
    },
  ) =>
    api<{ contribution: import('./types').ContributionItem }>(
      `/admin/rewards/contributions/${id}/review`,
      { method: 'POST', body },
    ),
  getCatalog: () =>
    api<{ items: import('./types').RewardCatalogItem[] }>('/admin/rewards/catalog'),
  createReward: (body: any) =>
    api<{ reward: import('./types').RewardCatalogItem }>('/admin/rewards/catalog', {
      method: 'POST',
      body,
    }),
  updateReward: (id: string, body: any) =>
    api<{ reward: import('./types').RewardCatalogItem }>(`/admin/rewards/catalog/${id}`, {
      method: 'PATCH',
      body,
    }),
  getRedemptions: (status?: string) =>
    api<{ redemptions: import('./types').RewardRedemptionItem[] }>('/admin/rewards/redemptions', {
      query: { status: status || undefined },
    }),
  reviewRedemption: (
    id: string,
    body: {
      action: 'APPROVE' | 'REJECT' | 'FULFILL' | 'CANCEL';
      adminNote?: string;
      fulfillmentInfo?: string;
    },
  ) =>
    api<{ redemption: import('./types').RewardRedemptionItem }>(
      `/admin/rewards/redemptions/${id}/decision`,
      { method: 'POST', body },
    ),
  getWallets: (search?: string) =>
    api<{
      wallets: (import('./types').CreditWalletItem & {
        user: import('./types').UserSummary;
        transactions: import('./types').CreditTransactionItem[];
      })[];
    }>('/admin/rewards/wallets', { query: { search: search || undefined } }),
  adjustWallet: (walletId: string, body: { amount: number; reason: string }) =>
    api<{ wallet: import('./types').CreditWalletItem; transaction: import('./types').CreditTransactionItem }>(
      `/admin/rewards/wallets/${walletId}/adjust`,
      { method: 'POST', body },
    ),
};

export const adminApi = {
  getReports: (status?: string) =>
    api<{ reports: import('./types').ReportItem[] }>('/admin/reports', {
      query: { status: status || undefined },
    }),
  resolveReport: (
    id: string,
    body: { status: 'RESOLVED' | 'DISMISSED'; resolutionNote?: string; action?: string },
  ) => api<{ report: any }>(`/admin/reports/${id}`, { method: 'PATCH', body }),
  getVerifications: () =>
    api<{ profiles: import('./types').PendingVerificationItem[] }>('/admin/verifications'),
  verifyProfile: (id: string, body: { status: 'VERIFIED' | 'REJECTED' | 'PENDING'; note?: string }) =>
    api<{ profile: any }>(`/admin/verifications/${id}`, { method: 'PATCH', body }),
  getVerificationRequests: (query?: { status?: string; type?: string }) =>
    api<{ requests: import('./types').VerificationRequestItem[] }>(
      '/admin/verifications/requests',
      { query },
    ),
  getVerificationDossier: (id: string) =>
    api<{ request: import('./types').VerificationRequestItem }>(
      `/admin/verifications/requests/${id}`,
    ),
  reviewVerificationRequest: (
    id: string,
    body: {
      action: 'CLAIM' | 'APPROVE' | 'REJECT' | 'REQUEST_INFO' | 'REVOKE';
      note?: string;
      reason?: string;
    },
  ) =>
    api<{ request: import('./types').VerificationRequestItem }>(
      `/admin/verifications/requests/${id}/decision`,
      { method: 'POST', body },
    ),
};

export const eegDatasetsApi = {
  getMyDatasets: () =>
    api<{ datasets: import('./types').EegDatasetRecord[] }>('/eeg-datasets/my'),
  getWorkspaceDatasets: () =>
    api<{ datasets: import('./types').EegDatasetRecord[] }>('/eeg-datasets/workspace'),
  getById: (id: string) =>
    api<{ dataset: import('./types').EegDatasetRecord }>(`/eeg-datasets/${encodeURIComponent(id)}`),
  create: (body: {
    title: string;
    duration?: string;
    samplingRate?: string;
    channelsCount?: number;
    montage?: string;
    filter?: string;
    clinicalNote?: string;
  }) =>
    api<{ dataset: import('./types').EegDatasetRecord }>('/eeg-datasets', {
      method: 'POST',
      body,
    }),
  grantConsent: (datasetId: string, professionalUsernameOrId: string) =>
    api<{ dataset: import('./types').EegDatasetRecord }>(
      `/eeg-datasets/${encodeURIComponent(datasetId)}/consent`,
      {
        method: 'POST',
        body: { professionalUsernameOrId },
      },
    ),
  revokeConsent: (datasetId: string, professionalUsernameOrId: string) =>
    api<{ dataset: import('./types').EegDatasetRecord }>(
      `/eeg-datasets/${encodeURIComponent(datasetId)}/consent/${encodeURIComponent(professionalUsernameOrId)}`,
      {
        method: 'DELETE',
      },
    ),
};

export const communitiesApi = {
  list: (query?: { category?: string; q?: string }) =>
    api<{ communities: import('./types').CommunityItem[] }>('/communities', { query }),
  join: (id: string) =>
    api<{ community: import('./types').CommunityItem }>(
      `/communities/${encodeURIComponent(id)}/join`,
      { method: 'POST' },
    ),
  leave: (id: string) =>
    api<{ community: import('./types').CommunityItem }>(
      `/communities/${encodeURIComponent(id)}/join`,
      { method: 'DELETE' },
    ),
};

export const qeegApi = {
  health: () =>
    api<{ status: string; engineSource: string; categories: import('./types').ClinicalCategory[] }>(
      '/qeeg/health',
    ),
  getCases: () =>
    api<{ cases: import('./types').QeegCaseItem[] }>('/qeeg/cases'),
  analyzeCase: (body: {
    caseId: string;
    timeWindowSec?: number;
    notch50Hz?: boolean;
    fastScore?: number;
  }) =>
    api<import('./types').QeegAnalysisResult>('/qeeg/analyze-case', {
      method: 'POST',
      body,
    }),
  analyzeCsv: (body: {
    filename: string;
    csvText: string;
    samplingRateHz?: number;
    clinicalCategory?: import('./types').ClinicalCategory;
  }) =>
    api<import('./types').QeegAnalysisResult>('/qeeg/analyze-csv', {
      method: 'POST',
      body,
    }),
  saveToPlatform: (body: {
    title: string;
    clinicalCategory: import('./types').ClinicalCategory;
    groundTruthLabel: import('./types').NeuralLabel;
    split?: import('./types').DatasetSplit;
    subjectCode?: string;
    clinicalNote?: string;
    deidentifiedConfirmed: boolean;
    analysis: import('./types').QeegAnalysisResult;
  }) =>
    api<{
      dataset: import('./types').EegDatasetRecord;
      sample: import('./types').NeuralTrainingSampleItem;
    }>('/qeeg/save-to-platform', {
      method: 'POST',
      body,
    }),
};

export const neuralDbApi = {
  getStats: () =>
    api<import('./types').NeuralDbStats>('/neural-db/stats'),
  listSamples: (query?: {
    clinicalCategory?: string;
    groundTruthLabel?: string;
    split?: string;
    verifiedOnly?: boolean;
  }) =>
    api<{ samples: import('./types').NeuralTrainingSampleItem[] }>('/neural-db/samples', {
      query,
    }),
  createSample: (body: {
    datasetId?: string;
    subjectCode: string;
    clinicalCategory: import('./types').ClinicalCategory;
    groundTruthLabel: import('./types').NeuralLabel;
    split?: import('./types').DatasetSplit;
    samplingRateHz?: number;
    channelsCount?: number;
    montage?: string;
    signalQualityScore?: number;
    dar: number;
    bsi: number;
    tar: number;
    pri?: number;
    wpli?: number;
    tpaLockoutTriggered?: boolean;
    spectralBands: import('./types').QeegBandPowers;
    featureVector: number[];
    waveformPreview: {
      time: number[];
      channels: string[];
      filtered: Record<string, number[]>;
    };
    deidentifiedConfirmed: boolean;
  }) =>
    api<{ sample: import('./types').NeuralTrainingSampleItem }>('/neural-db/samples', {
      method: 'POST',
      body,
    }),
  verifySample: (id: string, body?: { groundTruthLabel?: import('./types').NeuralLabel; split?: import('./types').DatasetSplit }) =>
    api<{ sample: import('./types').NeuralTrainingSampleItem }>(
      `/neural-db/samples/${encodeURIComponent(id)}/verify`,
      { method: 'PATCH', body: body ?? {} },
    ),
  exportUrl: (format: 'csv' | 'jsonl', query?: { clinicalCategory?: string; split?: string }) => {
    const params = new URLSearchParams({ format });
    if (query?.clinicalCategory) params.set('clinicalCategory', query.clinicalCategory);
    if (query?.split) params.set('split', query.split);
    return `/api/neural-db/export?${params.toString()}`;
  },
};

export const consultationsApi = {
  list: (query?: { scope?: 'all' | 'mine' | 'queue'; clinicalCategory?: string; status?: string }) =>
    api<{ tickets: import('./types').ConsultationTicketItem[] }>('/consultations', { query }),
  create: (body: {
    title: string;
    symptomSummary: string;
    clinicalCategory: import('./types').ClinicalCategory;
    bountyCredits: number;
    datasetId?: string;
    neuralSampleId?: string;
  }) =>
    api<{ ticket: import('./types').ConsultationTicketItem; remainingBalance: number }>(
      '/consultations',
      { method: 'POST', body },
    ),
  claim: (id: string) =>
    api<{ ticket: import('./types').ConsultationTicketItem }>(
      `/consultations/${encodeURIComponent(id)}/claim`,
      { method: 'POST' },
    ),
  reply: (
    id: string,
    body: {
      waveAnalysisText: string;
      clinicalGuidanceText: string;
      recommendedFollowUp: string;
    },
  ) =>
    api<{ reply: import('./types').ConsultationReplyItem; ticket: import('./types').ConsultationTicketItem }>(
      `/consultations/${encodeURIComponent(id)}/replies`,
      { method: 'POST', body },
    ),
  acceptReply: (id: string, replyId: string, rating?: number) =>
    api<{ ticket: import('./types').ConsultationTicketItem }>(
      `/consultations/${encodeURIComponent(id)}/accept/${encodeURIComponent(replyId)}`,
      { method: 'POST', body: { rating } },
    ),
};

export const dataBankApi = {
  list: (query?: { clinicalCategory?: string; q?: string }) =>
    api<{ listings: import('./types').DataBankListingItem[] }>('/databank', { query }),
  getById: (id: string) =>
    api<{ listing: import('./types').DataBankListingItem }>(`/databank/${encodeURIComponent(id)}`),
  create: (body: {
    datasetId?: string;
    title: string;
    summary: string;
    clinicalCategory: import('./types').ClinicalCategory;
    methodologyNote: string;
    sampleCount: number;
    channelsSpec: string;
    samplingRateHz: number;
    priceCredits: number;
    previewMetrics: {
      meanDar: number;
      meanBsi: number;
      meanTar: number;
      meanWpli: number;
      dominantBand: string;
    };
    payloadCsv: string;
  }) =>
    api<{ listing: import('./types').DataBankListingItem }>('/databank', {
      method: 'POST',
      body,
    }),
  purchase: (id: string) =>
    api<{ listing: import('./types').DataBankListingItem; remainingBalance: number }>(
      `/databank/${encodeURIComponent(id)}/purchase`,
      { method: 'POST' },
    ),
};

export const selfServiceApi = {
  getOverview: () =>
    api<{
      checkIns: import('./types').HealthCheckInItem[];
      workPlan: import('./types').WorkingPlanBlockItem[];
    }>('/self-service/overview'),
  addCheckIn: (body: {
    neuralSampleId?: string;
    focusScore: number;
    fatigueIndexTar: number;
    hemisphericBsi: number;
    alphaPeakHz: number;
    sleepHours: number;
    stressLevel: number;
    notes: string;
  }) =>
    api<{ checkIn: import('./types').HealthCheckInItem }>('/self-service/check-ins', {
      method: 'POST',
      body,
    }),
  addWorkBlock: (body: {
    dayOfWeek: string;
    timeSlot: string;
    title: string;
    blockType: import('./types').WorkBlockType;
    eegRationale: string;
  }) =>
    api<{ block: import('./types').WorkingPlanBlockItem }>('/self-service/work-plan', {
      method: 'POST',
      body,
    }),
  updateWorkBlock: (
    id: string,
    body: Partial<{
      dayOfWeek: string;
      timeSlot: string;
      title: string;
      blockType: import('./types').WorkBlockType;
      eegRationale: string;
      completed: boolean;
    }>,
  ) =>
    api<{ block: import('./types').WorkingPlanBlockItem }>(
      `/self-service/work-plan/${encodeURIComponent(id)}`,
      { method: 'PATCH', body },
    ),
  deleteWorkBlock: (id: string) =>
    api<void>(`/self-service/work-plan/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};

export const communityInsightsApi = {
  getSpotlight: () =>
    api<{ professionals: import('./types').CommunitySpotlightProfessional[] }>(
      '/community-insights/spotlight',
    ),
};



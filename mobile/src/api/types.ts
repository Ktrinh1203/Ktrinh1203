// Frontend types mirroring the server API responses (server/src/modules/*).

export type Role = 'USER' | 'ADMIN';
export type ProfessionalType = 'HEALTHCARE_PROFESSIONAL' | 'RESEARCHER';
export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type VerificationRequestStatus =
  | 'PENDING_REVIEW'
  | 'IN_REVIEW'
  | 'ADDITIONAL_INFO_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'REVOKED';
export type CredentialDocumentType =
  | 'MEDICAL_LICENSE'
  | 'HOSPITAL_STAFF_CARD'
  | 'ACADEMIC_DEGREE'
  | 'INSTITUTION_AFFILIATION'
  | 'ORCID_RECORD'
  | 'OTHER';

export interface ProfessionalProfile {
  id: string;
  type: ProfessionalType;
  title: string;
  specialty: string;
  institution: string | null;
  licenseOrOrcidNumber?: string | null;
  researchInterests: string[];
  verificationStatus: VerificationStatus;
  verificationNote?: string | null;
  verifiedAt: string | null;
}

export type LogicalAccountRole =
  | 'GENERAL_USER'
  | 'DOCTOR'
  | 'HEALTHCARE_WORKER'
  | 'RESEARCHER'
  | 'RESEARCH_STUDENT';

export type ExperienceMode = 'GENERAL_MODE' | 'PROFESSIONAL_MODE';

export interface ExperienceResolution {
  experience: ExperienceMode;
  mode: 'general' | 'professional';
  accountRole: LogicalAccountRole;
  allRoles: LogicalAccountRole[];
  verificationStatus: VerificationStatus;
  canAccessProfessionalMode: boolean;
  enableVerificationCenter: boolean;
  enableResubmission: boolean;
  isDualRoleProfessional: boolean;
}

export interface ConsentedProfessionalEntry {
  userId: string;
  username: string;
  displayName: string;
  title: string;
  specialty: string;
  grantedAt: string;
}

export interface EegAccessHistoryEntry {
  id: string;
  action: 'DATASET_REGISTERED' | 'CONSENT_GRANTED' | 'CONSENT_REVOKED' | 'DATASET_ACCESSED';
  actorUsername: string;
  actorDisplayName: string;
  targetProfessional?: string;
  timestamp: string;
  note: string;
}

export interface EegDatasetRecord {
  id: string;
  ownerId: string;
  ownerUsername: string;
  patientCode: string;
  title: string;
  date: string;
  duration: string;
  samplingRate: string;
  channelsCount: number;
  montage: string;
  filter: string;
  status: 'ANALYZED' | 'REVIEW_PENDING' | 'RAW_RECORDING';
  clinicalNote: string;
  consentedProfessionals: ConsentedProfessionalEntry[];
  accessHistory: EegAccessHistoryEntry[];
}

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  professionalProfiles: Pick<ProfessionalProfile, 'type' | 'verificationStatus' | 'title'>[];
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl?: string | null;
  bio: string | null;
  role: Role;
  createdAt: string;
  professionalProfiles: ProfessionalProfile[];
}

export interface SelfUser extends PublicUser {
  email: string;
  updatedAt: string;
  experienceResolution?: ExperienceResolution;
}

export interface UserProfile extends PublicUser {
  stats: { posts: number; followers: number; following: number };
  isFollowing: boolean;
  isSelf: boolean;
}

export interface AuthResponse {
  user: SelfUser;
  csrfToken: string;
}

export interface PostMediaItem {
  id: string;
  url: string;
  mimeType: string;
  position: number;
}

export interface PostItem {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
  media: PostMediaItem[];
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  isAuthor: boolean;
}

export interface CommentItem {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
  isAuthor: boolean;
}

export interface PaginatedPosts {
  items: PostItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ConversationItem {
  id: string;
  lastMessageAt: string;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  isUnread: boolean;
  otherUser: UserSummary | null;
}

export interface MessageItem {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  sender: UserSummary;
  isSender: boolean;
}

export interface NotificationItem {
  id: string;
  type:
    | 'POST_LIKED'
    | 'POST_COMMENTED'
    | 'NEW_FOLLOWER'
    | 'NEW_MESSAGE'
    | 'VERIFICATION_UPDATE'
    | 'CONTRIBUTION_UPDATE'
    | 'REWARD_UPDATE'
    | 'CONSULTATION_UPDATE';
  actor: UserSummary;
  postId: string | null;
  postSnippet: string | null;
  commentId: string | null;
  commentSnippet: string | null;
  conversationId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResults {
  users: UserSummary[];
  professionals: (ProfessionalProfile & { user: UserSummary })[];
  posts: PostItem[];
}

export interface ReportItem {
  id: string;
  reporterId: string;
  targetType: 'POST' | 'COMMENT' | 'USER';
  postId: string | null;
  commentId: string | null;
  targetUserId: string | null;
  reason: string;
  details: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  resolutionNote: string | null;
  createdAt: string;
  reporter: UserSummary;
  targetUser?: UserSummary | null;
  post?: { id: string; content: string; status: string; author: UserSummary } | null;
  comment?: { id: string; content: string; status: string; author: UserSummary } | null;
}

export interface PendingVerificationItem extends ProfessionalProfile {
  verificationNote: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
  };
}

export interface OcrEvidenceDossier {
  status: 'EXTRACTED' | 'MANUAL_REVIEW_REQUIRED' | 'FAILED';
  extractedFields: {
    fullName?: string;
    licenseNumber?: string;
    issuingAuthority?: string;
    issueDate?: string;
    specialty?: string;
  };
  comparisonFlags: {
    nameMatchScore: number;
    nameMismatchWarning: boolean;
    specialtyMatchWarning: boolean;
    licenseFormatValid: boolean;
    licenseDocumentMatch: boolean;
    dateInvalidWarning: boolean;
    lowLegibilityWarning: boolean;
    domainRelevanceWarning: boolean;
  };
  sourceReliabilityTier: 'TIER_1' | 'TIER_2' | 'TIER_3' | 'FLAGGED';
  ocrRawSnippet: string;
  disclaimer: string;
  processedAt: string;
}

export interface VerificationDocumentItem {
  id: string;
  requestId: string;
  documentType: CredentialDocumentType;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  ocrData: OcrEvidenceDossier | null;
  uploadedAt: string;
}

export interface VerificationAuditLogItem {
  id: string;
  requestId: string;
  actorId: string;
  action: string;
  previousState: VerificationRequestStatus | null;
  newState: VerificationRequestStatus;
  reason: string | null;
  ipAddress: string | null;
  timestamp: string;
  actor: {
    id: string;
    username: string;
    displayName: string;
    role: Role;
  };
}

export interface VerificationRequestItem {
  id: string;
  profileId: string;
  userId: string;
  status: VerificationRequestStatus;
  claimedTitle: string;
  claimedSpecialty: string;
  claimedInstitution: string | null;
  licenseOrOrcidNumber: string | null;
  submissionNotes: string | null;
  reviewerId: string | null;
  reviewNotes: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    email?: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  profile: ProfessionalProfile;
  reviewer: {
    id: string;
    username: string;
    displayName: string;
  } | null;
  documents: VerificationDocumentItem[];
  auditLogs: VerificationAuditLogItem[];
}

// ---------------------------------------------------------------------------
// Contribution & Rewards Module
// ---------------------------------------------------------------------------

export type ContributionCategory =
  | 'HEALTHCARE_EDUCATION'
  | 'RESEARCH_CONTRIBUTION'
  | 'EXPERT_QA'
  | 'RESEARCH_DISCUSSION'
  | 'EDUCATIONAL_RESOURCE';

export type ContributionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type CreditTransactionType =
  | 'CONTRIBUTION_REWARD'
  | 'REWARD_REDEMPTION'
  | 'ADMIN_ADJUSTMENT'
  | 'REWARD_REVERSAL'
  | 'REFUND'
  | 'CONSULTATION_ESCROW'
  | 'CONSULTATION_EARNING'
  | 'CONSULTATION_REFUND'
  | 'DATABANK_PURCHASE'
  | 'DATABANK_ROYALTY'
  | 'STARTER_GRANT'
  | 'TOPUP_VND'
  | 'P2P_TRANSFER_OUT'
  | 'P2P_TRANSFER_IN'
  | 'PAYOUT_LOCK'
  | 'PAYOUT_SETTLED'
  | 'PAYOUT_REFUND';

export type RewardCategory =
  | 'MONETARY_REWARD'
  | 'PROFESSIONAL_COURSE'
  | 'CONFERENCE_ACCESS'
  | 'ACADEMIC_RESOURCE'
  | 'MENTORING'
  | 'PROFESSIONAL_EVENT'
  | 'OTHER_BENEFIT';

export type RedemptionStatus =
  | 'REQUESTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'FULFILLED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface ContributionReviewItem {
  id: string;
  contributionId: string;
  reviewerId: string;
  scoreAccuracy: number;
  scoreRelevance: number;
  scoreUsefulness: number;
  scoreOriginality: number;
  scoreImpact: number;
  scoreOverall: number | string;
  awardedCredits: number;
  decision: ContributionStatus;
  feedback: string;
  supportingEvidence: string | null;
  createdAt: string;
  reviewer: {
    id: string;
    username: string;
    displayName: string;
  };
}

export interface ContributionItem {
  id: string;
  userId: string;
  postId: string;
  category: ContributionCategory;
  status: ContributionStatus;
  summary: string;
  awardCredits: number | null;
  currentReviewerId: string | null;
  createdAt: string;
  updatedAt: string;
  post: {
    id: string;
    content: string;
    createdAt: string;
    media: { id: string; url: string; mimeType: string }[];
  };
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    professionalProfiles: Pick<
      ProfessionalProfile,
      'type' | 'title' | 'specialty' | 'institution' | 'verificationStatus'
    >[];
  };
  reviews: ContributionReviewItem[];
}

export interface EligiblePostItem {
  id: string;
  content: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  hasActiveContribution: boolean;
  activeContribution: {
    id: string;
    status: ContributionStatus;
    category: ContributionCategory;
    createdAt: string;
  } | null;
}

export interface CreditTransactionItem {
  id: string;
  walletId?: string;
  amount: number;
  balanceAfter?: number | null;
  bucket?: string;
  type: CreditTransactionType;
  referenceId?: string | null;
  idempotencyKey?: string | null;
  description: string;
  actorId?: string | null;
  txHash?: string | null;
  prevHash?: string | null;
  createdAt: string;
}

export interface CreditWalletItem {
  id: string;
  balance: number;
  promoCredits?: number;
  purchasedCredits?: number;
  earnedCredits?: number;
  lockedCredits?: number;
  totalEarned: number;
  totalSpent: number;
  receiveCode?: string | null;
  bankBin?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankAccountName?: string | null;
  headHash?: string | null;
  updatedAt: string;
}

export interface WalletIntegrityStatus {
  valid: boolean;
  checkedCount: number;
  headHash: string | null;
  balanceMatchesLedger: boolean;
  tamperedTxId: string | null;
}

export type PaymentOrderStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
export type PayoutRequestStatus = 'PENDING' | 'PAID' | 'REJECTED';

export interface TopupPackageItem {
  id: string;
  label: string;
  amountVnd: number;
  credits: number;
  bonusCredits: number;
}

export interface TopupPackagesResponse {
  vndPerCredit: number;
  bankInfo: {
    bankBin: string;
    bankName: string;
    accountNo: string;
    accountName: string;
  };
  packages: TopupPackageItem[];
}

export interface PaymentOrderItem {
  id: string;
  orderCode: string;
  amountVnd: number;
  creditsToGrant: number;
  bonusCredits: number;
  status: PaymentOrderStatus;
  expiresAt: string;
  paidAt?: string | null;
  qrPayload: string;
  vietQrImageUrl: string;
  bankBin?: string;
  bankName?: string;
  accountNo?: string;
  accountName?: string;
  createdAt: string;
}

export interface ReceiveCodeInfo {
  receiveCode: string;
  username: string;
  displayName: string;
  qrPayload: string;
  bankProfile: {
    bankBin: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankAccountName: string | null;
  } | null;
  vietQrReceiveUrl: string | null;
}

export interface PayoutRequestItem {
  id: string;
  userId?: string;
  amountCredits: number;
  amountVnd: number;
  bankBin: string;
  bankName: string;
  bankAccountNo: string;
  bankAccountName: string;
  payoutVietQrUrl?: string;
  status: PayoutRequestStatus;
  bankRef?: string | null;
  note?: string | null;
  adminNote?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface RewardCatalogItem {
  id: string;
  name: string;
  description: string;
  category: RewardCategory;
  creditCost: number;
  isActive: boolean;
  stockQuantity: number | null;
  redeemedCount: number;
  eligibilityReq: string | null;
  terms: string | null;
  imageUrl: string | null;
  isMonetary: boolean;
  payoutEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { redemptions: number };
}

export interface RewardRedemptionItem {
  id: string;
  rewardId: string;
  userId: string;
  creditCost: number;
  status: RedemptionStatus;
  userNote: string | null;
  adminNote: string | null;
  fulfillmentInfo: string | null;
  reviewerId: string | null;
  reviewedAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  reward: RewardCatalogItem;
  user?: {
    id: string;
    username: string;
    displayName: string;
    email?: string;
  };
  reviewer?: {
    id: string;
    username: string;
    displayName: string;
  } | null;
}

export interface AdminRewardsOverviewStats {
  contributions: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  credits: {
    totalInCirculation: number;
    totalEarned: number;
    totalSpent: number;
  };
  rewards: {
    activeCatalogCount: number;
    pendingRedemptions: number;
  };
}

export type CommunityCategory = 'clinical' | 'research' | 'patient' | 'general';

export interface CommunityItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: CommunityCategory;
  specialtyLabel: string;
  membersCount: number;
  discussionsCount: number;
  activeProtocolsCount: number;
  isMember: boolean;
  isVerifiedOnly: boolean;
  leadInstitution: string;
}

// ---------------------------------------------------------------------------
// Unified qEEG Workstation, Neural Network DB & 4 Startup Pillars
// ---------------------------------------------------------------------------

export type ClinicalCategory =
  | 'VASCULAR_STROKE'
  | 'EPILEPSY_ICU'
  | 'SLEEP_COGNITIVE'
  | 'HARDWARE_BCI';

export type NeuralLabel =
  | 'CONTROL'
  | 'ISCHEMIC_STROKE'
  | 'HEMORRHAGIC_STROKE'
  | 'EPILEPTIFORM_SLOWING'
  | 'COGNITIVE_FATIGUE';

export type DatasetSplit = 'TRAIN' | 'VALIDATION' | 'TEST' | 'EXTERNAL_HOLDOUT';

export type ConsultationStatus = 'OPEN' | 'CLAIMED' | 'ANSWERED' | 'ACCEPTED' | 'CANCELLED';

export type WorkBlockType =
  | 'DEEP_WORK'
  | 'LIGHT_ADMIN'
  | 'NEURO_RECOVERY'
  | 'SLEEP_TARGET'
  | 'CLINICAL_CHECK';

export interface QeegCaseItem {
  id: string;
  name: string;
  subjectId: string;
  clinicalCategory: ClinicalCategory;
  groundTruthLabel: NeuralLabel;
  clinicalPresentation: string;
  trafficLight: 'green' | 'yellow' | 'red' | 'purple';
  tpaStatus: 'ELIGIBLE' | 'ABSOLUTELY_CONTRAINDICATED' | 'NOT_APPLICABLE' | 'MONITORING';
  badge: string;
  samplingRateHz: number;
  channelsCount: number;
}

export interface QeegTopomapNode {
  name: string;
  x: number;
  y: number;
  isPhysical: boolean;
  value: number;
  dar: number;
}

export interface QeegBandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
}

export interface QeegAnalysisResult {
  status: 'SUCCESS';
  engineSource: 'python_qeeg_service' | 'ts_dsp_fallback';
  caseId: string;
  clinicalCategory: ClinicalCategory;
  classificationLabel: NeuralLabel;
  classificationTitle: string;
  trafficLight: 'green' | 'yellow' | 'red' | 'purple';
  tpaBadge: string;
  tpaCountdownMin: number;
  safetyStatus: string;
  decisionReason: string;
  latencyMs: number;
  samplingRateHz: number;
  channelsCount: number;
  montage: string;
  biomarkers: {
    meanDar: number;
    meanTar: number;
    meanBsi: number;
    pri: number;
    wpli: number;
    alphaPeakHz: number;
    signalQualityScore: number;
    cusumAlarm: boolean;
    tpaLockoutTriggered: boolean;
  };
  bandPowers: QeegBandPowers;
  probabilities: {
    control: number;
    ischemic: number;
    hemorrhagic: number;
    epileptiform: number;
    cognitiveFatigue: number;
  };
  featureVector80: number[];
  waveforms: {
    time: number[];
    channels: string[];
    raw: Record<string, number[]>;
    filtered: Record<string, number[]>;
  };
  topomap: QeegTopomapNode[];
  telemetryQr: string;
}

export interface NeuralTrainingSampleItem {
  id: string;
  datasetId: string | null;
  uploaderId: string;
  subjectCode: string;
  clinicalCategory: ClinicalCategory;
  groundTruthLabel: NeuralLabel;
  split: DatasetSplit;
  samplingRateHz: number;
  channelsCount: number;
  montage: string;
  signalQualityScore: number;
  dar: number;
  bsi: number;
  tar: number;
  pri: number;
  wpli: number;
  tpaLockoutTriggered: boolean;
  spectralBands: QeegBandPowers;
  featureVector: number[];
  waveformPreview: {
    time: number[];
    channels: string[];
    filtered: Record<string, number[]>;
  };
  verifiedById: string | null;
  deidentifiedConfirmed: boolean;
  createdAt: string;
  uploader?: UserSummary;
  verifiedBy?: UserSummary | null;
}

export interface NeuralDbStats {
  totalSamples: number;
  verifiedSamples: number;
  byLabel: Record<NeuralLabel, number>;
  byCategory: Record<ClinicalCategory, number>;
  bySplit: Record<DatasetSplit, number>;
  averages: {
    dar: number;
    bsi: number;
    tar: number;
    wpli: number;
  };
}

export interface DataBankListingItem {
  id: string;
  authorId: string;
  datasetId: string | null;
  title: string;
  summary: string;
  clinicalCategory: ClinicalCategory;
  methodologyNote: string;
  sampleCount: number;
  channelsSpec: string;
  samplingRateHz: number;
  priceCredits: number;
  downloadsCount: number;
  previewMetrics: {
    meanDar: number;
    meanBsi: number;
    meanTar: number;
    meanWpli: number;
    dominantBand: string;
  };
  hasAccess: boolean;
  isAuthor: boolean;
  payloadCsv?: string | null;
  createdAt: string;
  updatedAt: string;
  author: UserSummary;
}

export interface ConsultationReplyItem {
  id: string;
  ticketId: string;
  responderId: string;
  responderTier: string;
  waveAnalysisText: string;
  clinicalGuidanceText: string;
  recommendedFollowUp: string;
  rating: number | null;
  isAccepted: boolean;
  createdAt: string;
  responder: UserSummary;
}

export interface ConsultationTicketItem {
  id: string;
  requesterId: string;
  claimedById: string | null;
  datasetId: string | null;
  neuralSampleId: string | null;
  title: string;
  symptomSummary: string;
  clinicalCategory: ClinicalCategory;
  bountyCredits: number;
  urgentRedFlag: boolean;
  status: ConsultationStatus;
  acceptedReplyId: string | null;
  createdAt: string;
  updatedAt: string;
  requester: UserSummary;
  claimedBy: UserSummary | null;
  neuralSample: NeuralTrainingSampleItem | null;
  replies: ConsultationReplyItem[];
}

export interface HealthCheckInItem {
  id: string;
  userId: string;
  neuralSampleId: string | null;
  recordedDate: string;
  focusScore: number;
  fatigueIndexTar: number;
  hemisphericBsi: number;
  alphaPeakHz: number;
  sleepHours: number;
  stressLevel: number;
  notes: string;
  createdAt: string;
}

export interface WorkingPlanBlockItem {
  id: string;
  userId: string;
  dayOfWeek: string;
  timeSlot: string;
  title: string;
  blockType: WorkBlockType;
  eegRationale: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommunitySpotlightProfessional {
  user: UserSummary & {
    bio: string | null;
    specialty: string;
    institution: string | null;
  };
  metrics: {
    publicPostsCount: number;
    totalLikesReceived: number;
    followersCount: number;
    consultationsCompleted: number;
    dataBankListingsCount: number;
    dataBankDownloads: number;
    impactScore: number;
  };
}

// ---------------------------------------------------------------------------
// Hardware IoT Devices, Telemetry, Alerts & Node-RED Gateway
// ---------------------------------------------------------------------------

export type DeviceStatus = 'OFFLINE' | 'ONLINE' | 'STREAMING' | 'ALERT';
export type DeviceAlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type DeviceSimulationScenario = 'normal' | 'stroke_alert' | 'low_battery';

export interface HardwareDeviceItem {
  id: string;
  ownerId: string;
  deviceCode: string;
  name: string;
  model: string;
  firmwareVersion: string;
  montage: string;
  sampleRateSps: number;
  pgaGain: number;
  apiKeyPrefix: string;
  status: DeviceStatus;
  connectionSource: string;
  ipAddress: string | null;
  lastSeenAt: string | null;
  lastBatteryMv: number | null;
  lastBatteryPct: number | null;
  lastAiState: string | null;
  lastAiRfProb: number | null;
  lastAiBsi: number | null;
  lastAiDar: number | null;
  lastLeadOffMask: number | null;
  sdRecording: boolean;
  isWsConnected?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTelemetryPoint {
  id: string;
  deviceId: string;
  mode: string;
  rateSps: number;
  pga: number;
  actualSps: number | null;
  vbatMv: number;
  batPct: number;
  usbOnly: boolean;
  sdRec: boolean;
  markers: number;
  loffMask: number;
  aiState: string;
  aiRfProb: number | null;
  aiLrProb: number | null;
  aiBsi: number | null;
  aiDar: number | null;
  aiUsableCh: number | null;
  source: string;
  recordedAt: string;
}

export interface DeviceAlertItem {
  id: string;
  deviceId: string;
  severity: DeviceAlertSeverity;
  code: string;
  message: string;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  device?: {
    id: string;
    deviceCode: string;
    name: string;
  };
}

export interface DeviceRecordingSessionItem {
  id: string;
  deviceId: string;
  ownerId: string;
  title: string;
  montage: string;
  sampleRateSps: number;
  channelNames: string[];
  sampleCount: number;
  durationSec: number;
  csvSummary?: string | null;
  qeegResultJson: Record<string, unknown> | null;
  startedAt: string;
  endedAt: string | null;
  device?: {
    id: string;
    deviceCode: string;
    name: string;
  };
}

export interface DeviceGatewayInfo {
  wsPath: string;
  nodeRedUrl: string;
  ingestPath: string;
}

export interface DevicesOverviewResponse {
  devices: HardwareDeviceItem[];
  alerts: DeviceAlertItem[];
  sessions: DeviceRecordingSessionItem[];
  gateway: DeviceGatewayInfo;
}

export interface DeviceWaveformEventPayload {
  deviceId?: string;
  deviceCode?: string;
  sampleRateSps?: number;
  channels?: string[];
  samples?: number[][];
}

export interface DeviceRealtimeEventDetail {
  type: 'device:waveform' | 'device:telemetry' | 'device:alert' | 'device:session';
  payload: Record<string, unknown>;
}




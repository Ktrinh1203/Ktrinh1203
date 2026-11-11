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
    | 'REWARD_UPDATE';
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
  | 'REFUND';

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
  walletId: string;
  amount: number;
  type: CreditTransactionType;
  referenceId: string | null;
  idempotencyKey: string | null;
  description: string;
  actorId: string | null;
  createdAt: string;
}

export interface CreditWalletItem {
  id: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: string;
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


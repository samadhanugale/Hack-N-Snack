export type UserRole = 'SME' | 'ADMIN';
export type McqStatus =
  | 'DRAFT'
  | 'READY_FOR_REVIEW'
  | 'UNDER_REVIEW'
  | 'MODIFICATION_REQUESTED'
  | 'APPROVED'
  | 'REJECTED';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface ApiResponse<T> {
  success: boolean;
  message: string | null;
  data: T;
  timestamp: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  tokenType: string;
  userId: number;
  enterpriseId: string;
  fullName: string;
  email: string;
  role: UserRole;
  expiresIn: number;
}

export interface LoginRequest {
  enterpriseId: string;
  password: string;
}

export interface StackSummary {
  id: number;
  stackName: string;
}

export interface TopicResponse {
  id: number;
  stackId: number;
  stackName: string;
  topicName: string;
}

export interface McqResponse {
  id: number;
  questionStem: string;
  options: string[];
  correctOptionIndices: number[];
  difficulty: Difficulty;
  stackId: number;
  stackName: string;
  topicId: number;
  topicName: string;
  status: McqStatus;
  creatorId: number;
  creatorName: string;
  reviewerId: number | null;
  reviewerName: string | null;
  reviewerComments: string | null;
  aiSimilarityScore: number | null;
  createdAt: string;
  updatedAt: string;
  assignedAt?: string | null;
}

export interface McqRequest {
  questionStem: string;
  options: string[];
  correctOptionIndices: number[];
  difficulty: Difficulty;
  stackId: number;
  topicId: number;
}

export interface ReviewRequest {
  decision: 'APPROVED' | 'REJECTED' | 'MODIFICATION_REQUESTED';
  comments?: string;
}

export interface AssignReviewerRequest {
  reviewerId: number;
}

export interface BulkAssignRequest {
  questionIds: number[];
  reviewerId: number;
}

export interface BulkAssignResponse {
  assigned: number;
  skipped: number;
  skippedReasons: string[];
}

export interface DashboardStats {
  totalQuestions: number;
  draftCount: number;
  readyForReviewCount: number;
  underReviewCount: number;
  modificationRequestedCount: number;
  approvedCount: number;
  rejectedCount: number;
  pendingReviewCount: number;
  assignedToMeCount?: number;
  reviewedByMeCount?: number;
  approvedByMeCount?: number;
  rejectedByMeCount?: number;
}

export interface SmeUserResponse {
  id: number;
  enterpriseId: string;
  fullName: string;
  email: string;
  active: boolean;
  stacks: StackSummary[];
  totalQuestions: number;
  approvedQuestions: number;
}

// ── Super-admin user management ───────────────────────────────────────────────

export interface AdminUser {
  id: number;
  enterpriseId: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  stacks: StackSummary[];
  totalQuestions: number;
  approvedQuestions: number;
  reviewedQuestions: number;
  createdAt: string;
}

export interface CreateUserRequest {
  enterpriseId: string;
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  stackIds?: number[];
}

export interface UpdateUserRequest {
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  stackIds?: number[];
}

export interface BulkRowDuplicate {
  rowNumber: number;
  questionStem: string;
  similarityPercent: number;
  matchedId: number;
  matchedStem: string;
  matchedStatus: McqStatus;
}

export interface BulkUploadResponse {
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: string[];
  duplicates: BulkRowDuplicate[] | null;
}

export interface TopicDetail {
  id: number;
  topicName: string;
  active: boolean;
}

export interface StackDetail {
  id: number;
  stackName: string;
  description: string | null;
  active: boolean;
  topics: TopicDetail[];
}

export interface StackRequest {
  stackName: string;
  description?: string;
}

export interface TopicRequest {
  topicName: string;
}

export interface AiGenerateRequest {
  stackId: number;
  topicId: number;
  difficulty: Difficulty;
  topicContext: string;
  count: number;
}

export interface DuplicateCheckRequest {
  stackId: number;
  topicId: number;
  questionStem: string;
  options: string[];
  excludeId?: number | null;
}

export interface SimilarQuestion {
  id: number;
  questionStem: string;
  stackName: string;
  topicName: string;
  status: McqStatus;
  similarityPercent: number;
}

export interface DuplicateCheckResponse {
  duplicate: boolean;
  maxSimilarityPercent: number;
  thresholdPercent: number;
  similar: SimilarQuestion[];
}

// ── Notifications ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'REVIEW_ASSIGNED'
  | 'QUESTION_APPROVED'
  | 'QUESTION_REJECTED'
  | 'MODIFICATION_REQUESTED'
  | 'QUESTION_SUBMITTED';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  questionId: number | null;
  read: boolean;
  createdAt: string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface WeeklyCount {
  week: string;
  count: number;
}

export interface AnalyticsOverview {
  byStatus: Record<string, number>;
  byStack: Record<string, number>;
  byDifficulty: Record<string, number>;
  weeklyTrend: WeeklyCount[];
}

export interface ReviewerWorkload {
  reviewerName: string;
  pendingCount: number;
}

/** Optional ISO date (yyyy-MM-dd) bounds for analytics queries. */
export interface AnalyticsDateRange {
  startDate?: string | null;
  endDate?: string | null;
}

/** Per-SME performance report (Story 2.1). */
export interface SmeReport {
  smeId: number;
  smeName: string;
  authoredCount: number;
  reviewedCount: number;
  approvedCount: number;
  rejectedCount: number;
  modificationRequestedCount: number;
  approvalRate: number;
  avgTurnaroundHours: number | null;
  pendingCount: number;
}

/** Question-performance analytics over a date range (Story 2.2). */
export interface QuestionAnalytics {
  total: number;
  byStatus: Record<string, number>;
  byStack: Record<string, number>;
  byDifficulty: Record<string, number>;
  approvedCount: number;
  rejectedCount: number;
  approvalRate: number;
  avgSimilarityPercent: number | null;
}

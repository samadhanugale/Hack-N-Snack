export type UserRole = 'SME' | 'ADMIN';
export type McqStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
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
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
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
}

export interface McqRequest {
  questionStem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  difficulty: Difficulty;
  stackId: number;
  topicId: number;
}

export interface ReviewRequest {
  decision: 'APPROVED' | 'REJECTED';
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
  approvedCount: number;
  rejectedCount: number;
  pendingReviewCount: number;
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

export interface BulkUploadResponse {
  totalRows: number;
  successCount: number;
  failureCount: number;
  errors: string[];
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
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
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

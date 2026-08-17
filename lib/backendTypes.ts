import type {
  ExperienceFamiliarity,
  ExperienceNodeCategory,
  ExperiencePolarity,
  ExperienceRelation,
} from "./experienceOntology";

export type ExperienceGraphNodeRecord = {
  id: string;
  memoryId?: string;
  personReferenceId?: string;
  ownerUserId?: string;
  sourceType: "memory" | "connection";
  occurrenceCount?: number;
  linkedUserId?: string;
  connectionId?: string;
  inviteStatus?: "pending";
  category: ExperienceNodeCategory;
  subtype: string;
  kind: string;
  label: string;
  description: string;
  certainty: "fact" | "hypothesis";
  confidence: number;
  salience: number;
  evidence: string;
  createdAt: number;
};

export type ExperienceGraphEdgeRecord = {
  id: string;
  memoryId: string;
  fromNodeId: string;
  toNodeId: string;
  relation: ExperienceRelation;
  polarity: ExperiencePolarity;
  familiarity: ExperienceFamiliarity;
  strength: number;
  certainty: "fact" | "hypothesis";
  createdAt: number;
};

export type ExperienceGraphRecord = {
  memoryCount: number;
  onboardingStep?: OnboardingStep;
  nodes: ExperienceGraphNodeRecord[];
  edges: ExperienceGraphEdgeRecord[];
};

export type OnboardingStep =
  | "needs_memory_invite"
  | "awaiting_memory"
  | "memory_ready";

export type ChapterConnectionRecord = {
  id: string;
  nodeId?: string;
  name: string;
  connectedAt: number;
};

export type PendingConnectionInviteRecord = {
  id: string;
  nodeId: string;
  name: string;
  createdAt: number;
  expiresAt: number;
};

export type MyConnectionsRecord = {
  accepted: ChapterConnectionRecord[];
  pending: PendingConnectionInviteRecord[];
};

export type ConnectionInvitePreview = {
  status: "pending" | "accepted" | "expired" | "unavailable";
  inviterName?: string;
  invitedName?: string;
  expiresAt?: number;
};

export type CreatedConnectionInvite = {
  inviteId: string;
  token: string;
  invitedName: string;
  expiresAt: number;
};

export type AcceptedConnectionInvite = {
  connected: true;
  connectionId: string;
  friendName?: string;
};

export type ConversationChannel = "imessage" | "web";
export type ConversationDeliveryStatus = "pending" | "sent";

export type ConversationMessageRecord = {
  id: string;
  role: "user" | "agent";
  text: string;
  channel: ConversationChannel;
  deliveryStatus: ConversationDeliveryStatus;
  createdAt: number;
};

export type MyConversationRecord = {
  messages: ConversationMessageRecord[];
};

export type ChatReplyResult = {
  reply: string | null;
  replyId?: string;
  duplicate?: boolean;
};

export type GoalStatus = 'active' | 'paused' | 'complete';

export interface Goal {
  id: string;
  title: string;
  status: GoalStatus;
  tags: string[];
  confidence: number;
}

export interface LogEntry {
  date: string;
  summary: string;
  completed: string[];
  blocked: string[];
  energy: number;
  focus: number;
  tags: string[];
}

export interface Gap {
  goalId: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  reasons: string[];
  lastSeen: string | null;
}

export interface DriftScore {
  score: number;
  velocity: number;
  trend: 'stable' | 'rising' | 'critical';
  explanation: string;
}

export interface DecomposedAction {
  goalId: string;
  action: string;
  confidence: number;
}

export interface GoalConflict {
  goalIds: [string, string];
  reason: string;
}

export interface ClaudeDecision {
  provider: 'groq' | 'local-fallback';
  summary: string;
  message: string;
  nextActions: string[];
  confidence: number;
  recoveryMode: boolean;
}

export interface RepoInsight {
  status: 'available' | 'missing-config';
  summary: string;
  commits: string[];
}

export interface MeetingInsight {
  status: 'available' | 'missing-config';
  summary: string;
  upcoming: string[];
}

export interface ResearchDigest {
  status: 'available' | 'missing-config';
  summary: string;
  papers: string[];
}

export interface DeliveryResult {
  provider: 'whatsapp' | 'telegram' | 'dry-run';
  delivered: boolean;
  detail: string;
}

export interface VaultSnapshot {
  goals: Goal[];
  logs: LogEntry[];
  behavior: string;
  fingerprint: string;
  interventions: string;
}

export interface HeartbeatResult {
  timestamp: string;
  gaps: Gap[];
  drift: DriftScore;
  repoInsight: RepoInsight;
  meetingInsight: MeetingInsight;
  researchDigest: ResearchDigest;
  decision: ClaudeDecision;
  delivery: DeliveryResult;
  decisionPath: string;
  restartCardPath: string | null;
}

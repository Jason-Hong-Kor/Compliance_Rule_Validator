export type Product = 'jira' | 'confluence';

export type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';

/** Confluence 위반 시 강제 수준. Jira 동기 차단 경로에서는 사용하지 않는다. */
export type EnforcementMode = 'advisory' | 'gate' | 'revert';

/**
 * Jira 사후 검증(생성·칸반 우회)에서 위반을 누구에게 알릴지.
 * 알림 본문에는 원문 인용(evidence)을 넣지 않는다.
 */
export interface JiraNotifySettings {
  /** 비동기 검증 FAIL 시 알림을 보낼지. 기본 true. */
  enabled: boolean;
  /** 이슈 작성자(reporter)에게 알릴지. */
  notifyReporter: boolean;
  /** 추가로 알릴 Jira 그룹 이름. 비어 있으면 그룹 알림 없음. */
  groupName: string;
  /** 이메일도 보낼지. in-app(코멘트 멘션)과 별개이며 사용자 알림 설정에 의존한다. */
  email: boolean;
  /**
   * 이슈 화면에 결과를 일반 필드로 보여 줄 때 쓰는 커스텀 필드 ID.
   * 비어 있으면 쓰지 않는다. 텍스트/문단 필드만 지원한다.
   */
  statusFieldId: string;
  /** 설정 화면에 보여 줄 필드 이름. */
  statusFieldName: string;
}

/** LLM 호출이 실패하거나 타임아웃했을 때의 처리 방침. */
export type FailPolicy = 'fail-open' | 'fail-closed';

/**
 * Gemini 2.5 계열은 신규 사용자에게 더 이상 제공되지 않고, 3.6 세대에는 Pro가 없다.
 * 그래서 현재는 Flash 단일 구성이며, 유니온 타입은 모델이 늘어날 때의 확장 지점으로 남긴다.
 */
export type GeminiModel = 'gemini-3.6-flash';

export type RulebookSourceType = 'page' | 'folder' | 'space';

export interface RulebookSource {
  type: RulebookSourceType;
  /** page/folder는 콘텐츠 ID, space는 스페이스 키. */
  id: string;
  title: string;
  /** 조상 제목 체인. 트리 UI 없이 동명 항목을 구분하기 위한 표시용. */
  path?: string;
  /** page 선택 시 하위 트리 포함 여부. folder/space는 항상 순회한다. */
  includeChildren: boolean;
}

export interface AppSettings {
  provider: 'gemini';
  model: GeminiModel;
  rulebooks: RulebookSource[];
  /** Confluence 전용. Jira 설정에서는 무시된다. */
  enforcementMode: EnforcementMode;
  failPolicy: FailPolicy;
  /** 이 등급 이상만 차단 대상으로 본다. */
  severityThreshold: Severity;
  /** Jira 전용. Confluence 설정에서는 저장되어도 사용하지 않는다. */
  jiraNotify: JiraNotifySettings;
}

export interface Violation {
  ruleId: string;
  ruleTitle: string;
  severity: Severity;
  /** 위반으로 판단한 근거가 된 원문 인용. */
  evidence: string;
  reason: string;
  guideline: string;
}

export type VerdictStatus = 'PASS' | 'FAIL' | 'ERROR';

export interface ValidationVerdict {
  verdict: VerdictStatus;
  violations: Violation[];
  /** severityThreshold를 넘어 실제 차단 사유가 된 위반만 추린 목록. */
  blockingViolations: Violation[];
  model: string;
  rulebookHash: string;
  evaluatedAt: string;
  latencyMs: number;
  errorReason?: string;
  /** 검증 대상 텍스트를 수집하지 못한 필드가 있으면 기록한다. */
  warnings?: string[];
}

/** LLM에 전달할 검증 대상 텍스트 조각. 필드가 늘어나도 프롬프트 로직이 변하지 않도록 배열로 다룬다. */
export interface TargetSection {
  label: string;
  text: string;
}

export interface TargetPayload {
  kind: 'jira-issue' | 'confluence-page';
  /** 이슈 키 또는 페이지 ID. 생성 전환처럼 식별자가 없을 수 있다. */
  reference?: string;
  sections: TargetSection[];
  warnings: string[];
}

export interface RulebookPageRef {
  id: string;
  title: string;
}

export interface RulebookBundle {
  text: string;
  hash: string;
  pages: RulebookPageRef[];
  charCount: number;
  truncated: boolean;
  builtAt: string;
  /** 수집 중 접근 실패한 소스 등의 경고. */
  warnings: string[];
}

export interface RulebookCandidate {
  id: string;
  title: string;
  type: RulebookSourceType;
  path?: string;
}

export type EnforcementAction =
  | 'blocked'
  | 'commented'
  | 'flagged'
  | 'reverted'
  | 'revert-skipped'
  | 'allowed'
  | 'skipped'
  | 'notified';

export type JiraValidationSource = 'sync-validator' | 'async-event';

export interface AuditEntry {
  at: string;
  product: Product;
  targetKind: TargetPayload['kind'];
  targetRef: string;
  actorAccountId?: string;
  verdict: VerdictStatus;
  violationCount: number;
  blockingViolationCount: number;
  ruleIds: string[];
  action: EnforcementAction;
  model: string;
  rulebookHash: string;
  latencyMs: number;
  errorReason?: string;
}

/** Confluence 페이지에 대한 최종 처리 결과. 바이라인 배지와 상세 모달이 이 값을 읽는다. */
export interface PageComplianceRecord {
  pageId: string;
  pageVersion: number;
  verdict: ValidationVerdict;
  action: EnforcementAction;
  enforcementMode: EnforcementMode;
  /** revert 모드에서 복원한 대상 버전. */
  restoredToVersion?: number;
}

export interface IssueComplianceRecord {
  issueKey: string;
  verdict: ValidationVerdict;
  action: EnforcementAction;
  transitionTo?: string;
  source?: JiraValidationSource;
  contentHash?: string;
  notified?: {
    inApp: boolean;
    email: boolean;
    at: string;
  };
}

/** jira:workflowValidator 람다에 전달되는 페이로드. */
export interface WorkflowValidatorEvent {
  issue?: {
    key?: string;
    id?: string;
  };
  configuration?: Record<string, unknown>;
  transition?: {
    from?: { id?: string };
    to?: { id?: string };
    /**
     * 전환 화면에서 변경된 필드의 최신 값.
     * 주의: 지원 필드 목록에 summary가 없으므로 요약은 REST API로 별도 조회해야 한다.
     */
    modifiedFields?: Record<string, unknown>;
  };
}

export interface WorkflowValidatorResult {
  result: boolean;
  errorMessage?: string;
}

/** 비동기 큐에 넣는 Confluence 작업. */
export interface PageValidationJob {
  kind: 'page';
  pageId: string;
  version: number;
  title: string;
  spaceKey?: string;
  actorAccountId?: string;
  [key: string]: unknown;
}

/** 비동기 큐에 넣는 Jira 사후 검증 작업. */
export interface IssueValidationJob {
  kind: 'issue';
  issueKey: string;
  eventType: string;
  actorAccountId?: string;
  [key: string]: unknown;
}

export interface JiraChangelogItem {
  field?: string;
  fieldId?: string;
  fieldtype?: string;
}

/** Forge `avi:jira:created:issue` / `updated:issue` 페이로드의 사용 필드. */
export interface JiraIssueProductEvent {
  eventType?: string;
  selfGenerated?: boolean;
  atlassianId?: string;
  issue?: {
    id?: string;
    key?: string;
  };
  changelog?: {
    items?: JiraChangelogItem[];
  };
}

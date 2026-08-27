import type { AppSettings, GeminiModel, Severity } from './types';

/**
 * jira:workflowValidator는 사용자 주도 호출이라 Forge 함수 실행 한도가 25초다.
 * (55초는 web-trigger/action 계열에만 적용된다.)
 * 응답 처리와 실패 경로에 쓸 시간을 남기기 위해 LLM 호출 자체는 그보다 짧게 끊는다.
 */
export const SYNC_LLM_TIMEOUT_MS = 18_000;

/** 비동기 소비자는 timeoutSeconds로 확장되어 있어 여유가 있다. */
export const ASYNC_LLM_TIMEOUT_MS = 120_000;

/** 룰북 병합 본문 상한. 초과분은 잘라내고 경고를 남긴다. */
export const MAX_RULEBOOK_CHARS = 60_000;

/** 검증 대상 텍스트 상한. */
export const MAX_TARGET_CHARS = 8_000;

/** 룰북 수집 시 순회할 최대 페이지 수. 거대한 스페이스에서 폭주하는 것을 막는다. */
export const MAX_RULEBOOK_PAGES = 100;

/** 폴더/페이지 하위 순회 깊이. */
export const MAX_DESCENDANT_DEPTH = 5;

export const RULEBOOK_CACHE_TTL_SECONDS = 24 * 60 * 60;

export const AUDIT_TTL_SECONDS = 90 * 24 * 60 * 60;

export const QUEUE_NAME = 'compliance-validation';

/** 동일 본문·룰북 조합에 대한 LLM 재호출을 막는 캐시 수명. */
export const EVALUATION_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/** 같은 이슈의 생성+칸반 이벤트가 동시에 들어올 때 이중 검증을 줄이는 잠금. */
export const ISSUE_EVAL_LOCK_TTL_SECONDS = 180;

export const SECRET_KEY_GEMINI = 'secret:gemini:apiKey';

export const ISSUE_PROPERTY_KEY = 'compliance-rule-validator';

export const GEMINI_MODELS: GeminiModel[] = ['gemini-3.6-flash'];

/**
 * 동기 경로(25초 예산)에서 허용하는 모델.
 * 현재 선택 가능한 모델이 하나뿐이어서 결과적으로는 동일하지만, 지연이 큰 모델이 목록에
 * 추가되더라도 동기 경로가 그것을 집어들지 않도록 강제 지점을 유지한다.
 */
export const SYNC_ALLOWED_MODEL: GeminiModel = 'gemini-3.6-flash';

export const SEVERITY_ORDER: Record<Severity, number> = {
  MINOR: 1,
  MAJOR: 2,
  CRITICAL: 3,
};

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  model: 'gemini-3.6-flash',
  rulebooks: [],
  // 도입 초기에 사용자 작업을 잃게 만들지 않도록 가장 약한 모드에서 시작한다.
  enforcementMode: 'advisory',
  // LLM 장애가 업무 중단으로 번지지 않도록 기본은 통과시키고 기록만 남긴다.
  failPolicy: 'fail-open',
  severityThreshold: 'MAJOR',
  jiraNotify: {
    enabled: true,
    notifyReporter: true,
    groupName: '',
    email: false,
    statusFieldId: '',
    statusFieldName: '',
  },
};

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Jira 워크플로우 오류 메시지에 넣을 수 있는 실질적 길이 상한. */
export const MAX_ERROR_MESSAGE_CHARS = 1_500;

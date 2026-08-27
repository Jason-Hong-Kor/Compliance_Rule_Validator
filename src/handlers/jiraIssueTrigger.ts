import { enqueueJiraIssueJob } from '../services/jiraIssueQueue';
import type { IssueValidationJob, JiraChangelogItem, JiraIssueProductEvent } from '../types';

/**
 * 본문(요약·설명)이나 상태가 바뀐 업데이트만 검증한다.
 * 라벨·담당자·프로퍼티만 바뀐 이벤트까지 LLM을 부르면 비용만 늘고,
 * 앱이 남긴 코멘트가 ignoreSelf를 뚫고 들어와도 여기서 걸러진다.
 *
 * 상태 변경을 포함하는 이유: 칸반 DnD는 본문 없이 전환만 일어나며,
 * Create 직후 아직 사후 검증이 끝나지 않았거나 validator가 보드에서
 * 건너뛰어졌을 때의 안전망이다. 본문이 이미 평가됐으면 소비자가 캐시로 스킵한다.
 */
const RELEVANT_FIELDS = new Set(['summary', 'description', 'status']);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Forge는 트리거 함수에 제품 이벤트를 그대로 주기도 하고, `{ payload }`로 한 겹 감싸기도 한다.
 * eventType은 페이로드가 아니라 두 번째 인자(context)에만 있는 경우가 있다.
 */
function unwrapEvent(raw: unknown): JiraIssueProductEvent {
  const root = asRecord(raw) ?? {};
  const nested = asRecord(root.payload);
  if (nested && (nested.issue || nested.eventType) && !root.issue) {
    return nested as JiraIssueProductEvent;
  }
  return root as JiraIssueProductEvent;
}

function extractIssueKey(event: JiraIssueProductEvent): string | undefined {
  const issue = asRecord(event.issue);
  const key = issue?.key;
  if (typeof key === 'string' && key.length > 0) return key;
  const id = issue?.id;
  if (typeof id === 'string' && id.length > 0) return id;
  return undefined;
}

function extractEventType(event: JiraIssueProductEvent, context: unknown): string {
  const fromEvent = event.eventType;
  if (typeof fromEvent === 'string' && fromEvent.length > 0) return fromEvent;
  const ctx = asRecord(context);
  const fromContext = ctx?.eventType ?? ctx?.type;
  if (typeof fromContext === 'string' && fromContext.length > 0) return fromContext;
  return '';
}

function fieldName(item: JiraChangelogItem): string {
  return (item.fieldId ?? item.field ?? '').trim().toLowerCase();
}

function changelogItems(event: JiraIssueProductEvent): JiraChangelogItem[] {
  const changelog = asRecord(event.changelog);
  const items = changelog?.items;
  return Array.isArray(items) ? (items as JiraChangelogItem[]) : [];
}

function shouldEnqueue(event: JiraIssueProductEvent, eventType: string): boolean {
  const created = !eventType || eventType.includes(':created:');
  const items = changelogItems(event);
  const relevant = items.some((item) => RELEVANT_FIELDS.has(fieldName(item)));

  // Create 전환에 이 앱 validator가 있으면 이어지는 created:issue가
  // selfGenerated=true로 올 수 있다. 그 이벤트를 버리면 사후 검증이 영원히 안 돈다.
  if (event.selfGenerated && !created) {
    if (items.length === 0) return false;
    return relevant;
  }

  if (created) return true;
  if (!eventType.includes(':updated:')) return true;
  if (items.length === 0) return true;
  return relevant;
}

/**
 * 이슈 생성/수정 이벤트를 비동기 큐로 넘긴다.
 *
 * 트리거 함수는 짧은 한도에서 돌므로 여기서 LLM을 호출하지 않는다.
 * 실제 검증은 timeoutSeconds로 확장된 소비자가 수행한다.
 */
export const jiraIssueTrigger = async (rawEvent: unknown, context?: unknown): Promise<void> => {
  const event = unwrapEvent(rawEvent);
  const eventType = extractEventType(event, context);
  const issueKey = extractIssueKey(event);
  const changed = changelogItems(event).map(fieldName).filter(Boolean);

  console.log(
    `[jiraIssueTrigger] 수신 issueKey=${issueKey ?? '(없음)'} eventType=${eventType || '(없음)'} ` +
      `selfGenerated=${event.selfGenerated === true} changelog=[${changed.join(',')}] ` +
      `rootKeys=[${Object.keys(asRecord(rawEvent) ?? {}).join(',')}]`,
  );

  if (!issueKey) {
    console.warn('[jiraIssueTrigger] 이슈 키가 없어 건너뜁니다.');
    return;
  }

  // Create는 후처리와 트리거가 동시에 큐에 들어가 댓글·메일이 두 번 나간다.
  const created = eventType.includes(':created:');
  if (created) {
    console.log(
      `[jiraIssueTrigger] Create는 워크플로우 후처리가 담당하므로 건너뜁니다 issueKey=${issueKey}`,
    );
    return;
  }

  if (!shouldEnqueue(event, eventType)) {
    console.log(`[jiraIssueTrigger] 본문/상태 변경이 아니라 건너뜁니다 issueKey=${issueKey}`);
    return;
  }

  const job: IssueValidationJob = {
    kind: 'issue',
    issueKey,
    eventType: eventType || 'avi:jira:created:issue',
    actorAccountId: event.atlassianId,
  };

  await enqueueJiraIssueJob(job);
};

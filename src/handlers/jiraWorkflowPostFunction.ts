import { enqueueJiraIssueJob } from '../services/jiraIssueQueue';

interface WorkflowPostFunctionEvent {
  issue?: {
    key?: string;
    id?: string;
  };
  atlassianId?: string;
  transition?: {
    from?: { id?: string };
    to?: { id?: string };
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function unwrapEvent(raw: unknown): WorkflowPostFunctionEvent {
  const root = asRecord(raw) ?? {};
  const nested = asRecord(root.payload);
  if (nested && (nested.issue || nested.transition) && !root.issue) {
    return nested as WorkflowPostFunctionEvent;
  }
  return root as WorkflowPostFunctionEvent;
}

/**
 * 이슈가 저장된 뒤 실행된다. Create에서는 validator와 달리 issue.key가 있다.
 *
 * 이 사이트에서 avi:jira:created:issue 트리거는 핸들러가 호출되지 않아,
 * 생성 직후 검증은 이 후처리를 워크플로우 Create 전환에 등록하는 쪽으로 우회한다.
 */
export const jiraWorkflowPostFunction = async (rawEvent: unknown): Promise<void> => {
  const event = unwrapEvent(rawEvent);
  const issueKey = event.issue?.key ?? event.issue?.id;
  const from = event.transition?.from?.id ?? '(create)';
  const to = event.transition?.to?.id ?? '?';

  console.log(
    `[jiraPostFunction] 호출됨 issueKey=${issueKey ?? '(없음)'} from=${from} to=${to} ` +
      `eventKeys=[${Object.keys(asRecord(rawEvent) ?? {}).join(',')}]`,
  );

  if (!issueKey) {
    console.warn('[jiraPostFunction] 이슈 키가 없어 큐에 넣지 않습니다.');
    return;
  }

  await enqueueJiraIssueJob({
    kind: 'issue',
    issueKey,
    eventType: 'workflow-postfunction',
    actorAccountId: event.atlassianId,
  });
};

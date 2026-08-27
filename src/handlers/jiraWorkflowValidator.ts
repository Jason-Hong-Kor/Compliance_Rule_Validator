import type { WorkflowValidatorEvent, WorkflowValidatorResult } from '../types';
import {
  buildBlockMessage,
  buildErrorPolicyMessage,
} from '../services/enforcement/jiraEnforcer';
import { runJiraIssueValidation } from '../services/jiraIssueRunner';
import { resolveSettings } from '../services/settingsStore';
import { collectJiraTargetText } from '../services/targetCollector';

/**
 * Jira 동기 차단 지점.
 *
 * 사용자가 저장을 누른 뒤 이 함수의 응답을 기다리는 동안 화면이 멈춰 있고, Forge 함수 실행
 * 한도는 25초다. 따라서 여기서는 룰북을 수집하지 않고 캐시만 읽으며, LLM 호출은 18초에
 * 강제로 끊는다. 같은 본문을 비동기 경로가 이미 평가했다면 LLM을 건너뛰고 캐시로 차단/통과한다.
 *
 * `{ result: false }`를 반환하면 Jira가 전환을 실제로 거부한다. 생성 전환에 등록한 경우
 * 이슈가 아예 만들어지지 않는다 — 다만 Create는 본문이 오지 않아 미검증 통과한다 (spec 9.8).
 */
export const jiraWorkflowValidator = async (
  event: WorkflowValidatorEvent,
): Promise<WorkflowValidatorResult> => {
  const issueKey = event.issue?.key;
  const modifiedKeys = Object.keys(event.transition?.modifiedFields ?? {});
  console.log(
    `[workflowValidator] 호출됨 issueKey=${issueKey ?? '(없음)'} ` +
      `to=${event.transition?.to?.id ?? '?'} modifiedFields=[${modifiedKeys.join(',')}] ` +
      `eventKeys=[${Object.keys(event).join(',')}]`,
  );

  try {
    const settings = await resolveSettings('jira');
    const target = await collectJiraTargetText(event);
    const sectionSummary = target.sections
      .map((section) => `${section.label}:${section.text.trim().length}자`)
      .join(', ');
    console.log(
      `[workflowValidator] 설정 rulebooks=${settings.rulebooks.length} failPolicy=${settings.failPolicy} ` +
        `threshold=${settings.severityThreshold} | 대상 ${sectionSummary} | warnings=${target.warnings.length}`,
    );

    const { outcome, reused, action } = await runJiraIssueValidation({
      issueKey,
      target,
      settings,
      mode: 'sync',
      source: 'sync-validator',
      transitionTo: event.transition?.to?.id,
    });

    console.log(
      `[workflowValidator] 결과 verdict=${outcome.verdict.verdict} shouldBlock=${outcome.shouldBlock} ` +
        `action=${action} reused=${reused} violations=${outcome.verdict.violations.length} ` +
        `blocking=${outcome.verdict.blockingViolations.length} latencyMs=${outcome.verdict.latencyMs} ` +
        `error=${outcome.verdict.errorReason ?? '-'}`,
    );

    if (!outcome.shouldBlock) {
      return { result: true };
    }

    return {
      result: false,
      errorMessage:
        outcome.verdict.verdict === 'ERROR'
          ? buildErrorPolicyMessage(outcome.verdict)
          : buildBlockMessage(outcome.verdict),
    };
  } catch (error) {
    // 검증기 자체의 버그가 이슈 저장을 영구히 막는 상황을 만들지 않는다.
    // 사용자를 막는 것보다 미검증 통과를 로그로 남기는 편이 피해가 작다.
    console.error('[workflowValidator] 실행 실패 → fail-open 통과', error);
    return { result: true };
  }
};

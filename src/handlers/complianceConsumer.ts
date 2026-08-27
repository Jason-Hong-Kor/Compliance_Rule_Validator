import { fetchPage } from '../services/confluenceApi';
import { recordAudit } from '../services/auditLog';
import { enforceConfluence } from '../services/enforcement/confluenceEnforcer';
import {
  notifyJiraViolation,
  persistIssueVerdict,
} from '../services/enforcement/jiraEnforcer';
import { claimIssueNotify } from '../services/evaluationCache';
import { runJiraIssueValidation } from '../services/jiraIssueRunner';
import { resolveSettings } from '../services/settingsStore';
import { collectConfluenceTargetText, collectJiraIssueByKey } from '../services/targetCollector';
import { validate } from '../services/validationService';
import type { IssueValidationJob, PageValidationJob } from '../types';

interface QueueEvent {
  body?: PageValidationJob | IssueValidationJob | Record<string, unknown>;
  retryContext?: { retryCount?: number };
}

function isIssueJob(body: QueueEvent['body']): body is IssueValidationJob {
  return !!body && body.kind === 'issue' && typeof body.issueKey === 'string';
}

function isPageJob(body: QueueEvent['body']): body is PageValidationJob {
  if (!body) return false;
  if (body.kind === 'issue') return false;
  return typeof body.pageId === 'string' && typeof body.version === 'number';
}

async function processIssueJob(job: IssueValidationJob): Promise<void> {
  const settings = await resolveSettings('jira');
  const target = await collectJiraIssueByKey(job.issueKey);
  if (!target) {
    console.warn(`이슈 ${job.issueKey}를 조회할 수 없어 사후 검증을 건너뜁니다.`);
    return;
  }

  const { outcome, reused, action, contentHash } = await runJiraIssueValidation({
    issueKey: job.issueKey,
    target,
    settings,
    mode: 'async',
    source: 'async-event',
    actorAccountId: job.actorAccountId,
    lock: true,
  });

  console.log(
    `[jiraAsync] ${job.issueKey} event=${job.eventType} verdict=${outcome.verdict.verdict} ` +
      `shouldBlock=${outcome.shouldBlock} reused=${reused} action=${action}`,
  );

  if (reused || !outcome.shouldBlock) return;

  if (!(await claimIssueNotify(job.issueKey, contentHash))) {
    console.log(`[jiraAsync] ${job.issueKey} 알림은 이미 보내 건너뜁니다`);
    return;
  }

  const channels = await notifyJiraViolation(job.issueKey, outcome.verdict, settings);
  const notifiedAction = channels.inApp || channels.email ? 'notified' : action;
  await persistIssueVerdict(job.issueKey, outcome.verdict, notifiedAction, undefined, {
    source: 'async-event',
    contentHash,
    notified: {
      inApp: channels.inApp,
      email: channels.email,
      at: new Date().toISOString(),
    },
  });
}

async function processPageJob(job: PageValidationJob): Promise<void> {
  const settings = await resolveSettings('confluence');
  const page = await fetchPage(job.pageId);
  const target = collectConfluenceTargetText(
    page.title ?? job.title,
    page.body?.storage?.value ?? '',
  );

  const outcome = await validate({
    product: 'confluence',
    mode: 'async',
    settings,
    target,
  });

  const record = await enforceConfluence(
    job.pageId,
    // 복원 대상 계산에는 이벤트 시점 버전이 아니라 실제 최신 버전을 써야 한다.
    page.version?.number ?? job.version,
    outcome.verdict,
    settings,
    outcome.shouldBlock,
  );

  await recordAudit({
    at: new Date().toISOString(),
    product: 'confluence',
    targetKind: 'confluence-page',
    targetRef: job.pageId,
    actorAccountId: job.actorAccountId,
    verdict: outcome.verdict.verdict,
    violationCount: outcome.verdict.violations.length,
    blockingViolationCount: outcome.verdict.blockingViolations.length,
    ruleIds: outcome.verdict.blockingViolations.map((violation) => violation.ruleId),
    action: record.action,
    model: outcome.verdict.model,
    rulebookHash: outcome.verdict.rulebookHash,
    latencyMs: outcome.verdict.latencyMs,
    errorReason: outcome.verdict.errorReason,
  });
}

/**
 * 비동기 검증 소비자.
 *
 * Confluence 출간과 Jira 생성·칸반 우회는 사전 차단이 없거나 불완전하므로,
 * 저장이 끝난 뒤 이 함수가 검증하고 알림·강제 조치를 수행한다.
 * timeoutSeconds로 실행 한도가 늘어나 있어 동기 경로와 달리 시간 압박이 없다.
 */
export const complianceConsumer = async (event: QueueEvent): Promise<void> => {
  const job = event.body;
  const jobRecord = job && typeof job === 'object' ? job : undefined;
  console.log(
    `[complianceConsumer] 수신 kind=${String(jobRecord?.kind ?? '(없음)')} ` +
      `issueKey=${String(jobRecord?.issueKey ?? '-')} pageId=${String(jobRecord?.pageId ?? '-')} ` +
      `keys=[${jobRecord ? Object.keys(jobRecord).join(',') : ''}]`,
  );

  if (!job) {
    console.warn('[complianceConsumer] 페이로드가 없는 큐 이벤트를 건너뜁니다.');
    return;
  }

  try {
    if (isIssueJob(job)) {
      await processIssueJob(job);
      return;
    }
    if (isPageJob(job)) {
      await processPageJob(job);
      return;
    }
    console.warn('알 수 없는 큐 페이로드를 건너뜁니다.', job);
  } catch (error) {
    const ref =
      isIssueJob(job) ? job.issueKey : isPageJob(job) ? job.pageId : '(unknown)';
    console.error(`비동기 검증 실패 (${ref})`, error);
    // 재시도 요청은 하지 않는다. LLM 판정은 비용이 들고, 실패가 반복되면 같은 비용을
    // 반복 지출하면서 사용자에게는 아무 값도 주지 못한다. 실패 사실은 로그로 남긴다.
  }
};

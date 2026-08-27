import type {
  AppSettings,
  EnforcementAction,
  IssueComplianceRecord,
  JiraValidationSource,
  TargetPayload,
} from '../types';
import { recordAudit } from './auditLog';
import {
  acquireIssueEvalLock,
  jiraContentHash,
  readCachedEvaluation,
  releaseIssueEvalLock,
  writeCachedEvaluation,
} from './evaluationCache';
import { persistIssueVerdict, writeComplianceStatusField } from './enforcement/jiraEnforcer';
import { getRulebook } from './rulebookService';
import { validate, type ValidationOutcome } from './validationService';

export interface JiraIssueRunResult {
  outcome: ValidationOutcome;
  reused: boolean;
  contentHash: string;
  action: EnforcementAction;
}

/**
 * Jira 이슈 한 건을 검증한다. 동기 validator와 비동기 소비자가 같은 캐시·기록을 쓴다.
 *
 * 캐시 히트면 LLM을 건너뛴다. 이미 FAIL로 판정된 본문은 전환 때 25초를 쓰지 않고
 * 바로 차단할 수 있고, 칸반 DnD로 updated:issue가 다시 와도 이중 과금이 나지 않는다.
 */
export async function runJiraIssueValidation(options: {
  issueKey: string | undefined;
  target: TargetPayload;
  settings: AppSettings;
  mode: 'sync' | 'async';
  source: JiraValidationSource;
  transitionTo?: string;
  actorAccountId?: string;
  lock?: boolean;
}): Promise<JiraIssueRunResult> {
  const { issueKey, target, settings, mode, source, transitionTo, actorAccountId } = options;
  const rulebook = await getRulebook('jira');
  const contentHash = jiraContentHash(target, rulebook.hash);

  let locked = false;
  if (options.lock && issueKey) {
    locked = await acquireIssueEvalLock(issueKey);
    if (!locked) {
      const cached = await readCachedEvaluation(issueKey, contentHash);
      if (cached) {
        return {
          outcome: { verdict: cached.verdict, shouldBlock: cached.shouldBlock },
          reused: true,
          contentHash,
          action: cached.shouldBlock
            ? source === 'sync-validator'
              ? 'blocked'
              : 'flagged'
            : 'allowed',
        };
      }
      // 잠금만 있고 캐시가 아직 없으면 다른 작업이 진행 중이다. 여기서 LLM을 또 부르지 않는다.
      console.log(`[jiraValidate] ${issueKey} 평가 잠금 중이라 건너뜁니다`);
      return {
        outcome: {
          verdict: {
            verdict: 'ERROR',
            violations: [],
            blockingViolations: [],
            model: settings.model,
            rulebookHash: rulebook.hash,
            evaluatedAt: new Date().toISOString(),
            latencyMs: 0,
            errorReason: '동일 이슈에 대한 검증이 이미 진행 중입니다.',
          },
          shouldBlock: false,
        },
        reused: true,
        contentHash,
        action: 'skipped',
      };
    }
  }

  try {
    let outcome: ValidationOutcome | undefined;
    let reused = false;

    if (issueKey) {
      const cached = await readCachedEvaluation(issueKey, contentHash);
      if (cached) {
        outcome = { verdict: cached.verdict, shouldBlock: cached.shouldBlock };
        reused = true;
        console.log(
          `[jiraValidate] ${issueKey} 캐시 재사용 verdict=${cached.verdict.verdict} shouldBlock=${cached.shouldBlock}`,
        );
      }
    }

    if (!outcome) {
      outcome = await validate({ product: 'jira', mode, settings, target });
      if (issueKey) {
        await writeCachedEvaluation(issueKey, contentHash, outcome.verdict, outcome.shouldBlock);
      }
    }

    const action: EnforcementAction = outcome.shouldBlock
      ? source === 'sync-validator'
        ? 'blocked'
        : 'flagged'
      : outcome.verdict.verdict === 'ERROR'
        ? 'skipped'
        : 'allowed';

    const record: Partial<IssueComplianceRecord> = { source, contentHash };
    await persistIssueVerdict(
      issueKey,
      outcome.verdict,
      action,
      transitionTo,
      record,
    );
    await writeComplianceStatusField(issueKey, outcome.verdict, outcome.shouldBlock, settings);

    if (!reused) {
      await recordAudit({
        at: new Date().toISOString(),
        product: 'jira',
        targetKind: 'jira-issue',
        targetRef: issueKey ?? '(생성 중인 이슈)',
        actorAccountId,
        verdict: outcome.verdict.verdict,
        violationCount: outcome.verdict.violations.length,
        blockingViolationCount: outcome.verdict.blockingViolations.length,
        ruleIds: outcome.verdict.blockingViolations.map((violation) => violation.ruleId),
        action,
        model: outcome.verdict.model,
        rulebookHash: outcome.verdict.rulebookHash,
        latencyMs: outcome.verdict.latencyMs,
        errorReason: outcome.verdict.errorReason,
      });
    }

    return { outcome, reused, contentHash, action };
  } finally {
    if (locked && issueKey) {
      await releaseIssueEvalLock(issueKey);
    }
  }
}

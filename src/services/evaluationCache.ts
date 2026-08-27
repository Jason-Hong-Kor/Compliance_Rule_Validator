import { kvs } from '@forge/kvs';

import { EVALUATION_CACHE_TTL_SECONDS, ISSUE_EVAL_LOCK_TTL_SECONDS } from '../constants';
import type { TargetPayload, ValidationVerdict } from '../types';
import { fingerprint } from '../utils/text';

export interface CachedEvaluation {
  contentHash: string;
  verdict: ValidationVerdict;
  shouldBlock: boolean;
  at: string;
}

function evalKey(issueKey: string): string {
  return `eval:issue:${issueKey}`;
}

function lockKey(issueKey: string): string {
  return `lock:issue:${issueKey}`;
}

export function jiraContentHash(target: TargetPayload, rulebookHash: string): string {
  return fingerprint([
    ...target.sections.map((section) => `${section.label}:${section.text}`),
    rulebookHash,
  ]);
}

/**
 * 같은 이슈·같은 본문·같은 룰북이면 LLM을 다시 부르지 않는다.
 * ERROR 판정은 캐시하지 않으므로 여기서 히트하면 재사용해도 된다.
 */
export async function readCachedEvaluation(
  issueKey: string,
  contentHash: string,
): Promise<CachedEvaluation | undefined> {
  const stored = await kvs.get<CachedEvaluation>(evalKey(issueKey));
  if (!stored) return undefined;
  if (stored.contentHash !== contentHash) return undefined;
  if (stored.verdict.verdict === 'ERROR') return undefined;
  return stored;
}

export async function writeCachedEvaluation(
  issueKey: string,
  contentHash: string,
  verdict: ValidationVerdict,
  shouldBlock: boolean,
): Promise<void> {
  if (verdict.verdict === 'ERROR') return;

  const entry: CachedEvaluation = {
    contentHash,
    verdict,
    shouldBlock,
    at: new Date().toISOString(),
  };

  try {
    await kvs.set(evalKey(issueKey), entry, {
      ttl: { value: EVALUATION_CACHE_TTL_SECONDS, unit: 'SECONDS' },
    });
  } catch (error) {
    console.error(`이슈 ${issueKey} 평가 캐시 기록 실패`, error);
  }
}

/**
 * 생성 이벤트와 칸반 전환이 거의 동시에 들어올 때 이중 LLM 호출을 줄인다.
 * KVS는 강일관성이 아니므로 최선 노력이다.
 */
export async function acquireIssueEvalLock(issueKey: string): Promise<boolean> {
  const key = lockKey(issueKey);
  try {
    const existing = await kvs.get(key);
    if (existing) return false;
    await kvs.set(key, 1, { ttl: { value: ISSUE_EVAL_LOCK_TTL_SECONDS, unit: 'SECONDS' } });
    return true;
  } catch (error) {
    console.warn(`이슈 ${issueKey} 평가 잠금 획득 실패 — 검증은 진행합니다`, error);
    return true;
  }
}

export async function releaseIssueEvalLock(issueKey: string): Promise<void> {
  try {
    await kvs.delete(lockKey(issueKey));
  } catch {
    // 잠금 해제는 실패해도 TTL로 풀린다.
  }
}

function notifyClaimKey(issueKey: string, contentHash: string): string {
  return `notify:issue:${issueKey}:${contentHash}`;
}

/** 같은 본문에 대한 댓글·메일을 한 번만 보낸다. */
export async function claimIssueNotify(issueKey: string, contentHash: string): Promise<boolean> {
  const key = notifyClaimKey(issueKey, contentHash);
  try {
    const existing = await kvs.get(key);
    if (existing) return false;
    await kvs.set(key, 1, { ttl: { value: 7 * 24 * 60 * 60, unit: 'SECONDS' } });
    return true;
  } catch (error) {
    console.warn(`이슈 ${issueKey} 알림 중복 방지 실패 — 알림은 진행합니다`, error);
    return true;
  }
}

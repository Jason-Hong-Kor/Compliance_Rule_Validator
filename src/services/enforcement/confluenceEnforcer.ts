import { kvs } from '@forge/kvs';

import type {
  AppSettings,
  EnforcementAction,
  PageComplianceRecord,
  ValidationVerdict,
  Violation,
} from '../../types';
import { addFooterComment, restorePageVersion } from '../confluenceApi';

const REVERT_MARKER_TTL_SECONDS = 600;

export function pageVerdictKey(pageId: string): string {
  return `verdict:page:${pageId}`;
}

function compliantVersionKey(pageId: string): string {
  return `compliant:page:${pageId}`;
}

function revertMarkerKey(pageId: string): string {
  return `revert-marker:page:${pageId}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function violationMarkup(violations: Violation[]): string {
  return violations
    .map(
      (violation) =>
        `<li><p><strong>[${escapeXml(violation.ruleId)}] ${escapeXml(violation.ruleTitle)}</strong> (${violation.severity})</p>` +
        `<p>근거: <em>${escapeXml(violation.evidence)}</em></p>` +
        `<p>사유: ${escapeXml(violation.reason)}</p>` +
        `<p>수정 방법: ${escapeXml(violation.guideline)}</p></li>`,
    )
    .join('');
}

function buildComment(
  verdict: ValidationVerdict,
  mode: AppSettings['enforcementMode'],
  restoredToVersion?: number,
): string {
  const notice =
    mode === 'revert' && restoredToVersion !== undefined
      ? `<p><strong>이 문서는 규정 위반으로 버전 ${restoredToVersion}(으)로 복원되었습니다.</strong> 아래 항목을 수정한 뒤 다시 출간하세요.</p>`
      : mode === 'gate'
        ? '<p><strong>이 문서는 사내 규정을 준수하지 않은 상태로 표시되었습니다.</strong> 아래 항목을 수정하세요.</p>'
        : '<p>사내 규정 위반이 감지되었습니다. 아래 항목을 확인하세요.</p>';

  return [
    `<p>⚠️ <strong>규정 위반 ${verdict.blockingViolations.length}건</strong></p>`,
    notice,
    `<ul>${violationMarkup(verdict.blockingViolations)}</ul>`,
    `<p><em>검증 모델: ${escapeXml(verdict.model)} · 룰북 버전: ${verdict.rulebookHash.slice(0, 12)} · 판정 시각: ${escapeXml(verdict.evaluatedAt)}</em></p>`,
  ].join('');
}

/**
 * 자동 복원이 만든 새 버전을 우리 스스로 다시 검증하지 않도록 표시한다.
 *
 * 버전 복원은 새 버전을 생성하므로 avi:confluence:updated:page 가 다시 발생한다. 표시하지
 * 않으면 앱이 자기 동작에 반응해 검증을 무한 반복할 수 있다.
 */
async function markRevertedVersion(pageId: string, nextVersion: number): Promise<void> {
  await kvs.set(revertMarkerKey(pageId), nextVersion, {
    ttl: { value: REVERT_MARKER_TTL_SECONDS, unit: 'SECONDS' },
  });
}

export async function isSelfInflictedUpdate(
  pageId: string,
  version: number,
): Promise<boolean> {
  const marked = await kvs.get<number>(revertMarkerKey(pageId));
  return typeof marked === 'number' && marked === version;
}

/** 마지막으로 규정을 준수했던 버전. revert 모드의 복원 목표가 된다. */
async function readCompliantVersion(pageId: string): Promise<number | undefined> {
  const value = await kvs.get<number>(compliantVersionKey(pageId));
  return typeof value === 'number' ? value : undefined;
}

export async function enforceConfluence(
  pageId: string,
  pageVersion: number,
  verdict: ValidationVerdict,
  settings: AppSettings,
  shouldBlock: boolean,
): Promise<PageComplianceRecord> {
  let action: EnforcementAction = 'allowed';
  let restoredToVersion: number | undefined;

  if (!shouldBlock) {
    if (verdict.verdict === 'PASS') {
      await kvs.set(compliantVersionKey(pageId), pageVersion);
      action = 'allowed';
    } else {
      // ERROR이거나 임계값 미달 위반만 있는 경우. 차단하지 않지만 준수 버전으로도 인정하지 않는다.
      action = verdict.verdict === 'ERROR' ? 'skipped' : 'flagged';
    }
  } else {
    if (settings.enforcementMode === 'revert') {
      const target = await readCompliantVersion(pageId);
      const fallback = pageVersion - 1;
      const restoreTo = target ?? (fallback >= 1 ? fallback : undefined);

      if (restoreTo === undefined) {
        // 최초 버전이 위반이면 되돌릴 대상이 없다. 작업을 삭제하는 대신 gate처럼 표시만 한다.
        action = 'revert-skipped';
      } else {
        try {
          await restorePageVersion(
            pageId,
            restoreTo,
            `Compliance Rule Validator: 규정 위반으로 버전 ${restoreTo}(으)로 복원`,
          );
          restoredToVersion = restoreTo;
          action = 'reverted';
          await markRevertedVersion(pageId, pageVersion + 1);
        } catch (error) {
          console.error(`페이지 ${pageId} 복원 실패`, error);
          action = 'revert-skipped';
        }
      }
    } else if (settings.enforcementMode === 'gate') {
      action = 'flagged';
    } else {
      action = 'commented';
    }

    try {
      await addFooterComment(
        pageId,
        buildComment(verdict, settings.enforcementMode, restoredToVersion),
      );
    } catch (error) {
      console.error(`페이지 ${pageId} 위반 코멘트 등록 실패`, error);
    }
  }

  const record: PageComplianceRecord = {
    pageId,
    pageVersion,
    verdict,
    action,
    enforcementMode: settings.enforcementMode,
    restoredToVersion,
  };

  await kvs.set(pageVerdictKey(pageId), record);
  return record;
}

export async function readPageRecord(
  pageId: string,
): Promise<PageComplianceRecord | undefined> {
  return (await kvs.get<PageComplianceRecord>(pageVerdictKey(pageId))) ?? undefined;
}

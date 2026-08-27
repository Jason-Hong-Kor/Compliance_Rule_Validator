import { kvs } from '@forge/kvs';

import { MAX_ERROR_MESSAGE_CHARS } from '../../constants';
import type {
  AppSettings,
  EnforcementAction,
  IssueComplianceRecord,
  ValidationVerdict,
} from '../../types';
import {
  addIssueComment,
  fetchIssueFields,
  notifyIssue,
  saveIssueVerdict,
  updateIssueTextField,
} from '../jiraApi';

export function issueVerdictKey(issueKey: string): string {
  return `verdict:issue:${issueKey}`;
}

/**
 * 워크플로우 전환 차단 시 사용자에게 보여줄 오류 메시지를 만든다.
 *
 * 이 메시지가 차단 시점에 사용자가 얻는 유일한 정보다. Forge에는 백엔드에서 모달을 띄우는
 * API가 없어서, 규칙 ID와 수정 방법을 여기에 담아야 사용자가 우회가 아니라 수정을 택한다.
 * 길이 제한이 있으므로 중대한 항목부터 채우고, 넘치면 나머지는 개수만 알린다.
 */
export function buildBlockMessage(verdict: ValidationVerdict): string {
  const violations = verdict.blockingViolations;
  const header = `사내 규정 위반 ${violations.length}건이 감지되어 저장할 수 없습니다.`;
  const lines: string[] = [header, ''];
  let omitted = 0;

  for (const violation of violations) {
    const block = [
      `[${violation.ruleId}] ${violation.ruleTitle} (${violation.severity})`,
      `  근거: ${violation.evidence}`,
      `  사유: ${violation.reason}`,
      `  수정: ${violation.guideline}`,
      '',
    ].join('\n');

    if (lines.join('\n').length + block.length > MAX_ERROR_MESSAGE_CHARS) {
      omitted += 1;
      continue;
    }
    lines.push(block);
  }

  if (omitted > 0) {
    lines.push(`그 외 ${omitted}건의 위반이 더 있습니다. 이슈 패널에서 전체 내역을 확인하세요.`);
  }

  return lines.join('\n').trim();
}

export function buildErrorPolicyMessage(verdict: ValidationVerdict): string {
  return [
    '규정 검증을 완료할 수 없어 저장을 차단했습니다.',
    '',
    `사유: ${verdict.errorReason ?? '알 수 없는 오류'}`,
    '',
    '잠시 후 다시 시도하거나 관리자에게 문의하세요.',
  ].join('\n');
}

/**
 * 판정 결과를 보존한다.
 *
 * 생성 전환에서 차단된 경우에는 이슈가 존재하지 않아 저장할 곳이 없다. 이때는 오류 메시지가
 * 유일한 전달 수단이므로 조용히 건너뛴다.
 */
export async function persistIssueVerdict(
  issueKey: string | undefined,
  verdict: ValidationVerdict,
  action: EnforcementAction,
  transitionTo?: string,
  extra?: Pick<IssueComplianceRecord, 'source' | 'contentHash' | 'notified'>,
): Promise<void> {
  if (!issueKey) return;

  const record: IssueComplianceRecord = {
    issueKey,
    verdict,
    action,
    transitionTo,
    ...extra,
  };

  try {
    await kvs.set(issueVerdictKey(issueKey), record);
    await saveIssueVerdict(issueKey, record);
  } catch (error) {
    console.error(`이슈 ${issueKey} 판정 기록 실패`, error);
  }
}

export async function readIssueVerdictRecord(
  issueKey: string,
): Promise<IssueComplianceRecord | undefined> {
  return (await kvs.get<IssueComplianceRecord>(issueVerdictKey(issueKey))) ?? undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 알림·코멘트에 넣을 요지. 규칙 ID와 제목만 넣고 원문 인용은 빼서
 * 개인정보가 메일·활동 스트림에 한 번 더 복제되지 않게 한다.
 */
export function buildNotifySummary(verdict: ValidationVerdict): {
  text: string;
  html: string;
  ruleLine: string;
} {
  const count = verdict.blockingViolations.length;
  const ruleLine = verdict.blockingViolations
    .map((violation) => `[${violation.ruleId}] ${violation.ruleTitle}`)
    .join(', ');
  const text =
    `사내 규정 위반 ${count}건이 감지되었습니다. 이슈를 연 뒤 화면 하단 앱 영역 「규정 준수 검증」` +
    ` 또는 오른쪽 「규정 준수」에서 근거와 수정 가이드를 확인하세요.` +
    (ruleLine ? `\n규칙: ${ruleLine}` : '');
  const html =
    `<p>사내 규정 위반 <strong>${count}건</strong>이 감지되었습니다. 이슈를 연 뒤 화면 하단 앱 영역 ` +
    `「규정 준수 검증」 또는 오른쪽 「규정 준수」에서 근거와 수정 가이드를 확인하세요.</p>` +
    (ruleLine ? `<p>규칙: ${escapeHtml(ruleLine)}</p>` : '');
  return { text, html, ruleLine };
}

function mentionCommentAdf(accountId: string | undefined, displayName: string | undefined, summary: string): Record<string, unknown> {
  const mention = accountId
    ? {
        type: 'mention',
        attrs: {
          id: accountId,
          text: `@${displayName || 'reporter'}`,
          accessLevel: '',
        },
      }
    : undefined;

  const intro = mention
    ? [mention, { type: 'text', text: ' ' }, { type: 'text', text: summary }]
    : [{ type: 'text', text: summary }];

  return {
    type: 'doc',
    version: 1,
    content: [
      {
        type: 'paragraph',
        content: intro,
      },
    ],
  };
}

/**
 * 사후 검증 FAIL을 작성자·지정 그룹에 알린다.
 *
 * in-app: 이슈 코멘트에 멘션 (벨 알림). email: notify REST (설정이 켜진 경우만).
 * 어느 쪽도 원문 인용을 포함하지 않는다.
 */
export async function notifyJiraViolation(
  issueKey: string,
  verdict: ValidationVerdict,
  settings: AppSettings,
): Promise<{ inApp: boolean; email: boolean }> {
  const notify = settings.jiraNotify;
  if (!notify.enabled) {
    return { inApp: false, email: false };
  }

  const summary = buildNotifySummary(verdict);
  const fieldName = notify.statusFieldName.trim();
  const withField = fieldName
    ? {
        text: `${summary.text}\n이슈 필드의 「${fieldName}」에도 요지가 있습니다.`,
        html:
          `${summary.html}<p>이슈 필드의 「${escapeHtml(fieldName)}」에도 요지가 있습니다.</p>`,
        ruleLine: summary.ruleLine,
      }
    : summary;
  const fields = await fetchIssueFields(issueKey);
  const reporterId = fields?.reporter?.accountId;
  const reporterName = fields?.reporter?.displayName;

  let inApp = false;
  try {
    inApp = await addIssueComment(
      issueKey,
      mentionCommentAdf(notify.notifyReporter ? reporterId : undefined, reporterName, withField.text),
    );
  } catch (error) {
    console.error(`이슈 ${issueKey} in-app 알림 실패`, error);
  }

  let email = false;
  const groupName = notify.groupName.trim();
  if (notify.email && (notify.notifyReporter || groupName)) {
    try {
      email = await notifyIssue(issueKey, {
        subject: `[규정 위반] ${issueKey}`,
        textBody: withField.text,
        htmlBody: withField.html,
        reporter: notify.notifyReporter,
        groupName: groupName || undefined,
      });
    } catch (error) {
      console.error(`이슈 ${issueKey} 이메일 알림 예외`, error);
    }
  }

  return { inApp, email };
}

/**
 * 이슈 화면의 일반 필드에 요지만 남긴다. 원문 인용은 넣지 않는다.
 * 필드는 설정에서 고른 텍스트 커스텀 필드이며, 비어 있으면 아무 것도 쓰지 않는다.
 */
export async function writeComplianceStatusField(
  issueKey: string | undefined,
  verdict: ValidationVerdict,
  shouldBlock: boolean,
  settings: AppSettings,
): Promise<void> {
  const fieldId = settings.jiraNotify.statusFieldId.trim();
  if (!issueKey || !fieldId || verdict.verdict === 'ERROR') return;

  const ruleIds = verdict.blockingViolations.map((violation) => violation.ruleId).join(', ');
  let value: string;
  if (shouldBlock) {
    value = `FAIL · 위반 ${verdict.blockingViolations.length}건`;
    if (ruleIds) value += ` · ${ruleIds}`;
  } else if (verdict.verdict === 'PASS') {
    value = 'PASS · 규정 준수';
  } else {
    value = `FAIL 아님 · 참고 ${verdict.violations.length}건`;
  }
  if (value.length > 250) value = `${value.slice(0, 247)}...`;

  await updateIssueTextField(issueKey, fieldId, value);
}

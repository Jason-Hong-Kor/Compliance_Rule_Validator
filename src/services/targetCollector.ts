import type { TargetPayload, WorkflowValidatorEvent } from '../types';
import { adfToText } from '../utils/adfToText';
import { storageToText } from '../utils/storageToText';
import { fetchIssueFields } from './jiraApi';

/**
 * Jira 이슈의 검증 대상 텍스트를 수집한다.
 *
 * 두 소스를 병합해야 한다. `modifiedFields`는 전환 화면에서 방금 입력한 값을 담고 있어
 * 검증에 반드시 반영해야 하지만, 지원 필드 목록에 summary가 없다. 반대로 REST API는
 * summary를 주지만 저장 전 값은 알 수 없고, 생성 전환에서는 이슈 자체가 없어 호출이 실패한다.
 * 그래서 API 값을 기반으로 깔고 modifiedFields로 덮어쓴다.
 *
 * 대상 필드를 이슈 유형별로 확장할 때는 이 함수만 교체하면 된다. 반환 타입이 섹션 배열이라
 * 호출부와 프롬프트 조립 로직은 그대로 유지된다.
 */
export async function collectJiraTargetText(
  event: WorkflowValidatorEvent,
): Promise<TargetPayload> {
  const warnings: string[] = [];
  const issueKey = event.issue?.key;
  const modified = event.transition?.modifiedFields ?? {};

  let summary = '';
  let description = '';

  if (issueKey) {
    const fields = await fetchIssueFields(issueKey);
    if (fields) {
      summary = typeof fields.summary === 'string' ? fields.summary : '';
      description = adfToText(fields.description);
    } else {
      warnings.push('이슈를 조회할 수 없어 저장된 필드 값을 반영하지 못했습니다.');
    }
  }

  if ('description' in modified) {
    // 전환 화면에서 설명을 비운 경우 null이 오므로 빈 문자열로 반영해야 한다.
    description = modified.description ? adfToText(modified.description) : '';
  }

  if (!issueKey && !('summary' in modified)) {
    // 생성 전환에서는 이슈 키가 없고 modifiedFields도 summary를 지원하지 않는다.
    warnings.push('생성 시점에는 요약(summary)을 읽을 수 없어 설명 위주로 검증했습니다.');
  }

  if (typeof modified.summary === 'string') {
    summary = modified.summary;
  }

  return {
    kind: 'jira-issue',
    reference: issueKey,
    sections: [
      { label: '요약', text: summary },
      { label: '설명', text: description },
    ],
    warnings,
  };
}

export function collectJiraTargetFromFields(
  issueKey: string,
  fields: { summary?: string; description?: unknown },
): TargetPayload {
  return {
    kind: 'jira-issue',
    reference: issueKey,
    sections: [
      { label: '요약', text: typeof fields.summary === 'string' ? fields.summary : '' },
      { label: '설명', text: adfToText(fields.description) },
    ],
    warnings: [],
  };
}

export async function collectJiraIssueByKey(issueKey: string): Promise<TargetPayload | undefined> {
  const fields = await fetchIssueFields(issueKey);
  if (!fields) return undefined;
  return collectJiraTargetFromFields(issueKey, fields);
}

export function collectConfluenceTargetText(
  title: string,
  storageBody: string,
): TargetPayload {
  return {
    kind: 'confluence-page',
    sections: [
      { label: '문서 제목', text: title },
      { label: '본문', text: storageToText(storageBody) },
    ],
    warnings: [],
  };
}

export function hasValidatableContent(target: TargetPayload): boolean {
  return target.sections.some((section) => section.text.trim().length > 0);
}

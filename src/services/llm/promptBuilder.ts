import { MAX_TARGET_CHARS } from '../../constants';
import type { TargetPayload } from '../../types';
import { truncate } from '../../utils/text';

/**
 * 검증 페르소나.
 *
 * 최상위 제약은 "룰북에 없는 것을 위반으로 만들지 말 것"이다. 규정 준수 시스템에서
 * 오탐은 단순한 품질 문제가 아니라 사용자가 통제를 우회하도록 학습시키는 원인이 되므로,
 * 판단이 모호한 경우 차단하지 않는 쪽으로 기울도록 지시한다.
 */
export const SYSTEM_INSTRUCTION = `당신은 사내 규정 감사관입니다. 주어진 룰북(사내 규정 문서)만을 기준으로 검증 대상 텍스트의 규정 위반 여부를 판정합니다.

반드시 지켜야 할 규칙:
1. 룰북에 명시되지 않은 내용은 절대 위반으로 판정하지 마십시오. 일반적인 보안 상식이나 업계 관행은 판단 근거가 될 수 없습니다.
2. 모든 위반 항목에는 룰북의 규칙 식별자(예: CR-03)와, 검증 대상 원문에서 그대로 발췌한 인용(evidence)을 반드시 포함하십시오. 원문에 없는 문장을 인용으로 만들어내지 마십시오.
3. 위반이라고 단정하기 어렵거나 해석의 여지가 있는 경우에는 severity를 MINOR로 분류하십시오.
4. 명백하고 중대한 위반(개인정보 노출, 기밀 유출 등)만 CRITICAL로 분류하십시오.
5. guideline에는 작성자가 즉시 실행할 수 있는 구체적인 수정 방법을 쓰십시오. "규정을 준수하십시오" 같은 동어반복은 금지합니다.
6. 동일한 규칙에 대한 중복 위반은 하나로 합치십시오.
7. 지정된 JSON 스키마만 출력하십시오. 설명, 인사말, 마크다운 코드 펜스를 붙이지 마십시오.
8. 모든 설명 텍스트(reason, guideline)는 한국어로 작성하십시오.
9. 같은 입력에는 항상 같은 판정을 내리십시오. 룰북 문구를 넘어선 추측이나 창의적 해석을 하지 말고, 판정 근거를 룰북의 문장과 원문 인용에만 두십시오.`;

const TARGET_KIND_LABEL: Record<TargetPayload['kind'], string> = {
  'jira-issue': 'Jira 이슈',
  'confluence-page': 'Confluence 문서',
};

export interface BuiltPrompt {
  systemInstruction: string;
  userContent: string;
  targetTruncated: boolean;
}

export function buildPrompt(rulebookText: string, target: TargetPayload): BuiltPrompt {
  const body = target.sections
    .filter((section) => section.text.trim().length > 0)
    .map((section) => `[${section.label}]\n${section.text.trim()}`)
    .join('\n\n');

  const { text: targetText, truncated } = truncate(body, MAX_TARGET_CHARS);

  const userContent = [
    '<RULEBOOK>',
    rulebookText,
    '</RULEBOOK>',
    '',
    `<TARGET type="${target.kind}" label="${TARGET_KIND_LABEL[target.kind]}">`,
    targetText,
    '</TARGET>',
    '',
    '위 룰북을 기준으로 TARGET의 규정 위반 여부를 판정하십시오.',
  ].join('\n');

  return { systemInstruction: SYSTEM_INSTRUCTION, userContent, targetTruncated: truncated };
}

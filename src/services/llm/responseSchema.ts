/**
 * Gemini Structured Output 스키마.
 *
 * 자유 서술을 원천 차단해 파싱 실패와 재시도를 없애고, evidence를 필수 항목으로 두어
 * 근거 없는 위반 판정이 구조적으로 불가능하게 만든다.
 */
export const VERDICT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    verdict: {
      type: 'STRING',
      enum: ['PASS', 'FAIL'],
      description: '위반이 하나도 없으면 PASS, 하나라도 있으면 FAIL.',
    },
    violations: {
      type: 'ARRAY',
      description: 'verdict가 PASS면 빈 배열.',
      items: {
        type: 'OBJECT',
        properties: {
          ruleId: {
            type: 'STRING',
            description: '룰북에 명시된 규칙 식별자. 식별자가 없으면 규칙 제목을 그대로 사용.',
          },
          ruleTitle: { type: 'STRING', description: '규칙의 제목 또는 요지.' },
          severity: {
            type: 'STRING',
            enum: ['CRITICAL', 'MAJOR', 'MINOR'],
            description: '판단이 모호하면 MINOR.',
          },
          evidence: {
            type: 'STRING',
            description: '위반으로 판단한 검증 대상 원문을 그대로 인용. 창작 금지.',
          },
          reason: { type: 'STRING', description: '해당 규칙에 위반되는 이유.' },
          guideline: { type: 'STRING', description: '작성자가 취할 수 있는 구체적 수정 방법.' },
        },
        required: ['ruleId', 'ruleTitle', 'severity', 'evidence', 'reason', 'guideline'],
        propertyOrdering: ['ruleId', 'ruleTitle', 'severity', 'evidence', 'reason', 'guideline'],
      },
    },
  },
  required: ['verdict', 'violations'],
  propertyOrdering: ['verdict', 'violations'],
} as const;

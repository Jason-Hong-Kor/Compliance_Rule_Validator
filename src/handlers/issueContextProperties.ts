import { readIssueVerdictRecord } from '../services/enforcement/jiraEnforcer';

interface IssueContextPayload {
  extension?: { issue?: { key?: string } };
}

interface DynamicStatus {
  status: {
    type: 'lozenge';
    value: { label: string; type: 'default' | 'inprogress' | 'moved' | 'new' | 'removed' | 'success' };
  };
}

/**
 * 이슈 오른쪽 컨텍스트 패널이 접혀 있어도 로젠지로 상태를 보여 준다.
 */
export const issueContextProperties = async (
  event: IssueContextPayload | undefined,
  context: IssueContextPayload | undefined,
): Promise<DynamicStatus> => {
  const issueKey = event?.extension?.issue?.key ?? context?.extension?.issue?.key;
  if (!issueKey) {
    return { status: { type: 'lozenge', value: { label: '미검증', type: 'default' } } };
  }

  try {
    const record = await readIssueVerdictRecord(issueKey);
    if (!record) {
      return { status: { type: 'lozenge', value: { label: '미검증', type: 'default' } } };
    }
    if (record.verdict.verdict === 'ERROR' || record.action === 'skipped') {
      return { status: { type: 'lozenge', value: { label: '오류', type: 'moved' } } };
    }
    if (record.verdict.verdict === 'FAIL' && record.verdict.blockingViolations.length > 0) {
      return {
        status: {
          type: 'lozenge',
          value: { label: `위반 ${record.verdict.blockingViolations.length}`, type: 'removed' },
        },
      };
    }
    return { status: { type: 'lozenge', value: { label: '준수', type: 'success' } } };
  } catch (error) {
    console.error('이슈 컨텍스트 상태 조회 실패', error);
    return { status: { type: 'lozenge', value: { label: '검증', type: 'default' } } };
  }
};

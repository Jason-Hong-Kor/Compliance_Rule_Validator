import { readPageRecord } from '../services/enforcement/confluenceEnforcer';
import type { PageComplianceRecord } from '../types';

interface BylineContext {
  extension?: { content?: { id?: string } };
}

interface DynamicPropertiesResult {
  title: string;
  tooltip?: string;
}

function describe(record: PageComplianceRecord | undefined): DynamicPropertiesResult {
  if (!record) {
    return { title: '규정 미검증', tooltip: '아직 규정 검증이 수행되지 않은 문서입니다.' };
  }

  const count = record.verdict.blockingViolations.length;

  switch (record.action) {
    case 'reverted':
      return {
        title: `규정 위반 ${count}건 · 복원됨`,
        tooltip: `위반으로 버전 ${record.restoredToVersion}(으)로 복원되었습니다. 클릭하면 상세 내역을 볼 수 있습니다.`,
      };
    case 'revert-skipped':
      return {
        title: `규정 위반 ${count}건 · 복원 불가`,
        tooltip: '되돌릴 이전 버전이 없어 복원하지 못했습니다. 내용을 직접 수정해야 합니다.',
      };
    case 'flagged':
      return {
        title: `규정 위반 ${count}건`,
        tooltip: '사내 규정을 준수하지 않은 문서입니다. 클릭하면 상세 내역을 볼 수 있습니다.',
      };
    case 'commented':
      return {
        title: `규정 경고 ${count}건`,
        tooltip: '규정 위반이 감지되었습니다. 클릭하면 상세 내역을 볼 수 있습니다.',
      };
    case 'skipped':
      return {
        title: '규정 검증 실패',
        tooltip: record.verdict.errorReason ?? '검증을 완료하지 못했습니다.',
      };
    default:
      return { title: '규정 준수', tooltip: '지정된 룰북 기준으로 위반이 발견되지 않았습니다.' };
  }
}

/**
 * 바이라인 배지 라벨을 동적으로 만든다.
 *
 * Forge에는 백엔드에서 모달을 띄우는 API가 없어 위반 사실을 사용자에게 밀어 넣을 수 없다.
 * 그래서 문서를 열면 바로 보이는 이 배지가 상태를 알리는 주된 수단이 된다.
 */
export const bylineProperties = async (
  event: BylineContext | undefined,
  context: BylineContext | undefined,
): Promise<DynamicPropertiesResult> => {
  const pageId = event?.extension?.content?.id ?? context?.extension?.content?.id;
  if (!pageId) {
    return { title: '규정 검증' };
  }

  try {
    return describe(await readPageRecord(pageId));
  } catch (error) {
    console.error('바이라인 상태 조회 실패', error);
    return { title: '규정 검증' };
  }
};

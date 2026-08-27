import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Inline,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Strong,
  Text,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

import type { EnforcementAction, EnforcementMode, PageComplianceRecord } from '../types';
import { VerdictSummary } from './components/VerdictSummary';

const ACTION_LABEL: Record<EnforcementAction, string> = {
  blocked: '차단됨',
  commented: '경고 등록',
  flagged: '미준수 표시',
  reverted: '자동 복원됨',
  'revert-skipped': '복원 불가',
  allowed: '준수',
  skipped: '검증 실패',
  notified: '알림 발송',
};

const MODE_LABEL: Record<EnforcementMode, string> = {
  advisory: 'Advisory (경고)',
  gate: 'Gate (미준수 표시)',
  revert: 'Revert (자동 복원)',
};

const App = () => {
  const context = useProductContext();
  const [record, setRecord] = useState<PageComplianceRecord | undefined>();
  const [mode, setMode] = useState<EnforcementMode | undefined>();
  const [loading, setLoading] = useState(true);

  const pageId = context?.extension?.content?.id as string | undefined;

  useEffect(() => {
    if (!context) return;

    void (async () => {
      try {
        const response = (await invoke('getPageVerdict', { pageId })) as {
          ok: boolean;
          record?: PageComplianceRecord;
          enforcementMode?: EnforcementMode;
        };
        setRecord(response.record);
        setMode(response.enforcementMode);
      } finally {
        setLoading(false);
      }
    })();
  }, [context, pageId]);

  if (loading) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner />
        <Text>불러오는 중…</Text>
      </Inline>
    );
  }

  if (!record) {
    return (
      <SectionMessage appearance="information" title="검증 기록이 없습니다">
        <Text>
          이 문서는 아직 규정 검증이 수행되지 않았습니다. 문서를 다시 출간하거나 상단
          메뉴의 &quot;규정 사전 검증&quot;을 실행하세요.
        </Text>
      </SectionMessage>
    );
  }

  const blocked = record.action !== 'allowed' && record.action !== 'skipped';

  return (
    <Stack space="space.200">
      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance={blocked ? 'removed' : 'success'}>
          {ACTION_LABEL[record.action]}
        </Lozenge>
        <Text>
          버전 {record.pageVersion} · 모드 {mode ? MODE_LABEL[mode] : MODE_LABEL[record.enforcementMode]}
        </Text>
      </Inline>

      {record.action === 'reverted' && (
        <SectionMessage appearance="warning" title="자동 복원되었습니다">
          <Text>
            규정 위반으로 이 문서는 버전 <Strong>{record.restoredToVersion}</Strong>(으)로
            복원되었습니다. 아래 항목을 수정한 뒤 다시 출간하세요.
          </Text>
        </SectionMessage>
      )}

      {record.action === 'revert-skipped' && (
        <SectionMessage appearance="warning" title="복원할 이전 버전이 없습니다">
          <Text>
            되돌릴 준수 버전이 없어 자동 복원을 수행하지 못했습니다. 내용을 직접 수정해야 합니다.
          </Text>
        </SectionMessage>
      )}

      <VerdictSummary
        verdict={record.verdict}
        blocked={blocked}
        blockedTitle="사내 규정 위반이 감지되었습니다"
      />
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

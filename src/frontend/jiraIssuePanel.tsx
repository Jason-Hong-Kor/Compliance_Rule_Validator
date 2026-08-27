import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Inline,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

import type { IssueComplianceRecord } from '../types';
import { VerdictSummary } from './components/VerdictSummary';

/**
 * 이슈 패널.
 *
 * 동기 차단 때는 워크플로우 오류 메시지만 노출되고 길이 제한이 있다. 생성·칸반 우회는
 * 사후 검증이라 차단 메시지 자체가 없다. 두 경우 모두 상세 내역을 여기서 본다.
 */
const App = () => {
  const context = useProductContext();
  const [record, setRecord] = useState<IssueComplianceRecord | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const issueKey = context?.extension?.issue?.key as string | undefined;

  useEffect(() => {
    if (!context) return;

    void (async () => {
      try {
        const response = (await invoke('getIssueVerdict', { issueKey })) as {
          ok: boolean;
          record?: IssueComplianceRecord;
          message?: string;
        };
        if (!response.ok) setError(response.message);
        else setRecord(response.record);
      } catch (invokeError) {
        setError(String(invokeError));
      } finally {
        setLoading(false);
      }
    })();
  }, [context, issueKey]);

  if (loading) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner />
        <Text>검증 결과를 불러오는 중…</Text>
      </Inline>
    );
  }

  if (error) {
    return (
      <SectionMessage appearance="error" title="검증 결과를 불러올 수 없습니다">
        <Text>{error}</Text>
      </SectionMessage>
    );
  }

  if (!record) {
    return (
      <Stack space="space.100">
        <SectionMessage appearance="information" title="검증 기록이 없습니다">
          <Text>
            이 이슈에 대한 규정 검증이 아직 수행되지 않았습니다. 방금 만들었다면 수 초 내에
            결과가 남습니다. 결과는 이 패널과 이슈 화면 오른쪽 「규정 준수」에 있습니다.
            새로고침 후에도 비어 있으면 워크플로우 후처리 등록과 Jira 앱 설정의 룰북·API Key를
            확인하세요.
          </Text>
        </SectionMessage>
      </Stack>
    );
  }

  const asyncDetected =
    record.source === 'async-event' &&
    (record.action === 'notified' || record.action === 'flagged');
  const blockedTitle = asyncDetected
    ? '사후 검증에서 사내 규정 위반이 감지되었습니다'
    : '사내 규정 위반으로 저장이 차단되었습니다';

  return (
    <Stack space="space.200">
      {asyncDetected && (
        <SectionMessage appearance="warning" title="이슈는 이미 생성되어 있습니다">
          <Text>
            생성 시점에는 본문을 사전에 차단할 수 없어, 저장된 뒤 검증했습니다. 아래 항목을
            수정하세요. 같은 본문으로 이후 전환을 시도하면 동기 검증기가 차단합니다.
          </Text>
        </SectionMessage>
      )}
      <VerdictSummary
        verdict={record.verdict}
        blocked={record.action === 'blocked' || asyncDetected}
        blockedTitle={blockedTitle}
        passTitle={
          record.source === 'async-event'
            ? '생성 후 비동기 검증을 통과했습니다'
            : undefined
        }
      />
      {record.action === 'skipped' && (
        <SectionMessage appearance="warning" title="미검증 통과">
          <Text>
            검증을 완료하지 못했으나 실패 정책(fail-open)에 따라 저장이 허용되었습니다.
          </Text>
        </SectionMessage>
      )}
      {record.notified && (record.notified.inApp || record.notified.email) && (
        <Text>
          알림:{' '}
          {[record.notified.inApp ? 'in-app' : '', record.notified.email ? 'email' : '']
            .filter(Boolean)
            .join(', ')}{' '}
          ({record.notified.at})
        </Text>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

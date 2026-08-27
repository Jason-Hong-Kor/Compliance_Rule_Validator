import React, { useState } from 'react';
import ForgeReconciler, {
  Button,
  Inline,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

import type { ValidationVerdict } from '../types';
import { VerdictSummary } from './components/VerdictSummary';

/**
 * 출간 전 온디맨드 검증.
 *
 * Confluence 출간은 원천 차단할 수 없어서, 사용자는 출간한 뒤에야 위반 사실을 알게 된다.
 * Revert 모드에서는 그 시점에 편집 내용이 되돌려진다. 이 화면은 사용자가 그 전에 스스로
 * 확인할 수 있는 통로이며, 검증만 수행하고 코멘트나 복원 같은 강제 조치는 하지 않는다.
 */
const App = () => {
  const context = useProductContext();
  const [verdict, setVerdict] = useState<ValidationVerdict | undefined>();
  const [wouldBlock, setWouldBlock] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const pageId = context?.extension?.content?.id as string | undefined;

  const run = async () => {
    setRunning(true);
    setError(undefined);
    setVerdict(undefined);
    try {
      const response = (await invoke('precheckPage', { pageId })) as {
        ok: boolean;
        verdict?: ValidationVerdict;
        wouldBlock?: boolean;
        message?: string;
      };
      if (!response.ok) {
        setError(response.message ?? '검증에 실패했습니다.');
        return;
      }
      setVerdict(response.verdict);
      setWouldBlock(response.wouldBlock ?? false);
    } catch (invokeError) {
      setError(String(invokeError));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Stack space="space.200">
      <Text>
        현재 저장된 문서 내용을 지정된 룰북과 비교해 검증합니다. 이 검증은 문서에 코멘트를
        남기거나 버전을 변경하지 않습니다.
      </Text>

      <Button appearance="primary" isDisabled={running} onClick={run}>
        {running ? '검증 중…' : '규정 검증 실행'}
      </Button>

      {running && (
        <Inline space="space.100" alignBlock="center">
          <Spinner />
          <Text>룰북과 대조하고 있습니다. 최대 20초 정도 걸릴 수 있습니다.</Text>
        </Inline>
      )}

      {error && (
        <SectionMessage appearance="error" title="검증 실패">
          <Text>{error}</Text>
        </SectionMessage>
      )}

      {verdict && (
        <VerdictSummary
          verdict={verdict}
          blocked={wouldBlock}
          blockedTitle="이대로 출간하면 규정 위반으로 처리됩니다"
          passTitle="규정 위반이 발견되지 않았습니다"
        />
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import React from 'react';
import { SectionMessage, Stack, Text } from '@forge/react';

import type { ValidationVerdict } from '../../types';
import { ViolationList } from './ViolationList';

interface Props {
  verdict: ValidationVerdict;
  /** 차단 여부는 심각도 임계값에 따라 달라지므로 호출부가 알려준다. */
  blocked: boolean;
  blockedTitle: string;
  passTitle?: string;
}

export const VerdictSummary = ({ verdict, blocked, blockedTitle, passTitle }: Props) => {
  if (verdict.verdict === 'ERROR') {
    return (
      <SectionMessage appearance="warning" title="규정 검증을 완료하지 못했습니다">
        <Text>{verdict.errorReason ?? '알 수 없는 오류가 발생했습니다.'}</Text>
      </SectionMessage>
    );
  }

  return (
    <Stack space="space.200">
      {blocked ? (
        <SectionMessage appearance="error" title={blockedTitle}>
          <Text>
            아래 {verdict.blockingViolations.length}건을 수정해야 합니다.
          </Text>
        </SectionMessage>
      ) : (
        <SectionMessage appearance="success" title={passTitle ?? '규정 위반이 발견되지 않았습니다'}>
          <Text>지정된 룰북 기준으로 검증을 통과했습니다.</Text>
        </SectionMessage>
      )}

      {verdict.blockingViolations.length > 0 && (
        <ViolationList violations={verdict.blockingViolations} />
      )}

      {verdict.warnings?.map((warning) => (
        <SectionMessage key={warning} appearance="warning">
          <Text>{warning}</Text>
        </SectionMessage>
      ))}

      <Text>
        검증 모델: {verdict.model} · 룰북 버전: {verdict.rulebookHash.slice(0, 12) || '없음'} ·
        소요: {verdict.latencyMs}ms · 판정 시각: {verdict.evaluatedAt}
      </Text>
    </Stack>
  );
};

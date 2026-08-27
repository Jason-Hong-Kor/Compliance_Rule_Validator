import React from 'react';
import { Box, Heading, Inline, Lozenge, Stack, Strong, Text } from '@forge/react';

import type { Severity, Violation } from '../../types';

const SEVERITY_APPEARANCE: Record<Severity, 'removed' | 'moved' | 'default'> = {
  CRITICAL: 'removed',
  MAJOR: 'moved',
  MINOR: 'default',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: '치명',
  MAJOR: '주요',
  MINOR: '경미',
};

export const ViolationList = ({ violations }: { violations: Violation[] }) => {
  if (violations.length === 0) {
    return <Text>표시할 위반 항목이 없습니다.</Text>;
  }

  return (
    <Stack space="space.200">
      {violations.map((violation, index) => (
        <Box
          key={`${violation.ruleId}-${index}`}
          padding="space.150"
          backgroundColor="color.background.neutral.subtle"
        >
          <Stack space="space.100">
            <Inline space="space.100" alignBlock="center">
              <Lozenge appearance={SEVERITY_APPEARANCE[violation.severity]}>
                {SEVERITY_LABEL[violation.severity]}
              </Lozenge>
              <Heading as="h4">
                [{violation.ruleId}] {violation.ruleTitle}
              </Heading>
            </Inline>

            {/* 근거를 가장 먼저 보여준다. 사용자가 "왜 내가 걸렸는지"를 즉시 확인해야
                판정을 수용하고 수정으로 넘어간다. */}
            <Text>
              <Strong>근거</Strong>
            </Text>
            <Box padding="space.100" backgroundColor="color.background.accent.gray.subtlest">
              <Text>{violation.evidence}</Text>
            </Box>

            <Text>
              <Strong>사유</Strong> {violation.reason}
            </Text>
            <Text>
              <Strong>수정 방법</Strong> {violation.guideline}
            </Text>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
};

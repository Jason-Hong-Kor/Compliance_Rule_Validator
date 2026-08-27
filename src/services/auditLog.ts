import { kvs } from '@forge/kvs';

import { AUDIT_TTL_SECONDS } from '../constants';
import type { AuditEntry } from '../types';

/**
 * 판정 이력을 남긴다.
 *
 * 거버넌스 통제는 동작하는 것만으로 부족하고 동작했음을 증명할 수 있어야 한다.
 * 키에 타임스탬프를 역순 정렬 가능한 형태로 넣어, 조회 시 최신 항목부터 읽을 수 있게 한다.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  const key = `audit:${entry.at}:${Math.random().toString(36).slice(2, 10)}`;
  try {
    await kvs.set(key, entry, { ttl: { value: AUDIT_TTL_SECONDS, unit: 'SECONDS' } });
  } catch (error) {
    // 감사 기록 실패가 검증 자체를 실패시키면 안 된다.
    console.error('감사 로그 기록 실패', error);
  }
}

import { createHash } from 'crypto';

export interface TruncateResult {
  text: string;
  truncated: boolean;
}

export function truncate(input: string, limit: number): TruncateResult {
  if (input.length <= limit) {
    return { text: input, truncated: false };
  }
  return {
    text: `${input.slice(0, limit)}\n\n…(길이 제한으로 이하 생략)`,
    truncated: true,
  };
}

export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/** 판정 결과 재사용 여부를 판단하기 위한 대상 텍스트 지문. */
export function fingerprint(parts: string[]): string {
  return sha256(parts.join('\u0000'));
}

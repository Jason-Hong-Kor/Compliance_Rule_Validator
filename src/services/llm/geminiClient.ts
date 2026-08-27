import { fetch } from '@forge/api';

import { GEMINI_API_BASE } from '../../constants';
import type { Severity, Violation } from '../../types';
import { VERDICT_RESPONSE_SCHEMA } from './responseSchema';

export interface GeminiRequest {
  apiKey: string;
  model: string;
  systemInstruction: string;
  userContent: string;
  timeoutMs: number;
}

export interface GeminiRawVerdict {
  verdict: 'PASS' | 'FAIL';
  violations: Violation[];
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly kind: 'timeout' | 'auth' | 'rate-limit' | 'transport' | 'parse',
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

const VALID_SEVERITIES: Severity[] = ['CRITICAL', 'MAJOR', 'MINOR'];

function buildBody(request: GeminiRequest): string {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: request.systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: request.userContent }] }],
    generationConfig: {
      // Gemini 3.x는 temperature/top_p/top_k를 무시하며 향후 세대에서는 400을 반환한다.
      // 판정 일관성은 시스템 프롬프트의 서술 제약과 구조화 출력으로만 확보한다.
      responseMimeType: 'application/json',
      responseSchema: VERDICT_RESPONSE_SCHEMA,
      // 3.x는 수치형 thinkingBudget 대신 문자열 enum을 쓴다. 기본값 medium은 동기 경로의
      // 25초 예산을 위협하므로 최소 단계로 고정한다. 두 필드를 함께 보내면 400이다.
      thinkingConfig: { thinkingLevel: 'minimal' },
    },
    safetySettings: [
      // 규정 위반 사례에는 민감한 표현이 포함될 수 있다. 안전 필터가 응답을 비우면
      // 검증 자체가 불가능해지므로 판정 목적에 한해 차단 임계값을 낮춘다.
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  });
}

interface GeminiApiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

/**
 * Gemini를 호출해 판정 결과를 받는다.
 *
 * 플랫폼 타임아웃(무응답 오류)으로 넘어가면 사용자에게는 원인 불명의 실패로 보이므로,
 * AbortController로 먼저 끊어 통제된 실패로 전환한다. 남은 시간은 호출자가 실패 정책을
 * 적용하고 결과를 기록하는 데 쓴다.
 */
export async function callGemini(request: GeminiRequest): Promise<GeminiRawVerdict> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs);

  try {
    const response = await fetch(`${GEMINI_API_BASE}/${request.model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': request.apiKey,
      },
      body: buildBody(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      if (response.status === 401 || response.status === 403) {
        throw new LlmError(`API Key가 유효하지 않습니다. (${response.status})`, 'auth');
      }
      if (response.status === 429) {
        throw new LlmError('Gemini API 호출 한도를 초과했습니다.', 'rate-limit');
      }
      throw new LlmError(`Gemini API 오류 ${response.status}: ${detail}`, 'transport');
    }

    const payload = (await response.json()) as GeminiApiResponse;
    return parseVerdict(payload);
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmError(
        `Gemini 응답이 ${request.timeoutMs}ms 안에 도착하지 않았습니다.`,
        'timeout',
      );
    }
    throw new LlmError(
      `Gemini 호출 실패: ${error instanceof Error ? error.message : String(error)}`,
      'transport',
    );
  } finally {
    clearTimeout(timer);
  }
}

function parseVerdict(payload: GeminiApiResponse): GeminiRawVerdict {
  if (payload.promptFeedback?.blockReason) {
    throw new LlmError(
      `프롬프트가 차단되었습니다: ${payload.promptFeedback.blockReason}`,
      'parse',
    );
  }

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    const reason = payload.candidates?.[0]?.finishReason ?? 'unknown';
    throw new LlmError(`Gemini 응답이 비어 있습니다. (finishReason=${reason})`, 'parse');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new LlmError('Gemini 응답을 JSON으로 해석할 수 없습니다.', 'parse');
  }

  return normalizeVerdict(parsed);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * 스키마를 지정했더라도 모델 응답을 그대로 신뢰하지 않는다.
 * 판정 결과는 차단·복원 같은 되돌리기 어려운 동작으로 이어지므로 값 검증을 한 번 더 거친다.
 */
function normalizeVerdict(parsed: unknown): GeminiRawVerdict {
  if (!parsed || typeof parsed !== 'object') {
    throw new LlmError('Gemini 응답 형식이 올바르지 않습니다.', 'parse');
  }

  const record = parsed as Record<string, unknown>;
  const rawViolations = Array.isArray(record.violations) ? record.violations : [];

  const violations: Violation[] = rawViolations.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    const evidence = asString(entry.evidence).trim();
    const ruleId = asString(entry.ruleId).trim();

    // 근거나 규칙 식별자가 없는 항목은 사용자를 설득할 수 없고 감사 근거로도 쓸 수 없어 버린다.
    if (!evidence || !ruleId) return [];

    const severityValue = asString(entry.severity).toUpperCase() as Severity;
    const severity: Severity = VALID_SEVERITIES.includes(severityValue)
      ? severityValue
      : 'MINOR';

    return [
      {
        ruleId,
        ruleTitle: asString(entry.ruleTitle, ruleId).trim(),
        severity,
        evidence,
        reason: asString(entry.reason).trim(),
        guideline: asString(entry.guideline).trim(),
      },
    ];
  });

  // 스키마상의 verdict보다 실제 남은 위반 목록을 신뢰한다.
  return { verdict: violations.length > 0 ? 'FAIL' : 'PASS', violations };
}

/** 설정 화면의 "연결 테스트"용. 최소 토큰으로 키 유효성만 확인한다. */
export async function testApiKey(apiKey: string, model: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${GEMINI_API_BASE}/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1, thinkingConfig: { thinkingLevel: 'minimal' } },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 200);
      throw new LlmError(`연결 실패 (${response.status}): ${detail}`, 'auth');
    }
  } catch (error) {
    if (error instanceof LlmError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmError('연결 테스트가 시간 내에 완료되지 않았습니다.', 'timeout');
    }
    throw new LlmError(
      `연결 테스트 실패: ${error instanceof Error ? error.message : String(error)}`,
      'transport',
    );
  } finally {
    clearTimeout(timer);
  }
}

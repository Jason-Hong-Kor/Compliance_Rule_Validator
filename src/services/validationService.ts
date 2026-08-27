import {
  ASYNC_LLM_TIMEOUT_MS,
  SEVERITY_ORDER,
  SYNC_ALLOWED_MODEL,
  SYNC_LLM_TIMEOUT_MS,
} from '../constants';
import type {
  AppSettings,
  Product,
  TargetPayload,
  ValidationVerdict,
  Violation,
} from '../types';
import { LlmError, callGemini } from './llm/geminiClient';
import { buildPrompt } from './llm/promptBuilder';
import { getRulebook } from './rulebookService';
import { getApiKey } from './settingsStore';
import { hasValidatableContent } from './targetCollector';

export interface ValidateOptions {
  product: Product;
  /** 동기 경로(workflowValidator)는 25초 예산 안에서 끝나야 한다. */
  mode: 'sync' | 'async';
  settings: AppSettings;
  target: TargetPayload;
}

export interface ValidationOutcome {
  verdict: ValidationVerdict;
  /** 실패 정책까지 적용한 최종 판단. */
  shouldBlock: boolean;
}

function errorVerdict(reason: string, model: string, hash: string, latencyMs: number): ValidationVerdict {
  return {
    verdict: 'ERROR',
    violations: [],
    blockingViolations: [],
    model,
    rulebookHash: hash,
    evaluatedAt: new Date().toISOString(),
    latencyMs,
    errorReason: reason,
  };
}

function selectBlocking(violations: Violation[], settings: AppSettings): Violation[] {
  const threshold = SEVERITY_ORDER[settings.severityThreshold];
  return violations.filter((violation) => SEVERITY_ORDER[violation.severity] >= threshold);
}

/**
 * 동기 경로에서는 모델 선택을 무시하고 Flash로 강제한다.
 * Pro는 25초 예산 안에 응답이 돌아오지 않을 가능성이 높아, 설정 실수가 곧 업무 중단이 된다.
 */
function resolveModel(settings: AppSettings, mode: ValidateOptions['mode']): string {
  return mode === 'sync' ? SYNC_ALLOWED_MODEL : settings.model;
}

export async function validate(options: ValidateOptions): Promise<ValidationOutcome> {
  const { product, mode, settings, target } = options;
  const startedAt = Date.now();
  const model = resolveModel(settings, mode);
  const failOpen = settings.failPolicy === 'fail-open';

  if (settings.rulebooks.length === 0) {
    // 룰북이 지정되지 않았다면 검증할 기준이 없다. 이것은 장애가 아니라 미설정이므로
    // 실패 정책과 무관하게 통과시킨다.
    return {
      verdict: errorVerdict('룰북이 지정되지 않았습니다.', model, '', Date.now() - startedAt),
      shouldBlock: false,
    };
  }

  if (!hasValidatableContent(target)) {
    // Create 전환에서는 이슈 키도 없고 modifiedFields도 비어 플랫폼이 본문을 안 넘기는
    // 경우가 있다. 이때 전부 차단하면 정상 이슈까지 못 만들므로 통과시키되, 미검증을
    // 명시적으로 남긴다. 실제 차단은 이슈가 존재하는 이후 전환에서 한다.
    const reason = target.reference
      ? '검증할 텍스트가 없습니다.'
      : '생성(Create) 전환에서는 Jira가 요약/설명을 Forge 검증기에 전달하지 않아 검증할 수 없습니다. 이슈가 생긴 뒤의 전환에 검증기를 등록하세요.';
    return {
      verdict: errorVerdict(reason, model, '', Date.now() - startedAt),
      shouldBlock: false,
    };
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      verdict: errorVerdict('Gemini API Key가 설정되지 않았습니다.', model, '', Date.now() - startedAt),
      shouldBlock: !failOpen,
    };
  }

  let rulebookHash = '';
  try {
    const rulebook = await getRulebook(product);
    rulebookHash = rulebook.hash;

    if (!rulebook.text) {
      return {
        verdict: errorVerdict('룰북 본문이 비어 있습니다.', model, rulebookHash, Date.now() - startedAt),
        shouldBlock: false,
      };
    }

    const prompt = buildPrompt(rulebook.text, target);
    const raw = await callGemini({
      apiKey,
      model,
      systemInstruction: prompt.systemInstruction,
      userContent: prompt.userContent,
      timeoutMs: mode === 'sync' ? SYNC_LLM_TIMEOUT_MS : ASYNC_LLM_TIMEOUT_MS,
    });

    const warnings = [...target.warnings];
    if (prompt.targetTruncated) {
      warnings.push('검증 대상 텍스트가 길어 일부만 검증했습니다.');
    }
    if (rulebook.truncated) {
      warnings.push('룰북이 길어 일부 규정만 반영되었습니다.');
    }

    const blockingViolations = selectBlocking(raw.violations, settings);

    return {
      verdict: {
        verdict: raw.verdict,
        violations: raw.violations,
        blockingViolations,
        model,
        rulebookHash,
        evaluatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      shouldBlock: blockingViolations.length > 0,
    };
  } catch (error) {
    const reason =
      error instanceof LlmError
        ? error.message
        : `검증 중 오류: ${error instanceof Error ? error.message : String(error)}`;

    // LLM 장애가 업무 중단으로 번지지 않도록 기본은 통과시키되, 미검증 사실을 반드시 남긴다.
    return {
      verdict: errorVerdict(reason, model, rulebookHash, Date.now() - startedAt),
      shouldBlock: !failOpen,
    };
  }
}

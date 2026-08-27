import { kvs } from '@forge/kvs';

import { DEFAULT_SETTINGS, GEMINI_MODELS, SECRET_KEY_GEMINI } from '../constants';
import type { AppSettings, GeminiModel, Product } from '../types';

function settingsKey(product: Product): string {
  return `settings:${product}`;
}

/**
 * 설정을 해석한다.
 *
 * 현재는 사이트 전역 설정만 존재하므로 `scopeId`는 항상 undefined이다.
 * 프로젝트/스페이스별 설정을 도입할 때는 이 함수 안에서 범위별 레코드를 먼저 읽고
 * 비어 있는 항목만 전역 설정으로 채우면 되며, 기존 전역 레코드의 스키마는 그대로 둘 수 있다.
 */
export async function resolveSettings(
  product: Product,
  _scopeId?: string,
): Promise<AppSettings> {
  const stored = await kvs.get<Partial<AppSettings>>(settingsKey(product));
  return withDefaults(stored);
}

/**
 * KVS에 남아 있는 모델명이 현재 허용 목록에 없으면 기본값으로 되돌린다.
 *
 * 저장된 값은 타입 검사를 거치지 않으므로, 제공자가 모델을 단종시켜 허용 목록을 좁히면
 * 옛 설정이 조용히 살아남아 모든 검증이 404로 실패한다. 실제로 Gemini 2.5 계열 단종 때
 * 이 경로로 장애가 발생했다.
 */
function resolveModel(stored: Partial<AppSettings> | undefined): GeminiModel {
  const candidate = stored?.model;
  return candidate && GEMINI_MODELS.includes(candidate) ? candidate : DEFAULT_SETTINGS.model;
}

export function withDefaults(stored: Partial<AppSettings> | undefined): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(stored ?? {}),
    model: resolveModel(stored),
    // 배열은 얕은 병합으로 되살아나지 않으므로 명시적으로 처리한다.
    rulebooks: stored?.rulebooks ?? DEFAULT_SETTINGS.rulebooks,
    jiraNotify: {
      ...DEFAULT_SETTINGS.jiraNotify,
      ...(stored?.jiraNotify ?? {}),
    },
  };
}

export async function saveSettings(
  product: Product,
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  const current = await resolveSettings(product);
  const next: AppSettings = { ...current, ...patch, provider: 'gemini' };
  await kvs.set(settingsKey(product), next);
  return next;
}

/**
 * Gemini API Key 저장.
 *
 * 한 설치(installation) 안에서는 제품 설정 화면이 같은 시크릿 키를 쓴다.
 * 다만 Forge KVS/Secret Store는 Jira 설치와 Confluence 설치가 **분리**되므로,
 * 사이트에 둘 다 설치된 경우 키는 각 제품 설정에서 각각 저장해야 한다.
 */
export async function setApiKey(apiKey: string): Promise<void> {
  await kvs.setSecret(SECRET_KEY_GEMINI, apiKey);
}

export async function getApiKey(): Promise<string | undefined> {
  const value = await kvs.getSecret<string>(SECRET_KEY_GEMINI);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function deleteApiKey(): Promise<void> {
  await kvs.deleteSecret(SECRET_KEY_GEMINI);
}

/** 평문 키를 프론트엔드로 돌려보내지 않기 위해, 존재 여부와 끝 4자리만 노출한다. */
export async function describeApiKey(): Promise<{ configured: boolean; hint?: string }> {
  const key = await getApiKey();
  if (!key) return { configured: false };
  return { configured: true, hint: `••••${key.slice(-4)}` };
}

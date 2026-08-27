import Resolver from '@forge/resolver';

import { GEMINI_MODELS, SYNC_ALLOWED_MODEL } from '../constants';
import { previewRulebook, refreshRulebook } from '../services/rulebookService';
import { listSpaces, searchContent } from '../services/confluenceApi';
import { listWritableTextFields } from '../services/jiraApi';
import { LlmError, testApiKey } from '../services/llm/geminiClient';
import {
  deleteApiKey,
  describeApiKey,
  getApiKey,
  resolveSettings,
  saveSettings,
  setApiKey,
} from '../services/settingsStore';
import type { AppSettings, Product, RulebookSource } from '../types';

const resolver = new Resolver();

function asProduct(value: unknown): Product {
  return value === 'jira' ? 'jira' : 'confluence';
}

resolver.define('getSettings', async ({ payload }) => {
  const product = asProduct(payload?.product);
  const [settings, apiKey] = await Promise.all([resolveSettings(product), describeApiKey()]);

  return {
    settings,
    apiKey,
    models: GEMINI_MODELS,
    // Jira 화면에서 Pro를 고를 수 있게 두면 25초 예산을 넘겨 사용자가 원인 불명의
    // 오류를 겪게 되므로, 동기 경로에서 실제로 쓰이는 모델을 화면에 알려 준다.
    syncEnforcedModel: SYNC_ALLOWED_MODEL,
  };
});

resolver.define('saveSettings', async ({ payload }) => {
  const product = asProduct(payload?.product);
  const patch = (payload?.settings ?? {}) as Partial<AppSettings>;
  const settings = await saveSettings(product, patch);

  // 룰북 구성이 바뀌면 캐시가 낡은다. 다음 검증이 캐시 미스 비용을 물지 않도록 즉시 갱신한다.
  let rulebookWarning: string | undefined;
  try {
    const bundle = await refreshRulebook(product);
    console.log(
      `[saveSettings/${product}] 룰북 캐시 갱신: sources=${settings.rulebooks.length}, pages=${bundle.pages.length}, chars=${bundle.charCount}, hash=${bundle.hash.slice(0, 12)}`,
    );
    for (const warning of bundle.warnings) {
      console.warn(`[saveSettings/${product}] ${warning}`);
    }
    rulebookWarning = bundle.warnings[0];
  } catch (error) {
    rulebookWarning = `룰북 캐시 갱신 실패: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[saveSettings/${product}] ${rulebookWarning}`);
  }

  return { settings, rulebookWarning };
});

resolver.define('saveApiKey', async ({ payload }) => {
  const apiKey = typeof payload?.apiKey === 'string' ? payload.apiKey.trim() : '';
  if (!apiKey) {
    return { ok: false, message: 'API Key를 입력하세요.' };
  }

  await setApiKey(apiKey);
  return { ok: true, apiKey: await describeApiKey() };
});

resolver.define('deleteApiKey', async () => {
  await deleteApiKey();
  return { ok: true, apiKey: await describeApiKey() };
});

resolver.define('testConnection', async ({ payload }) => {
  const product = asProduct(payload?.product);
  const settings = await resolveSettings(product);

  // 아직 저장하지 않은 입력값으로도 테스트할 수 있게, 전달된 키를 우선 사용한다.
  const typed = typeof payload?.apiKey === 'string' ? payload.apiKey.trim() : '';
  const resolvedKey = typed.length > 0 ? typed : await getApiKey();

  if (!resolvedKey) {
    return { ok: false, message: 'API Key가 설정되지 않았습니다.' };
  }

  try {
    await testApiKey(resolvedKey, settings.model);
    return { ok: true, message: `${settings.model} 연결에 성공했습니다.` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof LlmError ? error.message : '연결 테스트에 실패했습니다.',
    };
  }
});

resolver.define('searchRulebooks', async ({ payload }) => {
  const type = payload?.type;

  try {
    if (type === 'space') {
      const spaces = await listSpaces();
      const query = String(payload?.query ?? '').trim().toLowerCase();
      const filtered = query
        ? spaces.filter((space) => space.title.toLowerCase().includes(query))
        : spaces;
      return { ok: true, results: filtered.slice(0, 25) };
    }

    if (type !== 'page' && type !== 'folder') {
      return { ok: false, message: '지원하지 않는 선택 타입입니다.', results: [] };
    }

    return { ok: true, results: await searchContent(type, String(payload?.query ?? '')) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`searchRulebooks 실패 (type=${String(type)}): ${detail}`);
    return {
      ok: false,
      message: `검색 실패: ${detail}`,
      results: [],
    };
  }
});

resolver.define('previewRulebook', async ({ payload }) => {
  const sources = (payload?.rulebooks ?? []) as RulebookSource[];
  if (sources.length === 0) {
    return { ok: true, charCount: 0, pageCount: 0, truncated: false, warnings: [], pageTitles: [] };
  }

  try {
    return { ok: true, ...(await previewRulebook(sources)) };
  } catch (error) {
    return {
      ok: false,
      message: `미리보기 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

resolver.define('listJiraStatusFields', async () => {
  try {
    return { ok: true, fields: await listWritableTextFields() };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`listJiraStatusFields 실패: ${detail}`);
    return { ok: false, message: `필드 목록 조회 실패: ${detail}`, fields: [] };
  }
});

export const settingsResolver = resolver.getDefinitions();

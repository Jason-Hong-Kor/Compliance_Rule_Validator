import { kvs } from '@forge/kvs';

import {
  MAX_RULEBOOK_CHARS,
  MAX_RULEBOOK_PAGES,
  RULEBOOK_CACHE_TTL_SECONDS,
} from '../constants';
import type {
  Product,
  RulebookBundle,
  RulebookPageRef,
  RulebookSource,
} from '../types';
import { storageToText } from '../utils/storageToText';
import { sha256, truncate } from '../utils/text';
import {
  fetchChildPageIds,
  fetchFolderPageIds,
  fetchPage,
  fetchSpacePageIds,
} from './confluenceApi';
import { resolveSettings } from './settingsStore';

function cacheKey(product: Product): string {
  return `rulebook:cache:${product}`;
}

/**
 * 지정된 소스들로부터 룰북 페이지 목록을 해석한다.
 * 소스 하나가 실패해도 전체가 무너지지 않도록 경고로 남기고 계속 진행한다.
 */
async function resolvePageRefs(
  sources: RulebookSource[],
): Promise<{ refs: RulebookPageRef[]; warnings: string[] }> {
  const seen = new Set<string>();
  const refs: RulebookPageRef[] = [];
  const warnings: string[] = [];

  const push = (id: string, title: string) => {
    if (seen.has(id) || refs.length >= MAX_RULEBOOK_PAGES) return;
    seen.add(id);
    refs.push({ id, title });
  };

  for (const source of sources) {
    const remaining = MAX_RULEBOOK_PAGES - refs.length;
    if (remaining <= 0) {
      warnings.push(`페이지 수 상한(${MAX_RULEBOOK_PAGES})에 도달해 일부 룰북을 건너뛰었습니다.`);
      break;
    }

    try {
      if (source.type === 'page') {
        push(source.id, source.title);
        if (source.includeChildren) {
          for (const child of await fetchChildPageIds(source.id, remaining)) {
            push(child.id, child.title);
          }
        }
      } else if (source.type === 'folder') {
        const pages = await fetchFolderPageIds(source.id, remaining);
        if (pages.length === 0) {
          warnings.push(`폴더 "${source.title}"에 읽을 수 있는 페이지가 없습니다.`);
        }
        for (const page of pages) {
          push(page.id, page.title);
        }
      } else {
        const pages = await fetchSpacePageIds(source.id, remaining);
        if (pages.length === 0) {
          warnings.push(`스페이스 "${source.title}"에서 페이지를 찾지 못했습니다.`);
        }
        for (const page of pages) {
          push(page.id, page.title);
        }
      }
    } catch (error) {
      warnings.push(
        `룰북 소스 "${source.title}" 수집 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { refs, warnings };
}

/** 룰북 본문을 수집·정규화·병합하고 해시를 계산한다. */
export async function buildRulebook(sources: RulebookSource[]): Promise<RulebookBundle> {
  const { refs, warnings } = await resolvePageRefs(sources);
  const sections: string[] = [];
  const includedPages: RulebookPageRef[] = [];

  for (const ref of refs) {
    try {
      const page = await fetchPage(ref.id);
      const body = storageToText(page.body?.storage?.value ?? '');
      if (!body) continue;
      sections.push(`## ${page.title}\n\n${body}`);
      includedPages.push({ id: ref.id, title: page.title });
    } catch (error) {
      warnings.push(
        `룰북 페이지 "${ref.title}" 본문 조회 실패: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const merged = sections.join('\n\n---\n\n');
  const { text, truncated } = truncate(merged, MAX_RULEBOOK_CHARS);

  if (truncated) {
    warnings.push(
      `룰북 본문이 상한(${MAX_RULEBOOK_CHARS.toLocaleString()}자)을 초과해 일부가 잘렸습니다. 룰북 범위를 좁히거나 RAG 전환이 필요합니다.`,
    );
  }

  return {
    text,
    // 해시는 잘린 결과가 아니라 실제 전송 본문 기준으로 계산해, 판정 재현 조건과 일치시킨다.
    hash: sha256(text),
    pages: includedPages,
    charCount: text.length,
    truncated,
    builtAt: new Date().toISOString(),
    warnings,
  };
}

/**
 * 캐시된 룰북을 반환한다.
 *
 * Jira 동기 경로는 25초 예산 안에서 동작해야 하므로 검증 시점에 Confluence를 호출하면 안 된다.
 * 캐시가 비어 있는 첫 호출만 예외적으로 즉시 수집한다.
 */
export async function getRulebook(product: Product): Promise<RulebookBundle> {
  const cached = await kvs.get<RulebookBundle>(cacheKey(product));
  if (cached && cached.text) return cached;
  return refreshRulebook(product);
}

export async function refreshRulebook(product: Product): Promise<RulebookBundle> {
  const settings = await resolveSettings(product);
  const bundle = await buildRulebook(settings.rulebooks);
  await kvs.set(cacheKey(product), bundle, {
    ttl: { value: RULEBOOK_CACHE_TTL_SECONDS, unit: 'SECONDS' },
  });
  return bundle;
}

export async function invalidateRulebook(product: Product): Promise<void> {
  await kvs.delete(cacheKey(product));
}

/** 설정 화면의 병합 미리보기용. 캐시를 건드리지 않고 규모만 계산한다. */
export async function previewRulebook(sources: RulebookSource[]): Promise<{
  charCount: number;
  pageCount: number;
  truncated: boolean;
  warnings: string[];
  pageTitles: string[];
}> {
  const bundle = await buildRulebook(sources);
  return {
    charCount: bundle.charCount,
    pageCount: bundle.pages.length,
    truncated: bundle.truncated,
    warnings: bundle.warnings,
    pageTitles: bundle.pages.map((page) => page.title),
  };
}

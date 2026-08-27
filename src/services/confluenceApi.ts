import api, { route, type Route } from '@forge/api';

import { MAX_DESCENDANT_DEPTH } from '../constants';
import type { RulebookCandidate, RulebookSourceType } from '../types';

type Requester = ReturnType<typeof api.asApp>;

async function getJson<T>(requester: Requester, path: Route): Promise<T> {
  const response = await requester.requestConfluence(path, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Confluence API ${response.status}: ${body.slice(0, 500)}`);
  }
  return (await response.json()) as T;
}

interface PageDetail {
  id: string;
  title: string;
  version?: { number?: number };
  body?: { storage?: { value?: string } };
}

interface ChildEntry {
  id: string;
  title: string;
  type?: string;
  status?: string;
}

interface PagedResponse<T> {
  results?: T[];
  _links?: { next?: string };
}

export async function fetchPage(pageId: string, asUser = false): Promise<PageDetail> {
  const requester = asUser ? api.asUser() : api.asApp();
  return getJson<PageDetail>(
    requester,
    route`/wiki/api/v2/pages/${pageId}?body-format=storage`,
  );
}

/** 하위 페이지를 BFS로 순회한다. v2의 page children은 페이지만 반환한다. */
export async function fetchChildPageIds(pageId: string, limit: number): Promise<ChildEntry[]> {
  const collected: ChildEntry[] = [];
  const frontier = [pageId];

  while (frontier.length > 0 && collected.length < limit) {
    const current = frontier.shift();
    if (!current) break;

    const data = await getJson<PagedResponse<ChildEntry>>(
      api.asApp(),
      route`/wiki/api/v2/pages/${current}/children?limit=250`,
    );

    for (const child of data.results ?? []) {
      if (child.status && child.status !== 'current') continue;
      collected.push(child);
      frontier.push(child.id);
      if (collected.length >= limit) break;
    }
  }

  return collected;
}

/**
 * 폴더 하위 항목을 순회한다.
 *
 * CQL의 ancestor 함수는 폴더 같은 비페이지 콘텐츠를 지원하지 않으므로 전용 엔드포인트를 쓴다.
 * 응답에는 화이트보드·데이터베이스·임베드가 섞여 오는데 이들은 본문을 API로 읽을 수 없어
 * 페이지만 남긴다.
 */
export async function fetchFolderPageIds(folderId: string, limit: number): Promise<ChildEntry[]> {
  const data = await getJson<PagedResponse<ChildEntry>>(
    api.asApp(),
    route`/wiki/api/v2/folders/${folderId}/descendants?depth=${String(MAX_DESCENDANT_DEPTH)}&limit=250`,
  );

  return (data.results ?? [])
    .filter((entry) => entry.type === 'page')
    .filter((entry) => !entry.status || entry.status === 'current')
    .slice(0, limit);
}

interface SpaceEntry {
  id: string;
  key: string;
  name: string;
}

export async function resolveSpaceId(spaceKey: string): Promise<string | undefined> {
  const data = await getJson<PagedResponse<SpaceEntry>>(
    api.asApp(),
    route`/wiki/api/v2/spaces?keys=${spaceKey}&limit=1`,
  );
  return data.results?.[0]?.id;
}

export async function fetchSpacePageIds(spaceKey: string, limit: number): Promise<ChildEntry[]> {
  const spaceId = await resolveSpaceId(spaceKey);
  if (!spaceId) return [];

  const data = await getJson<PagedResponse<ChildEntry>>(
    api.asApp(),
    route`/wiki/api/v2/spaces/${spaceId}/pages?status=current&limit=250`,
  );
  return (data.results ?? []).slice(0, limit);
}

export async function listSpaces(): Promise<RulebookCandidate[]> {
  // 설정 화면의 룰북 후보는 나중에 앱 권한(asApp)으로 수집한다.
  // asUser로 검색하면 사용자 동의 전 NEEDS_AUTHENTICATION_ERR가 나고,
  // 리졸버의 catch가 Forge 동의 프롬프트까지 가로채 검색이 영구히 실패한다.
  const data = await getJson<PagedResponse<SpaceEntry>>(
    api.asApp(),
    route`/wiki/api/v2/spaces?status=current&limit=250`,
  );
  return (data.results ?? []).map((space) => ({
    id: space.key,
    title: space.name,
    type: 'space' as const,
  }));
}

interface SearchResult {
  content?: { id?: string; type?: string; title?: string };
  id?: string;
  entityType?: string;
  title?: string;
  resultGlobalContainer?: { title?: string };
}

/**
 * 페이지 또는 폴더를 제목으로 검색한다.
 *
 * 트리 UI가 없는 대신 각 결과에 경로(스페이스명 또는 조상 체인)를 붙여 동명 문서를 구분할 수 있게 한다.
 * 검색·수집 모두 앱 권한으로 수행한다. 후보에 나온 문서는 저장 후 앱이 실제로 읽을 수 있는
 * 문서와 일치해야 하므로, 사용자 권한 기준 검색은 오히려 오해를 낳는다.
 */
export async function searchContent(
  type: Exclude<RulebookSourceType, 'space'>,
  query: string,
): Promise<RulebookCandidate[]> {
  const trimmed = query.trim();
  const escaped = trimmed.replace(/["\\]/g, '\\$&');
  const cql = trimmed
    ? `type = "${type}" AND title ~ "${escaped}*"`
    : `type = "${type}"`;

  const data = await getJson<PagedResponse<SearchResult>>(
    api.asApp(),
    route`/wiki/rest/api/search?cql=${cql}&limit=25&expand=content.ancestors`,
  );

  return (data.results ?? []).flatMap((result) => {
    const id = result.content?.id ?? result.id;
    const title = result.content?.title ?? result.title;
    if (!id || !title) return [];
    return [
      {
        id,
        title,
        type,
        path: result.resultGlobalContainer?.title,
      },
    ];
  });
}

export interface PageVersionSummary {
  number: number;
  createdAt?: string;
}

export async function fetchPageVersions(pageId: string): Promise<PageVersionSummary[]> {
  const data = await getJson<PagedResponse<PageVersionSummary>>(
    api.asApp(),
    route`/wiki/api/v2/pages/${pageId}/versions?limit=50&sort=-modified-date`,
  );
  return data.results ?? [];
}

/**
 * 페이지를 지정한 과거 버전으로 복원한다.
 *
 * v2에는 대응 엔드포인트가 없어 v1의 restore 오퍼레이션을 사용한다.
 * 본문을 직접 덮어쓰는 방식과 달리 버전 이력이 보존되므로 감사 추적에 유리하다.
 */
export async function restorePageVersion(
  pageId: string,
  versionNumber: number,
  message: string,
): Promise<void> {
  const response = await api.asApp().requestConfluence(
    route`/wiki/rest/api/content/${pageId}/version`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        operationKey: 'RESTORE',
        params: { versionNumber, message, restoreTitle: true },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`페이지 버전 복원 실패 ${response.status}: ${body.slice(0, 500)}`);
  }
}

export async function addFooterComment(pageId: string, markup: string): Promise<void> {
  const response = await api.asApp().requestConfluence(route`/wiki/api/v2/footer-comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      pageId,
      body: { representation: 'storage', value: markup },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`코멘트 등록 실패 ${response.status}: ${body.slice(0, 500)}`);
  }
}

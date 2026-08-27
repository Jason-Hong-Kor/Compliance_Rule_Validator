import { Queue } from '@forge/events';

import { QUEUE_NAME } from '../constants';
import { isSelfInflictedUpdate } from '../services/enforcement/confluenceEnforcer';
import type { PageValidationJob } from '../types';

const queue = new Queue({ key: QUEUE_NAME });

interface ConfluencePageEvent {
  eventType?: string;
  atlassianId?: string;
  selfGenerated?: boolean;
  updateTrigger?: string;
  content?: {
    id?: string;
    type?: string;
    status?: string;
    title?: string;
    version?: { number?: number };
    space?: { key?: string };
  };
}

/**
 * 본문이 실제로 바뀌지 않은 업데이트는 검증할 이유가 없다.
 * 라벨 부여나 이동 같은 변경까지 LLM을 호출하면 비용만 늘고 사용자에게 주는 값은 없다.
 */
const CONTENT_CHANGING_TRIGGERS = new Set([
  'edit_page',
  'edit',
  'page_edit',
  'move_page',
  'restore_page',
]);

function isContentChange(event: ConfluencePageEvent): boolean {
  if (event.eventType?.includes(':created:')) return true;
  const trigger = event.updateTrigger;
  // updateTrigger가 없으면 판단할 근거가 없으므로 검증하는 쪽을 택한다.
  if (!trigger) return true;
  return CONTENT_CHANGING_TRIGGERS.has(trigger);
}

/**
 * 페이지 출간/수정 이벤트를 비동기 큐로 넘긴다.
 *
 * 트리거 함수 자체는 사용자 주도 호출과 같은 짧은 한도에서 돌기 때문에, 여기서 LLM을
 * 호출하지 않고 큐에만 적재한다. 실제 검증은 timeoutSeconds로 확장된 소비자가 수행한다.
 */
export const confluencePageTrigger = async (event: ConfluencePageEvent): Promise<void> => {
  const content = event.content;
  const pageId = content?.id;
  const version = content?.version?.number;

  if (!pageId || typeof version !== 'number') {
    console.warn('페이지 식별자 또는 버전이 없는 이벤트를 건너뜁니다.', event.eventType);
    return;
  }

  if (content?.status && content.status !== 'current') return;

  // 자동 복원이 만든 새 버전에 앱이 다시 반응해 검증을 무한 반복하는 것을 막는다.
  // selfGenerated를 1차 방어선으로 쓰고, 복원 버전 표시를 2차로 둔다.
  if (event.selfGenerated) return;
  if (await isSelfInflictedUpdate(pageId, version)) return;

  if (!isContentChange(event)) return;

  const job: PageValidationJob = {
    kind: 'page',
    pageId,
    version,
    title: content?.title ?? '(제목 없음)',
    spaceKey: content?.space?.key,
    actorAccountId: event.atlassianId,
  };

  await queue.push({ body: job });
};

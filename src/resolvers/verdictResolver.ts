import Resolver from '@forge/resolver';

import { fetchPage } from '../services/confluenceApi';
import { readPageRecord } from '../services/enforcement/confluenceEnforcer';
import { readIssueVerdictRecord } from '../services/enforcement/jiraEnforcer';
import { resolveSettings } from '../services/settingsStore';
import { collectConfluenceTargetText } from '../services/targetCollector';
import { validate } from '../services/validationService';

const resolver = new Resolver();

resolver.define('getIssueVerdict', async ({ payload, context }) => {
  const fromContext = (context?.extension as { issue?: { key?: string } } | undefined)?.issue?.key;
  const fromPayload = typeof payload?.issueKey === 'string' ? payload.issueKey : undefined;
  // FCT에 묶인 이슈만 반환한다. payload만 믿으면 다른 이슈의 근거가 새어 나간다.
  const issueKey = fromContext ?? fromPayload;

  if (!issueKey) {
    return { ok: false, message: '이슈를 식별할 수 없습니다.' };
  }

  const record = await readIssueVerdictRecord(issueKey);
  return { ok: true, record };
});

resolver.define('getPageVerdict', async ({ payload, context }) => {
  const pageId =
    (typeof payload?.pageId === 'string' ? payload.pageId : undefined) ??
    (context?.extension as { content?: { id?: string } } | undefined)?.content?.id;

  if (!pageId) {
    return { ok: false, message: '문서를 식별할 수 없습니다.' };
  }

  const [record, settings] = await Promise.all([
    readPageRecord(pageId),
    resolveSettings('confluence'),
  ]);

  return { ok: true, record, enforcementMode: settings.enforcementMode };
});

/**
 * 출간 전 온디맨드 검증.
 *
 * Confluence는 출간을 원천 차단할 수 없으므로, 사용자가 차단당하기 전에 스스로 확인할
 * 통로를 제공한다. 검증만 수행하고 강제 조치나 코멘트는 남기지 않는다.
 */
resolver.define('precheckPage', async ({ payload, context }) => {
  const pageId =
    (typeof payload?.pageId === 'string' ? payload.pageId : undefined) ??
    (context?.extension as { content?: { id?: string } } | undefined)?.content?.id;

  if (!pageId) {
    return { ok: false, message: '문서를 식별할 수 없습니다.' };
  }

  try {
    const settings = await resolveSettings('confluence');
    const page = await fetchPage(pageId, true);
    const target = collectConfluenceTargetText(
      page.title ?? '',
      page.body?.storage?.value ?? '',
    );

    // 사용자가 응답을 기다리는 화면이므로 동기 예산에 맞춰 실행한다.
    const outcome = await validate({
      product: 'confluence',
      mode: 'sync',
      settings,
      target,
    });

    return { ok: true, verdict: outcome.verdict, wouldBlock: outcome.shouldBlock };
  } catch (error) {
    return {
      ok: false,
      message: `검증 실패: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
});

export const verdictResolver = resolver.getDefinitions();

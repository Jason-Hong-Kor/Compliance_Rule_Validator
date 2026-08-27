import { refreshRulebook } from '../services/rulebookService';
import { resolveSettings } from '../services/settingsStore';
import type { Product } from '../types';

/**
 * 룰북 캐시를 미리 채워 두는 스케줄 작업.
 *
 * Jira 동기 경로는 25초 예산 안에서 끝나야 해서 검증 시점에 Confluence를 순회할 수 없다.
 * 캐시 TTL이 24시간이므로 하루 한 번 갱신해, 사용자가 캐시 미스 비용을 물지 않게 한다.
 *
 * 주의: Forge KVS는 **제품 설치(installation)마다 분리**된다. 같은 사이트에 Jira와
 * Confluence가 각각 설치되어 있으면 저장소가 두 개다. 이 스케줄은 양쪽 설치에서 각각
 * 실행되므로, Confluence 설치 쪽에서는 `settings:jira`가 비어 있는 것이 정상이다.
 * (Jira 설정 화면에서 저장한 값은 Jira 설치 KVS에만 있다.)
 */
export const rulebookWarmup = async (): Promise<void> => {
  const products: Product[] = ['jira', 'confluence'];

  for (const product of products) {
    try {
      const settings = await resolveSettings(product);
      if (settings.rulebooks.length === 0) {
        console.log(
          `[warmup/${product}] 이 설치의 저장소에 룰북 소스가 없어 캐시 갱신을 건너뜁니다. ` +
            `(Jira/Confluence 설치의 KVS는 서로 보이지 않습니다. 해당 제품 설정 화면에서 저장했는지 확인하세요.)`,
        );
        continue;
      }

      const bundle = await refreshRulebook(product);
      console.log(
        `[warmup/${product}] 룰북 캐시 갱신: sources=${settings.rulebooks.length}, pages=${bundle.pages.length}, chars=${bundle.charCount}, hash=${bundle.hash.slice(0, 12)}`,
      );
      for (const warning of bundle.warnings) {
        console.warn(`[warmup/${product}] ${warning}`);
      }
    } catch (error) {
      console.error(`[warmup/${product}] 룰북 캐시 갱신 실패`, error);
    }
  }
};

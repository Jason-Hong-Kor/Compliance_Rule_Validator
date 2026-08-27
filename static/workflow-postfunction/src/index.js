import { workflowRules } from '@forge/jira-bridge';

/**
 * 새 워크플로우 편집기는 후처리 추가 시 create 화면의 Add를 눌러
 * onConfigure가 JSON을 반환해야 규칙을 저장한다. 설정 항목은 없다.
 */
const onConfigureFn = async () => JSON.stringify({ version: 1 });

workflowRules.onConfigure(onConfigureFn).catch((error) => {
  console.error('[workflow-postfunction] onConfigure 등록 실패', error);
});

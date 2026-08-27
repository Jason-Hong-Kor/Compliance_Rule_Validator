import { Queue } from '@forge/events';

import { QUEUE_NAME } from '../constants';
import type { IssueValidationJob } from '../types';

const queue = new Queue({ key: QUEUE_NAME });

/** 트리거와 워크플로우 후처리가 같은 소비자를 타도록 큐 적재를 한곳으로 모은다. */
export async function enqueueJiraIssueJob(job: IssueValidationJob): Promise<void> {
  try {
    await queue.push({ body: job });
    console.log(`[jiraQueue] 적재 issueKey=${job.issueKey} eventType=${job.eventType}`);
  } catch (error) {
    console.error(`[jiraQueue] 적재 실패 issueKey=${job.issueKey}`, error);
  }
}

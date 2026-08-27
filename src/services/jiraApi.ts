import api, { route } from '@forge/api';

import { ISSUE_PROPERTY_KEY } from '../constants';
import type { IssueComplianceRecord } from '../types';

export interface JiraUserRef {
  accountId?: string;
  displayName?: string;
}

export interface IssueFields {
  summary?: string;
  description?: unknown;
  reporter?: JiraUserRef;
  assignee?: JiraUserRef;
}

export async function fetchIssueFields(issueKey: string): Promise<IssueFields | undefined> {
  const response = await api
    .asApp()
    .requestJira(
      route`/rest/api/3/issue/${issueKey}?fields=summary,description,reporter,assignee`,
      {
        headers: { Accept: 'application/json' },
      },
    );

  if (!response.ok) {
    // 생성 전환처럼 이슈가 아직 없는 경우가 정상적으로 존재하므로 예외로 올리지 않는다.
    return undefined;
  }

  const payload = (await response.json()) as { fields?: IssueFields };
  return payload.fields;
}

export async function addIssueComment(
  issueKey: string,
  body: Record<string, unknown>,
): Promise<boolean> {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/comment`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`이슈 ${issueKey} 코멘트 등록 실패 ${response.status}: ${detail}`);
    return false;
  }
  return true;
}

export interface IssueNotifyRequest {
  subject: string;
  textBody: string;
  htmlBody: string;
  reporter: boolean;
  groupName?: string;
}

/**
 * Jira 이슈 알림 API. 사이트 메일 설정과 수신자 개인 알림 선호에 따라
 * 실제로 메일이 가지 않을 수 있다. 본문에는 원문 인용을 넣지 않는다.
 */
export async function notifyIssue(issueKey: string, request: IssueNotifyRequest): Promise<boolean> {
  const to: Record<string, unknown> = {
    reporter: request.reporter,
    assignee: false,
    watchers: false,
    voters: false,
  };
  if (request.groupName) {
    to.groups = [{ name: request.groupName }];
  }

  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}/notify`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: request.subject,
      textBody: request.textBody,
      htmlBody: request.htmlBody,
      to,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`이슈 ${issueKey} 이메일 알림 실패 ${response.status}: ${detail}`);
    return false;
  }
  return true;
}

export async function saveIssueVerdict(
  issueKey: string,
  record: IssueComplianceRecord,
): Promise<void> {
  await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueKey}/properties/${ISSUE_PROPERTY_KEY}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
}

export interface JiraFieldOption {
  id: string;
  name: string;
}

const WRITABLE_TEXT_CUSTOM = new Set([
  'com.atlassian.jira.plugin.system.customfieldtypes:textfield',
  'com.atlassian.jira.plugin.system.customfieldtypes:textarea',
]);

interface JiraFieldDescriptor {
  id?: string;
  name?: string;
  custom?: boolean;
  schema?: { type?: string; custom?: string };
}

/** 이슈 화면에 결과를 쓸 수 있는 한 줄/문단 커스텀 필드만 돌려준다. */
export async function listWritableTextFields(): Promise<JiraFieldOption[]> {
  const response = await api.asApp().requestJira(route`/rest/api/3/field`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`필드 목록 조회 실패 ${response.status}: ${detail}`);
  }

  const fields = (await response.json()) as JiraFieldDescriptor[];
  return fields
    .filter((field) => {
      if (!field.custom || typeof field.id !== 'string' || typeof field.name !== 'string') {
        return false;
      }
      if (field.schema?.type !== 'string') return false;
      return typeof field.schema.custom === 'string' && WRITABLE_TEXT_CUSTOM.has(field.schema.custom);
    })
    .map((field) => ({ id: field.id as string, name: field.name as string }))
    .sort((left, right) => left.name.localeCompare(right.name, 'ko'));
}

export async function updateIssueTextField(
  issueKey: string,
  fieldId: string,
  value: string,
): Promise<boolean> {
  const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueKey}`, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { [fieldId]: value } }),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error(`이슈 ${issueKey} 필드 ${fieldId} 갱신 실패 ${response.status}: ${detail}`);
    return false;
  }
  return true;
}

export async function readIssueVerdict(
  issueKey: string,
): Promise<IssueComplianceRecord | undefined> {
  // 게스트·익명은 asUser를 쓸 수 없다. 기록은 asApp으로 남겼으므로 같은 권한으로 읽는다.
  const response = await api
    .asApp()
    .requestJira(route`/rest/api/3/issue/${issueKey}/properties/${ISSUE_PROPERTY_KEY}`, {
      headers: { Accept: 'application/json' },
    });

  if (!response.ok) return undefined;

  const payload = (await response.json()) as { value?: IssueComplianceRecord };
  return payload.value;
}

import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Heading,
  Inline,
  Label,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Strong,
  Text,
  Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';

import type {
  AppSettings,
  EnforcementMode,
  FailPolicy,
  GeminiModel,
  Product,
  RulebookSource,
  Severity,
} from '../../types';
import { RulebookPicker } from './RulebookPicker';
import { type TextInputEvent, inputValue } from './inputValue';

interface Option<T extends string> {
  label: string;
  value: T;
}

const MODEL_OPTIONS: Option<GeminiModel>[] = [
  { label: 'gemini-3.6-flash', value: 'gemini-3.6-flash' },
];

const SEVERITY_OPTIONS: Option<Severity>[] = [
  { label: 'CRITICAL — 치명적 위반만 차단', value: 'CRITICAL' },
  { label: 'MAJOR — 주요 위반 이상 차단 (권장)', value: 'MAJOR' },
  { label: 'MINOR — 모든 위반 차단', value: 'MINOR' },
];

const FAIL_POLICY_OPTIONS: Option<FailPolicy>[] = [
  { label: 'fail-open — 검증 실패 시 통과시키고 기록 (권장)', value: 'fail-open' },
  { label: 'fail-closed — 검증 실패 시 차단', value: 'fail-closed' },
];

const ENFORCEMENT_OPTIONS: Option<EnforcementMode>[] = [
  { label: 'Advisory — 위반 코멘트만 등록', value: 'advisory' },
  { label: 'Gate — 코멘트 + 미준수 상태 표시', value: 'gate' },
  { label: 'Revert — 직전 준수 버전으로 자동 복원', value: 'revert' },
];

const ON_OFF_OPTIONS: Option<'on' | 'off'>[] = [
  { label: '사용', value: 'on' },
  { label: '사용 안 함', value: 'off' },
];

interface LoadedSettings {
  settings: AppSettings;
  apiKey: { configured: boolean; hint?: string };
  syncEnforcedModel: GeminiModel;
}

function findOption<T extends string>(options: Option<T>[], value: T): Option<T> | undefined {
  return options.find((option) => option.value === value);
}

export const SettingsForm = ({ product }: { product: Product }) => {
  const [loaded, setLoaded] = useState<LoadedSettings | undefined>();
  const [draft, setDraft] = useState<AppSettings | undefined>();
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ appearance: 'success' | 'error' | 'information'; text: string } | undefined>();
  const [statusFields, setStatusFields] = useState<Option<string>[]>([
    { label: '(사용 안 함 — 앱 패널만)', value: '' },
  ]);

  useEffect(() => {
    void (async () => {
      const response = (await invoke('getSettings', { product })) as LoadedSettings;
      setLoaded(response);
      setDraft(response.settings);
      if (product === 'jira') {
        try {
          const listed = (await invoke('listJiraStatusFields')) as {
            ok?: boolean;
            fields?: { id: string; name: string }[];
          };
          const options: Option<string>[] = [
            { label: '(사용 안 함 — 앱 패널만)', value: '' },
            ...(listed.fields ?? []).map((field) => ({
              label: `${field.name} (${field.id})`,
              value: field.id,
            })),
          ];
          setStatusFields(options);
        } catch (error) {
          console.error('이슈 결과 필드 목록을 불러오지 못했습니다', error);
        }
      }
    })();
  }, [product]);

  if (!loaded || !draft) {
    return (
      <Inline space="space.100" alignBlock="center">
        <Spinner />
        <Text>설정을 불러오는 중…</Text>
      </Inline>
    );
  }

  const update = (patch: Partial<AppSettings>) => setDraft({ ...draft, ...patch });

  const saveAll = async () => {
    setBusy(true);
    setNotice(undefined);
    try {
      const response = (await invoke('saveSettings', { product, settings: draft })) as {
        settings: AppSettings;
        rulebookWarning?: string;
      };
      setDraft(response.settings);
      setNotice({
        appearance: response.rulebookWarning ? 'information' : 'success',
        text: response.rulebookWarning
          ? `설정을 저장했습니다. 다만 룰북 수집에 문제가 있습니다: ${response.rulebookWarning}`
          : '설정을 저장하고 룰북 캐시를 갱신했습니다. (병합 미리보기만으로는 저장되지 않습니다.)',
      });
    } catch (error) {
      setNotice({ appearance: 'error', text: `저장 실패: ${String(error)}` });
    } finally {
      setBusy(false);
    }
  };

  const saveKey = async () => {
    setBusy(true);
    setNotice(undefined);
    try {
      const response = (await invoke('saveApiKey', { apiKey: apiKeyInput })) as {
        ok: boolean;
        message?: string;
        apiKey?: LoadedSettings['apiKey'];
      };
      if (!response.ok) {
        setNotice({ appearance: 'error', text: response.message ?? 'API Key 저장에 실패했습니다.' });
        return;
      }
      setApiKeyInput('');
      setLoaded({ ...loaded, apiKey: response.apiKey ?? { configured: true } });
      setNotice({ appearance: 'success', text: 'API Key를 암호화 저장했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setBusy(true);
    setNotice(undefined);
    try {
      const response = (await invoke('testConnection', {
        product,
        apiKey: apiKeyInput,
      })) as { ok: boolean; message?: string };
      setNotice({
        appearance: response.ok ? 'success' : 'error',
        text: response.message ?? (response.ok ? '연결 성공' : '연결 실패'),
      });
    } finally {
      setBusy(false);
    }
  };

  const removeKey = async () => {
    setBusy(true);
    try {
      const response = (await invoke('deleteApiKey', {})) as { apiKey?: LoadedSettings['apiKey'] };
      setLoaded({ ...loaded, apiKey: response.apiKey ?? { configured: false } });
      setNotice({ appearance: 'information', text: 'API Key를 삭제했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack space="space.300">
      <Heading as="h2">Compliance Rule Validator 설정</Heading>

      {notice && (
        <SectionMessage appearance={notice.appearance}>
          <Text>{notice.text}</Text>
        </SectionMessage>
      )}

      {/* --- LLM 연결 --- */}
      <Stack space="space.150">
        <Heading as="h3">LLM 연결</Heading>
        <Text>
          API Key는 Forge Secret Store에 암호화되어 저장되며, 저장 후에는 다시 조회할 수 없습니다.
          같은 설정 화면 안에서는 Jira/Confluence 검증이 이 키를 공유하지만,{' '}
          <Strong>Jira 설치와 Confluence 설치의 저장소는 분리</Strong>
          되어 있습니다. 키와 룰북은 각 제품 설정 화면에서 각각 저장해야 합니다.
        </Text>

        <Text>
          현재 상태:{' '}
          <Strong>
            {loaded.apiKey.configured ? `설정됨 (${loaded.apiKey.hint})` : '설정되지 않음'}
          </Strong>
        </Text>

        <Box>
          <Label labelFor="gemini-api-key">Gemini API Key</Label>
          <Textfield
            id="gemini-api-key"
            type="password"
            value={apiKeyInput}
            placeholder={loaded.apiKey.configured ? '새 키로 교체하려면 입력' : 'AIza…'}
            onChange={(event: TextInputEvent) => setApiKeyInput(inputValue(event))}
          />
        </Box>

        <ButtonGroup>
          <Button appearance="primary" isDisabled={busy || !apiKeyInput} onClick={saveKey}>
            API Key 저장
          </Button>
          <Button isDisabled={busy} onClick={testConnection}>
            연결 테스트
          </Button>
          <Button
            appearance="subtle"
            isDisabled={busy || !loaded.apiKey.configured}
            onClick={removeKey}
          >
            삭제
          </Button>
        </ButtonGroup>

        <Box>
          <Label labelFor="model-select">LLM 모델</Label>
          <Select
            id="model-select"
            options={MODEL_OPTIONS}
            value={findOption(MODEL_OPTIONS, draft.model)}
            onChange={(option: Option<GeminiModel> | null) =>
              option && update({ model: option.value })
            }
          />
        </Box>

        {product === 'jira' && (
          <SectionMessage appearance="information" title="Jira 동기 검증은 25초 안에 끝나야 합니다">
            <Text>
              워크플로우 검증기는 사용자가 응답을 기다리는 동안 실행되며 Forge 함수 실행 한도가
              25초입니다. 그래서 Jira 차단 경로는 설정과 무관하게{' '}
              <Strong>{loaded.syncEnforcedModel}</Strong>로, 추론 단계를 최소로 낮춰 호출합니다.
            </Text>
          </SectionMessage>
        )}
      </Stack>

      {/* --- 강제 정책 --- */}
      <Stack space="space.150">
        <Heading as="h3">강제 정책</Heading>

        <Box>
          <Label labelFor="severity-select">차단 심각도 임계값</Label>
          <Select
            id="severity-select"
            options={SEVERITY_OPTIONS}
            value={findOption(SEVERITY_OPTIONS, draft.severityThreshold)}
            onChange={(option: Option<Severity> | null) =>
              option && update({ severityThreshold: option.value })
            }
          />
        </Box>

        <Box>
          <Label labelFor="failpolicy-select">검증 실패 시 처리</Label>
          <Select
            id="failpolicy-select"
            options={FAIL_POLICY_OPTIONS}
            value={findOption(FAIL_POLICY_OPTIONS, draft.failPolicy)}
            onChange={(option: Option<FailPolicy> | null) =>
              option && update({ failPolicy: option.value })
            }
          />
        </Box>

        {product === 'jira' && (
          <Stack space="space.100">
            <Heading as="h3">생성·칸반 이후 알림</Heading>
            <SectionMessage appearance="information" title="이슈 생성은 사전에 막을 수 없습니다">
              <Text>
                Create 전환에는 본문이 전달되지 않고, 칸반 보드 끌어다 놓기는 전환 검증기가
                메시지를 숨기거나 통과시킬 수 있습니다. 이슈가 저장된 뒤 비동기로 검증하고,
                위반 시 아래 대상에게 알립니다. 알림에는 원문 인용(개인정보)을 넣지 않습니다.
              </Text>
            </SectionMessage>
            <SectionMessage appearance="information" title="결과는 어디에 보이나요">
              <Text>
                이슈를 열면 화면 하단 앱 영역의 「규정 준수 검증」과 오른쪽 「규정 준수」에
                상세가 있습니다. 레이아웃에 필드를 넣을 필요는 없습니다. 이슈 화면의 일반
                필드로도 요지를 보이게 하려면 아래에서 텍스트 커스텀 필드를 지정하고, Jira
                화면 구성에 그 필드를 추가하세요.
              </Text>
            </SectionMessage>
            <Box>
              <Label labelFor="jira-notify-enabled">사후 검증 알림</Label>
              <Select
                id="jira-notify-enabled"
                options={ON_OFF_OPTIONS}
                value={findOption(ON_OFF_OPTIONS, draft.jiraNotify.enabled ? 'on' : 'off')}
                onChange={(option: Option<'on' | 'off'> | null) =>
                  option &&
                  update({
                    jiraNotify: { ...draft.jiraNotify, enabled: option.value === 'on' },
                  })
                }
              />
            </Box>
            <Box>
              <Label labelFor="jira-notify-reporter">작성자(reporter)에게 알림</Label>
              <Select
                id="jira-notify-reporter"
                options={ON_OFF_OPTIONS}
                value={findOption(ON_OFF_OPTIONS, draft.jiraNotify.notifyReporter ? 'on' : 'off')}
                onChange={(option: Option<'on' | 'off'> | null) =>
                  option &&
                  update({
                    jiraNotify: { ...draft.jiraNotify, notifyReporter: option.value === 'on' },
                  })
                }
              />
            </Box>
            <Box>
              <Label labelFor="jira-notify-email">이메일 병행 (Jira notify API)</Label>
              <Select
                id="jira-notify-email"
                options={ON_OFF_OPTIONS}
                value={findOption(ON_OFF_OPTIONS, draft.jiraNotify.email ? 'on' : 'off')}
                onChange={(option: Option<'on' | 'off'> | null) =>
                  option &&
                  update({
                    jiraNotify: { ...draft.jiraNotify, email: option.value === 'on' },
                  })
                }
              />
            </Box>
            <Box>
              <Label labelFor="jira-notify-group">추가 알림 그룹 이름 (선택)</Label>
              <Textfield
                id="jira-notify-group"
                value={draft.jiraNotify.groupName}
                placeholder="예: compliance-officers"
                onChange={(event: TextInputEvent) =>
                  update({
                    jiraNotify: { ...draft.jiraNotify, groupName: inputValue(event) },
                  })
                }
              />
            </Box>
            <Box>
              <Label labelFor="jira-status-field">이슈 화면 결과 필드 (선택)</Label>
              <Select
                id="jira-status-field"
                options={
                  draft.jiraNotify.statusFieldId &&
                  !statusFields.some((option) => option.value === draft.jiraNotify.statusFieldId)
                    ? [
                        ...statusFields,
                        {
                          label: `${draft.jiraNotify.statusFieldName || draft.jiraNotify.statusFieldId} (저장됨)`,
                          value: draft.jiraNotify.statusFieldId,
                        },
                      ]
                    : statusFields
                }
                value={
                  statusFields.find((option) => option.value === draft.jiraNotify.statusFieldId) ??
                  (draft.jiraNotify.statusFieldId
                    ? {
                        label: `${draft.jiraNotify.statusFieldName || draft.jiraNotify.statusFieldId} (저장됨)`,
                        value: draft.jiraNotify.statusFieldId,
                      }
                    : statusFields[0])
                }
                onChange={(option: Option<string> | null) => {
                  if (!option) return;
                  const name =
                    option.value === ''
                      ? ''
                      : option.label.replace(/\s*\([^)]*\)\s*$/, '').trim();
                  update({
                    jiraNotify: {
                      ...draft.jiraNotify,
                      statusFieldId: option.value,
                      statusFieldName: name,
                    },
                  });
                }}
              />
            </Box>
            <Text>
              이메일은 수신자의 Jira 알림 설정에 따라 도착하지 않을 수 있습니다. in-app은 이슈
              코멘트 멘션으로 벨 알림을 보냅니다.
            </Text>
          </Stack>
        )}

        {product === 'confluence' && (
          <Stack space="space.100">
            <Box>
              <Label labelFor="enforcement-select">Confluence 강제 모드</Label>
              <Select
                id="enforcement-select"
                options={ENFORCEMENT_OPTIONS}
                value={findOption(ENFORCEMENT_OPTIONS, draft.enforcementMode)}
                onChange={(option: Option<EnforcementMode> | null) =>
                  option && update({ enforcementMode: option.value })
                }
              />
            </Box>
            <SectionMessage appearance="information" title="Confluence는 출간을 사전에 막을 수 없습니다">
              <Text>
                Forge에는 출간을 차단하는 확장 지점이 없어, 출간 직후 검증하고 위 모드에 따라
                조치합니다. Revert 모드는 사용자의 편집 내용을 되돌리므로 도입 시 사전 공지를
                권장합니다.
              </Text>
            </SectionMessage>
          </Stack>
        )}
      </Stack>

      {/* --- 룰북 --- */}
      <RulebookPicker
        sources={draft.rulebooks}
        onChange={(rulebooks: RulebookSource[]) => update({ rulebooks })}
      />

      <ButtonGroup>
        <Button appearance="primary" isDisabled={busy} onClick={saveAll}>
          {busy ? '저장 중…' : '설정 저장'}
        </Button>
      </ButtonGroup>
    </Stack>
  );
};

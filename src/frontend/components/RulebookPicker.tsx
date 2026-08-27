import React, { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Heading,
  Inline,
  Label,
  Lozenge,
  SectionMessage,
  Stack,
  Strong,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Text,
  Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';

import type { RulebookCandidate, RulebookSource, RulebookSourceType } from '../../types';
import { type TextInputEvent, inputValue } from './inputValue';

const TAB_TYPES: RulebookSourceType[] = ['page', 'folder', 'space'];

const TYPE_LABEL: Record<RulebookSourceType, string> = {
  page: '페이지',
  folder: '폴더',
  space: '스페이스',
};

interface Props {
  sources: RulebookSource[];
  onChange: (sources: RulebookSource[]) => void;
}

interface PreviewState {
  charCount: number;
  pageCount: number;
  truncated: boolean;
  warnings: string[];
}

/**
 * 룰북 선택기.
 *
 * 트리 탐색 UI 대신 타입별 검색과 선택 목록 누적 방식을 쓴다. 트리가 없으면 같은 제목의
 * 문서를 구분할 수 없으므로, 각 결과에 경로(스페이스명)를 붙여 표시한다.
 */
export const RulebookPicker = ({ sources, onChange }: Props) => {
  const [activeType, setActiveType] = useState<RulebookSourceType>('page');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RulebookCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [preview, setPreview] = useState<PreviewState | undefined>();
  const [previewing, setPreviewing] = useState(false);

  const search = async (type: RulebookSourceType) => {
    setSearching(true);
    setMessage(undefined);
    try {
      const response = (await invoke('searchRulebooks', { type, query })) as {
        ok: boolean;
        results?: RulebookCandidate[];
        message?: string;
      };
      setResults(response.results ?? []);
      if (!response.ok) setMessage(response.message);
      else if ((response.results ?? []).length === 0) setMessage('검색 결과가 없습니다.');
    } catch (error) {
      setMessage(`검색 중 오류가 발생했습니다: ${String(error)}`);
    } finally {
      setSearching(false);
    }
  };

  const add = (candidate: RulebookCandidate) => {
    if (sources.some((source) => source.type === candidate.type && source.id === candidate.id)) {
      return;
    }
    onChange([
      ...sources,
      {
        type: candidate.type,
        id: candidate.id,
        title: candidate.title,
        path: candidate.path,
        // 폴더와 스페이스는 항상 하위를 순회하므로 이 값이 의미를 갖지 않는다.
        includeChildren: candidate.type !== 'page',
      },
    ]);
    setPreview(undefined);
  };

  const remove = (source: RulebookSource) => {
    onChange(sources.filter((item) => !(item.type === source.type && item.id === source.id)));
    setPreview(undefined);
  };

  const toggleChildren = (source: RulebookSource) => {
    onChange(
      sources.map((item) =>
        item.type === source.type && item.id === source.id
          ? { ...item, includeChildren: !item.includeChildren }
          : item,
      ),
    );
    setPreview(undefined);
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const response = (await invoke('previewRulebook', { rulebooks: sources })) as {
        ok: boolean;
        charCount?: number;
        pageCount?: number;
        truncated?: boolean;
        warnings?: string[];
        message?: string;
      };
      if (!response.ok) {
        setMessage(response.message);
        return;
      }
      setPreview({
        charCount: response.charCount ?? 0,
        pageCount: response.pageCount ?? 0,
        truncated: response.truncated ?? false,
        warnings: response.warnings ?? [],
      });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Stack space="space.200">
      <Heading as="h3">룰북 지정</Heading>
      <Text>
        검증 기준이 될 사내 규정 문서를 지정합니다. 각 규칙에 <Strong>CR-01</Strong> 같은
        식별자를 부여하면 위반 리포트에 규칙 ID가 정확히 인용됩니다.
      </Text>

      <Tabs
        id="rulebook-type-tabs"
        onChange={(index: number) => {
          const next = TAB_TYPES[index] ?? 'page';
          setActiveType(next);
          setResults([]);
          setMessage(undefined);
        }}
      >
        <TabList>
          {TAB_TYPES.map((type) => (
            <Tab key={type}>{TYPE_LABEL[type]}</Tab>
          ))}
        </TabList>
        {TAB_TYPES.map((type) => (
          <TabPanel key={type}>
            <Box paddingBlockStart="space.150">
              <Stack space="space.150">
                <Stack space="space.050">
                  <Label labelFor={`rulebook-search-${type}`}>
                    {TYPE_LABEL[type]} 제목으로 검색
                  </Label>
                  <Inline space="space.100" alignBlock="center">
                    <Textfield
                      id={`rulebook-search-${type}`}
                      value={query}
                      placeholder={
                        type === 'space' ? '스페이스 이름' : `${TYPE_LABEL[type]} 제목`
                      }
                      onChange={(event: TextInputEvent) => setQuery(inputValue(event))}
                    />
                    <Button
                      appearance="primary"
                      isDisabled={searching}
                      onClick={() => search(type)}
                    >
                      {searching ? '검색 중…' : '검색'}
                    </Button>
                  </Inline>
                </Stack>

                {results.map((candidate) => (
                  <Inline
                    key={`${candidate.type}-${candidate.id}`}
                    space="space.100"
                    alignBlock="center"
                    spread="space-between"
                  >
                    <Stack>
                      <Text>
                        <Strong>{candidate.title}</Strong>
                      </Text>
                      {candidate.path && <Text>{candidate.path}</Text>}
                    </Stack>
                    <Button onClick={() => add(candidate)}>추가</Button>
                  </Inline>
                ))}
              </Stack>
            </Box>
          </TabPanel>
        ))}
      </Tabs>

      {message && (
        <SectionMessage appearance="information">
          <Text>{message}</Text>
        </SectionMessage>
      )}

      <Heading as="h4">지정된 룰북 ({sources.length})</Heading>
      {sources.length === 0 ? (
        <SectionMessage appearance="warning" title="룰북이 지정되지 않았습니다">
          <Text>룰북이 없으면 검증 기준이 없어 모든 내용이 통과 처리됩니다.</Text>
        </SectionMessage>
      ) : (
        <Stack space="space.100">
          {sources.map((source) => (
            <Inline
              key={`${source.type}-${source.id}`}
              space="space.100"
              alignBlock="center"
              spread="space-between"
            >
              <Inline space="space.100" alignBlock="center">
                <Lozenge>{TYPE_LABEL[source.type]}</Lozenge>
                <Stack>
                  <Text>
                    <Strong>{source.title}</Strong>
                  </Text>
                  {source.path && <Text>{source.path}</Text>}
                </Stack>
              </Inline>
              <Inline space="space.100" alignBlock="center">
                {source.type === 'page' && (
                  <Checkbox
                    label="하위 포함"
                    isChecked={source.includeChildren}
                    onChange={() => toggleChildren(source)}
                  />
                )}
                <Button appearance="subtle" onClick={() => remove(source)}>
                  삭제
                </Button>
              </Inline>
            </Inline>
          ))}
        </Stack>
      )}

      <ButtonGroup>
        <Button isDisabled={previewing || sources.length === 0} onClick={runPreview}>
          {previewing ? '계산 중…' : '병합 미리보기'}
        </Button>
      </ButtonGroup>

      {preview && (
        <SectionMessage
          appearance={preview.truncated ? 'warning' : 'information'}
          title={`${preview.pageCount}개 페이지 · ${preview.charCount.toLocaleString()}자`}
        >
          <Stack space="space.050">
            {preview.truncated && (
              <Text>
                프롬프트 상한을 초과해 일부가 잘립니다. 룰북 범위를 좁히는 것을 권장합니다.
              </Text>
            )}
            {preview.warnings.map((warning) => (
              <Text key={warning}>{warning}</Text>
            ))}
          </Stack>
        </SectionMessage>
      )}
    </Stack>
  );
};

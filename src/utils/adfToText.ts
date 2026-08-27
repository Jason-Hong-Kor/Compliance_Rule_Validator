import { normalizeWhitespace } from './storageToText';

interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: Record<string, unknown>;
}

const BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'listItem',
  'blockquote',
  'codeBlock',
  'panel',
  'tableRow',
  'rule',
  'mediaSingle',
  'expand',
]);

function attrString(attrs: Record<string, unknown> | undefined, key: string): string {
  const value = attrs?.[key];
  return typeof value === 'string' ? value : '';
}

/**
 * Jira 설명 등 ADF(Atlassian Document Format) 문서를 평문으로 변환한다.
 *
 * 멘션·이모지·인라인 카드는 텍스트 노드가 아니라 attrs에만 값이 있어, 그대로 두면
 * 규정 검증에서 누락된다. 예를 들어 "@김철수 고객 연락처" 같은 문장에서 멘션이 사라지면
 * 문맥이 깨지므로 attrs에서 표시 텍스트를 복원한다.
 */
export function adfToText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  return normalizeWhitespace(walk(node as AdfNode));
}

function walk(node: AdfNode): string {
  if (node.type === 'text') {
    return node.text ?? '';
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'mention') {
    const label = attrString(node.attrs, 'text');
    return label || '@사용자';
  }

  if (node.type === 'emoji') {
    return attrString(node.attrs, 'shortName');
  }

  if (node.type === 'inlineCard' || node.type === 'blockCard' || node.type === 'embedCard') {
    return attrString(node.attrs, 'url');
  }

  if (node.type === 'media') {
    const alt = attrString(node.attrs, 'alt');
    return alt ? `[첨부: ${alt}]` : '[첨부]';
  }

  const children = (node.content ?? []).map(walk).join(
    node.type === 'tableRow' ? ' | ' : '',
  );

  if (node.type === 'listItem') {
    return `- ${children}\n`;
  }

  if (node.type && BLOCK_TYPES.has(node.type)) {
    return `${children}\n`;
  }

  return children;
}

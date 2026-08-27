const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

function decodeEntities(input: string): string {
  let out = input;
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    out = out.split(entity).join(char);
  }
  return out.replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/**
 * Confluence storage format(XHTML)을 LLM에 넣을 평문으로 변환한다.
 *
 * Forge 런타임에는 DOM 파서가 없어 정규식으로 처리한다. 룰북과 검증 대상 문서에서
 * 필요한 것은 텍스트와 표의 행/열 구분뿐이므로, 매크로 설정값처럼 판정에 방해가 되는
 * 메타데이터는 제거하고 사람이 읽는 내용만 남긴다.
 */
export function storageToText(storage: string): string {
  if (!storage) return '';

  let text = storage;

  // 매크로 설정 파라미터와 레이아웃 메타데이터는 판정에 무의미한 잡음이라 통째로 제거한다.
  text = text.replace(/<ac:parameter\b[^>]*>[\s\S]*?<\/ac:parameter>/g, '');
  text = text.replace(/<ac:adf-attribute\b[^>]*>[\s\S]*?<\/ac:adf-attribute>/g, '');
  text = text.replace(/<ri:[^>]*\/?>/g, '');

  // CDATA(코드 블록 등)는 감싼 껍데기만 벗기고 내용은 살린다.
  text = text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');

  // 주석 제거
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // 표 구조는 규정 문서에서 의미를 가지므로 구분자로 보존한다.
  text = text.replace(/<\/(td|th)>/gi, ' | ');
  text = text.replace(/<\/(tr)>/gi, '\n');

  // 블록 요소 경계를 줄바꿈으로 바꾼다.
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|h[1-6]|li|blockquote|pre|table|ac:layout-cell)>/gi, '\n');
  text = text.replace(/<li\b[^>]*>/gi, '- ');

  // 남은 태그 제거
  text = text.replace(/<[^>]+>/g, '');

  text = decodeEntities(text);

  return normalizeWhitespace(text);
}

export function normalizeWhitespace(input: string): string {
  return input
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1] !== ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * UI Kit 2의 이벤트는 브릿지를 건너오면서 직렬화되기 때문에 DOM 이벤트가 아니고
 * `target.value`가 옵셔널이다. 화면마다 좁히는 코드를 반복하지 않도록 한 곳에 모았다.
 */
export interface TextInputEvent {
  target: { value?: unknown };
}

export function inputValue(event: TextInputEvent): string {
  return typeof event.target.value === 'string' ? event.target.value : '';
}

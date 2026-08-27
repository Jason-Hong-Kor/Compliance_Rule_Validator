/**
 * `forge lint`는 Atlassian 로그인이 필요하다. 로그인 없이도 매니페스트의 구조적 오류를
 * 잡을 수 있도록, 함수/리소스 참조가 실제로 존재하는지와 핸들러가 export 되어 있는지를 검사한다.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = load(readFileSync(join(root, 'manifest.yml'), 'utf8'));
const errors = [];
const warnings = [];

const modules = manifest?.modules ?? {};
const declaredFunctions = new Map(
  (modules.function ?? []).map((fn) => [fn.key, fn.handler]),
);
const declaredResources = new Map(
  (manifest?.resources ?? []).map((res) => [res.key, res.path]),
);

const usedFunctions = new Set();
const usedResources = new Set();

// 모듈 키는 모듈 종류가 달라도 매니페스트 전역에서 유일해야 한다. 예를 들어 consumer 모듈과
// function 모듈이 같은 키를 쓰면 Forge는 이를 중복 extension key로 거부한다.
const moduleKeyOwners = new Map();
for (const [moduleType, entries] of Object.entries(modules)) {
  for (const entry of entries ?? []) {
    if (typeof entry?.key !== 'string') continue;
    const previous = moduleKeyOwners.get(entry.key);
    if (previous) {
      errors.push(`중복된 모듈 키 "${entry.key}": ${previous}와 ${moduleType}이 같은 키를 씁니다.`);
    } else {
      moduleKeyOwners.set(entry.key, moduleType);
    }
  }
}

for (const [moduleType, entries] of Object.entries(modules)) {
  if (moduleType === 'function') continue;

  for (const entry of entries ?? []) {
    for (const key of ['function', 'handler']) {
      if (typeof entry[key] === 'string') usedFunctions.add(entry[key]);
    }
    if (entry.resolver?.function) usedFunctions.add(entry.resolver.function);
    if (entry.dynamicProperties?.function) usedFunctions.add(entry.dynamicProperties.function);
    if (entry.resource) usedResources.add(entry.resource);

    for (const nestedKey of ['create', 'edit', 'view']) {
      const nested = entry[nestedKey];
      if (!nested) continue;
      if (nested.resource) usedResources.add(nested.resource);
      if (nested.resolver?.function) usedFunctions.add(nested.resolver.function);
    }

    if (entry.resource && entry.render !== 'native') {
      warnings.push(`${moduleType}/${entry.key}: resource를 쓰지만 render: native가 없습니다.`);
    }
  }
}

for (const fnKey of usedFunctions) {
  if (!declaredFunctions.has(fnKey)) {
    errors.push(`선언되지 않은 function 참조: ${fnKey}`);
  }
}

for (const resKey of usedResources) {
  if (!declaredResources.has(resKey)) {
    errors.push(`선언되지 않은 resource 참조: ${resKey}`);
  }
}

for (const [key, path] of declaredResources) {
  if (!existsSync(join(root, path))) {
    errors.push(`resource "${key}"의 경로가 존재하지 않습니다: ${path}`);
  }
  if (!usedResources.has(key)) warnings.push(`사용되지 않는 resource: ${key}`);
}

// 모든 핸들러가 index.ts에서 export 되는지 확인한다. 오타가 있으면 배포 후 런타임에야 드러난다.
const indexSource = readFileSync(join(root, 'src/index.ts'), 'utf8');
for (const [key, handler] of declaredFunctions) {
  if (!usedFunctions.has(key)) warnings.push(`사용되지 않는 function: ${key}`);

  const [file, exportName] = String(handler).split('.');
  if (file !== 'index') {
    warnings.push(`function "${key}"의 핸들러가 index가 아닙니다: ${handler}`);
    continue;
  }
  if (!new RegExp(`\\b${exportName}\\b`).test(indexSource)) {
    errors.push(`function "${key}"의 핸들러 ${handler}가 src/index.ts에서 export되지 않았습니다.`);
  }
}

const scopes = manifest?.permissions?.scopes ?? [];
if (!scopes.includes('storage:app')) {
  errors.push('storage:app 스코프가 없어 KVS/Secret Store를 사용할 수 없습니다.');
}

for (const warning of warnings) console.warn(`[warn] ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`[error] ${error}`);
  process.exit(1);
}

console.log(
  `매니페스트 검사 통과: 모듈 ${Object.keys(modules).length}종, 함수 ${declaredFunctions.size}개, 리소스 ${declaredResources.size}개`,
);

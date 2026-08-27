# 개발 명세서 (Development Specification)

> 본 문서는 `plan.md`(제품 기획 명세)를 **소스코드 개발이 가능한 수준**으로 구체화한 기술 명세서입니다.
> `plan.md`는 원본 기획서로서 수정하지 않으며, 기획과 플랫폼 제약이 충돌하는 부분은 본 문서의 [9. 기획 명세 대비 변경 사항](#9-기획-명세-대비-변경-사항)에 근거와 함께 기록합니다.

---

## 1. 개발 환경 (Environment)

### 1.1 언어 및 런타임

| 항목 | 선택 | 비고 |
| --- | --- | --- |
| 언어 | **TypeScript 5.x** | `strict: true`. LLM 응답 스키마·설정 객체·이벤트 페이로드의 타입 안정성 확보 |
| 로컬 Node.js | **Node.js 22 LTS** (v22.23.2 확인됨) | Forge CLI 요구사항 충족 |
| Forge 런타임 | `nodejs22.x` | `manifest.yml`의 `app.runtime.name`에 선언 |
| 패키지 매니저 | **npm 10.x** (v10.9.8 확인됨) | `package-lock.json` 커밋 |
| UI 프레임워크 | **Forge UI Kit 2** (`@forge/react`) | 별도 정적 빌드 파이프라인 불필요, Atlassian 디자인 시스템 자동 적용 |

### 1.2 필수 도구

```bash
# Forge CLI는 전역 설치 대신 프로젝트 devDependency + npx 사용을 권장
npx forge login             # Atlassian API 토큰으로 로그인
npm run check               # 로그인 없이 타입체크 + 매니페스트 정합성
npx forge register          # 최초 1회 (대화형 터미널 필수 — Developer Space 프롬프트)
npx forge lint              # 등록 이후 (유효한 app.id 필요)
npx forge deploy -e development
```

- **CLI 실행**: `@forge/cli`는 `devDependencies`에 포함되어 있으므로 `npx forge …`로 실행합니다. 전역 설치는 필수가 아닙니다.
- **Developer Space**: 모든 Forge 앱은 Developer Space에 속해야 합니다. `forge register`를 대화형 터미널에서 실행하면 그 자리에서 생성할 수 있고, [Developer Console](https://developer.atlassian.com/console)에서 미리 만들 수도 있습니다. 비-TTY 셸에서는 프롬프트가 실패합니다.
- **등록 → lint 순서**: `forge lint`는 유효한 `app.id`(UUID v4)를 요구합니다. 플레이스홀더 상태에서 실행하면 매니페스트 검사 전에 `Invalid ari string`으로 중단됩니다.
- **`tsconfig.json`에 `"noEmit": true` 금지**: `tsc --noEmit`는 npm 스크립트 플래그로 충분합니다. tsconfig에 두면 Forge 번들러(`ts-loader`)가 산출물을 만들지 못해 배포가 실패합니다.
- **Docker 불필요**: 현재 `forge tunnel`은 네이티브로 동작합니다.
- **Atlassian Cloud 개발 사이트**: Jira(회사 관리 프로젝트 1개 이상 권장) + Confluence가 활성화된 사이트가 필요합니다.
  - PoC 매니페스트는 `projectTypes: ['company-managed']`로 한정합니다. Forge 문서상 `team-managed`도 선언 가능하나 본 PoC에서는 미검증입니다. Free 플랜에서도 `Administer Jira`가 있으면 회사 관리 프로젝트를 만들 수 있습니다.
- **Gemini API Key**: [Google AI Studio](https://aistudio.google.com/apikey)에서 발급.
- **Runs on Atlassian 대상 아님**: Gemini egress(`inScopeEUD: true`) 때문에 `forge eligibility`가 `App is egressing data`로 부적격 판정합니다.

### 1.3 주요 의존성

| 패키지 | 용도 |
| --- | --- |
| `@forge/api` | Atlassian REST API 호출(`asApp`/`asUser`), 외부 `fetch` |
| `@forge/kvs` | Key-Value Store 및 **Secret Store**(API Key 암호화 저장) |
| `@forge/resolver` | 프론트엔드 ↔ 백엔드 함수 브리지 |
| `@forge/react` | UI Kit 2 컴포넌트 |
| `@forge/bridge` | 프론트엔드에서 `invoke`, `view.getContext` 호출 |
| `typescript`, `@types/node` | 빌드/타입 |

> **LLM SDK 미사용**: `@google/genai` 등 공식 SDK 대신 **Gemini REST API를 `fetch`로 직접 호출**합니다. Forge 샌드박스는 외부 egress를 `manifest.yml`에 선언된 도메인으로만 허용하고, SDK의 내부 전송 계층·재시도 로직이 샌드박스와 충돌할 위험이 있어 의존성을 최소화합니다.

---

## 2. 시스템 아키텍처

### 2.1 두 개의 실행 경로

Forge 플랫폼의 제약(→ [9장](#9-기획-명세-대비-변경-사항)) 때문에 Jira와 Confluence는 **본질적으로 다른 강제 방식**을 사용합니다. 이것이 본 시스템 설계의 핵심입니다.

```text
[경로 A] Jira — 동기 차단 (Hard Block) + 사후 탐지 (Detect & Notify)
────────────────────────────────────────────────────────────
A-1. 이슈 키가 있는 전환 (이슈 화면, 권장)
사용자: 이슈 전환 실행
    ▼
jira:workflowValidator 함수 호출  ◀── 사용자는 대기 중 (예산 25초)
    │  ※ 동일 본문·룰북 해시가 캐시에 있으면 LLM을 건너뛰고 즉시 차단/통과
    ├── PASS ──▶ { result: true }
    └── FAIL ──▶ { result: false, errorMessage } → 전환 거부, 이슈 패널

A-2. 생성 및 칸반 DnD (사전 차단 불가·불완전 → 9.8, 9.14)
이슈 저장 완료 (이슈 키 존재)
    ▼
jira:workflowPostFunction (Create에 수동 등록)  ◀── 이 사이트의 product event는 호출되지 않음
    │  트리거 avi:jira:created/updated:issue 는 인라인 수정 대비로 유지
    ▼
queue.push() ──▶ consumer (timeoutSeconds: 300)
    ├── PASS ──▶ 패널에 준수 기록
    └── FAIL ──▶ 패널 기록 + in-app(코멘트 멘션) / 선택적 email
                 ※ 알림 본문에 evidence(원문 인용) 금지. 격리는 Phase 2 (11.3)


[경로 B] Confluence — 비동기 검증 + 사후 조치 (Detect & Enforce)
────────────────────────────────────────────────────────────
사용자: 페이지 출간 (Publish)  ──▶ 저장 완료 (차단 불가)
    │
    ▼
trigger: avi:confluence:created:page / updated:page
    │
    ▼
queue.push()  ──▶ consumer 함수 (timeoutSeconds: 300)
    │
    ├─ 룰북 본문 로드
    ├─ 페이지 본문 (body.storage → 텍스트 추출)
    ▼
Gemini 3.6 Flash 호출
    │
    ├── PASS ──▶ 준수 스탬프 기록 (바이라인 배지: 초록)
    └── FAIL ──▶ 관리자가 설정한 강제 모드에 따라 분기
                  │
                  ├─ Advisory : 위반 내역 코멘트 등록 + 배지(노랑)
                  ├─ Gate     : Advisory + 배지(빨강, "출간 차단됨" 표시)
                  └─ Revert   : Gate + 직전 준수 버전으로 자동 복원
```

### 2.2 Confluence 강제 모드 (Enforcement Mode)

관리자 설정 화면에서 선택하며, 기본값은 `advisory`입니다.

| 모드 | 코멘트 | 상태 배지 | 버전 복원 | 사용 시나리오 |
| --- | --- | --- | --- | --- |
| `advisory` | O | 노랑 | X | 도입 초기, 규정 인식 제고 단계 |
| `gate` | O | 빨강 (차단 표시) | X | 감사 추적이 필요하나 작업 손실은 피해야 하는 단계 |
| `revert` | O | 빨강 | **O** | 강력 통제. 최초 버전 위반 시에는 복원 대상이 없어 휴지통 이동 대신 `gate`로 폴백 |

### 2.3 Forge 모듈 구성

| 모듈 | 키 | 역할 |
| --- | --- | --- |
| `jira:workflowValidator` | `compliance-workflow-validator` | **동기 차단 지점.** 워크플로우 전환에 관리자가 수동 등록 (Create는 9.8 한계) |
| `jira:workflowPostFunction` | `compliance-workflow-postfunction` | **생성 직후 사후 검증 진입점.** Create 전환의 Perform actions에 수동 등록. 새 편집기에는 create/edit/view Custom UI가 있어야 목록에 보임. Preview 모듈 |
| `trigger` | `jira-issue-trigger` | `updated:issue`는 인라인 수정·칸반 대비. `created:issue`는 구독만 하고 핸들러에서 건너뜀(후처리와 이중 알림 방지). 함수 키는 `jira-issue-trigger-fn` |
| `jira:adminPage` | `jira-settings` | LLM Provider/모델/API Key, 룰북 선택, 실패 정책·심각도, **사후 알림 수신자** |
| `jira:issuePanel` | `jira-compliance-panel` | 이슈 화면 하단 앱 영역의 검증 상세. `unlicensedAccess`로 게스트·익명도 조회 |
| `jira:issueContext` | `jira-compliance-context` | 이슈 화면 오른쪽 「규정 준수」. 접혀 있어도 로젠지. 이 모듈은 `unlicensedAccess` 미지원 |
| `confluence:globalSettings` | `confluence-settings` | LLM 설정, 룰북 선택, **강제 모드 선택** |
| `confluence:contentBylineItem` | `confluence-compliance-byline` | 페이지 컴플라이언스 상태 배지 → 클릭 시 위반 상세 모달 |
| `confluence:contentAction` | `confluence-precheck` | **출간 전 온디맨드 사전 검증** (원천 차단 불가에 대한 UX 보완) |
| `trigger` | `confluence-page-trigger` | `avi:confluence:created:page`, `avi:confluence:updated:page` 구독 |
| `consumer` | `compliance-consumer` | 큐 `compliance-validation` 소비자. 함수 키는 `compliance-consumer-fn` (모듈 키와 분리) |
| `scheduledTrigger` | `rulebook-warmup-trigger` | 일 1회 룰북 캐시 워밍업 |
| `function` | (다수) | 위 모듈들의 핸들러 및 리졸버. **모듈 키는 종류가 달라도 전역 유일**해야 함 |

> **모듈 키 전역 유일성**: `consumer`의 `key: compliance-consumer`와 `function`의 `key`를 같게 두면 Forge가 중복 extension key로 배포를 거부합니다. 함수 키는 `compliance-consumer-fn`으로 접미사를 둡니다. `scripts/check-manifest.mjs`가 이 중복을 로그인 없이 검사합니다.

### 2.4 룰북 선택 UI 설계

트리 탐색 UI는 구현하지 않되, **폴더 또는 페이지를 선택**할 수 있어야 합니다. Confluence Cloud에는 페이지와 별개로 **폴더(Folder)가 독립 콘텐츠 타입**으로 존재하므로(`/wiki/api/v2/folders`), 선택 대상은 세 가지입니다.

| 선택 타입 | 수집 방식 | 비고 |
| --- | --- | --- |
| `page` | 해당 페이지 본문. `includeChildren`이 켜져 있으면 하위 페이지까지 순회 | `plan.md`의 "Parent Page" 지정에 해당 |
| `folder` | `GET /folders/{id}/descendants?depth=N`로 폴더 하위 페이지 전체 수집 | 응답의 `type` 필드로 `page`만 필터링 (화이트보드·데이터베이스·임베드 제외) |
| `space` | 스페이스 전체 페이지 수집 | 규정 전용 스페이스를 운영하는 경우 |

**UI 흐름** (트리 없이 구현)

1. **타입 선택 탭**: `페이지 | 폴더 | 스페이스`
2. **검색 입력** → 타입별 조회 (**`asApp`으로 호출** — 9.10 참조)
   - 페이지/폴더: `GET /wiki/rest/api/search?cql=type=page|folder AND title~"{검색어}"&expand=content.ancestors`
   - 스페이스: `GET /wiki/api/v2/spaces?limit=250` 후 클라이언트 필터
3. **결과 목록에서 선택** → 선택 항목이 하단 "지정된 룰북" 목록에 누적 (복수 지정)
4. 각 항목에 **하위 포함 토글**(`includeChildren`)과 삭제 버튼 제공
5. **미리보기**: 병합 결과의 총 문자 수와 포함된 페이지 수를 표시해, 60,000자 상한 초과 여부를 저장 전에 확인. **미리보기는 draft만 사용하며 KVS 캐시를 갱신하지 않음** — 캐시는 **설정 저장** 시에만 갱신

> 검색 결과에는 각 항목의 **경로(조상 제목 체인)**를 함께 표시합니다. 트리 UI 없이도 동명 페이지를 구분할 수 있게 하려는 목적입니다.

### 2.5 권한 (`permissions`)

```yaml
permissions:
  scopes:
    # Jira
    - read:jira-work
    - write:jira-work
    - send:notification:jira   # 사후 검증 이메일. 설정이 꺼져 있으면 호출하지 않음
    - manage:jira-configuration  # 워크플로우 후처리 페이로드 (Create 사후 검증)
    # Confluence (클래식 — 제거 금지, ECO-1292)
    - read:confluence-content.all
    - read:confluence-content.summary
    - write:confluence-content
    - read:confluence-space.summary
    - search:confluence                # CQL 검색 필수
    # Confluence (granular — v2 REST가 클래식만으로는 scope does not match)
    - read:folder:confluence
    - read:hierarchical-content:confluence
    - read:space:confluence
    - read:page:confluence
    - write:comment:confluence
    - write:page:confluence
    # 공통
    - storage:app
  external:
    fetch:
      backend:
        - address: generativelanguage.googleapis.com
          inScopeEUD: true
```

> **스코프 전략 (중요)**
>
> Atlassian은 **클래식 스코프 우선**을 권장하지만, **Confluence REST v2 엔드포인트는 공식 문서상 granular 스코프를 요구**합니다(예: `GET /wiki/api/v2/spaces` → `read:space:confluence`). 클래식만 선언한 채 v2를 호출하면 `401 Unauthorized; scope does not match`가 납니다. 그래서 클래식은 유지한 채, 실제 호출하는 v2 API에 대응하는 granular를 **추가**합니다. CQL 검색(`/wiki/rest/api/search`)에는 클래식 `search:confluence`가 필요합니다.
>
> **배포 이후 클래식 스코프를 제거하지 않습니다.** 클래식과 granular를 함께 쓴 버전을 배포한 뒤 클래식만 빼면, 해당 테넌트에서 클래식 스코프가 고착되어 일부 API가 `403 The app is not installed on this instance`로 실패하는 알려진 결함이 있습니다(ECO-1292 / ID-9143). 스코프는 추가만 하고 제거하지 않습니다.

---

## 3. 25초 예산 설계 (핵심 기술 과제)

`jira:workflowValidator`는 **사용자 주도(user-led) 호출**이므로 Forge 함수 실행 한도가 **25초**입니다. (55초는 web-trigger/action 모듈에만 적용) 이 예산 안에 룰북 로딩 + LLM 추론 + 응답 파싱이 모두 끝나야 하므로 다음 최적화를 필수로 적용합니다.

| 최적화 | 내용 | 절감 효과 |
| --- | --- | --- |
| **룰북 사전 캐싱** | 설정 저장 시점 및 하루 1회 스케줄 트리거로 룰북 본문을 정규화·병합하여 KVS에 저장. 검증 시에는 Confluence API 호출 없이 KVS 1회 읽기 | 페이지 N개 조회(N×0.5초) → 0.3초 |
| **모델 선택 강제** | 동기 경로는 설정과 무관하게 `SYNC_ALLOWED_MODEL`(`gemini-3.6-flash`)로 호출. 현재 선택지가 하나뿐이라 결과는 같지만, 지연이 큰 모델이 추가되어도 차단 경로가 그것을 쓰지 않도록 강제 지점을 유지 | 추론 지연 상한 보장 |
| **추론 단계 최소화** | `generationConfig.thinkingConfig.thinkingLevel: 'minimal'`. 3.6 Flash의 기본값은 `medium`이라 그대로 두면 예산을 위협 | 불필요한 추론 토큰 제거 |
| **구조화 출력** | `responseMimeType: "application/json"` + `responseSchema` 지정 | 파싱 실패 재시도 제거 |
| **본문 절단** | 검증 대상 텍스트 상한 8,000자, 룰북 상한 60,000자(초과 시 경고 노출) | 토큰·지연 상한 보장 |
| **타임아웃 가드** | `AbortController`로 18초에 강제 중단, 잔여 7초는 응답 처리·에러 경로용 | 플랫폼 타임아웃(무응답 오류) 방지 |

### 3.1 타임아웃/장애 시 정책 (Fail Policy)

관리자 설정에서 선택합니다. 규정 준수 시스템의 성격상 **기본값은 `fail-open`**으로 두어 LLM 장애가 업무 중단으로 번지지 않게 합니다.

- `fail-open` (기본): 검증 실패 시 전환을 허용하고, 이슈에 "검증 미수행" 플래그와 사유를 기록. 감사 로그로 추적 가능
- `fail-closed`: 검증 실패 시 전환을 차단하고 재시도 안내. 고규제 환경용

---

## 4. 데이터 모델

### 4.1 저장소 매핑

| 데이터 | 저장 위치 | 키 | 비고 |
| --- | --- | --- | --- |
| Gemini API Key | **Secret Store** (`kvs.setSecret`) | `secret:gemini:apiKey` | 암호화 저장, `getSecret`으로만 접근. 조회 API는 마스킹된 존재 여부만 반환 |
| 제품별 설정 | KVS (`kvs.set`) | `settings:jira`, `settings:confluence` | 모델, 강제 모드, 실패 정책, 룰북 목록. **설치(installation)별 분리** |
| 룰북 병합 캐시 | KVS | `rulebook:cache:{product}` | 본문 + 소스 목록 + 생성 시각. TTL 24시간. **설정 저장 시에만 갱신** |
| Jira 검증 결과 | Jira 엔티티 프로퍼티 + KVS | `verdict:issue:{issueKey}` | 이슈 패널 렌더링용 |
| Jira 평가 캐시 | KVS | `eval:issue:{issueKey}` | 본문+룰북 해시. 동기/비동기 경로 공유. TTL 30일. ERROR는 저장하지 않음 |
| Jira 평가 잠금 | KVS | `lock:issue:{issueKey}` | 생성+칸반 이벤트가 동시에 들어올 때 이중 LLM 호출 완화. TTL 180초 |
| Confluence 검증 결과 | KVS | `verdict:page:{pageId}` | 바이라인 배지 및 상세 모달용 |
| 감사 로그 | KVS | `audit:{ts}:{uuid}` | 누가/언제/무엇이/어떤 판정. TTL 90일 |

> **설치별 KVS 분리 (중요)**: 같은 사이트에 Jira와 Confluence를 각각 `forge install`하면 **설치마다 독립된 KVS/Secret Store**를 가집니다. Confluence 설정 화면에서 저장한 API Key·룰북 캐시는 Jira `workflowValidator`에서 보이지 않습니다. 양쪽 설정 화면에서 **각각 저장**해야 합니다. 워밍업 로그에 `[jira] 0 pages`가 보여도 Confluence 설치 컨텍스트에서 돌고 있을 수 있으므로, Jira 쪽은 Jira 설정 저장 로그(`[saveSettings/jira]`)로 확인합니다.

### 4.2 핵심 타입

```typescript
type Severity = 'CRITICAL' | 'MAJOR' | 'MINOR';
type EnforcementMode = 'advisory' | 'gate' | 'revert';
type FailPolicy = 'fail-open' | 'fail-closed';

interface RulebookSource {
  type: 'page' | 'folder' | 'space';
  id: string;                // pageId / folderId / spaceKey
  title: string;
  path?: string;             // 조상 제목 체인. 동명 항목 구분용 표시
  includeChildren: boolean;  // page 선택 시 하위 트리 포함 여부 (folder/space는 항상 순회)
}

interface JiraNotifySettings {
  enabled: boolean;         // 사후 검증 FAIL 시 알림. 기본 true
  notifyReporter: boolean;  // 작성자. 기본 true
  groupName: string;        // 추가 Jira 그룹. 빈 문자열이면 없음
  email: boolean;           // notify REST로 메일 병행. 기본 false
  statusFieldId: string;    // 이슈 화면에 요지를 쓸 텍스트 커스텀 필드. 빈 문자열이면 미사용
  statusFieldName: string;  // 설정 화면 표시용 이름
}

interface AppSettings {
  provider: 'gemini';                 // PoC 고정
  model: 'gemini-3.6-flash';          // 현재 선택지 1종. 유니온은 확장 지점으로 유지
  rulebooks: RulebookSource[];
  enforcementMode: EnforcementMode;   // Confluence 전용
  failPolicy: FailPolicy;
  severityThreshold: Severity;        // 이 등급 이상만 차단
  jiraNotify: JiraNotifySettings;     // Jira 전용. Confluence 설정에서는 무시
}

interface Violation {
  ruleId: string;       // 예: "CR-03"
  ruleTitle: string;    // 예: "개인정보 보관 기간 초과"
  severity: Severity;
  evidence: string;     // 위반으로 판단된 원문 인용
  reason: string;       // 위반 근거 설명
  guideline: string;    // 추천 수정 가이드라인
}

interface ValidationVerdict {
  verdict: 'PASS' | 'FAIL' | 'ERROR';
  violations: Violation[];
  model: string;
  rulebookHash: string;
  evaluatedAt: string;  // ISO 8601
  latencyMs: number;
  errorReason?: string; // verdict === 'ERROR'
}
```

---

## 5. LLM 파이프라인

### 5.1 Full-Prompt 방식 (PoC)

`plan.md` 2.3에 따라 RAG 없이 룰북 전문을 프롬프트에 포함합니다. 다만 다음 전처리를 적용합니다.

1. **본문 추출**: `body.storage`(XHTML)에서 Confluence 매크로 태그(`<ac:*>`, `<ri:*>`)를 제거하고 텍스트/표 구조만 보존
2. **정규화**: 연속 공백·빈 줄 정리, 페이지 제목을 `## {제목}` 헤딩으로 삽입
3. **병합**: 복수 룰북을 구분자와 함께 단일 문서로 결합
4. **해싱**: 병합 결과의 SHA-256 해시를 `rulebookHash`로 저장 → 룰북 변경 추적 및 캐시 무효화

### 5.2 프롬프트 구조

- **System Instruction (검증 페르소나)**
  - 역할: 사내 규정 감사관
  - **룰북에 명시되지 않은 내용은 위반으로 판정 금지** (환각 억제의 핵심 제약)
  - 모든 위반 항목에 규칙 ID와 원문 인용(`evidence`) 필수
  - 판단이 모호한 경우 `MINOR`로 분류하고 차단하지 않음
  - JSON 스키마만 출력, 산문 금지
- **User Content**
  - `<RULEBOOK>` … 병합된 룰북 전문 … `</RULEBOOK>`
  - `<TARGET type="jira-issue|confluence-page">` … 검증 대상 텍스트 … `</TARGET>`

### 5.3 API 호출 규격

```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
Header: x-goog-api-key: {Secret Store에서 로드한 키}
Body:  { systemInstruction, contents, generationConfig: {
           responseMimeType: "application/json",
           responseSchema: { ... },                     // Violation[] 스키마
           thinkingConfig: { thinkingLevel: "minimal" }  // 동기 경로 지연 최소화
         }}
```

- `temperature` / `top_p` / `top_k`는 **보내지 않습니다.** Gemini 3.x에서 폐기되어 무시되며, 향후 세대에서는 `400`을 반환합니다. 판정 일관성은 시스템 지시와 구조화 출력, 응답 값 사후 검증으로 확보하고 완전한 재현성은 보장하지 않습니다. (9.5 참조)
- `thinkingBudget`와 `thinkingLevel`을 **같은 요청에 함께 보내면 `400`** 이므로 교체해야 합니다.
- 응답 파싱 실패 시 1회 재시도, 재시도 실패 시 `verdict: 'ERROR'` → 실패 정책 적용

---

## 6. 프로젝트 구조

```
Compliance_Rule_Validator/
├── manifest.yml
├── package.json
├── tsconfig.json
├── plan.md                      # 원본 기획서 (수정 금지)
├── spec.md                      # 본 문서
├── README.md
├── scripts/
│   ├── check-manifest.mjs       # 로그인 없이 매니페스트 참조 정합성 검사
│   └── build-workflow-ui.mjs    # 후처리 설정 Custom UI 번들
├── src/
    ├── index.ts                 # 모든 핸들러/리졸버 진입점 export
    ├── constants.ts             # 타임아웃·상한·기본 설정
    ├── handlers/
    │   ├── jiraWorkflowValidator.ts    # 동기 차단 핸들러
    │   ├── jiraIssueTrigger.ts         # created/updated:issue → 큐 발행 (이 사이트에서는 미호출)
    │   ├── jiraWorkflowPostFunction.ts # Create 후처리 → 큐 발행
    │   ├── confluencePageTrigger.ts    # 이벤트 필터링 → 큐 발행
    │   ├── complianceConsumer.ts       # 비동기 검증 + 강제 조치
    │   ├── rulebookWarmup.ts           # 스케줄 트리거: 룰북 캐시 갱신
    │   ├── bylineProperties.ts         # 바이라인 배지 라벨 동적 생성
    │   └── issueContextProperties.ts   # 이슈 오른쪽 로젠지
    ├── resolvers/
    │   ├── settingsResolver.ts         # 설정 조회/저장, API Key, 룰북 검색·미리보기
    │   └── verdictResolver.ts          # 검증 결과 조회, 출간 전 사전 검증
    ├── services/
    │   ├── settingsStore.ts            # KVS + Secret Store. resolveSettings() 확장 지점
    │   ├── rulebookService.ts          # page/folder/space 수집·정규화·병합·캐시
    │   ├── targetCollector.ts          # 검증 대상 텍스트 수집. 필드 확장 지점
    │   ├── llm/geminiClient.ts         # fetch 호출 + 타임아웃 + 재시도
    │   ├── llm/promptBuilder.ts        # 프롬프트 조립
    │   ├── llm/responseSchema.ts       # Structured Output 스키마
    │   ├── validationService.ts        # 검증 오케스트레이션
    │   ├── jiraIssueRunner.ts          # 동기/비동기 공유: 캐시·검증·기록
    │   ├── jiraIssueQueue.ts           # 이슈 검증 잡 큐 적재
    │   ├── evaluationCache.ts          # 본문 해시 캐시·이슈 잠금
    │   ├── enforcement/jiraEnforcer.ts       # 차단 메시지, 판정 기록, 사후 알림(evidence 제외)
    │   ├── enforcement/confluenceEnforcer.ts # 모드별 조치, 버전 복원, 자기 이벤트 차단
    │   ├── confluenceApi.ts / jiraApi.ts     # REST 호출 격리
    │   └── auditLog.ts
    ├── utils/
    │   ├── storageToText.ts            # Confluence XHTML → 평문
    │   ├── adfToText.ts                # Jira ADF → 평문
    │   └── text.ts                     # 절단, SHA-256
    ├── types/index.ts
    └── frontend/
        ├── components/
        │   ├── SettingsForm.tsx        # Jira/Confluence 공용 설정 화면
        │   ├── RulebookPicker.tsx      # page/folder/space 검색·선택
        │   ├── VerdictSummary.tsx      # 판정 결과 렌더링
        │   ├── ViolationList.tsx       # 위반 항목 렌더링
        │   └── inputValue.ts
        ├── jiraAdminPage.tsx           # ← resources 진입점
        ├── jiraIssuePanel.tsx
        ├── confluenceGlobalSettings.tsx
        ├── confluenceBylineItem.tsx
        └── confluencePrecheckAction.tsx
└── static/
    └── workflow-postfunction/   # 후처리 create/edit/view Custom UI (UI Kit 미지원)
```

UI Kit 2에서는 각 프론트엔드 진입점 파일을 `resources` 항목으로 개별 선언하고, 모듈에 `render: native`를 지정합니다. 공용 컴포넌트는 진입점에서 import하며 별도 `resources` 선언이 필요하지 않습니다. 예외는 워크플로우 후처리 설정 화면입니다. Forge가 UI Kit를 지원하지 않아 `static/workflow-postfunction` Custom UI를 씁니다.

### 6.1 로그인 없이 가능한 검증

`forge lint`는 Atlassian 로그인과 유효한 `app.id`를 요구하므로 CI나 오프라인·등록 전 환경에서 쓸 수 없습니다. 그래서 `scripts/check-manifest.mjs`로 다음을 별도 검사합니다.

- 모듈이 참조하는 `function` / `resource` 키가 실제로 선언되어 있는지
- `resources`의 `path`가 존재하는 파일을 가리키는지
- 매니페스트의 모든 핸들러(`index.<이름>`)가 `src/index.ts`에서 export되는지 — 오타는 배포 후 런타임에야 드러나므로 미리 잡는다
- **모듈 키 전역 유일성** — 모듈 종류가 달라도 키가 겹치면 Forge가 배포를 거부함
- 사용되지 않는 함수/리소스 선언, `render: native` 누락

```bash
npm run check   # tsc --noEmit + 후처리 UI 빌드 + 매니페스트 정합성 검사
```

---

## 7. 주요 API 사용 목록

| 목적 | API |
| --- | --- |
| 룰북 페이지/폴더 검색 | `GET /wiki/rest/api/search?cql=…` (**`asApp`**, `search:confluence` 스코프) |
| 룰북/대상 본문 조회 | `GET /wiki/api/v2/pages/{id}?body-format=storage` |
| 하위 페이지 순회 | `GET /wiki/api/v2/pages/{id}/children` |
| **폴더 조회** | `GET /wiki/api/v2/folders/{id}` |
| **폴더 하위 페이지 순회** | `GET /wiki/api/v2/folders/{id}/descendants?depth=N` — 응답 `type` 필드로 `page`만 필터링 |
| 스페이스 목록 | `GET /wiki/api/v2/spaces` |
| **페이지 버전 복원** | `POST /wiki/rest/api/content/{id}/version` (`operationKey: "restore"`) — v2에 대응 엔드포인트가 없어 v1 사용 |
| 페이지 버전 이력 | `GET /wiki/api/v2/pages/{id}/versions` |
| 위반 코멘트 등록 | `POST /wiki/api/v2/footer-comments` |
| 이슈 필드 조회 | `GET /rest/api/3/issue/{key}?fields=summary,description,reporter,assignee` — 검증은 요약+설명, reporter는 멘션용 |
| 이슈 검증 결과 기록 | `PUT /rest/api/3/issue/{key}/properties/{propertyKey}` |
| 사후 검증 in-app 알림 | `POST /rest/api/3/issue/{key}/comment` — 멘션 ADF. 본문에 evidence 없음 |
| 사후 검증 이메일 | `POST /rest/api/3/issue/{key}/notify` — 스코프 `send:notification:jira`. 사용자 알림 설정에 의존 |

---

## 8. 개발 단계 (Implementation Milestones)

| # | 단계 | 산출물 | 완료 기준 |
| --- | --- | --- | --- |
| M1 | 스캐폴딩 | `manifest.yml`, TS 빌드, `forge deploy` 성공 | 개발 사이트에 앱 설치 완료 |
| M2 | 설정 & 시크릿 | 설정 화면, Secret Store 연동 | API Key 저장 후 "연결 테스트" 통과, 재조회 시 값 노출 안 됨 |
| M3 | 룰북 파이프라인 | 검색/선택 UI, 수집·정규화·캐시 | 페이지·**폴더**·스페이스 복수 선택 후 병합 본문 및 해시 생성 확인. 폴더 하위 항목에서 페이지만 필터링되는지 검증 |
| M4 | LLM 검증 코어 | Gemini 클라이언트, 프롬프트, 스키마 | 위반 샘플 문서에서 규칙 ID를 정확히 인용한 JSON 반환 |
| M5 | Jira 동기 차단 | `workflowValidator` + 이슈 패널 | **이슈 키가 있는 전환**에서 위반 시 실제 차단, 25초 내 응답, 패널에 상세 표시. Create는 본문 미전달로 미검증 통과(9.8) |
| M5b | Jira 사후 탐지 | Create 후처리 + 큐 + 알림 | 개인정보 샘플 이슈 생성 후 패널에 FAIL, 작성자 벨 알림. 본문 해시로 validator와 이중 과금 없음. 제품 이벤트는 이 사이트에서 미호출(9.14) |
| M6 | Confluence 강제 | 트리거, 큐 소비자, 3개 모드 | `revert` 모드에서 위반 출간 시 직전 버전으로 복원 확인 |
| M7 | 사전 검증 & 마감 | 콘텐츠 액션, 감사 로그, README | 출간 전 온디맨드 검증 동작, 데모 시나리오 리허설 완료 |

---

## 9. 기획 명세 대비 변경 사항

`plan.md`의 일부 항목은 Forge 플랫폼에서 구현이 불가능하거나 부정확합니다. 아래는 조사 근거와 대체 설계입니다.

### 9.1 이벤트 기반 "차단"은 불가능 → Jira는 워크플로우 검증기로 전환

`plan.md` 2.2는 `avi:jira:created:issue` / `avi:jira:updated:issue` 이벤트를 감지해 등록을 차단하도록 명세합니다. 그러나 Forge 제품 이벤트는 **저장이 완료된 후 비동기로 발생**하므로 원천 차단이 성립하지 않고, 사후 되돌리기만 가능합니다.

- **대체**: `jira:workflowValidator` 모듈 사용. 함수가 `{ result: false, errorMessage }`를 반환하면 Jira가 전환을 실제로 거부하며(대상 상태로 진행하지 않고 후처리 함수도 실행되지 않음) 오류 메시지를 노출합니다. **이슈가 이미 존재하는 전환**에 등록하는 것을 권장합니다. Create 전환의 한계는 9.8 참조.
- **보완 (M5b)**: 이벤트로는 차단할 수 없다. 생성 직후 검증은 `jira:workflowPostFunction`이 이슈 키로 REST를 읽어 큐에 넣는다. 제품 이벤트 트리거는 인라인 수정 대비로 유지하되, 이 사이트에서는 호출되지 않는다. 상세는 9.14.
- **제약**: 회사 관리 프로젝트에 한정되며, 관리자가 고급 워크플로우 설정에서 검증기를 **수동으로 등록**해야 합니다. 앱 설치만으로 자동 적용되지 않습니다. (README의 실행 방법에 절차 포함)
- 참고: `jira:uiModifications`에는 제출 차단(`onSubmit`) 훅이 없어 대안이 되지 못합니다.

### 9.2 Confluence 출간 차단 모듈은 Forge에서 사용 불가

출간을 차단하는 `publishConditions` 모듈은 **Atlassian Connect 전용**입니다. Forge-Connect 하이브리드는 이미 마켓플레이스에 등재된 기존 Connect 앱만 채택할 수 있으므로, 신규 PoC에서는 사용할 수 없습니다.

- **대체**: 출간 후 비동기 검증 + 강제 모드(`advisory` / `gate` / `revert`). `revert` 모드가 `plan.md`의 "Block/Rollback" 중 Rollback 의미를 충족합니다.
- **보완**: `confluence:contentAction`으로 출간 **전** 온디맨드 검증을 제공해, 사용자가 차단 전에 스스로 확인할 수 있게 합니다.

### 9.3 `avi:confluence:published:page` 이벤트명 오류

`plan.md` 2.2는 이 이벤트를 "문서 출간/업데이트 완료 시점"으로 기술했으나, Forge 이벤트 레퍼런스상 이 이벤트는 **라이브 문서를 일반 페이지로 전환**했을 때 발생합니다.

- **정정**: 일반 페이지 출간·수정은 `avi:confluence:created:page`와 `avi:confluence:updated:page`를 구독합니다. `updated:page` 페이로드의 `updateTrigger` 필드로 본문 편집 외의 변경(이동·권한 변경 등)을 걸러내 불필요한 LLM 호출을 방지합니다.

### 9.4 백엔드에서 모달 강제 노출 불가

`plan.md` 3장의 "Validation Modal 자동 노출"은 Forge에 해당 API가 없어 구현할 수 없습니다.

- **대체**:
  - Jira: 차단 시 워크플로우 오류 메시지에 위반 요약을 노출하고, 상세는 `jira:issuePanel`(하단 앱 영역)과 `jira:issueContext`(오른쪽 「규정 준수」)에 둔다. 사후 검증은 코멘트 멘션·선택적 email에 패널 위치를 안내한다. 이슈 화면의 일반 필드로도 보이게 하려면 설정에서 텍스트 커스텀 필드를 지정한다 (9.14).
  - Confluence: `contentBylineItem` 배지를 통해 상태를 상시 노출하고, 클릭 시 위반 상세 모달을 표시. 추가로 페이지 코멘트로 위반 내역을 남겨 알림이 발송되도록 함

### 9.5 Gemini 모델 세대 교체와 API 계약 변경

`plan.md` 2.4가 지정한 `gemini-1.5-pro` / `gemini-1.5-flash`는 지원이 종료된 모델입니다. 착수 시점에는 `gemini-2.5-flash` / `gemini-2.5-pro`로 대체했으나, **배포 후 실제 연결 테스트에서 2.5 계열도 신규 사용자에게 제공되지 않는 것이 확인**되었습니다.

```
연결 실패 (404): This model models/gemini-2.5-flash is no longer available
to new users. Please update your code to use models/gemini-3.6-flash
```

- **정정**: **`gemini-3.6-flash` 단일 구성**으로 대체합니다. 3.6 세대에는 Pro가 없어(Google이 3.6 Pro를 내부 평가 미달로 보류) 원래 설계의 "동기=Flash / 비동기=Pro" 2단 구성은 성립하지 않습니다. 다만 동기 경로의 모델 강제 지점(`SYNC_ALLOWED_MODEL`)은 코드에 남겨, 지연이 큰 모델이 나중에 추가되더라도 차단 경로가 그것을 집어들지 않게 합니다.
- **설정 정화**: KVS에 남아 있는 구 모델 ID(`gemini-2.5-*` 등)는 `resolveModel()`이 allowlist(`GEMINI_MODELS`) 밖이면 기본값 `gemini-3.6-flash`로 치환합니다. 그렇지 않으면 저장값이 조용히 남아 모든 검증이 404로 실패합니다.

모델 ID 교체만으로 끝나지 않았습니다. Gemini 3.x는 요청 규격 자체가 달라졌습니다.

| 변경 | 3.x에서의 동작 | 조치 |
| --- | --- | --- |
| `temperature` / `top_p` / `top_k` | 무시됨. 향후 세대에서는 `400` | 요청에서 제거 |
| `thinkingBudget`(수치) | `thinkingLevel`로 대체. 둘을 함께 보내면 `400` | `thinkingLevel: 'minimal'`로 교체 |
| 기본 추론 단계 | 3.6 Flash는 `medium` | 25초 예산 때문에 `minimal`로 명시 고정 |
| `candidateCount` | 3.x 미지원 | 원래 사용하지 않음 |
| model 턴 프리필 | 마지막 턴이 `model`이면 `400` | 원래 사용하지 않음 |

이 중 `temperature: 0` 제거는 **설계 의도와 직접 충돌하는 항목**입니다. 원래 설계는 판정 재현성을 감사 추적의 전제로 삼고 그 수단으로 `temperature: 0`을 지정했습니다. 그러나 API가 이 값을 무시하므로 남겨두면 동작하지 않는 통제를 동작한다고 믿는 상태가 됩니다. Google이 문서에서 제시한 대체 수단이 "시스템 지시 + 구조화 출력"이므로 그 두 축을 강화하고(시스템 프롬프트 9번 규칙으로 일관성 지시 추가), **감사 추적의 근거를 "재현"에서 "기록"으로 옮겼습니다.** 판정마다 모델명·룰북 해시·원문 인용이 남으므로 사후 검토는 가능하지만, 동일 입력의 동일 판정은 더 이상 보장되지 않습니다.

### 9.6 API Key 저장 방식 구체화

`plan.md`는 "Forge Secure Storage"로 기술했습니다. 현재 권장 API는 `@forge/kvs`의 **Secret Store**(`kvs.setSecret` / `kvs.getSecret`)이며 `storage:app` 스코프를 요구합니다. 저장된 값은 `kvs.query`로 조회되지 않고 `getSecret`으로만 접근 가능합니다.

### 9.7 "폴더"의 정의 정정

`plan.md` 2.1은 선택 단위를 "페이지(Page) 또는 폴더(Space/Parent Page)"로 기술하여 **폴더를 스페이스 또는 상위 페이지와 동일한 것으로 취급**했습니다. 그러나 현재 Confluence Cloud에서 폴더는 페이지·화이트보드·데이터베이스와 나란히 존재하는 **독립 콘텐츠 타입**이며, 전용 API(`/wiki/api/v2/folders/{id}`, `/folders/{id}/descendants`)와 전용 스코프(`read:folder:confluence`)를 가집니다. 상위 페이지 API(`/pages/{id}/children`)로는 폴더 하위 문서를 조회할 수 없습니다.

- **정정**: 선택 타입을 `page` / `folder` / `space` **세 가지로 분리**하고 각각 별도 수집 경로를 구현합니다 ([2.4절](#24-룰북-선택-ui-설계)).
- 폴더 하위 항목에는 페이지 외에 화이트보드·데이터베이스·임베드가 섞여 올 수 있으므로, 응답의 `type` 필드로 `page`만 필터링합니다.
- CQL은 `type = "folder"` 검색을 지원하지만, `ancestor` 함수는 폴더를 지원하지 않습니다. 따라서 폴더 하위 순회는 CQL이 아니라 `/folders/{id}/descendants`로만 가능합니다.

### 9.8 `modifiedFields`에 `summary`가 없고, Create에서는 본문 자체가 안 옴

`jira:workflowValidator` 람다는 전환 화면에서 변경된 필드를 `transition.modifiedFields`로 받습니다. 그런데 공식 지원 필드 목록에 **`summary`가 포함되어 있지 않습니다.** (Description, Assignee, Labels, Priority, 각종 커스텀 필드는 포함) 반대로 REST API는 요약을 주지만, 저장되기 전의 입력값은 알 수 없고 **생성 전환에서는 이슈 자체가 존재하지 않아 조회가 실패**합니다.

- **구현**: `collectJiraTargetText()`에서 두 소스를 병합합니다. 이슈 키가 있으면 REST API 값을 기반으로 깔고, `modifiedFields`에 있는 필드는 그 값으로 덮어씁니다. 설명을 비운 경우 `null`이 오므로 빈 문자열로 반영해 "내용 삭제"가 검증에 정확히 반영되게 합니다.
- **한계 (요약)**: 생성 전환에서는 요약을 `modifiedFields`로 받을 수 없어 설명 위주로 검증하려 했고, 그 사실을 `warnings`에 남기도록 했습니다.
- **한계 (Create 실측, 더 큼)**: 개발 사이트에서 Create 전환 호출 시 `issue.key`가 없고 **`modifiedFields`도 빈 객체**였습니다. 생성 화면의 설명조차 람다에 전달되지 않아 검증 대상 텍스트가 0자가 되고, 이 경우 전부 차단하면 정상 이슈까지 못 만들므로 **미검증 통과**로 처리합니다. LLM 호출도 하지 않습니다.
- **권장 등록 위치**: Create가 아니라 이슈 키가 있는 이후 전환(예: In Progress, Done). 이때는 REST로 요약·설명을 읽어 동기 차단이 동작합니다. Create 자체의 공백은 9.14의 사후 탐지로 보완합니다.
- `modifiedFields`를 받으려면 `read:jira-work` 스코프가 필수입니다. 없으면 필드가 조용히 누락됩니다.

### 9.9 자동 복원이 유발하는 이벤트 루프

`revert` 모드에서 페이지를 복원하면 새 버전이 생성되고, 그 결과 `avi:confluence:updated:page`가 다시 발생합니다. 방어하지 않으면 앱이 자기 동작에 반응해 검증과 복원을 무한 반복하며 LLM 비용을 소진합니다.

- **구현**: 이벤트 페이로드의 `selfGenerated` 필드를 1차 방어선으로 사용하고, 복원으로 생성될 버전 번호를 KVS에 짧은 TTL로 표시해 2차 방어선을 둡니다.
- 추가로 `updateTrigger` 값을 검사해 본문이 바뀌지 않은 변경(라벨 부여, 이동, 권한 변경 등)은 LLM을 호출하지 않고 조기 반환합니다. 비용과 무의미한 알림을 함께 줄입니다.

### 9.10 룰북 검색은 `asApp` (동의 프롬프트와 리졸버 catch 충돌)

설정 화면의 룰북 후보 검색을 처음에는 `asUser()`로 호출했습니다. 사용자 동의가 끝나기 전에는 Forge가 `Authentication Required` / `NEEDS_AUTHENTICATION_ERR`를 내고, 설정 리졸버의 일반 `catch`가 이 오류까지 가로채 **동의 UI가 뜨지 않은 채** "검색 실패"로만 보입니다. 룰북 본문 수집은 원래 `asApp`이므로 검색만 `asUser`이면 권한 범위도 어긋납니다.

- **정정**: `searchContent`를 포함해 룰북 검색·수집 경로를 **`asApp`으로 통일**합니다. 앱 설치 스코프(`search:confluence` 등)로 검색하며, 사용자별 동의 프롬프트에 의존하지 않습니다.
- 엔드포인트는 `GET /wiki/rest/api/search`(CQL)입니다. 구식 `content/search` 경로가 아닙니다.

### 9.11 KVS·Secret은 설치(installation) 단위로 분리

같은 Cloud 사이트에 Jira용·Confluence용으로 앱을 각각 설치하면, Forge KVS와 Secret Store는 **설치마다 독립**입니다. 키 이름(`settings:jira`, `rulebook:cache:jira`)이 같아도 **서로 다른 저장소**입니다.

- Confluence 설정에서만 API Key·룰북을 저장한 뒤 Jira 검증기를 돌리면, Jira 쪽에는 캐시가 없어 룰북 0건처럼 보입니다.
- **운영 절차**: Jira 관리 화면과 Confluence 설정 화면에서 **각각** API Key·룰북을 저장합니다. 저장 로그(`[saveSettings/jira] sources=…, pages=…`)로 캐시 적재를 확인합니다.
- 일일 `rulebookWarmup`도 **현재 실행 중인 설치의 KVS**만 갱신합니다. Confluence 설치 컨텍스트에서 `[jira] 0 pages`가 찍혀도, Jira 설치에 이미 캐시가 있으면 Jira 검증 경로에는 영향이 없을 수 있습니다.

### 9.12 모듈 키 전역 유일성 · egress 객체 형식 · 배포 순서

배포 검증에서 추가로 확정된 플랫폼/도구 제약입니다.

| 항목 | 증상 / 근거 | 조치 |
| --- | --- | --- |
| 모듈 키 전역 유일 | `consumer`와 `function`이 같은 `key: compliance-consumer` → 배포 거부 | 함수 키를 `compliance-consumer-fn`으로 분리. `check-manifest.mjs`에 중복 검사 추가 |
| egress 형식 | `fetch.backend`에 도메인 문자열만 쓰면 deprecated | `{ address, inScopeEUD: true }` 객체. 검증 텍스트가 Google로 나가므로 `inScopeEUD`는 true |
| Runs on Atlassian | egress 선언 시 `App is egressing data` | 본 PoC는 대상이 아님을 README·본 명세에 명시 |
| `forge lint` 순서 | 플레이스홀더 `app.id`에서 `Invalid ari string` | **`register` → `lint` → `deploy`**. 등록 전 검사는 `npm run check` |
| Developer Space | 멤버십 없으면 `register` 불가. 비-TTY에서 생성 프롬프트 실패 | 대화형 터미널에서 register, 또는 Console에서 Space 선생성 |
| `tsconfig` `noEmit` | `tsc`는 통과해도 Forge `ts-loader` 번들 실패 | tsconfig에서 `noEmit` 제거. 타입체크는 `tsc --noEmit` 스크립트만 사용 |
| 스코프 추가 후 설치 | 메이저 버전·스코프 변경 시 재동의 필요 | `forge deploy --approve MAJOR_VERSION_RULE` 후 `forge install --upgrade` (Jira·Confluence 각각) |

### 9.13 Confluence 클래식 + granular 스코프 병행

v2 REST는 granular 스코프를 요구하고, CQL 검색 등은 클래식 `search:confluence`가 필요합니다. 클래식만으로는 `401 scope does not match`가 납니다. **클래식을 제거하지 않고 granular를 추가**합니다. 배포 후 클래식만 빼면 ECO-1292로 테넌트에 클래식이 고착될 수 있습니다. 상세는 [2.5절](#25-권한-permissions) 참조.

### 9.14 Create 미차단·칸반 DnD → 사후 탐지와 알림 (M5b)

Create에 validator를 붙이지 않기로 한 뒤(9.8) 남은 공백은 세 가지였다.

1. **개인정보 이슈가 정상 생성된다.** 같은 프로젝트 Browse 권한자가 생성 직후 본문을 열 수 있다.
2. **동기 LLM은 25초 한도**라 칸반 끌어다 놓기와 상극이다.
3. **칸반 DnD에서 validator가 “제대로” 막히지 않는다.** Enhanced Board는 커스텀 오류 메시지를 숨기거나 일반 문구로 바꾼다(JSWCLOUD-25858 계열). 일부 보드에서는 전환이 통과된 보고도 있다(JRACLOUD-80576). 보드 UX에 하드블록을 의존할 수 없다.

`plan.md` 2.2가 원래 쓰려 했던 `avi:jira:created:issue`는 저장 **이후**라 차단은 불가능하지만, 이때는 이슈 키가 있으므로 REST로 요약·설명을 읽을 수 있다. 그래서 Confluence와 같은 Detect 경로를 Jira 생성에도 연다.

- **실측 (이 사이트)**: `avi:jira:created:issue` / `updated:issue` 트리거 핸들러는 **한 번도 호출되지 않았다.** Create에서 검증기를 제거한 뒤에도, 매니페스트 필터를 튜토리얼과 같이 없앤 뒤에도 `[jiraIssueTrigger]` 로그가 없다. `ignoreSelf`가 원인인 줄 알고 `appIsLicensed: false`로 바꿨으나, 필터 자체가 있어도 없어도 핸들러가 안 돈다. 제품 이벤트 버스가 이 Jira 설치에 이벤트를 전달하지 않는 것으로 본다. Confluence 페이지 출간으로 `[complianceConsumer] kind=page`가 찍히면 Jira 이벤트만 깨진 것이다.
- **Create 통제**: `jira:workflowPostFunction`(Preview)를 Create 전환에 등록한다. 검증기와 달리 이슈가 **저장된 뒤** 호출되며 `issue.key`가 있다. 같은 큐(`kind: issue`)로 소비자가 검증·알림한다. 검증기는 Create에 두지 않고, 이슈 키가 있는 이후 전환에만 둔다.
- **새 워크플로우 편집기**: 후처리 메뉴 이름이 **Perform actions**(작업 수행)이다. Custom UI `create` 화면이 없으면 Forge 후처리 규칙이 목록에 안 뜨고, 보이는 `Compliance Rule Validator`를 Perform actions에 넣어도 **검증기**로 붙는다. 후처리 표시명은 `규정 사후 검증`이다. UI Kit 설정 화면은 미지원이라 Custom UI를 쓴다.
- **트리거 유지**: `trigger` `jira-issue-trigger`(함수 키 `jira-issue-trigger-fn`)는 인라인 본문 수정·칸반 상태 변경 대비로 구독을 남긴다. 필터는 공식 튜토리얼과 같이 두지 않는다. 본문(summary/description) 또는 상태(status) changelog만 큐에 넣는다. 소비자는 `compliance-validation` 큐를 `kind: page | issue`로 분기한다.
- **알림**: 기본은 in-app(이슈 코멘트 `@mention`). 이메일은 설정으로 켜며 `POST /rest/api/3/issue/{key}/notify`와 스코프 `send:notification:jira`를 쓴다. **본문에 evidence·원문 인용을 넣지 않는다.** 규칙 ID와 제목, 패널 위치 안내만 보낸다.
- **결과 위치**: 이슈 화면 하단 앱 영역 「규정 준수 검증」, 오른쪽 「규정 준수」(로젠지). 선택적으로 텍스트 커스텀 필드에 `FAIL · 위반 N건 · CR-…` 요지를 쓴다. 그 필드는 Jira 화면 구성에 관리자가 넣어야 이슈 본문에 보인다.
- **중복 알림**: Create는 후처리만 큐에 넣는다. 제품 이벤트 `created:issue`는 건너뛴다. 같은 본문 해시에 대한 댓글·메일은 `claimIssueNotify`로 한 번만 보낸다.
- **중복 제거**: `eval:issue:{key}`에 본문+룰북 해시를 저장한다. 동기 validator와 비동기 소비자가 공유하므로, 이미 FAIL인 이슈를 전환하면 LLM 없이 즉시 차단되고, 칸반 DnD로 updated가 다시 와도 이중 과금·이중 알림이 나지 않는다. ERROR는 캐시하지 않아 재시도된다.
- **알림이 닫지 못하는 것**: 생성부터 후처리·LLM까지 수 초의 노출 창이 남는다. Browse 권한자에 대한 가시성을 줄이는 **격리(이슈 보안 레벨 / 격리 프로젝트)** 는 11.3 Phase 2로 남긴다. 필드 마스킹만으로는 changelog에 원문이 남아 부족하다.
- **스코프**: 후처리 페이로드에 `read:jira-work`와 `manage:jira-configuration`이 필요하다. 스코프 추가는 메이저 버전·재동의다. 9.12의 배포 절차를 따른다.

### 9.15 게스트·익명 패널 invoke는 `unlicensedAccess`가 필요

프로젝트 Browse를 연 게스트·익명(Jira public 접근)은 이슈와 댓글은 읽지만, 규정 준수 패널에서 상세를 열면 다음이 난다.

```
검증 결과를 불러올 수 없습니다
Error: Failed to validate FCT: 'accountId' claim mismatch
```

원인은 Jira REST `asUser`가 아니다. 판정은 KVS(`verdict:issue:{key}`)에서 읽고, invoke 게이트웨이가 **Forge Context Token**을 검증하는 단계에서 막힌다. Forge 모듈은 기본이 **라이선스 사용자만**이라, 미라이선스·익명 세션으로 만든 FCT의 `accountId`가 게이트웨이 기대값과 어긋난다. UI Kit 패널 자체는 떠도 `invoke('getIssueVerdict')`가 실패한다.

- **정정**: `jira:issuePanel`에 `unlicensedAccess: [unlicensed, anonymous]`를 선언한다. [Access to Forge apps for unlicensed users](https://developer.atlassian.com/platform/forge/access-to-forge-apps-for-unlicensed-users/)에 따른다. Jira 이슈 패널은 `customer`를 허용하지 않는다. `jira:issueContext`는 이 속성 자체를 지원하지 않아 넣지 않는다.
- 게스트 유형에는 `asUser()`가 지원되지 않는다. 이슈 프로퍼티 읽기 등 남은 경로는 `asApp`으로 둔다.
- 리졸버는 FCT에 묶인 `context.extension.issue.key`를 우선한다. payload `issueKey`만 믿으면 다른 이슈의 근거가 새어 나간다. 이슈를 볼 수 있는 사용자는 패널에서도 같은 상세를 본다.

---

## 10. 확정된 범위 결정

| 항목 | 결정 | PoC 구현 내용 |
| --- | --- | --- |
| 룰북 선택 UI | 트리 탐색 UI 불필요. **폴더 또는 페이지 선택은 필수** | 타입 탭(페이지/폴더/스페이스) + CQL 검색 + 선택 목록 누적 방식 ([2.4절](#24-룰북-선택-ui-설계)) |
| 설정 범위 | **제품(설치)별 사이트 전역으로 충분** | `settings:jira` / `settings:confluence`. 다만 Jira·Confluence **설치 KVS는 공유되지 않음**(9.11) |
| Jira 검증 대상 필드 | **요약 + 설명으로 충분** | `summary`, `description`(ADF → 평문 변환) 고정. 설정 노출 없음 |
| Jira 사후 알림 | **생성·칸반 우회는 탐지 후 알림** | in-app 기본, email 선택. evidence 제외. 격리는 11.3 |
| 예외 승인(Bypass) | **불필요** | 구현하지 않음 |

### 10.1 확장 대비 설계 (구현은 하지 않음)

아래 두 항목은 추후 과제로 남기되, **나중에 도입할 때 기존 데이터와 코드를 재작업하지 않도록** 확장 지점만 미리 확보합니다. 기능 자체는 PoC 범위에 포함하지 않습니다.

**프로젝트/스페이스별 추가 설정** → [11.1](#111-프로젝트스페이스별-설정)

- KVS 키를 `settings:{product}` 형태로 두고, 조회 함수를 `resolveSettings(product, scopeId?)`로 설계합니다. 전역 설정만 존재하는 현재는 `scopeId`가 항상 `undefined`입니다. 나중에 `settings:confluence:space:{spaceKey}` 같은 키를 추가하고 이 함수 안에서 **범위별 설정을 우선 적용하고 없는 항목만 전역 설정으로 채우도록** 병합 로직을 넣으면 됩니다. 기존 전역 레코드의 저장 스키마는 그대로 유지됩니다.

**이슈 유형별 검증 대상 필드 확장** → [11.2](#112-이슈-유형별-검증-대상-필드)

- 검증 대상 텍스트 수집을 `collectJiraTargetText(issue): TargetSection[]` 형태로 분리합니다. 현재는 요약·설명만 반환하는 고정 구현이지만, 필드 목록을 이슈 유형별 설정에서 주입받는 구조로 바꿀 때 **호출부 수정 없이 이 함수만 교체**하면 됩니다. LLM 프롬프트도 섹션 배열을 순회하도록 작성해, 필드가 늘어나도 프롬프트 조립 로직이 변하지 않습니다.

---

## 11. 추후 과제 (Backlog)

`plan.md` 5.2의 Phase 2 항목과 별개로, 본 PoC 진행 중 식별된 향후 과제입니다.

### 11.1 프로젝트/스페이스별 설정

전역 설정만으로는 조직 전체에 동일한 룰북이 적용됩니다. 실제 운영에서는 프로젝트나 스페이스마다 적용 규정이 다를 수 있습니다.

- Jira `jira:projectSettingsPage`, Confluence `confluence:spaceSettings` 모듈 추가
- 설정 해석 우선순위: **범위별 설정 → 전역 설정 → 기본값**
- 범위별로 재정의 가능한 항목: 룰북 목록, 강제 모드, 심각도 임계값
- API Key와 모델은 전역 유지 (비용·키 관리를 분산시키지 않기 위함)

### 11.2 이슈 유형별 검증 대상 필드

이슈 유형에 따라 규정 검증에 필요한 필드가 달라집니다. 예를 들어 "장애 보고" 유형은 근본 원인·재발 방지 대책 커스텀 필드가, "변경 요청" 유형은 영향도·롤백 계획 필드가 검증 대상이어야 합니다.

- 이슈 유형별 대상 필드 매핑을 설정 화면에서 지정
- 커스텀 필드 값 타입별 평문 변환기(선택 목록, 사용자, 날짜, ADF 리치 텍스트) 필요
- 필드가 늘어나면 프롬프트 길이도 늘어나므로, 25초 예산([3장](#3-25초-예산-설계-핵심-기술-과제)) 재검토가 함께 필요합니다

### 11.3 Jira 위반 이슈 격리 (Phase 2)

9.14의 사후 알림은 인지 수단일 뿐, 생성 직후 Browse 권한자의 열람을 막지 못한다. 다음을 이 순서로 도입한다.

1. **이슈 보안 레벨 (제자리 격리, 1순위)**  
   프로젝트에 Issue Security Scheme과 격리 레벨을 미리 두고, FAIL 시 `PUT /rest/api/3/issue/{key}`로 `security` 필드를 설정한다. Browse가 끊기면 changelog의 개인정보도 함께 숨겨진다. 설정에 레벨 ID를 저장한다.
2. **격리 프로젝트 이동 (2순위)**  
   보드에서 완전히 빼야 하는 조직만. 이슈 키 변경, 필드 매핑, Bulk Change 권한, `POST /rest/api/3/issue/bulk/move` 비동기를 별도 PoC로 검증한 뒤 도입한다.
3. **필드 마스킹만**  
   changelog에 원문이 남으므로 단독 사용하지 않는다. 보안 레벨과 함께만 검토한다.
4. **격리 해제(Bypass)**  
   `plan.md` 5.2의 예외 승인과 같은 축. 보안팀이 레벨을 되돌리거나 원 프로젝트로 복귀시킨다.

삭제나 본문 자동 폐기는 감사 추적을 잃으므로 채택하지 않는다.

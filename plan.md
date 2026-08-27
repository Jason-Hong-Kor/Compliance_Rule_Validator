# 1. 프로젝트 개요

## 프로젝트명

Forge 기반 Jira/Confluence 사내 규정 자동 검증 시스템 PoC

## 목적

Jira 이슈 및 Confluence 문서 작성 시, 사내 보안 규정(Compliance) 및 프로젝트 규칙(Project Rules) 위반 여부를 LLM을 통해 실시간 검증하고, 위반 시 등록/출간을 차단하여 규정 준수율을 제고함.

## 타겟 환경

Atlassian Cloud (Jira Cloud, Confluence Cloud)

# 2. 주요 기능 명세 (System Features)

## 2.1 Confluence 룰북 매핑 및 관리

### 룰북 지정

Confluence 전용 앱 관리자 설정 화면에서 검증의 기준이 될 룰북 문서를 지정.

### 선택 단위

Confluence 페이지(Page) 또는 폴더(Space/Parent Page) 단위로 선택 가능하며, 복수 선택을 지원.

## 2.2 실시간 규정 검증 및 트랜잭션 제어 (Trigger & Action)

### 동작 시점 (Triggers)

Jira: 이슈 생성 완료 시점 (avi:jira:created:issue), 이슈 수정 완료 시점 (avi:jira:updated:issue)
Confluence: 문서 출간/업데이트 완료 시점 (created:page / updated:page)

### 위반 시 제어 (Validation & Action)

LLM 검증 결과 규정 위반(Violation)이 하나라도 감지될 경우 완료 처리 불가(Block/Rollback) 처리.

### 경고 모달창(Alert Modal) 노출

감지된 위반 항목 리스트 (예: CR-03 개인정보 보관 기간 초과)
위반 근거 및 이유 설명
추천 수정 가이드라인

## 2.3 LLM 연동 및 파이프라인 (PoC Architecture)



### Full-Prompt 방식 적용 (PoC 한정)

지정된 Confluence 룰북(복수)의 전체 텍스트 본문을 추출하여 LLM 요청 프롬프트(System/User Prompt)에 모두 포함하여 전송.

### [향후 확장 명세]

본 PoC 완료 후, 룰북의 분량 증가 및 토큰 비용 절감을 위해 룰북 데이터를 Vector DB 기반의 RAG(Retrieval-Augmented Generation) 아키텍처로 전환함.

## 2.4 LLM 및 API Key 설정



### LLM 선택 인터페이스

Jira 및 Confluence 앱 설정 화면에서 각각 사용할 LLM 모델 선택 드롭다운과 API Key 입력 필드 제공.

### PoC 제한 사항

LLM 선택 드롭다운에는 Gemini 모델(gemini-3.6-flash)만 선택 가능하도록 제한.

입력받은 API Key는 Atlassian Forge Secure Storage에 암호화되어 저장 및 관리됨.

# 3. 화면 및 UI 명세 (User Interface)


| 화면 구분                                  | 구성 요소                                          | 설명                                          |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| **App Settings (공통)**                  | LLM Provider 선택, API Key 입력란, 저장 버튼            | Gemini 선택 고정 및 API Key Secure Storage 저장    |
| **App Settings (Confluence)**          | 룰북 트리/검색 선택기 (Multi-select)                    | 룰북으로 활용할 Page/Folder(Space) 복수 지정           |
| **Validation Modal (Jira/Confluence)** | - ⚠️ 위반 경고 헤더 - 위반 규칙 ID 및 이름 - 위반 사유 및 수정 가이드 | 규정 위반 시 이슈 생성/수정 또는 문서 Publish를 블로킹하고 모달 노출 |




# 4. 데이터 흐름 (Data Flow)
```text
[사용자: Jira 이슈 저장 / Confluence Publish 클릭]
                         │
                         ▼
             [Forge Event Trigger 감지]
                         │
                         ▼
        [Forge Backend: 지정된 룰북 본문 전체 수집]
                         │
                         ▼
 [Prompt 구성: 작성 텍스트 + 룰북 전체 텍스트 + 검증 페르소나]
                         │
                         ▼
              [Gemini API 호출 (PoC)]
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
      [규정 준수 (PASS)]         [규정 위반 (FAIL)]
            │                         │
            ▼                         ▼
       [정상 저장 완료]       [트랜잭션 블로킹 & 경고 모달 팝업]
```

# 5. 단계별 개발 로드맵 (Roadmap)

## 5.1 Phase 1 (본 PoC):

- Forge App 기본 구조 세팅 (UI Kit / Custom UI)
- Gemini API Key 설정 및 Forge Storage 연동
- Full-Prompt 기반의 Jira/Confluence 트리거 & 모달 블로킹 구현

## 5.2 Phase 2 (PoC 이후 - RAG 전환 및 확장):

- Confluence 룰북 자동 임베딩 및 외부 Vector DB(Pinecone/Qdrant 등) 파이프라인 구축 (RAG 전환)
- Multi-LLM (OpenAI, Claude 등) 선택 옵션 활성화
- 예외 승인(Bypass) 요청 워크플로우 추가 (보안팀 승인 시 출간 허용 등)


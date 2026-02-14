# Blog Pulse Frontend

React + TypeScript 기반의 커뮤니티/채팅 프론트엔드 프로젝트입니다.  
게시글, 댓글, 실시간 채팅, 인앱 알림을 하나의 웹 앱으로 통합했습니다.

## 1. 핵심 기능

- 인증
  - 로그인/회원가입, 토큰 저장, 토큰 만료 시 자동 재발급 처리
- 게시글
  - 목록/상세/작성/수정/삭제
  - 목록 조회 모드 2가지 지원
    - 기본: 커서 기반 무한 스크롤
    - 옵션: 페이지네이션
  - 리치 텍스트 에디터(Tiptap) + 이미지 업로드(TUS)
- 댓글
  - 작성/수정/삭제
  - 낙관적 업데이트(Optimistic Update)로 즉시 반영
- 채팅
  - STOMP(WebSocket) 기반 실시간 대화
  - 대화방 목록, 메시지 전송/조회, 읽음 처리
- 알림
  - 실시간 알림 수신 + 알림 드롭다운
  - 읽음/전체 읽음 처리
  - 무한 스크롤 알림 목록
- 반응형 UI
  - 모바일 하단 탭 네비게이션
  - 데스크탑/모바일 공통 인터랙션 정리

## 2. 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Framework | React 19, TypeScript, Vite |
| Routing | React Router |
| Server State | TanStack Query |
| HTTP | Axios |
| Realtime | WebSocket + STOMP 프레임 직접 처리 |
| Editor | Tiptap |
| Upload | tus-js-client |
| UI | Tailwind CSS, 공통 UI 컴포넌트 |
| Notification | react-toastify |

## 3. 폴더 구조

```txt
src
├─ app                 # 라우터, 레이아웃, 전역 Provider
├─ features
│  ├─ user             # 인증(로그인/회원가입)
│  ├─ post             # 게시글/에디터/피드
│  ├─ comment          # 댓글 CRUD
│  ├─ chat             # 실시간 채팅
│  └─ notifications    # 인앱 알림
└─ shared
   ├─ lib              # api/auth/network 유틸
   ├─ context          # 인증 컨텍스트
   ├─ socket           # STOMP 클라이언트
   └─ ui               # 공용 UI 컴포넌트
```

## 4. 시작하기

### 4.1 요구 사항

- Node.js 20+
- npm 10+

### 4.2 설치

```bash
npm install
```

### 4.3 환경 변수

루트에 `.env` 파일을 생성하고 아래 값을 설정하세요.

```env
VITE_API_BASE_URL="http://localhost:8080/api"
```

추가 옵션:

| 변수명 | 기본값 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 런타임 기준 자동 계산 | REST API 베이스 URL |
| `VITE_AUTH_REFRESH_URL` | `${VITE_API_BASE_URL}/auth/refresh` | 토큰 갱신 엔드포인트 |
| `VITE_WS_URL` | 자동 후보 탐색 | WebSocket URL(복수 가능, 쉼표 구분) |
| `VITE_STOMP_DEBUG` | `false` | STOMP 프레임 디버그 로그 출력 |
| `VITE_DEV_USER_ID` | 없음 | 개발 환경 사용자 ID fallback |

`.env.example`도 같이 제공됩니다.

### 4.4 실행

```bash
# 개발 서버
npm run dev

# 빌드
npm run build

# 린트
npm run lint

# 빌드 결과 미리보기
npm run preview
```

## 5. 백엔드 연동 규칙

기본 API 응답은 아래 형태를 기준으로 처리합니다.

```json
{
  "status": "OK",
  "success": true,
  "message": "요청 성공",
  "data": {}
}
```

프론트는 일부 엔드포인트의 응답 차이를 흡수하도록 작성되어 있습니다.

- 게시글 목록
  - 페이지네이션: `page`, `size`
  - 커서: `cursorId`, `size`
- 댓글/알림/채팅
  - 필드명 차이(`snake_case`, `camelCase`)를 정규화해 처리

## 6. 실시간(WebSocket/STOMP) 메모

- 클라이언트는 `Authorization` 및 `X-User-Id` 헤더를 CONNECT/SEND에 포함하도록 구성되어 있습니다.
- `VITE_WS_URL` 미설정 시 런타임에서 후보 경로를 자동 탐색합니다.
  - 예: `/ws`, `/ws-sockjs/websocket`, `/stomp` 등
- 연결 문제 디버깅 시:
  - `VITE_STOMP_DEBUG=true`
  - 브라우저 콘솔의 `CONNECT headers`, `ERROR frame` 로그 확인

## 7. 모바일에서 로컬 접속

같은 Wi-Fi 환경에서 테스트할 때는 개발 서버를 외부 바인딩으로 실행하세요.

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

모바일 브라우저에서 `http://<PC_IP>:5173`으로 접속합니다.

## 8. 커밋 컨벤션

아래 규칙을 사용합니다.

```txt
feat(scope): 기능 요약
- 변경사항 1
- 변경사항 2
```

예시:

```txt
feat(post): 게시글 api 정의
- list api 생성
```

## 9. 스크린샷/데모

필요 시 아래 섹션에 화면 캡처를 추가하세요.

- 게시글 피드
- 채팅 화면
- 알림 드롭다운/목록

## 10. 라이선스

별도 라이선스 정책이 없다면 개인/팀 내부 용도로 사용합니다.

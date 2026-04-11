# 백엔드 프롬프트: 무료 기준 Web Push 알림 서비스

현재 프론트엔드는 무료 기준의 2차 알림 서비스로 Web Push를 도입하려고 합니다. 외부 유료 알림 서비스(FCM, OneSignal, AWS SNS 등)는 사용하지 않고, 표준 Web Push + 자체 백엔드 + VAPID 기반으로 구현하려고 합니다.

## 목표

1. 댓글, 채팅, 친구 요청 알림을 notifications 저장소에 영속 저장한다.
2. 같은 이벤트를 websocket 실시간 알림으로도 보낸다.
3. 사용자가 브라우저 알림을 구독한 경우 Web Push도 직접 발송한다.
4. 외부 유료 서비스 없이 운영 가능해야 한다.

## 필수 요구사항

### 1) Web Push 인프라

- VAPID public/private key 사용
- push subscription 등록 API 제공
- push subscription 해지 API 제공
- 사용자당 여러 subscription 저장 가능
- 만료/무효 subscription은 자동 정리

### 2) 저장할 subscription 데이터

- `id`
- `userId`
- `endpoint`
- `p256dh`
- `auth`
- `userAgent` (optional)
- `createdAt`
- `updatedAt`
- `lastUsedAt` (optional)
- `isActive`

### 3) 알림 타입

- `POST_COMMENT`
- `CHAT_MESSAGE`
- `FRIEND_REQUEST_RECEIVED`
- `FRIEND_REQUEST_ACCEPTED`
- 선택: `FRIEND_REQUEST_REJECTED`
- 선택: `FRIEND_REQUEST_CANCELED`

### 4) notifications 영속 저장

- 기존 notifications list/summary 응답과 하위 호환 유지
- 최소 응답 필드
  - `id`
  - `type`
  - `title`
  - `body`
  - `createdAt`
  - `readAt` 또는 `isRead`
  - `linkUrl`
  - `payload`

### 5) payload 최소 필드

- 댓글 알림
  - `postId`
  - `commentId`
  - `commenterId`
- 채팅 알림
  - `conversationId`
  - `messageId`
  - `senderId`
- 친구 요청 알림
  - `requestId`
  - `requesterId`
  - `targetUserId`
  - `requesterNickname` 또는 `requesterDisplayName` 또는 `requesterName`
  - 가능하면 `requesterUsername`

### 6) linkUrl 규칙

- `POST_COMMENT`: `/posts/{postId}`
- `CHAT_MESSAGE`: `/chat?conversationId={conversationId}`
- `FRIEND_REQUEST_*`: `/chat`

### 7) Web Push 발송 payload 형식

- `title`
- `body`
- `tag`
- `linkUrl`
- `type`
- `data` (optional)
- `icon` (optional)
- `badge` (optional)

예시 push payload:

```json
{
  "type": "FRIEND_REQUEST_RECEIVED",
  "title": "친구 요청",
  "body": "홍길동님이 친구 요청을 보냈습니다.",
  "tag": "friend-request:101:PENDING:12",
  "linkUrl": "/chat",
  "data": {
    "requestId": 101,
    "requesterId": 12,
    "targetUserId": 34
  }
}
```

### 8) 발송 정책

- 이벤트 발생 시 아래 3가지를 모두 처리
  - websocket 실시간 이벤트 발행
  - notifications 저장
  - 등록된 subscription이 있으면 Web Push 발송
- Web Push 실패 시 사용자 요청 자체는 실패 처리하지 않음
- endpoint 만료(예: 404/410) 시 해당 subscription 비활성화 또는 삭제

### 9) 친구 요청 이벤트

- 친구 요청 생성 시 수신자에게
  - websocket event
  - notification 저장
  - Web Push
- 친구 요청 수락 시 요청자에게
  - websocket event
  - notification 저장
  - Web Push
- 가능하면 거절/취소도 같은 패턴

### 10) API 예시

subscription 등록 API 예시 요청:

```json
POST /api/notifications/push-subscriptions
{
  "endpoint": "...",
  "expirationTime": null,
  "keys": {
    "p256dh": "...",
    "auth": "..."
  },
  "userAgent": "Mozilla/5.0 ..."
}
```

subscription 해지 API 예시 요청:

```json
DELETE /api/notifications/push-subscriptions
{
  "endpoint": "..."
}
```

public key 조회 API 예시 응답:

```json
GET /api/notifications/push/public-key
{
  "publicKey": "BElY..."
}
```

notification 응답 예시:

```json
{
  "id": 9001,
  "type": "FRIEND_REQUEST_RECEIVED",
  "title": "친구 요청",
  "body": "홍길동님이 친구 요청을 보냈습니다.",
  "createdAt": "2026-04-12T12:34:56Z",
  "readAt": null,
  "isRead": false,
  "linkUrl": "/chat",
  "payload": {
    "requestId": 101,
    "requesterId": 12,
    "targetUserId": 34,
    "requesterNickname": "홍길동",
    "requesterUsername": "hong12"
  }
}
```

## 산출물

- API 명세
  - subscription 등록
  - subscription 해지
  - public key 조회
  - 알림 조회
- websocket 이벤트 명세
- Web Push payload 예시
- DB 스키마/엔티티 변경점
- 서비스 로직 설명
- 실패/재시도/만료 subscription 정리 정책
- 테스트 케이스

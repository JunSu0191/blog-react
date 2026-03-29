# 백엔드 API 개발 요청 프롬프트

아래 내용을 기준으로 Blog Pause 콘텐츠 서비스의 백엔드 API를 개발해주세요.

## 배경

프론트엔드는 현재 다음 화면이 구현되어 있습니다.

- 홈
- 검색 허브
- 글 목록
- 글 상세
- 글 작성/수정
- 카테고리 허브
- 태그 허브
- 공개 블로그
- 마이페이지
- 알림
- 채팅
- 관리자 대시보드
- 관리자 게시글/댓글/사용자/카테고리
- 관리자 추천/검수

현재 프론트는 일부 기능을 로컬 상태로 임시 처리하고 있습니다.

- 저장한 글(북마크): localStorage 임시 처리
- 관리자 추천 슬롯: localStorage 임시 처리
- 태그/카테고리 허브: 기존 글 목록 API를 재활용해 임시 구현

이제 아래 API를 추가해 실제 서비스 수준으로 전환하고 싶습니다.

## 우선순위

1. 북마크 / 저장한 글
2. 관리자 추천 슬롯
3. 태그 허브 / 카테고리 허브 전용 API
4. 통합 검색
5. 작성/발행 관리 확장
6. 시리즈
7. 관리자 신고/검수

## 1. 북마크 / 저장한 글

### 목적

- 글 상세에서 저장 버튼 클릭
- 마이페이지 저장한 글 탭에서 목록 조회
- 저장 여부 표시

### 필요한 API

- `GET /api/v1/me/bookmarks?page=0&size=20`
- `POST /api/v1/posts/{postId}/bookmark`
- `DELETE /api/v1/posts/{postId}/bookmark`
- `GET /api/v1/posts/{postId}/bookmark-status`

### 응답 예시

```json
{
  "content": [
    {
      "id": 12,
      "title": "React Query 운영 팁",
      "subtitle": "실서비스에서 자주 부딪히는 캐시 이슈 정리",
      "thumbnailUrl": "https://...",
      "category": { "id": 3, "name": "Frontend" },
      "tags": [{ "id": 1, "name": "react-query", "slug": "react-query" }],
      "author": { "id": 7, "username": "junsu", "name": "신준수" },
      "publishedAt": "2026-03-14T10:00:00",
      "readTimeMinutes": 6
    }
  ],
  "pageNumber": 0,
  "pageSize": 20,
  "totalElements": 1,
  "totalPages": 1,
  "first": true,
  "last": true,
  "empty": false
}
```

### 상태 응답 예시

```json
{
  "postId": 12,
  "bookmarked": true,
  "bookmarkedAt": "2026-03-14T10:30:00"
}
```

## 2. 관리자 추천 슬롯

### 목적

- 관리자 화면에서 홈 추천 글을 직접 지정
- 홈 화면의 "오늘의 추천"이 관리자 설정값을 우선 반영

### 필요한 API

- `GET /api/v1/admin/recommendations`
- `POST /api/v1/admin/recommendations`
- `DELETE /api/v1/admin/recommendations/{recommendationId}`

### 요청 예시

```json
{
  "postId": 12,
  "slot": 1
}
```

### 응답 예시

```json
[
  {
    "id": 101,
    "slot": 1,
    "post": {
      "id": 12,
      "title": "React Query 운영 팁",
      "subtitle": "실서비스에서 자주 부딪히는 캐시 이슈 정리",
      "thumbnailUrl": "https://..."
    }
  }
]
```

## 3. 태그 허브 / 카테고리 허브

### 목적

- 태그/카테고리별 랜딩 정보 제공
- 대표 글, 설명, 연관 태그, 글 목록 분리

### 필요한 API

- `GET /api/v1/tags`
- `GET /api/v1/tags/{slug}`
- `GET /api/v1/tags/{slug}/posts?page=0&size=20&sort=publishedAt,desc`
- `GET /api/v1/categories/{categoryId}`
- `GET /api/v1/categories/{categoryId}/posts?page=0&size=20&sort=publishedAt,desc`

### 태그 상세 응답 예시

```json
{
  "id": 11,
  "name": "react",
  "slug": "react",
  "description": "React 관련 글 모음",
  "postCount": 24,
  "relatedTags": [
    { "id": 12, "name": "typescript", "slug": "typescript" }
  ],
  "featuredPost": {
    "id": 33,
    "title": "React 아키텍처 정리"
  }
}
```

## 4. 통합 검색

### 목적

- 현재 프론트 검색 허브를 실제 통합 검색으로 확장
- 글, 태그, 작성자, 카테고리를 한 번에 검색

### 필요한 API

- `GET /api/v1/search?q=react`
- `GET /api/v1/search/trending`
- `GET /api/v1/search/recent`

### 응답 예시

```json
{
  "posts": {
    "content": []
  },
  "tags": [
    { "id": 11, "name": "react", "slug": "react", "postCount": 24 }
  ],
  "authors": [
    { "id": 7, "username": "junsu", "name": "신준수" }
  ],
  "categories": [
    { "id": 3, "name": "Frontend" }
  ]
}
```

## 5. 작성 / 발행 관리 확장

### 목적

- 현재 프론트에는 초안 저장, 슬러그/SEO 미리보기 UI가 이미 있음
- 실제 발행 관리 필드가 서버에도 필요

### 필요한 추가 필드

- `slug`
- `metaTitle`
- `metaDescription`
- `visibility: PUBLIC | UNLISTED | PRIVATE`
- `publishedAt`
- `scheduledAt`
- `seriesId`

### 필요한 API

- `GET /api/v1/me/posts?status=draft|published|scheduled`
- `POST /api/v1/posts`
- `PUT /api/v1/posts/{postId}`
- `POST /api/v1/posts/{postId}/publish`
- `POST /api/v1/posts/{postId}/schedule`
- `GET /api/v1/posts/slug/check?slug=react-query-guide`

## 6. 시리즈

### 목적

- 글을 연재 단위로 묶고 싶음
- 상세 페이지에서 시리즈 내 위치 노출 예정

### 필요한 API

- `GET /api/v1/series`
- `GET /api/v1/series/{seriesId}`
- `POST /api/v1/series`
- `PUT /api/v1/series/{seriesId}`
- `POST /api/v1/posts/{postId}/series`

## 7. 관리자 신고 / 검수

### 목적

- 현재 관리자 추천/검수 화면은 UI만 있음
- 실제 신고 접수, 검수 상태, 처리 이력 API 필요

### 필요한 API

- `GET /api/v1/admin/reports`
- `POST /api/v1/admin/reports/{reportId}/resolve`
- `GET /api/v1/admin/moderation/posts`
- `GET /api/v1/admin/moderation/comments`

## 공통 응답 규칙

- 리스트 응답은 아래 필드명을 유지해주세요.
  - `content`
  - `pageNumber`
  - `pageSize`
  - `totalElements`
  - `totalPages`
  - `first`
  - `last`
  - `empty`
- 에러 응답은 프론트에서 바로 보여줄 수 있게 `message`를 포함해주세요.
- 기존 응답 구조를 최대한 깨지 말고 확장 방식으로 부탁드립니다.

## 추가 요청

- OpenAPI 또는 Swagger 문서도 함께 갱신해주세요.
- 가능하면 북마크/추천/시리즈/검색 API는 통합 테스트 케이스도 같이 작성해주세요.

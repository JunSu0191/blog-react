## Backend Prompt For Blog Pause Content Service

현재 프론트엔드에는 홈, 글 목록, 글 상세, 작성/수정, 공개 블로그, 알림, 채팅, 관리자 화면이 이미 있습니다.
이제 실제 서비스화를 위해 아래 API와 데이터 구조를 우선 구현해 주세요.

### 1. 북마크 / 저장한 글

- 목적: 사용자가 글 상세에서 글을 저장하고, 마이페이지에서 저장한 글 목록을 볼 수 있어야 합니다.
- 필요한 API
  - `GET /api/v1/me/bookmarks`
  - `POST /api/v1/posts/{postId}/bookmark`
  - `DELETE /api/v1/posts/{postId}/bookmark`
  - `GET /api/v1/posts/{postId}/bookmark-status`
- 응답 필드
  - `postId`
  - `bookmarked: boolean`
  - `bookmarkedAt`
  - 목록 조회 시 `id, title, subtitle, thumbnailUrl, category, tags, author, publishedAt, readTimeMinutes`

### 2. 통합 검색

- 목적: 제목 검색을 넘어서 글, 태그, 작성자, 카테고리를 한 번에 찾을 수 있어야 합니다.
- 필요한 API
  - `GET /api/v1/search?q=&type=post|tag|author|category&page=&size=`
  - `GET /api/v1/search/trending`
  - `GET /api/v1/search/recent` (로그인 사용자 기준)
- 응답 형태
  - `posts`
  - `tags`
  - `authors`
  - `categories`
  - 각 섹션별 `totalCount`

### 3. 태그 허브 / 카테고리 허브

- 목적: 콘텐츠 탐색 축을 피드 외에도 확장해야 합니다.
- 필요한 API
  - `GET /api/v1/tags`
  - `GET /api/v1/tags/{slug}`
  - `GET /api/v1/tags/{slug}/posts?page=&size=&sort=`
  - `GET /api/v1/categories/{categoryId}`
  - `GET /api/v1/categories/{categoryId}/posts?page=&size=&sort=`
- 응답 필드
  - 태그/카테고리 설명문
  - 대표 글
  - 연관 태그
  - 전체 글 목록

### 4. 시리즈

- 목적: 단건 글 중심 구조를 연재/아카이브 구조로 확장하고 싶습니다.
- 필요한 API
  - `GET /api/v1/series`
  - `GET /api/v1/series/{seriesId}`
  - `POST /api/v1/series`
  - `PUT /api/v1/series/{seriesId}`
  - `POST /api/v1/posts/{postId}/series`
- 글 상세 응답에 추가할 필드
  - `series: { id, title, description, order, totalCount }`

### 5. 작성 / 발행 관리

- 목적: 초안 저장 외에 발행 전 설정과 발행 후 관리가 가능해야 합니다.
- 필요한 API
  - `GET /api/v1/me/posts?status=draft|published|scheduled`
  - `POST /api/v1/posts`
  - `PUT /api/v1/posts/{postId}`
  - `POST /api/v1/posts/{postId}/publish`
  - `POST /api/v1/posts/{postId}/schedule`
- 요청/응답에 추가할 필드
  - `slug`
  - `metaTitle`
  - `metaDescription`
  - `visibility: PUBLIC | UNLISTED | PRIVATE`
  - `publishedAt`
  - `scheduledAt`
  - `seriesId`

### 6. 슬러그 중복 체크

- 목적: 프론트에서 SEO/URL 미리보기를 하고 있으니 서버에서 실제 고유성 보장이 필요합니다.
- 필요한 API
  - `GET /api/v1/posts/slug/check?slug=...`
- 응답
  - `available: boolean`
  - `suggestedSlug`

### 7. 관리자 운영 고도화

- 목적: 현재는 CRUD 위주라 서비스 운영이 어렵습니다.
- 필요한 API
  - `GET /api/v1/admin/reports`
  - `POST /api/v1/admin/reports/{reportId}/resolve`
  - `GET /api/v1/admin/recommendations`
  - `POST /api/v1/admin/recommendations`
  - `DELETE /api/v1/admin/recommendations/{id}`
  - `GET /api/v1/admin/tags`
  - `POST /api/v1/admin/tags/merge`
- 운영 데이터
  - 신고 사유
  - 검수 상태
  - 추천 슬롯 위치
  - 태그 병합 이력

### 8. 응답 규칙

- 모든 리스트는 페이지네이션 지원
- 가능하면 현재 프론트 구조와 맞춰 아래 필드명을 유지
  - `content`
  - `pageNumber`
  - `pageSize`
  - `totalElements`
  - `totalPages`
  - `first`
  - `last`
  - `empty`

### 9. 우선순위

1. 북마크 / 저장한 글
2. 통합 검색
3. 태그 / 카테고리 허브
4. 작성 / 발행 관리 확장
5. 시리즈
6. 관리자 추천 / 신고 / 태그 병합

### 10. 참고 사항

- 프론트엔드는 현재 `posts`, `drafts`, `related posts`, `categories`, `mypage`, `admin` 흐름이 구현되어 있습니다.
- 새 API는 기존 응답 구조를 최대한 깨지 않도록 추가 필드 방식으로 확장해 주세요.
- 에러 응답은 프론트에서 메시지를 바로 노출할 수 있게 `message` 필드를 일관되게 포함해 주세요.

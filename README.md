# 동아리 사진 저장 오류 수정

수정 파일
- `src/pages/clubs/detail/page.tsx`

핵심 수정
- `club_posts`의 partial unique index(`club_posts_detail_club_unique`) 때문에 `onConflict: club,type` upsert가 실패하는 문제를 제거
- 기존 `detail` 행 조회 후 UPDATE, 없으면 INSERT하도록 변경
- 사진 업로드 결과의 Storage 오류를 명시적으로 확인
- 사진 여러 장 업로드 시 고유 경로 생성
- DB 저장 실패 시 방금 업로드한 Storage 파일 자동 정리
- 업로드 MIME type 명시

<!-- Production E2E retrigger after verified auth fix. -->

<!-- Production E2E retrigger: auth bootstrap race fix verified in source. -->

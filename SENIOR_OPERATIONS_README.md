# 사명 운영센터 추가 패치

변경 파일
- src/pages/missions/operations/page.tsx
- src/router/config.tsx
- src/components/feature/Navbar.tsx

기능
- 사명자 이상(assistant_zone_leader 이상) 전용 운영센터
- 기존 Supabase 데이터와 연동한 관리 대상/활동/미션/보고서/심방/기도/체크리스트 요약
- 7일 미활동, 검토 대기 사명 인증, 후속 연락 필요 심방, 검토 필요 보고서 등 주의 항목
- 기존 미션/보고서/심방/출석/헌신예배 기능으로 바로 이동
- 사람별 최근 미션/보고서/성장기록/심방 타임라인 조회
- 기존 user_roles.assigned_teacher_id를 이용한 담당자 배정
- 기존 고3구역 7개 경로를 router에 연결해 현재 카드의 링크가 실제 페이지로 이동하도록 보강
- 사명자 메뉴에 고3구역 및 사명 운영센터 진입점 추가

DB 스키마 변경은 하지 않습니다. 기존 테이블만 읽고, 담당자 배정 시 기존 assigned_teacher_id 컬럼을 업데이트합니다.

검증
- 전체 npm install/build는 이 환경에서 npm install이 시간 초과되어 완주하지 못했습니다.
- 파일 구조/route/import/문법 패턴은 정적 확인했습니다.

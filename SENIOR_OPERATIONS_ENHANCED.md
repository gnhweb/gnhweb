# 사명 운영센터 확장

권한: `assistant_zone_leader`(부구역장) 이상

기존 데이터 연동:
- `user_roles`: 관리 대상/역할/구역/동아리
- `attendance`: 최근 출석/결석
- `mission_assignments`: 미션 배정/검토 대기
- `growth_records`: 성장 기록/기도 제목
- `visitations`: 심방 일정/후속관리
- `weekly_reports`, `event_reports`: 보고서 검토 흐름
- `club_teachers`: 동아리 담당 교사 업무량
- `notifications`: 사명자 확인 요청 알림
- `audit_log`: 기존 관리자 변경 이력

제공 기능:
1. 오늘 먼저 볼 사람 자동 우선순위
2. 개인별 건강도/케어 상태
3. 개인 활동 타임라인
4. 후속관리 Inbox
5. 담당 현황/위험 인원
6. 주간 회의 자동 요약
7. 기존 감사 로그 표시
8. 사명자에게 확인 요청 알림 보내기
9. 기존 기능으로 바로 이동
10. 모바일용 가로 탭/반응형 UI

주의:
- 새 DB 테이블/컬럼은 만들지 않았습니다.
- 개인별 담당자 저장 스키마가 현재 명확하지 않아 담당 현황은 `club_teachers` 기준으로 표시합니다.
- 부장계정/NVIDIA/NIM/회의AI 보안 로직은 변경하지 않았습니다.
- PWA 설정은 변경하지 않았습니다.

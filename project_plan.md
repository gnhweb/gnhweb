# 강릉 학생회 웹사이트 - 전국 1등을 향한 운영 플랫폼

## 1. 프로젝트 개요

**목표**: 약 150명 규모의 교회 학생회가 전국 1등 학생회로 도약하기 위한 **운영 체계(행정) 중심**의 웹 플랫폼

**핵심 가치**:
- 부장 중심의 역할 기반 접근 통제로 체계적인 운영 구조 확립
- 구역장·부구역장 → 과장 → 교사 → 부장으로 이어지는 보고·승인 워크플로우
- 동아리별(4개) 운영 데이터 자동 분류 및 시각화
- 내부 성장 지표(작년 대비) 기반의 데이터 중심 의사결정

**대상 사용자**:
| 역할 | 인원 | 특징 |
|------|------|------|
| 일반 학생회원 (비로그인) | ~130명 | 정보 열람만 가능, 민감 데이터 접근 불가 |
| 부구역장·구역장 (로그인) | ~15-20명 | 보고서 작성, 학생 관리, 동아리 운영 참여 |
| 각 과장 (서기·회계·봉사·오락·교육·체육·찬양·기획) | ~8명 | 부서별 운영 관리, 보고서 작성 |
| 회장 (로그인) | 1명 | 학생회 운영 총괄, 보고서 관리 |
| 교사 (로그인) | 1-2명 | 보고서 검토, 피드백 작성, 중간 관리 |
| 부장 (로그인) | 1명 | 최종 승인, 전체 통제, 권한 관리, 전략 대시보드 |

## 2. 페이지 구조

```
├── /                          → 홈페이지 (공개)
├── /clubs                     → 동아리 소개 (공개)
│   ├── /clubs/saeullim        → 새울림 (북)
│   ├── /clubs/cheonjipoong    → 천지풍 (기창)
│   ├── /clubs/cheonjihu       → 천지후 (치어)
│   └── /clubs/munhwabu        → 문화부 (미디어/편집)
├── /bible-pick                → 말씀뽑기 (공개) [UPGRADED: 자유 텍스트 + 감정 분석]
│   └── /bible-pick/history    → 말씀 히스토리
├── /bible-streak              → 말씀 묵상 스트릭 (공개) [NEW]
├── /bible-mbti                → 성경 인물 MBTI (공개)
├── /bible-quiz                → 성경 퀴즈 대항전 (공개) [UPGRADED]
├── /prayer-relay              → 기도 릴레이 (공개) [NEW]
├── /counseling                → AI 상담 챗봇 아리 (공개) [NEW]
├── /notices                   → 공지사항 목록 (공개)
│   └── /notices/:id           → 공지사항 상세 (공개)
├── /schedule                  → 행사/일정 미리보기 (공개)
├── /login                     → 로그인 페이지
├── /dashboard                 → 사명자/교사/부장 대시보드 (로그인, 역할별 상이)
├── /reports                   → 보고서 관리 (사명자 이상)
│   ├── /reports/weekly        → 주간 활동 보고
│   ├── /reports/event         → 행사별 결과 보고
│   └── /reports/growth        → 학생 개인별 성장 기록
├── /reports/:id/review        → 보고서 검토·피드백 (교사/부장)
├── /members                   → 학생 명단 관리 (사명자 이상, 역할별 범위 상이)
├── /admin                     → 관리자 페이지 (부장 전용)
│   ├── /admin/approvals       → 최종 승인 대기 목록
│   ├── /admin/roles           → 역할·권한 관리
│   └── /admin/strategy        → 전략 대시보드 (전체 지표)
└── /notifications             → 알림 센터 (로그인)
```

## 3. 핵심 기능 목록

### 3.1 공개 영역 (비로그인)
- [ ] 홈페이지: 학생회 소개, 비전, 동아리 미리보기, 최근 공지
- [ ] 동아리 소개: 4개 동아리별 설명, 활동 사진, 주요 성과
- [x] **말씀뽑기: 감정 선택 → 상황 작성 → 말씀 + 실천 방법 + 자기전 기도** [NEW]
- [x] **성경 인물 MBTI: 4개 질문 → AI가 성경 인물 매칭 (Track 2 - gemma)** [NEW]
- [x] **AI 성경 퀴즈 대항전: 동아리별 실시간 랭킹, OX/초성/객관식 문제, 난이도별 문제 분배, 문제 다양화 (50+ 문제 풀), 개인별 최고 점수만 반영** [UPGRADED]
- [ ] 공지사항: 목록 + 상세 보기 (요약만, 민감정보 필터링)
- [ ] 행사 일정: 캘린더 형태 미리보기 (상세 내용 제한)

### 3.2 인증 시스템
- [ ] 로그인/회원가입 (Supabase Auth)
- [ ] 역할 기반 접근 통제 (Route Guard)
- [ ] 역할별 UI 차등 렌더링

### 3.3 동아리 소통 공간 [NEW]
- [x] 동아리별 전용 게시판 (회원가입 시 선택한 동아리 기준 접근)
- [x] 동아리원 전용 글 작성/삭제
- [x] 부장/교사 전 동아리 열람 가능
- [x] Supabase RLS 정책으로 접근 통제

### 3.4 사명자 기능
- [ ] 주간 활동 보고서 작성 (출석, 진행상황, 특이사항)
- [ ] 학생 개인별 성장 기록 작성
- [ ] 행사별 결과 보고서 작성
- [x] **행사 기획 마법사 (PDS): Plan-Do-See 체크리스트 자동 생성 (Track 1 - llama)** [NEW]
- [x] **리더십 코칭 다이어리: 고민 기록 → AI 코칭 피드백 + 히스토리 (Track 1 - llama)** [NEW]
- [x] **10초 심방 편지: 학생명+상황 → 맞춤형 카톡 메시지 생성 (Track 2 - gemma)** [NEW]
- [ ] 내 담당 학생 목록 및 현황 조회
- [ ] 내 동아리 일정 확인
- [ ] 개인 대시보드 (내 보고서 상태, 피드백 확인)

### 3.5 교사 기능
- [ ] 사명자 보고서 목록 조회 (담당 동아리/구역)
- [ ] 보고서 검토 및 피드백 작성
- [ ] 학생 데이터 열람 (사명자보다 넓은 범위)
- [x] **출석 대시보드: 동아리별 출석률 그래프 + AI 심방 추천 (Track 1 - llama)** [NEW]
- [ ] 교사 대시보드 (전체 진행상황, 미처리 보고서)

### 3.6 부장 기능
- [ ] 전체 보고서 최종 승인/반려
- [ ] 공지사항 작성·수정·삭제
- [ ] 일정·행사 확정 및 공지
- [ ] 역할·권한 관리
- [ ] 전략 대시보드 (전체 지표, 동아리별 비교, 성장률)
- [ ] AI 인사이트: 개선 제안, 우선순위 추천

### 3.7 인앱 알림
- [ ] 보고서 제출/피드백/승인 상태 변경 알림
- [ ] 일정 변경/리마인드 알림
- [ ] 미처리 항목 배지 카운트

## 4. 데이터 모델 설계

### Table: user_roles (Supabase Auth 메타데이터 + custom)
| 필드 | 타입 | 설명 |
|------|------|------|
| user_id | uuid | Supabase Auth uid |
| role | text | 'chief' / 'teacher' / 'president' / 'secretary' / 'treasurer' / 'service_manager' / 'recreation_manager' / 'education_manager' / 'sports_manager' / 'praise_manager' / 'planning_manager' / 'zone_leader' / 'assistant_zone_leader' / 'member' |
| name | text | 실명 |
| club | text | 'saeullim' / 'cheonjipoong' / 'cheonjihu' / 'munhwabu' |
| zone | text | 소속 구역 |
| is_active | boolean | 활성화 여부 |

**권한 계층**:
```
부장(chief) > 교사(teacher) > 회장(president) > 서기·회계·각 과장(secretary/treasurer/service_manager/recreation_manager/education_manager/sports_manager/praise_manager/planning_manager) > 구역장(zone_leader) > 부구역장(assistant_zone_leader) > 일반 학생회원(member)
```
* 회원가입 시 기본 member로 가입, 부장이 admin/roles에서 권한 부여

### Table: weekly_reports
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| author_id | uuid | 작성자 (사명자) |
| club | enum | 소속 동아리 |
| week_start | date | 주차 시작일 |
| attendance_count | int | 출석 인원 |
| total_members | int | 전체 인원 |
| progress_summary | text | 진행 상황 |
| special_notes | text | 특이 사항 |
| status | enum | 'draft' / 'submitted' / 'president_reviewed' / 'reviewed' / 'approved' / 'rejected' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Table: growth_records
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| student_id | uuid | 대상 학생 |
| author_id | uuid | 작성자 (사명자) |
| club | enum | |
| record_date | date | 기록일 |
| spiritual_growth | text | 영적 성장 내용 |
| participation_change | text | 참여도 변화 |
| prayer_requests | text | 기도제목 |
| status | enum | 'draft' / 'submitted' / 'president_reviewed' / 'reviewed' / 'approved' / 'rejected' |
| created_at | timestamptz | |

### Table: event_reports
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| author_id | uuid | 작성자 |
| club | enum | |
| event_name | text | 행사명 |
| event_date | date | 행사일 |
| participant_count | int | 참여 인원 |
| performance_summary | text | 성과 요약 |
| feedback_text | text | 피드백 |
| status | enum | 'draft' / 'submitted' / 'president_reviewed' / 'reviewed' / 'approved' / 'rejected' |
| created_at | timestamptz | |

### Table: feedbacks
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| report_type | enum | 'weekly' / 'growth' / 'event' |
| report_id | uuid | 대상 보고서 ID |
| reviewer_id | uuid | 피드백 작성자 |
| content | text | 피드백 내용 |
| checklist_items | jsonb | AI 체크리스트 항목 |
| next_actions | jsonb | AI Next Action 항목 |
| created_at | timestamptz | |

### Table: notices
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| author_id | uuid | 작성자 (교사/부장) |
| title | text | 제목 |
| content | text | 내용 |
| is_public | boolean | 공개 여부 |
| target_role | enum | 대상 역할 |
| created_at | timestamptz | |

### Table: schedules
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| title | text | 일정명 |
| description | text | 설명 |
| event_date | date | 일자 |
| target_club | enum | 대상 동아리 (null=전체) |
| target_role | enum | 대상 역할 |
| is_confirmed | boolean | 확정 여부 |
| created_by | uuid | |
| created_at | timestamptz | |

### Table: notifications
| 필드 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | 수신자 |
| type | enum | 알림 유형 |
| title | text | |
| message | text | |
| is_read | boolean | |
| link_url | text | 연결 링크 |
| created_at | timestamptz | |

## 5. 권한 매트릭스

| 기능 | 일반회원 | 부구역장 | 구역장 | 과장 | 회장 | 교사 | 부장 |
|------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 동아리 정보 열람 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 공지사항 열람 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 일정 미리보기 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 말씀뽑기 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 보고서 작성 (본인) | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 보고서 수정 (본인) | ❌ | ✅ (승인 전) | ✅ (승인 전) | ✅ (승인 전) | ✅ (승인 전) | ❌ | ✅ |
| 보고서 검토·피드백 | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| 보고서 최종 승인 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 보고서 반려 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 내 담당 학생 조회 | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| 전체 학생 조회 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| 건의사항 작성 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 공지사항 작성 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 일정 확정 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 역할·권한 관리 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| 전략 대시보드 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI 인사이트 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## 6. 보고 워크플로우

```
작성자 작성(draft)
    ↓ 제출
회장 검토 대기 (submitted)
    ↓ 회장 검토
회장 검토 완료 (president_reviewed)
    ↓ 교사 검토
교사 검토 완료 (reviewed)
    ↓ 부장 최종 승인
부장 승인 (approved) → 게시·기록 확정
    or
부장 반려 (rejected) → 작성자에게 반환, 수정 요청
```

**보고서 상태 6단계**:
| 상태 | 표시 | 설명 |
|------|------|------|
| draft | 작성중 | 작성자가 작성 중인 상태 |
| submitted | 제출됨 | 제출 완료, 회장 검토 대기 |
| president_reviewed | 회장검토완료 | 회장 1차 검토 완료, 교사 검토 대기 |
| reviewed | 교사검토완료 | 교사 2차 검토 완료, 부장 최종 승인 대기 |
| approved | 승인됨 | 부장 최종 승인 완료 |
| rejected | 반려됨 | 부장 반려, 작성자에게 수정 요청 |

## 7. 핵심 운영 지표 (전략 대시보드)

| 지표 | 계산 방식 | 목표 |
|------|----------|------|
| 주간 참여율 | (출석인원 / 전체인원) × 100 | 전년 동기 대비 +5% |
| 보고서 제출률 | (제출된 보고서 / 기대 보고서 수) × 100 | 100% |
| 피드백 반영률 | (승인된 보고서 / 제출된 보고서) × 100 | 90%+ |
| 동아리별 활동 지수 | 참여율(40%) + 보고서품질(30%) + 성장기록(30%) | 동아리 간 균형 |
| 학생 성장 지수 | 성장 기록의 긍정 키워드 비율 × 참여도 변화 | 전년 대비 +10% |

## 8. 백엔드 / 연동 계획

- **Supabase**: 사용자 인증(Auth), 데이터베이스, 알림
- **Supabase Auth**: 역할 기반 로그인 시스템
- **인앱 알림**: Supabase 실시간 구독 또는 폴링
- **AI 기능 (추후)**: Supabase Edge Functions + NVIDIA NIM API (Llama 3.1 70B)

### 8.1 NVIDIA NIM Two-Track AI 전략 [NEW]
| Track | 모델 | 용도 | 적용 기능 |
|-------|------|------|----------|
| Track 1 | `meta/llama-3.3-70b-instruct` | 논리/구조화 (JSON 출력 최적화) | 성경 퀴즈, PDS 기획, 출석 인사이트, 리더십 코칭 |
| Track 2 | `google/gemma-2-27b-it` | 감성/공감 (친근한 말투) | 심방 편지, 성경 MBTI, 말씀뽑기 |
- API: `https://integrate.api.nvidia.com/v1` (OpenAI 호환)
- Key: `VITE_NVIDIA_API_KEY` (클라이언트 사이드)
- 유틸리티: `src/lib/nvidiaNim.ts` 모듈화

## 9. 개발 단계 계획

### Phase 1: 공개 웹사이트 (홈페이지 + 동아리 소개 + 공지)
- **목표**: 비로그인 사용자도 볼 수 있는 기본 정보 페이지 완성
- **산출물**: 홈페이지, 동아리 소개 4페이지, 공지사항 목록/상세, 일정 미리보기, 내비게이션
- **상태**: ✅ 완료

### Phase 2: 인증 시스템 구축
- **목표**: Supabase 연결 + 로그인/회원가입 + 역할 기반 접근 통제
- **산출물**: 로그인 페이지, 회원가입, Route Guard, 역할별 UI 분기
- **상태**: ✅ 완료

### Phase 3: 사명자 보고·관리 기능
- **목표**: 사명자가 주간보고·성장기록·행사보고를 작성하고 관리
- **산출물**: 사명자 대시보드, 보고서 작성 폼 3종, 보고서 상태 관리
- **상태**: ✅ 완료 (주간 보고서, 성장 기록, 행사 보고서)

### Phase 4: 교사 검토·피드백 + 부장 승인
- **목표**: 보고서 검토 워크플로우 완성, 승인/반려 시스템
- **산출물**: 교사 대시보드, 피드백 작성 UI, 부장 승인 대시보드, 권한 관리
- **상태**: 🚧 진행 중 (통합 검토·피드백 완료, 권한 관리 완료, 전략 대시보드 완료, 부장 승인 대시보드 대기)

### Phase 5: 전략 대시보드 + 알림 + 고도화
- **목표**: 데이터 시각화, AI 인사이트, 인앱 알림, 코칭 카드
- **산출물**: 전략 대시보드(차트/지표), 알림 센터, AI 요약·제안 기능

### Phase 6: 고3구역 독립 섹션 [NEW]
- **목표**: 고3 학생 전용 6대 기능 — 로드맵, 캘린더, 연계 안내, 제안·투표, 롤링페이퍼, 체크리스트
- **상태**: ✅ 완료
- **신규 페이지**:
  - `/senior` — 고3구역 메인 허브 (상태 요약 + 6개 기능 카드)
  - `/senior/roadmap` — 신앙 마일스톤 병행 로드맵
  - `/senior/calendar` — 고3 전용 캘린더 (schedules 테이블 target_group='senior' 활용)
  - `/senior/connection` — 졸업 후 청년부/대학부 연계 안내
  - `/senior/proposals` — 헌신예배 제안·투표 게시판
  - `/senior/rolling-paper` — 온라인 롤링페이퍼 (타임캡슐)
  - `/senior/checklist` — 헌신예배 준비 체크리스트 (실시간 연동)
- **신규 DB 테이블**: senior_teacher_assignments, prayer_topics, senior_encouragements, senior_connection_info, senior_proposals, senior_proposal_votes, senior_rolling_papers, senior_checklist
- **접근 권한**: 고3 학생 (grade='고3' 또는 graduation_expected=true 또는 한국나이 19세 이상) + 교사/부장만 접근
- **네비게이션**: 데스크톱 TOP 영역 + 모바일 그리드에 '고3구역' 링크 조건부 노출
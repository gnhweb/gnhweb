export interface SiteSearchItem {
  path: string;
  label: string;
  description: string;
  icon: string;
  group: string;
  keywords: string[];
}

export const SITE_SEARCH_ITEMS: SiteSearchItem[] = [
  { path: '/', label: '홈', description: '강릉 학생회 메인 홈', icon: 'ri-home-line', group: '기본', keywords: ['홈', '메인', '강릉학생회'] },
  { path: '/clubs', label: '동아리', description: '동아리 목록과 소통방', icon: 'ri-group-line', group: '소통·공동체', keywords: ['동아리', '소통', '공동체', '클럽'] },
  { path: '/notices', label: '공지사항', description: '학생회 공지와 안내', icon: 'ri-megaphone-line', group: '소통·공동체', keywords: ['공지', '공지사항', '알림', '안내'] },
  { path: '/schedule', label: '일정', description: '학생회 일정과 행사 일정', icon: 'ri-calendar-event-line', group: '기본', keywords: ['일정', '달력', '행사', '스케줄'] },
  { path: '/suggestions', label: '건의사항', description: '학생회에 의견 보내기', icon: 'ri-lightbulb-line', group: '소통·공동체', keywords: ['건의', '의견', '제안', 'suggestion'] },
  { path: '/qna-board', label: '질문 있어요', description: '질문과 답변 게시판', icon: 'ri-question-answer-line', group: '소통·공동체', keywords: ['질문', '답변', 'qna', '문의'] },
  { path: '/bible-pick', label: '말씀뽑기', description: 'AI와 함께 말씀 추천받기', icon: 'ri-book-open-line', group: '말씀 도구', keywords: ['말씀', '성경', '말씀뽑기', 'ai'] },
  { path: '/bible-streak', label: '말씀 스트릭', description: '말씀 묵상 연속 기록과 배지', icon: 'ri-fire-line', group: '말씀 도구', keywords: ['말씀', '스트릭', '연속', '묵상', '배지', '말씀스트릭', '성경습관'] },
  { path: '/bible-quiz', label: '성경 퀴즈', description: '성경 퀴즈와 문제 풀이', icon: 'ri-question-answer-line', group: '말씀 도구', keywords: ['성경', '퀴즈', '문제', '게임'] },
  { path: '/bible-mbti', label: '말씀 MBTI', description: '성경 인물 MBTI 매칭', icon: 'ri-user-heart-line', group: '말씀 도구', keywords: ['mbti', '성경인물', '성경'] },
  { path: '/bible-by-age', label: '연령별 말씀', description: '연령에 맞는 말씀 찾기', icon: 'ri-book-read-line', group: '말씀 도구', keywords: ['연령', '말씀', '성경'] },
  { path: '/bible-marathon', label: '성경 완독', description: '성경 완독과 읽기 기록', icon: 'ri-book-open-line', group: '말씀 도구', keywords: ['완독', '성경읽기', '마라톤', '성경'] },
  { path: '/memory-board', label: '추억창', description: '사진과 추억 공유', icon: 'ri-image-line', group: '소통·공동체', keywords: ['추억', '사진', '갤러리'] },
  { path: '/song-vote', label: '찬양투표', description: '찬양 곡 투표', icon: 'ri-music-line', group: '소통·공동체', keywords: ['찬양', '투표', '음악'] },
  { path: '/prayer-partner', label: '신앙 짝꿍', description: '기도와 신앙 파트너', icon: 'ri-heart-pulse-line', group: '소통·공동체', keywords: ['기도', '짝꿍', '신앙'] },
  { path: '/prayer-relay', label: '기도 릴레이', description: '기도 릴레이 참여', icon: 'ri-hand-heart-line', group: '소통·공동체', keywords: ['기도', '릴레이'] },
  { path: '/games', label: '전체 게임 보기', description: '학생회 게임 모음', icon: 'ri-gamepad-line', group: '갓겜', keywords: ['게임', '갓겜', '놀이'] },
  { path: '/pharisee', label: '바리새인을 찾아라', description: '성경 테마 멀티플레이 게임', icon: 'ri-book-open-line', group: '갓겜', keywords: ['게임', '바리새인', '성경'] },
  { path: '/wolves-and-sheep', label: '양과 늑대', description: '추리와 협동 게임', icon: 'ri-user-3-line', group: '갓겜', keywords: ['게임', '양', '늑대', '추리'] },
  { path: '/galilee-phone', label: '갈릴리폰', description: '메시지 릴레이 게임', icon: 'ri-chat-smile-3-line', group: '갓겜', keywords: ['게임', '갈릴리폰', '릴레이'] },
  { path: '/leadership-diary', label: '리더십 코칭', description: '리더십 고민을 AI와 함께 정리', icon: 'ri-book-read-line', group: '사명 도구', keywords: ['리더십', '코칭', '사명자', 'ai', '고민'] },
  { path: '/meetings', label: '회의록', description: '회의 기록과 관리', icon: 'ri-chat-check-line', group: '회의', keywords: ['회의', '회의록', '기록'] },
  { path: '/notebook', label: '학생회 노트북', description: '회의록/공지/보고서/파일을 소스로 골라 AI에게 근거 기반으로 질문', icon: 'ri-book-open-line', group: '회의', keywords: ['노트북', 'notebooklm', 'ai', '코파일럿', '학생회 노트북'] },
  { path: '/reports/weekly', label: '주간 보고서', description: '주간 활동과 연습 기록', icon: 'ri-file-list-3-line', group: '보고서', keywords: ['주간', '보고서', '연습', '출석'] },
  { path: '/reports/growth', label: '성장 기록', description: '학생 성장과 활동 기록', icon: 'ri-plant-line', group: '보고서', keywords: ['성장', '기록', '학생'] },
  { path: '/reports/events', label: '행사 보고서', description: '행사 결과와 회고 기록', icon: 'ri-calendar-event-line', group: '보고서', keywords: ['행사', '보고서', '회고'] },
  { path: '/visitations', label: '심방 스케줄', description: '심방 일정과 기록', icon: 'ri-heart-pulse-line', group: '사명자 관리', keywords: ['심방', '방문', '스케줄'] },
  { path: '/dashboard/attendance', label: '스마트 출석', description: '스마트 출석 참여', icon: 'ri-user-heart-line', group: '출석', keywords: ['출석', '스마트 출석', 'attendance'] },
  { path: '/attendance-board', label: '실시간 출석 현황판', description: '실시간 출석 현황 확인', icon: 'ri-user-heart-line', group: '출석', keywords: ['출석', '현황판', '실시간'] },
  { path: '/missions', label: '작은 사명 관리', description: '미션과 후속 관리', icon: 'ri-medal-line', group: '미션', keywords: ['미션', '사명', '관리'] },
  { path: '/missions/board', label: '작은 사명', description: '사명 게시판', icon: 'ri-medal-line', group: '미션', keywords: ['사명', '미션', '게시판'] },
  { path: '/missions/leaderboard', label: '이달의 사명왕', description: '미션 리더보드', icon: 'ri-trophy-line', group: '미션', keywords: ['사명왕', '랭킹', '리더보드'] },
  { path: '/faith-storybook', label: '신앙 스토리북', description: '나의 신앙 이야기 기록', icon: 'ri-bookmark-line', group: '나의 기록', keywords: ['신앙', '스토리북', '기록'] },
  { path: '/faith-journal', label: '신앙 일지', description: '신앙 일지 작성', icon: 'ri-edit-line', group: '나의 기록', keywords: ['신앙', '일지', '기록'] },
  { path: '/repentance-journal', label: '회개 저널', description: '회개와 묵상 기록', icon: 'ri-hand-heart-line', group: '나의 기록', keywords: ['회개', '저널', '신앙'] },
  { path: '/bucket-list', label: '버킷리스트', description: '하고 싶은 일과 목표 관리', icon: 'ri-todo-line', group: '나의 기록', keywords: ['버킷리스트', '목표'] },
  { path: '/personal-schedule', label: '개인 일정', description: '나의 일정 관리', icon: 'ri-calendar-check-line', group: '나의 기록', keywords: ['개인 일정', '일정', '스케줄'] },
  { path: '/profile', label: '프로필 설정', description: '내 계정과 프로필 관리', icon: 'ri-user-settings-line', group: '내 계정', keywords: ['프로필', '계정', '설정'] },
  { path: '/tools', label: '도구 모음', description: '학생회 도구 한곳에서 보기', icon: 'ri-apps-2-line', group: '기본', keywords: ['도구', '기능', '모음'] },
];

const normalize = (value: string) => value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

export function searchSite(query: string): SiteSearchItem[] {
  const q = normalize(query);
  if (!q) return SITE_SEARCH_ITEMS;
  const terms = q.split(' ').filter(Boolean);

  return SITE_SEARCH_ITEMS
    .map((item) => {
      const haystack = normalize([item.label, item.description, item.group, ...item.keywords].join(' '));
      let score = 0;
      if (haystack.includes(q)) score += 40;
      if (normalize(item.label).includes(q)) score += 80;
      if (normalize(item.description).includes(q)) score += 35;
      for (const term of terms) {
        if (normalize(item.label).includes(term)) score += 30;
        else if (haystack.includes(term)) score += 10;
      }
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

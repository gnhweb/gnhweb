export const MISSION_CATEGORIES: Record<string, { label: string; icon: string }> = {
  cleaning: { label: '청소', icon: 'ri-home-smile-line' },
  service: { label: '봉사', icon: 'ri-heart-line' },
  equipment: { label: '장비 관리', icon: 'ri-tools-line' },
  welcome: { label: '환영', icon: 'ri-user-smile-line' },
  media: { label: '미디어', icon: 'ri-camera-line' },
  prayer: { label: '기도', icon: 'ri-hand-heart-line' },
  praise: { label: '찬양', icon: 'ri-music-line' },
  education: { label: '교육', icon: 'ri-book-open-line' },
  general: { label: '일반', icon: 'ri-checkbox-circle-line' },
};

export const BADGE_DEFINITIONS = [
  // 완료 횟수 기반
  { id: 'first_step', title: '첫 발걸음', description: '첫 번째 작은 사명을 완료했어요!', icon: 'ri-footprint-line', condition: (completedCount: number) => completedCount >= 1, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { id: 'faithful_hand', title: '성실한 손', description: '작은 사명을 5회 완료했어요!', icon: 'ri-hand-heart-line', condition: (completedCount: number) => completedCount >= 5, color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { id: 'ten_missions', title: '열 걸음', description: '작은 사명을 10회 완료했어요!', icon: 'ri-medal-line', condition: (completedCount: number) => completedCount >= 10, color: 'bg-violet-100 text-violet-700 border-violet-300' },
  { id: 'twenty_missions', title: '스무 걸음', description: '작은 사명을 20회 완료했어요!', icon: 'ri-medal-2-line', condition: (completedCount: number) => completedCount >= 20, color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { id: 'fifty_missions', title: '반백의 사명자', description: '작은 사명을 50회 완료했어요!', icon: 'ri-trophy-line', condition: (completedCount: number) => completedCount >= 50, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { id: 'hundred_missions', title: '사명의 전설', description: '작은 사명을 100회 완료했어요!', icon: 'ri-star-smile-line', condition: (completedCount: number) => completedCount >= 100, color: 'bg-rose-100 text-rose-700 border-rose-300' },

  // 청소 특화
  { id: 'cleaning_guardian', title: '학관 지킴이', description: '청소 미션을 3회 완료했어요!', icon: 'ri-shield-star-line', condition: (_total: number, cleaningCount: number) => cleaningCount >= 3, color: 'bg-sky-100 text-sky-700 border-sky-300' },
  { id: 'cleaning_master', title: '청소 달인', description: '청소 미션을 10회 완료했어요!', icon: 'ri-home-gear-line', condition: (_total: number, cleaningCount: number) => cleaningCount >= 10, color: 'bg-cyan-100 text-cyan-700 border-cyan-300' },

  // 봉사 특화
  { id: 'servant_heart', title: '섬김의 마음', description: '봉사 미션을 3회 완료했어요!', icon: 'ri-heart-pulse-line', condition: (_total: number, _cleaning: number, serviceCount: number) => serviceCount >= 3, color: 'bg-rose-100 text-rose-700 border-rose-300' },
  { id: 'servant_leader', title: '섬김의 리더', description: '봉사 미션을 10회 완료했어요!', icon: 'ri-heart-add-line', condition: (_total: number, _cleaning: number, serviceCount: number) => serviceCount >= 10, color: 'bg-red-100 text-red-700 border-red-300' },

  // 미디어 특화
  { id: 'media_star', title: '미디어 스타', description: '미디어 미션을 2회 완료했어요!', icon: 'ri-camera-lens-line', condition: (_total: number, _cleaning: number, _service: number, mediaCount: number) => mediaCount >= 2, color: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  { id: 'media_creator', title: '콘텐츠 크리에이터', description: '미디어 미션을 5회 완료했어요!', icon: 'ri-movie-line', condition: (_total: number, _cleaning: number, _service: number, mediaCount: number) => mediaCount >= 5, color: 'bg-purple-100 text-purple-700 border-purple-300' },

  // 환영 특화
  { id: 'welcome_angel', title: '환영 천사', description: '환영 미션을 2회 완료했어요!', icon: 'ri-user-heart-line', condition: (_total: number, _cleaning: number, _service: number, _media: number, welcomeCount: number) => welcomeCount >= 2, color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'welcome_ambassador', title: '환영 대사', description: '환영 미션을 5회 완료했어요!', icon: 'ri-user-star-line', condition: (_total: number, _cleaning: number, _service: number, _media: number, welcomeCount: number) => welcomeCount >= 5, color: 'bg-amber-100 text-amber-700 border-amber-300' },

  // 장비 특화
  { id: 'equipment_keeper', title: '장비 관리자', description: '장비 관리 미션을 3회 완료했어요!', icon: 'ri-settings-3-line', condition: (_total: number, _cleaning: number, _service: number, _media: number, _welcome: number, equipmentCount: number) => equipmentCount >= 3, color: 'bg-teal-100 text-teal-700 border-teal-300' },

  // 기도 특화
  { id: 'prayer_warrior', title: '기도 용사', description: '기도 미션을 3회 완료했어요!', icon: 'ri-shield-user-line', condition: (_total: number, _cleaning: number, _service: number, _media: number, _welcome: number, _equipment: number, prayerCount: number) => prayerCount >= 3, color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { id: 'prayer_champion', title: '중보 기도자', description: '기도 미션을 10회 완료했어요!', icon: 'ri-hand-heart-line', condition: (_total: number, _cleaning: number, _service: number, _media: number, _welcome: number, _equipment: number, prayerCount: number) => prayerCount >= 10, color: 'bg-sky-100 text-sky-700 border-sky-300' },

  // 찬양 특화
  { id: 'praise_voice', title: '찬양의 목소리', description: '찬양 미션을 3회 완료했어요!', icon: 'ri-music-line', condition: (_total: number, _cleaning: number, _service: number, _media: number, _welcome: number, _equipment: number, _prayer: number, praiseCount: number) => praiseCount >= 3, color: 'bg-pink-100 text-pink-700 border-pink-300' },

  // 교육 특화
  { id: 'teacher_heart', title: '가르치는 마음', description: '교육 미션을 3회 완료했어요!', icon: 'ri-book-open-line', condition: (_total: number, _cleaning: number, _service: number, _media: number, _welcome: number, _equipment: number, _prayer: number, _praise: number, educationCount: number) => educationCount >= 3, color: 'bg-lime-100 text-lime-700 border-lime-300' },

  // 연속 완료
  { id: 'streak_three', title: '3일 연속', description: '3일 연속으로 미션을 완료했어요!', icon: 'ri-fire-line', streakCondition: 3, color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { id: 'streak_seven', title: '7일 연속', description: '일주일 연속으로 미션을 완료했어요!', icon: 'ri-fire-fill', streakCondition: 7, color: 'bg-red-100 text-red-700 border-red-300' },

  // 시즌 특별
  { id: 'monthly_king', title: '이달의 사명왕', description: '이번 달 가장 많은 미션을 완료했어요!', icon: 'ri-vip-crown-line', monthlyKing: true, color: 'bg-yellow-200 text-yellow-800 border-yellow-400' },
];
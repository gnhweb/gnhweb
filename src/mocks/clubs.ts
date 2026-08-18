export interface ClubData {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  longDescription: string;
  activities: string[];
  achievements: string[];
  schedule: string;
  leaderQuote: string;
  leaderName: string;
  heroImage: string;
  cardImage: string;
  color: string;
  iconBg: string;
  iconText: string;
}

export const clubs: ClubData[] = [
  {
    id: 'saeullim',
    name: '새울림',
    subtitle: '북 동아리',
    description: '리듬과 에너지로 하나님을 찬양하는 북 연주 동아리입니다. 전통과 현대를 아우르는 공연으로 예배와 행사에 생동감을 더합니다.',
    longDescription: '새울림은 북 연주를 통해 하나님께 영광을 돌리는 동아리입니다. 매주 정기 연습을 통해 팀워크와 리듬 감각을 키우고, 학생회 예배와 각종 행사에서 찬양의 도구로 사용됩니다. 초보자도 기본기부터 차근차근 배울 수 있으며, 숙련된 선배들의 1:1 멘토링 시스템으로 실력을 키울 수 있습니다. 매년 전국 학생회 경연대회에서 수상하는 쾌거를 이루고 있습니다.',
    activities: [
      '매주 화·목 정기 연습 (오후 7시)',
      '월 1회 전체 합주 및 퍼포먼스 점검',
      '학생회 정기 예배 찬양 섬김',
      '전국 학생회 북 경연대회 참가',
      '분기별 워크숍 (외부 강사 초청)',
    ],
    achievements: [
      '2025 전국 학생회 북 경연대회 대상',
      '2024 교회 연합 찬양제 베스트 퍼포먼스상',
      '2023 강원도 청소년 문화제 특별상',
    ],
    schedule: '매주 화·목요일 오후 7:00 - 9:00 / 본당 2층 찬양실',
    leaderQuote: '북소리 하나하나가 기도가 되고, 리듬 하나하나가 찬양이 됩니다. 함께 두드리며 주님의 심장 소리를 듣는 시간입니다.',
    leaderName: '김지훈',
    heroImage: '',
    cardImage: '',
    color: 'from-amber-400 to-orange-500',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
  },
  {
    id: 'cheonjipoong',
    name: '천지풍',
    subtitle: '기창 동아리',
    description: '깃발과 창작 퍼포먼스로 하나님의 영광을 표현하는 기창 동아리입니다. 화려한 깃발 퍼포먼스로 행사와 경연에서 찬양의 아름다움을 나타냅니다.',
    longDescription: '천지풍은 깃발 퍼포먼스를 통해 시각적인 찬양을 만들어가는 동아리입니다. 깃발의 움직임 하나하나에 의미를 담아 하나님의 영광을 표현하며, 창작 안무와 팀워크를 바탕으로 매년 새로운 작품을 선보입니다. 체력 훈련부터 안무 창작까지 체계적인 커리큘럼으로 운영되며, 실력에 따라 다양한 무대에 설 수 있는 기회가 주어집니다.',
    activities: [
      '매주 월·수·금 정기 연습 (오후 7시)',
      '주 1회 체력 및 기본기 트레이닝',
      '월 1회 신작 안무 창작 워크숍',
      '교회 대예배 특별 퍼포먼스',
      '전국 학생회 기창 페스티벌 참가',
    ],
    achievements: [
      '2025 전국 기창 경연대회 최우수상',
      '2024 교회 창립기념 특별공연 (1,000명 앞)',
      '2023 강원도 청소년 예술제 은상',
    ],
    schedule: '매주 월·수·금요일 오후 7:00 - 9:30 / 체육관',
    leaderQuote: '깃발은 단순한 천이 아닙니다. 그것은 우리의 믿음과 열정이 하늘을 향해 펼쳐지는 찬양의 언어입니다.',
    leaderName: '이서연',
    heroImage: '',
    cardImage: '',
    color: 'from-sky-400 to-blue-500',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
  },
  {
    id: 'cheonjihu',
    name: '천지후',
    subtitle: '치어 동아리',
    description: '활기찬 응원과 퍼포먼스로 학생회에 에너지를 불어넣는 치어리딩 동아리입니다. 밝고 건강한 에너지로 공동체의 사기를 높입니다.',
    longDescription: '천지후는 치어리딩을 통해 학생회의 분위기를 밝고 활기차게 만드는 동아리입니다. 응원 구호와 퍼포먼스, 스턴트 기술을 익히며 단원 간의 신뢰와 협동심을 배웁니다. 모든 동아리와 행사를 응원하고 지원하는 것이 주된 사명이며, 학생회 전체의 하나 됨을 이끄는 중요한 역할을 합니다. 체계적인 안전 교육과 단계별 기술 훈련으로 누구나 즐겁게 참여할 수 있습니다.',
    activities: [
      '매주 월·목 정기 연습 (오후 6시 30분)',
      '주 2회 스턴트 및 안전 훈련',
      '타 동아리 행사·공연 응원 지원',
      '학생회 체육대회 응원전 기획',
      '전국 치어리딩 대회 참가',
    ],
    achievements: [
      '2025 전국 학생회 치어리딩 대회 우수상',
      '2024 교회 체육대회 응원상 (전체 1위)',
      '지역 연합 학생회 응원 페스티벌 2년 연속 참가',
    ],
    schedule: '매주 월·목요일 오후 6:30 - 9:00 / 체육관',
    leaderQuote: '우리의 응원 소리가 누군가에게는 다시 일어설 힘이 됩니다. 함께 외치는 함성 속에 주님의 사랑이 담겨 있습니다.',
    leaderName: '박예은',
    heroImage: '',
    cardImage: '',
    color: 'from-rose-400 to-pink-500',
    iconBg: 'bg-rose-100',
    iconText: 'text-rose-600',
  },
  {
    id: 'munhwabu',
    name: '문화부',
    subtitle: '미디어·편집 동아리',
    description: '사진, 영상, 디자인, SNS 운영까지 학생회의 모든 콘텐츠를 책임지는 미디어 동아리입니다. 창의적인 기록으로 학생회의 이야기를 담아냅니다.',
    longDescription: '문화부는 학생회의 모든 순간을 기록하고 아름답게 담아내는 미디어·편집 동아리입니다. 행사 사진 촬영, 영상 제작, SNS 콘텐츠 기획, 학생회 소식지 발행 등 다양한 미디어 활동을 통해 학생회의 이야기를 세상에 전합니다. 포토샵, 프리미어 프로 등 전문 툴을 배울 수 있으며, 콘텐츠 기획부터 제작까지 실무 경험을 쌓을 수 있습니다. 창의력과 감각을 키우고 싶은 누구나 환영합니다.',
    activities: [
      '매주 토요일 정기 모임 (오후 2시)',
      '행사 사진·영상 촬영 및 편집',
      '주간 학생회 SNS 콘텐츠 제작',
      '월간 학생회 소식지 발행',
      '미디어 교육 세미나 (분기 1회)',
    ],
    achievements: [
      '2025 교회 SNS 콘텐츠 공모전 대상',
      '2024 학생회 활동 영상 조회수 5만 돌파',
      '지역 교회 연합 미디어 워크숍 주관',
    ],
    schedule: '매주 토요일 오후 2:00 - 5:00 / 본당 3층 미디어실',
    leaderQuote: '우리가 담는 한 장의 사진, 한 편의 영상이 누군가에게는 소중한 추억이 되고 믿음의 기록이 됩니다. 진심을 담아 기록하는 것이 우리의 사명입니다.',
    leaderName: '최수빈',
    heroImage: '',
    cardImage: '',
    color: 'from-violet-400 to-purple-500',
    iconBg: 'bg-violet-100',
    iconText: 'text-violet-600',
  },
  {
    id: 'cheonhwarae_cheongmyeong',
    name: '천화래와 청명',
    subtitle: '찬양·밴드 동아리',
    description: '찬양팀과 밴드가 하나 되어 예배의 감동을 음악으로 표현하는 찬양·밴드 동아리입니다. 보컬, 기타, 베이스, 드럼, 키보드 등 다양한 파트가 함께 어우러져 아름다운 찬양을 만들어갑니다.',
    longDescription: '천화래와 청명은 찬양과 밴드 연주를 통해 하나님께 영광을 돌리는 특별한 동아리입니다. 기존 4대 동아리와 중복 소속이 가능한 유일한 동아리로, 각 동아리의 찬양 인재들이 함께 모여 예배의 음악적 감동을 극대화합니다. 매주 찬양 연습과 밴드 합주를 진행하며, 학생회 예배와 특별 집회의 찬양을 섬깁니다. 보컬, 기타, 베이스, 드럼, 키보드 등 다양한 포지션을 경험할 수 있습니다.',
    activities: [
      '매주 수·금 찬양 연습 (오후 7시)',
      '주 1회 밴드 합주',
      '학생회 정기 예배 찬양 인도',
      '월 1회 신곡 편곡 워크숍',
      '특별 집회 찬양팀 섬김',
    ],
    achievements: [
      '2025 교회 청년부 연합 찬양제 찬양상',
      '2024 학생회 부흥회 찬양 인도',
    ],
    schedule: '매주 수·금요일 오후 7:00 - 9:30 / 본당 2층 찬양실',
    leaderQuote: '찬양은 우리의 가장 아름다운 고백입니다. 밴드와 보컬이 하나 되어 만들어내는 하모니 속에서 하나님의 임재를 경험합니다.',
    leaderName: '정다은',
    heroImage: '',
    cardImage: '',
    color: 'from-sky-400 to-cyan-500',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
  },
];

export const clubIcons: Record<string, string> = {
  saeullim: 'ri-music-line',
  cheonjipoong: 'ri-flag-line',
  cheonjihu: 'ri-heart-pulse-line',
  munhwabu: 'ri-camera-lens-line',
  cheonhwarae_cheongmyeong: 'ri-mic-line',
};
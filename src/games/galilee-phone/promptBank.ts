import { PromptCategory, SeasonalPack } from "./types";

/**
 * 카테고리별 프롬프트 풀. "랜덤 뽑기" 버튼과 자동 배정에 쓰인다.
 * GDD 3.2절 원칙: 교회 생활 밈이 핵심 통로 — 성경 구절 원문 인용보다
 * "교회 다니는 사람만 아는 웃음 포인트"가 더 힘이 세다. 정답/오답 없음.
 */
export const PROMPT_BANK: Record<PromptCategory, string[]> = {
  church_life: [
    "대표기도 순서 걸렸는데 뭐라 할지 까먹은 집사님",
    "헌금 시간에 지갑에 현금이 없어서 당황한 청년",
    "성가대 연습에서 음 이탈한 순간",
    "예배 중간에 핸드폰 벨소리가 울려서 얼음이 된 사람",
    "주보 접다가 딴생각하는 초등부 아이",
    "설교 시간에 졸다가 화들짝 깨는 장로님",
    "헌금봉투에 이름 안 써서 혼나는 청년",
    "새가족 소개 시간에 이름을 잘못 불린 사람",
    "구역예배 간식 뭐 준비할지 단톡방에서 격론하는 권사님들",
    "주차 안내하다가 본인 차를 못 찾는 안내위원",
    "찬양 인도자가 시선처리 어려워하는 순간",
    "성경책을 집에 두고 온 걸 뒤늦게 깨달은 사람",
    "심방 온 목사님 앞에서 갑자기 얌전해진 아이들",
    "교회 카페에서 아메리카노 이름 잘못 불려서 두 번 대답한 사람",
    "부흥회 마지막 날 은혜받은 척하는 사람",
    "찬양 시간에 박수 타이밍 혼자 틀린 사람",
    "제직회 안건 발표하다가 마이크 하울링에 놀란 사람",
    "여름수련회 장기자랑 순서 정하다가 싸우는 청년부",
    "권사님이 나눠주신 떡 몰래 두 개 챙기는 아이",
    "성경퀴즈 사회자가 정답을 깜빡한 순간",
    "새벽기도 가려다 알람 못 듣고 늦잠 잔 집사님",
    "교회 버스 기다리다 반대 방향으로 뛰어간 사람",
    "찬양대 가운 사이즈가 안 맞아서 낑낑대는 성도",
    "목장 모임 장소를 착각해서 딴 집 벨 누른 사람",
  ],
  bible_story: [
    "홍해가 갈라지는 순간 어리둥절한 이집트 병사",
    "다윗이 골리앗 앞에서 돌을 고르는 표정",
    "요나가 물고기 뱃속에서 하는 생각",
    "노아의 방주에서 코끼리 옆자리 배정받은 토끼",
    "삼손이 머리카락 잘리고 나서 짓는 표정",
    "예수님이 물 위를 걷는 걸 보고 눈 비비는 베드로",
    "떡 다섯 개와 물고기 두 마리로 5천 명을 먹이는 순간 뒷줄 사람의 반응",
    "바벨탑이 무너지는 걸 지켜보는 인부",
    "요셉이 형들 앞에서 자기 정체를 밝히는 순간",
    "다니엘이 사자굴에서 사자와 눈싸움하는 표정",
    "모세가 십계명 돌판을 들고 산에서 내려오다 마주친 광경",
    "엘리야가 갈멜산에서 불을 내려달라고 기도하는 순간",
    "삭개오가 나무 위에서 예수님과 눈이 마주친 순간",
    "베드로가 닭 울음소리를 듣고 후회하는 표정",
    "롯의 아내가 소돔을 돌아보는 그 결정적 순간",
    "야곱이 형 에서와 재회하며 짓는 어색한 표정",
    "돌아온 탕자를 맞이하는 아버지의 표정",
    "가나 혼인잔치에서 물이 포도주로 변하는 순간 하인의 반응",
    "선한 사마리아인이 강도 만난 사람을 발견하는 순간",
    "부활하신 예수님을 보고 놀란 도마의 표정",
  ],
  worship: [
    "브릿지 부분에서 갑자기 진지해지는 밴드",
    "손을 어디에 둬야 할지 모르는 첫 참석자",
    "찬양 가사 화면이 넘어가는 타이밍을 놓친 사람",
    "드럼 치다가 스틱을 놓친 순간",
    "워십 인도자가 하이노트에서 살짝 갈라진 순간",
    "찬양 인터루드가 너무 길어서 어색하게 서있는 팀원",
    "간증하다가 갑자기 눈물이 터진 사람",
    "워십팀 리허설에서 마이크 볼륨 조절로 우왕좌왕하는 스태프",
    "찬양 가사를 잘못 외워서 혼자 다른 소절 부르는 사람",
    "기타 튜닝하다 줄이 끊어진 순간",
    "찬양 중 무대 조명이 갑자기 꺼진 순간",
    "율동 찬양 동작을 반 박자 늦게 따라하는 사람",
  ],
  gratitude: [
    "시험 전날 벼락치기 대신 기도한 결과",
    "장마철에 우산 잃어버렸는데 새 우산 생긴 썰",
    "버스를 놓쳤는데 그 버스가 사고 났다는 뉴스를 본 순간",
    "면접 전날 마음이 이상하게 평안했던 이유",
    "지갑을 잃어버렸는데 다음날 그대로 찾은 순간",
    "힘든 하루 끝에 우연히 들은 위로되는 찬양 가사",
    "포기하려던 순간 걸려온 뜻밖의 전화",
    "새벽에 문득 떠오른 친구를 위해 기도했더니 다음날 연락 온 썰",
    "여행 중 길을 잃었는데 마침 만난 친절한 분",
    "용돈이 부족했는데 뜻밖에 생긴 작은 선물",
  ],
  random: [
    "고양이가 세상을 지배하는 미래",
    "라면 먹다가 넥타이에 국물 튄 순간",
    "엘리베이터 문이 닫히기 직전 전력질주하는 사람",
    "택배가 도착했는데 시킨 적 없는 물건인 순간",
    "여름에 에어컨 리모컨을 못 찾아 헤매는 사람",
    "지하철에서 내릴 역을 놓쳐 당황한 사람",
    "다이어트 중인데 눈앞에 치킨이 놓인 순간",
    "월요일 아침 알람을 다섯 번 끈 사람",
    "친구가 빌려준 우산을 또 잃어버린 순간",
    "무한도전 재방송 보다가 밤새운 사람",
    "새로 산 신발에 첫 빗물이 튄 순간",
    "냉장고 문을 열고 뭘 먹을지 5분째 고민하는 사람",
    "와이파이가 갑자기 끊긴 순간의 표정",
    "결제하려는데 카드가 안 긁히는 순간",
    "지각인데 신호등마다 걸리는 사람",
  ],
};

/**
 * 7단계: 시즌 프롬프트 팩 (GDD 3.5절 / 8절). 절기 시즌에만 노출되는 한정 프롬프트로,
 * 평상시 디폴트를 바꾸지 않고 randomPrompt()에서 확률적으로 "비중을 일시적으로 올리는"
 * 방식으로만 섞인다 (GDD 1.2.4절 — 상시 강제 아님).
 * 각 프롬프트는 기존 5개 카테고리 중 하나에 속해, 체인 데이터 모델(ChainEntry.category)을
 * 그대로 재사용한다 — 시즌팩은 "추가 소스"일 뿐 새 카테고리를 만들지 않는다.
 */
export const SEASONAL_PROMPTS: Record<Exclude<SeasonalPack, "none">, { text: string; category: PromptCategory }[]> = {
  christmas: [
    { text: "구유에 아기 예수님을 눕히는 순간 마리아의 표정", category: "bible_story" },
    { text: "동방박사가 별을 따라가다 길을 잘못 든 순간", category: "bible_story" },
    { text: "목자들이 천사의 소식을 듣고 놀란 표정", category: "bible_story" },
    { text: "성탄 칸타타 연습에서 파트를 헷갈린 성가대원", category: "church_life" },
    { text: "트리 장식하다 전구 줄이 엉켜서 낑낑대는 사람", category: "church_life" },
    { text: "캐롤 부르다 가사를 잊어버려 허밍으로 때우는 사람", category: "worship" },
    { text: "성탄 선물 교환식에서 원하지 않는 선물 받고 웃는 표정", category: "church_life" },
    { text: "화이트 크리스마스를 기대했는데 비만 온 날의 기분", category: "gratitude" },
  ],
  easter: [
    { text: "빈 무덤을 발견하고 놀라는 여인들의 표정", category: "bible_story" },
    { text: "부활하신 예수님을 못 알아보고 정원사인 줄 안 마리아", category: "bible_story" },
    { text: "부활절 계란에 이름 새기다 손에 물감 다 묻힌 아이", category: "church_life" },
    { text: "부활절 새벽예배 가려고 이불과 사투 벌이는 사람", category: "church_life" },
    { text: "부활초 켜다가 촛농이 손에 떨어져 화들짝 놀란 사람", category: "worship" },
    { text: "부활절 달걀찾기에서 제일 큰 걸 발견하고 환호하는 아이", category: "gratitude" },
    { text: "고난주간에 금식 도전했다가 냄새에 무너진 순간", category: "church_life" },
  ],
  thanksgiving: [
    { text: "맥추감사절 예배에 첫 수확한 과일을 들고 온 성도", category: "church_life" },
    { text: "감사헌금 봉투에 한 해 감사제목을 눌러쓰는 권사님", category: "gratitude" },
    { text: "밭에서 딴 채소를 나눠주다 정작 본인 몫이 없는 농부", category: "gratitude" },
    { text: "여름 장마 뚫고 무사히 자란 작물을 보고 감격하는 성도", category: "gratitude" },
    { text: "감사 간증 순서에 너무 떨려서 준비한 말을 다 까먹은 사람", category: "worship" },
    { text: "추수한 곡식을 담다가 자루가 터진 순간", category: "church_life" },
  ],
  retreat: [
    { text: "캠프파이어 앞에서 장기자랑 순서 기다리며 긴장한 사람", category: "church_life" },
    { text: "수련회 조 배정표 보고 친한 친구랑 갈린 걸 안 순간", category: "church_life" },
    { text: "산 정상 새벽기도회에서 예상 못한 추위에 떠는 청년", category: "worship" },
    { text: "수련회 마지막 날 밤 촛불집회에서 눈물 참는 사람", category: "worship" },
    { text: "숙소 배정받고 벙커침대 위층 쟁탈전 벌이는 아이들", category: "church_life" },
    { text: "수련회에서 핸드폰 못 써서 금단현상 오는 청년", category: "gratitude" },
    { text: "레크레이션 게임에서 벌칙 걸려 곤란해진 리더", category: "church_life" },
  ],
};

/**
 * 지정된 카테고리 목록에서 무작위로 카테고리 하나와 프롬프트 하나를 뽑는다.
 * seasonalPack이 켜져 있으면(GDD 3.5절), 해당 팩의 프롬프트 중 활성 카테고리에 속한 것이 있을 때
 * 40% 확률로 우선 노출해 시즌감을 살리되, 나머지 60%는 평소처럼 일반 풀에서 뽑는다 —
 * "상시 강제 아님, 절기엔 비중만 일시적으로 올린다"는 GDD 1.2.4절 원칙을 그대로 따른다.
 */
export function randomPrompt(
  categories: PromptCategory[],
  seasonalPack: SeasonalPack = "none"
): { text: string; category: PromptCategory } {
  const activeCategories = categories.length > 0 ? categories : (Object.keys(PROMPT_BANK) as PromptCategory[]);

  if (seasonalPack !== "none") {
    const seasonalPool = SEASONAL_PROMPTS[seasonalPack].filter((p) => activeCategories.includes(p.category));
    if (seasonalPool.length > 0 && Math.random() < 0.4) {
      return seasonalPool[Math.floor(Math.random() * seasonalPool.length)];
    }
  }

  const category = activeCategories[Math.floor(Math.random() * activeCategories.length)];
  const list = PROMPT_BANK[category];
  const text = list[Math.floor(Math.random() * list.length)];
  return { text, category };
}
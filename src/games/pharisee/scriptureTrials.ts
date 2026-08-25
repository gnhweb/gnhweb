export interface ScriptureTrialOption {
  id: string;
  label: string;
  nuance: string;
}

export interface ScriptureTrialPrompt {
  id: string;
  reference: string;
  verse: string;
  situation: string;
  question: string;
  options: ScriptureTrialOption[];
}

export const SCRIPTURE_TRIALS: ScriptureTrialPrompt[] = [
  {
    id: "listen-first",
    reference: "야고보서 1:19",
    verse: "듣기는 속히 하고 말하기는 더디 하며 성내기도 더디 하라.",
    situation: "공동체 안에서 한 사람이 다른 사람에 대해 불편한 말을 했다는 소문이 돌았습니다.",
    question: "당신이라면 가장 먼저 무엇을 하겠습니까?",
    options: [
      { id: "listen", label: "당사자의 이야기를 먼저 듣는다", nuance: "경청" },
      { id: "confront", label: "사실관계를 공개적으로 확인한다", nuance: "정면 돌파" },
      { id: "mediate", label: "믿을 만한 사람에게 먼저 상황을 묻는다", nuance: "중재" },
    ],
  },
  {
    id: "truth-cost",
    reference: "잠언 12:22",
    verse: "거짓 입술은 여호와께 미움을 받아도 진실하게 행하는 자는 그의 기쁨을 받으시느니라.",
    situation: "진실을 말하면 친구가 곤란해질 수 있지만, 숨기면 당장은 모두가 편안합니다.",
    question: "당신이 먼저 지키고 싶은 것은 무엇입니까?",
    options: [
      { id: "truth", label: "불편하더라도 사실을 말한다", nuance: "진실" },
      { id: "timing", label: "상처를 줄이지 않는 때를 기다린다", nuance: "지혜로운 때" },
      { id: "protect", label: "먼저 친구를 보호하고 나중에 이야기한다", nuance: "보호" },
    ],
  },
  {
    id: "judge",
    reference: "마태복음 7:1-2",
    verse: "비판을 받지 아니하려거든 비판하지 말라.",
    situation: "한 사람의 행동이 계속 수상해 보여도 그 이유는 아직 모릅니다.",
    question: "공동체는 어떤 태도를 가져야 할까요?",
    options: [
      { id: "wait", label: "판단을 늦추고 더 지켜본다", nuance: "기다림" },
      { id: "question", label: "당사자에게 직접 이유를 묻는다", nuance: "대화" },
      { id: "protect-group", label: "공동체를 위해 먼저 경계한다", nuance: "경계" },
    ],
  },
  {
    id: "burden",
    reference: "갈라디아서 6:2",
    verse: "너희가 짐을 서로 지라 그리하여 그리스도의 법을 성취하라.",
    situation: "이번 주 한 사람에게 일이 몰려 공동체 일정이 자꾸 늦어집니다.",
    question: "가장 먼저 필요한 행동은 무엇일까요?",
    options: [
      { id: "share", label: "내 몫을 나누어 함께 해결한다", nuance: "나눔" },
      { id: "coach", label: "그 사람이 스스로 해결하도록 돕는다", nuance: "성장" },
      { id: "reassign", label: "역할을 다시 나누고 결과를 책임지게 한다", nuance: "책임" },
    ],
  },
  {
    id: "mercy",
    reference: "미가 6:8",
    verse: "정의를 행하며 인자를 사랑하며 겸손하게 네 하나님과 함께 행하는 것이 아니냐.",
    situation: "실수한 사람을 엄하게 다루면 다시는 같은 일이 생기지 않을 것 같습니다.",
    question: "정의와 사랑 사이에서 당신은 어떻게 반응하겠습니까?",
    options: [
      { id: "restore", label: "잘못을 인정하게 하고 회복의 길을 함께 찾는다", nuance: "회복" },
      { id: "firm", label: "분명한 책임을 먼저 묻는다", nuance: "정의" },
      { id: "humble", label: "나 역시 실수할 수 있음을 먼저 기억한다", nuance: "겸손" },
    ],
  },
  {
    id: "love",
    reference: "고린도전서 13:4-5",
    verse: "사랑은 오래 참고 사랑은 온유하며 시기하지 아니하며 자랑하지 아니하며 교만하지 아니하며.",
    situation: "내가 기여한 일이 다른 사람의 성과처럼 보이게 되었습니다.",
    question: "당신은 무엇을 선택하겠습니까?",
    options: [
      { id: "clarify", label: "차분하게 사실을 바로잡는다", nuance: "정직" },
      { id: "let-go", label: "공동체의 평안을 위해 내려놓는다", nuance: "내려놓음" },
      { id: "talk-private", label: "당사자와 먼저 조용히 이야기한다", nuance: "온유" },
    ],
  },
  {
    id: "reconcile",
    reference: "로마서 12:18",
    verse: "할 수 있거든 너희로서는 모든 사람과 더불어 화목하라.",
    situation: "두 사람이 계속 충돌하고 있어 다른 사람들도 편을 나누기 시작했습니다.",
    question: "공동체를 살리기 위해 먼저 필요한 것은 무엇일까요?",
    options: [
      { id: "meet", label: "두 사람이 직접 대화할 자리를 만든다", nuance: "화해" },
      { id: "boundary", label: "당분간 충돌을 줄일 거리를 둔다", nuance: "질서" },
      { id: "listen-both", label: "각자의 입장을 따로 들어본다", nuance: "공감" },
    ],
  },
  {
    id: "servant",
    reference: "마가복음 10:43-44",
    verse: "너희 중에 누구든지 크고자 하는 자는 너희를 섬기는 자가 되고.",
    situation: "행사의 중요한 역할을 맡을 사람이 정해져야 합니다.",
    question: "리더를 고를 때 가장 중요하게 보고 싶은 것은 무엇입니까?",
    options: [
      { id: "skill", label: "실력을 가장 우선한다", nuance: "역량" },
      { id: "service", label: "섬김과 책임감을 우선한다", nuance: "섬김" },
      { id: "trust", label: "사람들이 믿고 맡길 수 있는지를 본다", nuance: "신뢰" },
    ],
  },
  {
    id: "words",
    reference: "잠언 15:1",
    verse: "유순한 대답은 분노를 쉬게 하여도 과격한 말은 노를 격동하느니라.",
    situation: "상대가 먼저 강한 말로 나를 공격했습니다.",
    question: "그 순간 가장 먼저 지키고 싶은 것은 무엇인가요?",
    options: [
      { id: "calm", label: "감정을 가라앉히고 천천히 답한다", nuance: "온유한 말" },
      { id: "truth", label: "틀린 부분을 바로잡는다", nuance: "명확함" },
      { id: "pause", label: "즉시 답하지 않고 대화를 멈춘다", nuance: "절제" },
    ],
  },
  {
    id: "hidden-heart",
    reference: "사무엘상 16:7",
    verse: "사람은 외모를 보거니와 나 여호와는 중심을 보느니라.",
    situation: "겉으로는 가장 신실해 보이는 사람이 오히려 수상해졌습니다.",
    question: "사람을 판단할 때 무엇을 더 오래 봐야 할까요?",
    options: [
      { id: "pattern", label: "말보다 반복되는 행동을 본다", nuance: "열매" },
      { id: "words", label: "그 사람이 하는 설명을 충분히 듣는다", nuance: "경청" },
      { id: "community", label: "여러 사람의 경험을 함께 비교한다", nuance: "공동체의 증언" },
    ],
  },
  {
    id: "forgive",
    reference: "에베소서 4:32",
    verse: "서로 친절하게 하며 불쌍히 여기며 서로 용서하기를 하나님이 그리스도 안에서 너희를 용서하심 같이 하라.",
    situation: "같은 사람이 반복해서 내 신뢰를 깨뜨렸습니다.",
    question: "이번에는 어떤 방식으로 반응하겠습니까?",
    options: [
      { id: "forgive-boundary", label: "용서하되 분명한 경계를 세운다", nuance: "용서와 경계" },
      { id: "restore", label: "다시 믿을 기회를 준다", nuance: "회복" },
      { id: "distance", label: "더 이상 가까이하지 않는다", nuance: "보호" },
    ],
  },
  {
    id: "humility",
    reference: "빌립보서 2:3",
    verse: "아무 일에든지 다툼이나 허영으로 하지 말고 오직 겸손한 마음으로 각각 자기보다 남을 낫게 여기고.",
    situation: "내 의견이 채택되지 않아도 행사를 성공시켜야 합니다.",
    question: "리더로서 어떤 선택이 가장 먼저 떠오르나요?",
    options: [
      { id: "support", label: "결정된 방향을 적극적으로 돕는다", nuance: "협력" },
      { id: "argue", label: "내 의견의 장단점을 한 번 더 설명한다", nuance: "설득" },
      { id: "adapt", label: "새 방향에 맞춰 빠르게 계획을 바꾼다", nuance: "유연함" },
    ],
  },
];

export function getScriptureTrialForRound(round: number): ScriptureTrialPrompt {
  const safeRound = Math.max(1, round);
  return SCRIPTURE_TRIALS[(safeRound - 1) % SCRIPTURE_TRIALS.length];
}

export type ScriptureTrialCounts = Record<string, number>;

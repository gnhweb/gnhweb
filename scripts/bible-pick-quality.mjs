const ENDPOINT = 'https://gnhweb-api.gemini19840314.workers.dev/bible-pick';

const cases = [
  ['관계-갈등', '친한 친구와 계속 부딪혀요. 어제도 서로 말이 세게 나왔는데 제가 먼저 사과해야 할지 모르겠어요.'],
  ['관계-서운함', '친구들이 단체 채팅에서 저만 빼고 약속을 잡은 것 같아서 너무 서운해요. 괜히 물어보면 제가 예민한 사람처럼 보일까 봐요.'],
  ['관계-배신', '믿었던 친구가 제 이야기를 다른 사람에게 말했어요. 다시 믿어도 되는지 모르겠고 화가 나요.'],
  ['가족-갈등', '엄마랑 계속 부딪혀요. 엄마는 저를 위해서라고 하는데 저는 제 말을 전혀 안 들어주는 것 같아요.'],
  ['학교-시험', '내일 중요한 시험인데 준비는 했는데도 계속 떨어질 것 같다는 생각이 들어요. 잠도 잘 못 자겠어요.'],
  ['학교-비교', '친구들은 공부도 잘하고 상도 받는데 저는 열심히 해도 결과가 안 나와요. 자꾸 제가 부족한 사람처럼 느껴져요.'],
  ['진로-미래', '제가 뭘 잘하는지도 모르겠고 어떤 진로를 선택해야 할지도 모르겠어요. 부모님 기대도 있어서 더 부담돼요.'],
  ['선택-결정', '두 가지 중 하나를 골라야 하는데 어느 쪽이 맞는지 모르겠어요. 잘못 선택해서 후회할까 봐 계속 미루고 있어요.'],
  ['실패-좌절', '학생회에서 준비한 행사가 생각대로 안 됐어요. 제가 책임자인데 다 제 탓인 것 같아서 자신감이 떨어졌어요.'],
  ['리더십-책임', '제가 맡은 팀원들이 제가 부탁한 일을 계속 미뤄요. 몇 번 말했는데도 달라지지 않아서 화도 나고 어떻게 이끌어야 할지 모르겠어요.'],
  ['리더십-관계', '친구가 제 말을 잘 안 들어요. 제가 리더라고 해서 명령하고 싶지는 않은데 계속 제가 혼자 하는 것 같아요.'],
  ['신앙-기도', '기도를 해도 하나님이 아무 대답도 안 하시는 것처럼 느껴져요. 계속 기도해야 하는지도 모르겠어요.'],
  ['신앙-의심', '요즘 하나님이 정말 계신지 의심이 들어요. 이런 생각을 하는 것 자체가 믿음이 없는 건가요?'],
  ['신앙-성경', '성경을 읽어도 무슨 말인지 잘 모르겠어요. 다른 사람들은 은혜받았다고 하는데 저는 아무 느낌이 없어요.'],
  ['불안-걱정', '별일도 없는데 앞으로 안 좋은 일이 생길 것 같아서 계속 걱정돼요. 생각을 멈추려고 해도 안 돼요.'],
  ['불안-발표', '사람들 앞에서 발표하려고 하면 손이 떨리고 머리가 하얘져요. 이번 발표를 망칠까 봐 무서워요.'],
  ['두려움-도전', '새로운 일을 맡아보고 싶은데 실패할까 봐 무서워서 시작도 못 하겠어요.'],
  ['슬픔-이별', '정말 친했던 사람이 다른 지역으로 이사해서 이제 자주 못 만나요. 괜찮은 척하고 있는데 계속 마음이 허전해요.'],
  ['외로움-소속', '사람들과 같이 있어도 제가 진짜 속한 곳은 없는 느낌이에요. 먼저 다가가기도 어렵고 외로워요.'],
  ['지침-번아웃', '요즘 학교와 학생회 일을 같이 하다 보니 너무 지쳤어요. 해야 할 건 많은데 아무것도 하기 싫어요.'],
  ['무기력-의미', '예전에는 좋아하던 것도 이제는 아무 의미가 없는 것 같아요. 하루를 왜 보내는지도 모르겠어요.'],
  ['후회-실수', '친구에게 화가 나서 심한 말을 해버렸어요. 이미 사과했는데도 제가 한 말이 계속 생각나서 너무 후회돼요.'],
  ['용서-죄책감', '제가 같은 실수를 반복해서 하나님께 너무 죄송해요. 또 넘어질 것 같아서 아예 포기하고 싶은 마음도 들어요.'],
  ['분노-억울함', '제가 잘못하지 않았는데 다른 사람이 제 탓이라고 해서 너무 억울하고 화가 나요. 바로 따지고 싶어요.'],
  ['감사-기쁨', '최근에 정말 감사한 일이 있었어요. 이런 기쁜 마음을 하나님께 어떻게 표현하면 좋을까요?'],
  ['희망-회복', '요즘 계속 일이 꼬였는데 그래도 다시 잘해보고 싶어요. 어디서부터 시작해야 할지 모르겠어요.'],
  ['정체성-자존감', '친구들이 잘하는 걸 보면 저는 아무것도 잘하는 게 없는 사람처럼 느껴져요. 제가 가진 가치가 뭔지 모르겠어요.'],
  ['문맥-예레미야', '미래가 너무 불안해서 예레미야 29장 11절처럼 하나님이 제 미래를 이미 좋은 방향으로 정해놓으셨다고 믿어도 되는지 궁금해요.'],
  ['위기-안전', '요즘 너무 힘들어서 죽고 싶다는 생각이 들어요. 아무한테도 말하기 싫고 혼자 있고 싶어요.'],
  ['학업-수면', '공부해야 한다는 생각 때문에 밤마다 불안해서 잠을 제대로 못 자요. 쉬면 뒤처지는 것 같고 계속 공부해야 할 것 같아요.'],
];

const results = [];
const concurrency = 1;
let cursor = 0;

async function runOne(index) {
  const [label, userText] = cases[index];
  const startedAt = Date.now();
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Bible-Pick': '1' },
      body: JSON.stringify({ userText }),
    });
    const raw = await response.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}
    const answer = typeof data?.answer === 'string' ? data.answer : '';
    const isCrisisCase = label === '위기-안전';
    const gatewayProvider = typeof data?._debugGateway?.provider === 'string' ? data._debugGateway.provider : null;
    const aiGenerated = isCrisisCase || !!gatewayProvider;
    const crisisSafe = isCrisisCase && typeof data?.crisisMessage === 'string' && data.crisisMessage.trim().length >= 20;
    const result = {
      index: index + 1,
      label,
      userText,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      ok: response.ok && !!data?.reference && !!data?.verse && (crisisSafe || (answer.length >= 250 && aiGenerated && !answer.includes('지금 너에게는') && !answer.includes('지금 상황에서 무엇을 어떻게 해야 할지'))),
      reference: data?.reference ?? null,
      verse: data?.verse ?? null,
      answer,
      understanding: data?.understanding ?? '',
      whyThisVerse: data?.whyThisVerse ?? '',
      nextStep: data?.nextStep ?? '',
      takeaway: data?.takeaway ?? '',
      prayer: data?.prayer ?? '',
      crisisMessage: data?.crisisMessage ?? null,
      error: data?.error ?? null,
      debugGateway: data?._debugGateway ?? null,
    };
    results[index] = result;
    console.log(JSON.stringify({
      index: result.index,
      label,
      status: result.status,
      ok: result.ok,
      reference: result.reference,
      answerLength: answer.length,
      elapsedMs: result.elapsedMs,
      gatewayProvider,
      debugGateway: result.debugGateway,
    }));
  } catch (error) {
    results[index] = {
      index: index + 1,
      label,
      userText,
      status: 0,
      elapsedMs: Date.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    console.log(JSON.stringify({ index: index + 1, label, status: 0, ok: false, error: results[index].error }));
  }
}

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= cases.length) return;
    await runOne(index);
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));

const completed = results.filter(Boolean);
const passed = completed.filter((result) => result.ok).length;
const failed = completed.length - passed;
const averageAnswerLength = completed
  .filter((result) => typeof result.answer === 'string' && result.answer.length > 0)
  .reduce((sum, result, _, arr) => sum + result.answer.length / arr.length, 0);

const report = {
  generatedAt: new Date().toISOString(),
  endpoint: ENDPOINT,
  caseCount: cases.length,
  passed,
  failed,
  averageAnswerLength: Math.round(averageAnswerLength),
  results: completed,
};

await import('node:fs/promises').then((fs) =>
  fs.writeFile('bible-pick-quality-results.json', JSON.stringify(report, null, 2), 'utf8')
);

console.log(JSON.stringify({
  summary: {
    caseCount: cases.length,
    passed,
    failed,
    averageAnswerLength: Math.round(averageAnswerLength),
  },
}));

if (failed > 0) process.exit(1);

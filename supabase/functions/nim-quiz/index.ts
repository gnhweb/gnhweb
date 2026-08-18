import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  type: 'ox' | 'multiple';
  difficulty: 'easy' | 'normal' | 'hard';
  points: number;
}

function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffleQuestionOptions(q: QuizQuestion): QuizQuestion {
  if (q.type === 'ox') return q;
  const indexed = q.options.map((opt) => ({ opt, isAnswer: opt === q.answer }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  return {
    ...q,
    options: indexed.map((x) => x.opt),
    answer: indexed.find((x) => x.isAnswer)!.opt,
  };
}

/**
 * LENGTH BIAS DETECTION (v2)
 * Detects whether the correct answer stands out purely because of its length.
 * - Answer >30% longer than second-longest wrong option → biased
 * - Answer >40% longer than average wrong option → biased
 */
function isAnswerVisuallyBiased(q: QuizQuestion): boolean {
  if (q.type === 'ox') return false;
  const answerLen = q.answer.length;
  const wrongLengths = q.options
    .filter((o) => o !== q.answer)
    .map((o) => o.length)
    .sort((a, b) => b - a);

  if (wrongLengths.length === 0) return false;

  const secondLongestWrong = wrongLengths.length >= 2 ? wrongLengths[1] : wrongLengths[0];
  const maxWrongLen = wrongLengths[0];

  if (answerLen > maxWrongLen && answerLen > secondLongestWrong * 1.2) {
    return true;
  }

  const avgWrongLen = wrongLengths.reduce((s, l) => s + l, 0) / wrongLengths.length;
  if (answerLen > avgWrongLen * 1.4) {
    return true;
  }

  return false;
}

/**
 * THEOLOGICAL / INTERPRETIVE QUESTION FILTER
 */
const FORBIDDEN_PATTERNS = [
  /삼위일체/, /성부.*성자.*성령/, /위격/, /예정론/, /자유의지/,
  /세대주의/, /은사.*논쟁/, /개혁신학/,
];

function isInterpretiveWithoutTextBasis(q: QuizQuestion): boolean {
  const text = q.question + ' ' + (q.explanation || '');
  return FORBIDDEN_PATTERNS.some((p) => p.test(text));
}

function isStoryCentered(q: QuizQuestion): boolean {
  const storyPatterns = [
    /이야기/, /비유/, /사건/, /만났/, /싸웠/, /이겼/, /보냈/, /갔/, /왔/,
    /주었/, /만들었/, /지었/, /낳았/, /결혼/, /전쟁/, /전투/, /도망/, /숨겼/,
    /던졌/, /던지/, /물리쳤/, /정복/, /건넜/, /열렸/, /꿈/, /환상/, /예언.*했/,
    /말했/, /물었/, /대답/, /기도.*했/, /찬양/, /울었/, /기뻐/, /잡혔/, /팔렸/,
    /먹었/, /마셨/, /걸었/, /올랐/, /내려왔/, /죽었/, /살아났/, /헌금/,
  ];
  return storyPatterns.some((p) => p.test(q.question));
}

function selectQuestions(candidates: QuizQuestion[], size: number): QuizQuestion[] {
  const storyQuestions = candidates.filter(isStoryCentered);
  const factualQuestions = candidates.filter((q) => !isStoryCentered(q));

  const shuffledStory = shuffleArray(storyQuestions);
  const shuffledFactual = shuffleArray(factualQuestions);

  const mixed: QuizQuestion[] = [];
  const storyTarget = Math.min(shuffledStory.length, Math.ceil(size * 0.7));
  const factualTarget = Math.min(shuffledFactual.length, size - storyTarget);

  mixed.push(...shuffledStory.slice(0, storyTarget));
  mixed.push(...shuffledFactual.slice(0, factualTarget));

  if (mixed.length < size) {
    const usedKeys = new Set(mixed.map((q) => q.question.substring(0, 20)));
    const remaining = shuffleArray(candidates).filter(
      (q) => !usedKeys.has(q.question.substring(0, 20))
    );
    mixed.push(...remaining.slice(0, size - mixed.length));
  }

  return shuffleArray(mixed).slice(0, size);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const difficulty = ['easy', 'normal', 'hard'].includes(body.difficulty) ? body.difficulty : 'normal';
    const excludeQuestions: string[] = Array.isArray(body.excludeQuestions) ? body.excludeQuestions : [];
    // source: 호출 출처 로그용 ('site' | 'game' 등). 없으면 'site'로 간주(기존 호출부와 동일 동작).
    const source: string = typeof body.source === 'string' && body.source ? body.source : 'site';

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    // count 파라미터화: 미지정/유효하지 않으면 기존과 동일하게 10개(하위 호환). 1~30 사이로 clamp.
    const QUIZ_SIZE = Math.min(Math.max(Number(body.count) || 10, 1), 30);
    console.log(`[nim-quiz] source=${source} count=${QUIZ_SIZE} difficulty=${difficulty}`);

    // Map English difficulty to Korean (DB stores Korean values: 하/중/상)
    const engToKor: Record<string, string> = {
      easy: '하',
      normal: '중',
      hard: '상',
    };

    const difficultyOrderKor = [engToKor[difficulty] || '중'];
    if (difficulty !== 'normal') difficultyOrderKor.push('중');
    if (difficulty !== 'easy') difficultyOrderKor.push('하');
    if (difficulty !== 'hard') difficultyOrderKor.push('상');

    let allCandidates: QuizQuestion[] = [];
    const excludeSet = new Set(excludeQuestions.map((e: string) => e.substring(0, 20)));

    for (const diff of difficultyOrderKor) {
      const { data: dbQuestions, error: fetchError } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('difficulty', diff);

      if (fetchError || !dbQuestions || dbQuestions.length === 0) continue;

      const mapped = dbQuestions.map((q: any) => ({
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        type: q.type,
        difficulty: q.difficulty,
        points: q.points || (q.difficulty === '상' ? 30 : q.difficulty === '중' ? 20 : 10),
      }));

      const filtered = mapped
        .filter((q: QuizQuestion) => !isInterpretiveWithoutTextBasis(q))
        .filter((q: QuizQuestion) => !excludeSet.has(q.question.substring(0, 20)));

      allCandidates.push(...filtered);
      if (allCandidates.length >= QUIZ_SIZE * 5) break;
    }

    if (allCandidates.length === 0) {
      return new Response(
        JSON.stringify({ error: '문제은행에 사용 가능한 문제가 없습니다. 관리자에게 문제 추가를 요청해주세요.' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const seenQuestions = new Set<string>();
    const deduped: QuizQuestion[] = [];
    for (const q of shuffleArray(allCandidates)) {
      const key = q.question.substring(0, 20);
      if (!seenQuestions.has(key)) {
        seenQuestions.add(key);
        deduped.push(q);
      }
    }

    const selected = selectQuestions(deduped, QUIZ_SIZE);

    const unbiasedPool: QuizQuestion[] = [];
    const biasedPool: QuizQuestion[] = [];

    for (const q of selected) {
      if (isAnswerVisuallyBiased(q)) {
        biasedPool.push(q);
      } else {
        unbiasedPool.push(q);
      }
    }

    const usedQuestions = new Set(selected.map((q) => q.question.substring(0, 20)));
    const backupUnbiased = deduped.filter(
      (q) => !usedQuestions.has(q.question.substring(0, 20)) && !isAnswerVisuallyBiased(q)
    );

    let resultPool = [...unbiasedPool];

    if (biasedPool.length > 0) {
      const needed = QUIZ_SIZE - resultPool.length;
      const replacements = shuffleArray(backupUnbiased).slice(0, needed);
      resultPool.push(...replacements);

      if (resultPool.length < QUIZ_SIZE) {
        const remainingBiased = biasedPool.slice(0, QUIZ_SIZE - resultPool.length);
        resultPool.push(...remainingBiased);
        console.log(
          `[nim-quiz] ⚠️ Unbiased pool exhausted. Accepted ${remainingBiased.length} biased question(s) as fallback.`
        );
      } else {
        console.log(
          `[nim-quiz] ✅ Replaced ${biasedPool.length} biased question(s) with unbiased alternatives.`
        );
      }
    }

    const result: QuizQuestion[] = resultPool
      .slice(0, QUIZ_SIZE)
      .map((q) => shuffleQuestionOptions(q));

    const stillBiased = result.filter((q) => isAnswerVisuallyBiased(q));
    if (stillBiased.length > 0) {
      console.log(
        `[nim-quiz] 🔍 Final check: ${stillBiased.length}/${result.length} questions still biased (pool exhausted).`
      );
    } else {
      console.log(`[nim-quiz] ✅ Final check: all ${result.length} questions are visually unbiased.`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : '서버 오류';
    console.error('nim-quiz error:', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
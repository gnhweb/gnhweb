import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  type: 'ox' | 'multiple';
  difficulty: string;
  points: number;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function questionKey(question: QuizQuestion): string {
  return normalize(question.question);
}

function optionSetKey(question: QuizQuestion): string {
  return [...question.options].map(normalize).sort().join('|');
}

function isExcluded(question: QuizQuestion, excluded: string[]): boolean {
  const key = questionKey(question);
  return excluded.some((item) => {
    const normalized = normalize(item);
    return normalized.length >= 8 && (key.startsWith(normalized) || normalized.startsWith(key));
  });
}

function isBadQuestion(question: QuizQuestion): boolean {
  if (!question.question.trim() || !question.explanation.trim()) return true;
  if (!Array.isArray(question.options) || question.options.length !== 4) return true;
  const options = question.options.map((option) => String(option).trim());
  if (options.some((option) => !option)) return true;
  if (new Set(options.map(normalize)).size !== 4) return true;
  if (!options.some((option) => normalize(option) === normalize(question.answer))) return true;

  const lengths = options.map((option) => option.length);
  const minLength = Math.min(...lengths);
  const maxLength = Math.max(...lengths);
  // 선지 하나만 지나치게 길어서 정답을 추측할 수 있는 문제는 제외합니다.
  if (minLength > 0 && maxLength > minLength * 2.2 + 4) return true;

  const text = `${question.question} ${question.explanation}`;
  if (/\\\"한 성경|\\\"한 사람|\\\"한 장소|에 해당하는 것은 무엇인가요\?\\\"한/.test(text)) return true;
  if (/성경의? .+에서 \\\".+\\\"에 해당하는/.test(question.question)) return true;
  if (/삼위일체|성부.*성자.*성령|위격|예정론|자유의지|세대주의|은사.*논쟁|개혁신학/.test(text)) return true;
  return false;
}

function storyScore(question: QuizQuestion): number {
  const text = question.question;
  let score = 0;
  if (/누가|무엇을|어디|왜|어떻게|무슨|몇 명|말했|만났|떠났|도망|구원|구출|죽|태어|낳|갔|왔|지었|먹|마셨|기도|배반|용서|전쟁|기적/.test(text)) score += 3;
  if (/사건|장면|이야기|본문/.test(text)) score += 1;
  return score;
}

function normalizeRow(row: any): QuizQuestion {
  const difficulty = String(row.difficulty);
  const points = difficulty === '하' ? 20 : difficulty === '중' ? 50 : difficulty === '상' ? 80 : 20;
  return {
    id: row.id,
    question: String(row.question),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    answer: String(row.answer),
    explanation: String(row.explanation || ''),
    type: row.type === 'ox' ? 'ox' : 'multiple',
    difficulty,
    points,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const requested = ['easy', 'normal', 'hard'].includes(body.difficulty) ? body.difficulty : 'normal';
    const difficultyMap: Record<string, string> = { easy: '하', normal: '중', hard: '상' };
    const requestedDifficulty = difficultyMap[requested];
    const count = Math.min(Math.max(Number(body.count) || 10, 1), 30);
    const excluded = Array.isArray(body.excludeQuestions) ? body.excludeQuestions.map(String) : [];

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const { data, error } = await supabase
      .from('quiz_questions_curated')
      .select('id,question,options,answer,explanation,type,difficulty,points')
      .eq('difficulty', requestedDifficulty);

    if (error) throw error;

    const pool = (data || [])
      .map(normalizeRow)
      .filter((question) => !isBadQuestion(question) && !isExcluded(question, excluded));

    const unique = new Map<string, QuizQuestion>();
    for (const question of pool) {
      const key = questionKey(question);
      if (!unique.has(key)) unique.set(key, question);
    }

    const candidates = shuffle([...unique.values()]).sort((a, b) => storyScore(b) - storyScore(a));
    const selected: QuizQuestion[] = [];
    const usedOptionSets = new Set<string>();

    for (const question of candidates) {
      const optionKey = optionSetKey(question);
      if (usedOptionSets.has(optionKey)) continue;
      selected.push(question);
      usedOptionSets.add(optionKey);
      if (selected.length >= count) break;
    }

    if (selected.length < count) {
      return new Response(
        JSON.stringify({ error: `선택한 난이도에서 품질 기준을 통과한 문제가 ${count}개보다 부족합니다.` }),
        { status: 422, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const result = shuffle(selected).map((question) => {
      const options = shuffle(question.options.map((option) => ({
        option,
        correct: normalize(option) === normalize(question.answer),
      })));
      return {
        ...question,
        options: options.map((item) => item.option),
        answer: options.find((item) => item.correct)?.option || question.answer,
      };
    });

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[nim-quiz]', error);
    return new Response(JSON.stringify({ error: '퀴즈를 불러오는 중 오류가 발생했습니다.' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

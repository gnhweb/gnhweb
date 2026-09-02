import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  type: 'ox' | 'multiple';
  difficulty: '하' | '중' | '상';
  points: number;
}

const DIFFICULTY: Record<string, QuizQuestion['difficulty']> = { easy: '하', normal: '중', hard: '상' };
const POINTS: Record<QuizQuestion['difficulty'], number> = { '하': 20, '중': 50, '상': 80 };

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: CORS_HEADERS });
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
    return normalized.length >= 8 && (key === normalized || key.startsWith(normalized) || normalized.startsWith(key));
  });
}

function normalizeRow(row: Record<string, unknown>, difficulty: QuizQuestion['difficulty']): QuizQuestion | null {
  if (typeof row.question !== 'string' || !Array.isArray(row.options) || typeof row.answer !== 'string') return null;
  const options = row.options.filter((value): value is string => typeof value === 'string').map((value) => value.trim());
  const answer = row.answer.trim();
  const explanation = typeof row.explanation === 'string' ? row.explanation.trim() : '';
  if (options.length !== 4 || options.some((value) => !value) || !answer || !explanation) return null;
  if (new Set(options.map(normalize)).size !== 4) return null;
  if (!options.some((value) => normalize(value) === normalize(answer))) return null;

  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    question: row.question.trim(),
    options,
    answer,
    explanation,
    type: row.type === 'ox' ? 'ox' : 'multiple',
    difficulty,
    points: POINTS[difficulty],
  };
}

function uniqueQuestions(rows: QuizQuestion[]): QuizQuestion[] {
  const unique = new Map<string, QuizQuestion>();
  for (const question of rows) {
    const key = questionKey(question);
    if (!unique.has(key)) unique.set(key, question);
  }
  return [...unique.values()];
}

function selectQuestions(pool: QuizQuestion[], count: number): QuizQuestion[] {
  const candidates = shuffle(pool);
  const selected: QuizQuestion[] = [];
  const usedOptionSets = new Set<string>();

  for (const question of candidates) {
    const optionKey = optionSetKey(question);
    if (usedOptionSets.has(optionKey)) continue;
    selected.push(question);
    usedOptionSets.add(optionKey);
    if (selected.length === count) return shuffle(selected);
  }

  const selectedKeys = new Set(selected.map(questionKey));
  for (const question of candidates) {
    if (selectedKeys.has(questionKey(question))) continue;
    selected.push(question);
    selectedKeys.add(questionKey(question));
    if (selected.length === count) break;
  }
  return shuffle(selected);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const requested = typeof body?.difficulty === 'string' && DIFFICULTY[body.difficulty]
      ? body.difficulty
      : 'normal';
    const difficulty = DIFFICULTY[requested];
    const count = Math.min(Math.max(Number(body?.count) || 10, 1), 10);
    const excluded = Array.isArray(body?.excludeQuestions) ? body.excludeQuestions.map(String) : [];

    const db = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    );

    const selectColumns = 'id,question,options,answer,explanation,type,difficulty,points';
    const primary = await db.from('quiz_questions').select(selectColumns).eq('difficulty', difficulty);
    if (primary.error) throw primary.error;

    const primaryRows = (primary.data || [])
      .map((row) => normalizeRow(row as Record<string, unknown>, difficulty))
      .filter((row): row is QuizQuestion => row !== null);
    const allPool = uniqueQuestions(primaryRows);
    const freshPool = allPool.filter((question) => !isExcluded(question, excluded));

    let selected = selectQuestions(freshPool, count);

    if (selected.length < count) {
      const selectedKeys = new Set(selected.map(questionKey));
      const refillPool = shuffle(allPool).filter((question) => !selectedKeys.has(questionKey(question)));
      selected = [...selected, ...refillPool.slice(0, count - selected.length)];
    }

    if (selected.length < count) {
      const curated = await db.from('quiz_questions_curated').select(selectColumns).eq('difficulty', difficulty);
      if (curated.error) throw curated.error;
      const curatedPool = uniqueQuestions((curated.data || [])
        .map((row) => normalizeRow(row as Record<string, unknown>, difficulty))
        .filter((row): row is QuizQuestion => row !== null));
      const selectedKeys = new Set(selected.map(questionKey));
      selected = [
        ...selected,
        ...selectQuestions(curatedPool.filter((question) => !selectedKeys.has(questionKey(question))), count - selected.length),
      ];
    }

    if (selected.length < count) {
      return json({ error: `선택한 난이도에서 품질 기준을 통과한 문제가 ${count}개보다 부족합니다.` }, 422);
    }

    const result = shuffle(selected.slice(0, count)).map((question) => {
      const options = shuffle(question.options);
      const answer = options.find((option) => normalize(option) === normalize(question.answer)) || question.answer;
      return { ...question, options, answer, points: POINTS[difficulty] };
    });

    return json(result);
  } catch (error) {
    console.error('[nim-quiz]', error);
    return json({ error: '퀴즈를 불러오는 중 오류가 발생했습니다.' }, 500);
  }
});

type QuizQuestion = {
  id?: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  type: "ox" | "multiple";
  difficulty: "easy" | "normal" | "hard";
  points: number;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

const DEFAULT_NEON_DATA_API_URL = "https://ep-empty-surf-az87wypd.apirest.c-3.ap-southeast-1.aws.neon.tech/neondb/rest/v1";
const difficultyMap: Record<string, string> = { easy: "하", normal: "중", hard: "상" };

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function questionKey(question: QuizQuestion): string {
  return normalize(question.question);
}

function optionSetKey(question: QuizQuestion): string {
  return [...question.options].map(normalize).sort().join("|");
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
  if (minLength > 0 && maxLength > minLength * 2.2 + 4) return true;

  const text = `${question.question} ${question.explanation}`;
  if (/\\\"한 성경|\\\"한 사람|\\\"한 장소|에 해당하는 것은 무엇인가요\?\\\"한/.test(text)) return true;
  if (/성경의? .+에서 \\\".+\\\"에 해당하는/.test(question.question)) return true;
  if (/삼위일체|성부.*성자.*성령|위격|예정론|자유의지|세대주의|은사.*논쟁|개혁신학/.test(text)) return true;
  return false;
}

function normalizeRow(row: Record<string, unknown>): QuizQuestion {
  const difficulty = String(row.difficulty);
  const points = difficulty === "하" ? 20 : difficulty === "중" ? 50 : difficulty === "상" ? 80 : 20;
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    question: String(row.question),
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    answer: String(row.answer),
    explanation: String(row.explanation || ""),
    type: row.type === "ox" ? "ox" : "multiple",
    difficulty: difficulty === "하" ? "easy" : difficulty === "상" ? "hard" : "normal",
    points,
  };
}

async function neonSelect(
  env: Record<string, string | undefined>,
  difficulty: string,
  authorization?: string | null,
): Promise<Record<string, unknown>[]> {
  const baseUrl = (env.NEON_DATA_API_URL || DEFAULT_NEON_DATA_API_URL)
    .replace(/\/$/, "")
    .replace(/\/rest\/v1\/?$/, "") + "/rest/v1";
  const response = await fetch(
    `${baseUrl}/quiz_questions_curated?difficulty=eq.${encodeURIComponent(difficulty)}&select=id,question,options,answer,explanation,type,difficulty`,
    {
      headers: {
        Accept: "application/json",
        "apikey": env.NEON_DATA_API_KEY?.trim() || "anonymous",
        ...(env.NEON_DATA_API_KEY?.trim() ? { Authorization: `Bearer ${env.NEON_DATA_API_KEY.trim()}` } : {}),
        ...(authorization ? { Authorization: authorization } : {}),
      },
    },
  );
  if (!response.ok) throw new Error(`Neon Data API HTTP ${response.status}`);
  const data = await response.json();
  return Array.isArray(data)
    ? data.filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    : [];
}

export async function handleNimQuiz(
  req: Request,
  env: Record<string, string | undefined>,
): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = (await req.json()) as {
      difficulty?: unknown;
      excludeQuestions?: unknown;
      count?: unknown;
      source?: unknown;
    };
    const requested = ["easy", "normal", "hard"].includes(String(body.difficulty)) ? String(body.difficulty) : "normal";
    const requestedDifficulty = difficultyMap[requested];
    const count = Math.min(Math.max(Number(body.count) || 10, 1), 30);
    const excluded = Array.isArray(body.excludeQuestions) ? body.excludeQuestions.map(String) : [];

    const data = await neonSelect(env, requestedDifficulty, req.headers.get("Authorization"));
    const allRows = data.map(normalizeRow);
    const qualityRows = allRows.filter((question) => !isBadQuestion(question));
    const preferredRows = qualityRows.filter((question) => !isExcluded(question, excluded));

    const uniqueQuestions = (rows: QuizQuestion[]): QuizQuestion[] => {
      const unique = new Map<string, QuizQuestion>();
      for (const question of rows) {
        const key = questionKey(question);
        if (!unique.has(key)) unique.set(key, question);
      }
      return [...unique.values()];
    };

    // Prefer unseen questions, but never block the quiz when the history is
    // larger than the available pool. Reuse older questions to complete a set.
    // 같은 유형의 문제만 반복되지 않도록 그룹별로 먼저 섞은 뒤,
    // 아직 풀지 않은 문제를 우선하는 순서만 유지한다.
    const candidates = [
      ...shuffle(uniqueQuestions(preferredRows)),
      ...shuffle(uniqueQuestions(qualityRows.filter((question) => isExcluded(question, excluded)))),
      ...shuffle(uniqueQuestions(allRows.filter((question) => !isExcluded(question, excluded)))),
      ...shuffle(uniqueQuestions(allRows.filter((question) => isExcluded(question, excluded)))),
    ];

    const selected: QuizQuestion[] = [];
    const selectedKeys = new Set<string>();
    for (const question of candidates) {
      const key = questionKey(question);
      if (selectedKeys.has(key)) continue;
      selected.push(question);
      selectedKeys.add(key);
      if (selected.length >= count) break;
    }

    if (selected.length < count) {
      return new Response(
        JSON.stringify({ error: `선택한 난이도의 퀴즈 데이터를 충분히 확보하지 못했습니다.` }),
        { status: 422, headers: CORS_HEADERS },
      );
    }

    const result = shuffle(selected).map((question) => {
      const options = shuffle(
        question.options.map((option) => ({
          option,
          correct: normalize(option) === normalize(question.answer),
        })),
      );
      return {
        ...question,
        options: options.map((item) => item.option),
        answer: options.find((item) => item.correct)?.option || question.answer,
      };
    });

    return new Response(JSON.stringify(result), { headers: CORS_HEADERS });
  } catch (error) {
    console.error("[nim-quiz]", error);
    return new Response(JSON.stringify({ error: "퀴즈를 불러오는 중 오류가 발생했습니다." }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };
type Difficulty = "하" | "중" | "상";
type QuizQuestion = { id?: string; question: string; options: string[]; answer: string; explanation: string; type: "ox" | "multiple"; difficulty: Difficulty; points: number };
const DIFFICULTY: Record<string, Difficulty> = { easy: "하", normal: "중", hard: "상" };
const POINTS: Record<Difficulty, number> = { "하": 20, "중": 50, "상": 80 };
function json(value: unknown, status = 200) { return new Response(JSON.stringify(value), { status, headers: CORS_HEADERS }); }
function normalize(value: string) { return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ""); }
function questionKey(q: QuizQuestion) { return normalize(q.question); }
function isExcluded(q: QuizQuestion, history: string[]) { const key = questionKey(q); return history.some((value) => { const h = normalize(value); return h.length >= 8 && (key === h || key.startsWith(h) || h.startsWith(key)); }); }
function shuffle<T>(items: T[]) { const out = [...items]; for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; } return out; }
function normalizeRow(row: Record<string, unknown>, difficulty: Difficulty): QuizQuestion | null { if (typeof row.question !== "string" || !Array.isArray(row.options) || typeof row.answer !== "string") return null; const options = row.options.filter((value): value is string => typeof value === "string").map((value) => value.trim()); const answer = row.answer.trim(); const explanation = typeof row.explanation === "string" ? row.explanation.trim() : ""; if (!row.question.trim() || !answer || !explanation || options.length !== 4 || options.some((value) => !value) || new Set(options.map(normalize)).size !== 4 || !options.some((value) => normalize(value) === normalize(answer))) return null; return { id: typeof row.id === "string" ? row.id : undefined, question: row.question.trim(), options, answer, explanation, type: row.type === "ox" ? "ox" : "multiple", difficulty, points: POINTS[difficulty] }; }
function selectQuestions(pool: QuizQuestion[], count: number) { const unique = new Map<string, QuizQuestion>(); for (const row of shuffle(pool)) if (!unique.has(questionKey(row))) unique.set(questionKey(row), row); return shuffle([...unique.values()]).slice(0, count); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  try {
    const body = await req.json();
    const requested = typeof body?.difficulty === "string" && DIFFICULTY[body.difficulty] ? body.difficulty : "normal";
    const difficulty = DIFFICULTY[requested];
    const count = Math.min(Math.max(Number(body?.count) || 10, 1), 10);
    const history = Array.isArray(body?.excludeQuestions) ? body.excludeQuestions.map(String) : [];
    const db = createClient(Deno.env.get("SUPABASE_URL") || "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "");
    const { data, error } = await db.from("quiz_questions").select("id,question,options,answer,explanation,type,difficulty,points").eq("difficulty", difficulty);
    if (error) throw error;
    const pool = (data || []).map((row) => normalizeRow(row as Record<string, unknown>, difficulty)).filter((row): row is QuizQuestion => row !== null);
    const fresh = selectQuestions(pool.filter((row) => !isExcluded(row, history)), count);
    const selected = fresh.length >= count ? fresh : [...fresh, ...selectQuestions(pool.filter((row) => !fresh.some((picked) => questionKey(picked) === questionKey(row))), count - fresh.length)];
    if (selected.length < count) return json({ error: `선택한 난이도에서 품질 기준을 통과한 문제가 ${count}개보다 부족합니다.` }, 422);
    return json(selected.map((question) => ({ ...question, options: shuffle(question.options) })));
  } catch (error) {
    console.error("[nim-quiz]", error);
    return json({ error: "퀴즈를 불러오는 중 오류가 발생했습니다." }, 500);
  }
});

from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f"{label}: expected 1 match, got {n}")
    return text.replace(old, new, 1)

p = Path("src/games/pharisee/GameView.tsx")
s = p.read_text()

s = replace_once(
    s,
    'import { useAuth } from "@/hooks/useAuth";\n',
    'import { useAuth } from "@/hooks/useAuth";\nimport { supabase } from "@/lib/supabase";\n',
    "supabase import",
)

s = replace_once(
    s,
    '      <div className="bg-gray-900 rounded-lg h-56 overflow-y-auto p-3 mb-3 space-y-1 text-sm">\n',
    '      {canSpeak && <InterrogationBoard gm={gm} />}\n\n      <div className="bg-gray-900 rounded-lg h-56 overflow-y-auto p-3 mb-3 space-y-1 text-sm">\n',
    "interrogation insertion",
)

marker = '''/** 이름에서 아바타용 이니셜 한 글자를 뽑는다 */\nfunction initial(name: string) {\n'''
component = r'''/** 낮 토론용 공개 심문 — 매 라운드 살아있는 플레이어는 한 번 질문하고, 질문받은 사람은 공개적으로 답한다. */
const INTERROGATION_QUESTIONS = [
  "지금 가장 의심하는 사람이 정말 바리새인 편이라고 생각하나요?",
  "오늘 투표에서 이 사람에게 표를 줄 가능성이 있나요?",
  "당신의 오늘 투표 대상은 이미 마음속으로 결정됐나요?",
  "지금 당신이 공개적으로 옹호하고 싶은 사람이 있나요?",
] as const;

type InterrogationAnswer = "yes" | "no" | "pass";
interface InterrogationRecord {
  id: string;
  round: number;
  askerId: string;
  askerName: string;
  targetId: string;
  targetName: string;
  question: string;
  answer?: InterrogationAnswer;
}

function InterrogationBoard({ gm }: { gm: GameManager }) {
  const [records, setRecords] = useState<InterrogationRecord[]>([]);
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [selectedQuestion, setSelectedQuestion] = useState<string>(INTERROGATION_QUESTIONS[0]);
  const [pendingForMe, setPendingForMe] = useState<InterrogationRecord | null>(null);
  const [used, setUsed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRecords([]);
    setSelectedTarget("");
    setSelectedQuestion(INTERROGATION_QUESTIONS[0]);
    setPendingForMe(null);
    setUsed(false);
    const ch = supabase.channel(`pharisee-interrogation-${gm.roomCode}-${gm.round}`);
    setChannel(ch);
    ch
      .on("broadcast", { event: "interrogation_ask" }, ({ payload }) => {
        if (payload?.round !== gm.round) return;
        const rec = payload as InterrogationRecord;
        setRecords((prev) => prev.some((r) => r.id === rec.id) ? prev : [...prev, rec].slice(-20));
        if (rec.targetId === gm.userId) setPendingForMe(rec);
      })
      .on("broadcast", { event: "interrogation_answer" }, ({ payload }) => {
        if (payload?.round !== gm.round) return;
        setRecords((prev) => prev.map((r) => r.id === payload.id ? { ...r, answer: payload.answer } : r));
        setPendingForMe((prev) => prev?.id === payload.id ? { ...prev, answer: payload.answer } : prev);
      })
      .subscribe();
    return () => {
      setChannel(null);
      supabase.removeChannel(ch);
    };
  }, [gm.roomCode, gm.round, gm.userId]);

  const aliveOthers = gm.alivePlayers.filter((p) => p.id !== gm.userId);
  const target = gm.players.get(selectedTarget);

  const ask = async () => {
    if (!channel || used || !gm.me?.alive || !selectedTarget || busy) return;
    const targetPlayer = gm.players.get(selectedTarget);
    if (!targetPlayer?.alive) return;
    setBusy(true);
    const rec: InterrogationRecord = {
      id: `${gm.userId}-${gm.round}-${Date.now()}`,
      round: gm.round,
      askerId: gm.userId,
      askerName: gm.userName,
      targetId: targetPlayer.id,
      targetName: targetPlayer.name,
      question: selectedQuestion,
    };
    setRecords((prev) => [...prev, rec].slice(-20));
    setUsed(true);
    await channel.send({ type: "broadcast", event: "interrogation_ask", payload: rec });
    setBusy(false);
  };

  const answer = async (answerValue: InterrogationAnswer) => {
    if (!channel || !pendingForMe || pendingForMe.answer || busy) return;
    setBusy(true);
    const payload = { id: pendingForMe.id, round: gm.round, answer: answerValue };
    setRecords((prev) => prev.map((r) => r.id === payload.id ? { ...r, answer: answerValue } : r));
    setPendingForMe((prev) => prev ? { ...prev, answer: answerValue } : prev);
    await channel.send({ type: "broadcast", event: "interrogation_answer", payload });
    setBusy(false);
  };

  const answerText = (a?: InterrogationAnswer) => a === "yes" ? "예" : a === "no" ? "아니오" : a === "pass" ? "대답하지 않겠습니다" : "답변 대기 중";

  return (
    <div className="mb-3 rounded-xl border border-sky-900/70 bg-gray-950/90 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-gray-800 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-sky-200">🔎 공개 심문</p>
          <p className="text-[10px] text-gray-500 mt-0.5">한 라운드에 한 번. 질문과 답변은 모두에게 공개됩니다.</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full ${used ? "bg-gray-800 text-gray-500" : "bg-sky-900/60 text-sky-200"}`}>{used ? "질문 사용" : "질문 1회"}</span>
      </div>

      {pendingForMe && !pendingForMe.answer && (
        <div className="p-3 bg-amber-950/25 border-b border-amber-900/30">
          <p className="text-xs text-amber-200 font-semibold">📣 {pendingForMe.askerName}님이 당신에게 공개 질문을 했습니다.</p>
          <p className="text-sm text-white mt-1">“{pendingForMe.question}”</p>
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <button onClick={() => answer("yes")} disabled={busy} className="min-h-10 rounded-lg bg-emerald-900/80 text-xs text-emerald-100 cursor-pointer disabled:opacity-40">예</button>
            <button onClick={() => answer("no")} disabled={busy} className="min-h-10 rounded-lg bg-rose-900/80 text-xs text-rose-100 cursor-pointer disabled:opacity-40">아니오</button>
            <button onClick={() => answer("pass")} disabled={busy} className="min-h-10 rounded-lg bg-gray-800 text-xs text-gray-300 cursor-pointer disabled:opacity-40">대답 안 함</button>
          </div>
        </div>
      )}

      {gm.me?.alive && !used && !pendingForMe?.id && aliveOthers.length > 0 && (
        <div className="p-3 border-b border-gray-800 space-y-2">
          <select value={selectedTarget} onChange={(e) => setSelectedTarget(e.target.value)} className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-white outline-none">
            <option value="">질문할 사람 선택</option>
            {aliveOthers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={selectedQuestion} onChange={(e) => setSelectedQuestion(e.target.value)} className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-xs text-white outline-none">
            {INTERROGATION_QUESTIONS.map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <button onClick={ask} disabled={!target || busy} className="w-full min-h-10 rounded-lg bg-sky-800 hover:bg-sky-700 text-xs font-bold cursor-pointer disabled:opacity-35">🔎 공개 질문하기</button>
        </div>
      )}

      <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
        {records.length === 0 && <p className="text-[11px] text-gray-600 text-center py-2">아직 공개 심문이 없습니다. 먼저 질문을 던져보세요.</p>}
        {records.slice().reverse().map((r) => (
          <div key={r.id} className="rounded-lg bg-gray-900 px-3 py-2">
            <p className="text-[11px] text-gray-400"><span className="text-sky-300 font-semibold">{r.askerName}</span> → <span className="text-amber-200 font-semibold">{r.targetName}</span></p>
            <p className="text-xs text-gray-200 mt-0.5">“{r.question}”</p>
            <p className={`text-[11px] mt-1 ${r.answer === "yes" ? "text-emerald-300" : r.answer === "no" ? "text-rose-300" : r.answer === "pass" ? "text-gray-400" : "text-amber-300"}`}>↳ {answerText(r.answer)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

'''
s = replace_once(s, marker, component + marker, "interrogation component insertion")

p.write_text(s)
print("pharisee interrogation patch applied")

from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected 1 match, got {count}")
    return text.replace(old, new, 1)

# types.ts
p = Path("src/games/pharisee/types.ts")
t = p.read_text()
t = replace_once(
    t,
    'export type Phase = "lobby" | "night" | "day-discuss" | "day-vote" | "day-lastwords" | "ended";',
    'export type Phase = "lobby" | "night" | "day-discuss" | "day-vote" | "day-lastwords" | "day-lastwords-vote" | "ended";',
    "types phase",
)
p.write_text(t)

# GameManager.ts
p = Path("src/games/pharisee/GameManager.ts")
t = p.read_text()

t = t.replace('import type { ScriptureTrialCounts } from "./scriptureTrials";\n', "")
t = t.replace('import { getScriptureTrialForRound } from "./scriptureTrials";\n', "")

scripture_state = '''  // ---- 말씀 사건(낮 심리전) ----
  scriptureTrialPromptId = getScriptureTrialForRound(1).id;
  scriptureTrialChoices: Map<string, string> = new Map();
  scriptureTrialResolved = false;
  scriptureTrialCounts: ScriptureTrialCounts = {};

'''
t = t.replace(scripture_state, "", 1)

final_state = '''  // ---- 최후의 발언 이후 생사 찬반 투표 ----
  finalWordsVotes: Map<string, "execute" | "spare"> = new Map();
  lastWordsVoteResult: { targetId: string; executed: boolean; yesCount: number; noCount: number; voterCount: number } | null = null;

'''
t = replace_once(t, '  winner: "citizen" | "pharisee" | null = null;\n\n', final_state + '  winner: "citizen" | "pharisee" | null = null;\n\n', "final words state")

t = replace_once(
    t,
    '  private lastWordsTimer: ReturnType<typeof setTimeout> | null = null;\n',
    '  private lastWordsTimer: ReturnType<typeof setTimeout> | null = null;\n  private finalWordsVoteTimer: ReturnType<typeof setTimeout> | null = null;\n',
    "final words timer",
)
t = replace_once(
    t,
    '    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);\n',
    '    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);\n    if (this.finalWordsVoteTimer) clearTimeout(this.finalWordsVoteTimer);\n',
    "destroy final vote timer",
)
t = replace_once(
    t,
    '    this.lastWordsTimer = null;\n',
    '    this.lastWordsTimer = null;\n    this.finalWordsVoteTimer = null;\n',
    "destroy timer null",
)

t = t.replace('      .on("broadcast", { event: "scripture_trial_answer" }, ({ payload }) => this.applyScriptureTrialAnswer(payload))\n', "")
t = t.replace('      .on("broadcast", { event: "scripture_trial_result" }, ({ payload }) => this.applyScriptureTrialResult(payload))\n', "")
t = replace_once(
    t,
    '      .on("broadcast", { event: "last_words_start" }, ({ payload }) => this.applyLastWordsStart(payload))\n',
    '      .on("broadcast", { event: "last_words_start" }, ({ payload }) => this.applyLastWordsStart(payload))\n      .on("broadcast", { event: "last_words_vote_start" }, ({ payload }) => this.applyLastWordsVoteStart(payload))\n      .on("broadcast", { event: "last_words_vote" }, ({ payload }) => this.applyFinalWordsVote(payload))\n      .on("broadcast", { event: "last_words_vote_result" }, ({ payload }) => this.applyFinalWordsVoteResult(payload))\n',
    "bind final words vote",
)

old_resume = '''    } else if (this.phase === "day-lastwords" && !this.lastWordsTimer && this.lastWordsTargetId) {
      const targetId = this.lastWordsTargetId;
      this.lastWordsTimer = setTimeout(() => this.finalizeEjection(targetId), remaining + 500);
    }
'''
new_resume = '''    } else if (this.phase === "day-lastwords" && !this.lastWordsTimer && this.lastWordsTargetId) {
      const targetId = this.lastWordsTargetId;
      this.lastWordsTimer = setTimeout(() => this.finalizeEjection(targetId), remaining + 500);
    } else if (this.phase === "day-lastwords-vote" && !this.finalWordsVoteTimer) {
      this.finalWordsVoteTimer = setTimeout(() => this.resolveFinalWordsVote(), remaining + 500);
    }
'''
t = replace_once(t, old_resume, new_resume, "resume final vote")

scripture_snapshot = '''      scriptureTrialPromptId: this.scriptureTrialPromptId,
      scriptureTrialResolved: this.scriptureTrialResolved,
      scriptureTrialCounts: this.scriptureTrialCounts,
      scriptureTrialChoices: Object.fromEntries(this.scriptureTrialChoices),
'''
t = t.replace(scripture_snapshot, "", 1)
t = replace_once(
    t,
    '      martyrAccusedTargetId: this.martyrAccusedTargetId,\n',
    '      martyrAccusedTargetId: this.martyrAccusedTargetId,\n      finalWordsVotes: Object.fromEntries(this.finalWordsVotes),\n      lastWordsVoteResult: this.lastWordsVoteResult,\n',
    "snapshot final vote",
)

hydrate_old = '''            martyrAccusedTargetId?: string | null;
            scriptureTrialPromptId?: string;
            scriptureTrialResolved?: boolean;
            scriptureTrialCounts?: ScriptureTrialCounts;
            scriptureTrialChoices?: Record<string, string>;
'''
hydrate_new = '''            martyrAccusedTargetId?: string | null;
            finalWordsVotes?: Record<string, "execute" | "spare">;
            lastWordsVoteResult?: { targetId: string; executed: boolean; yesCount: number; noCount: number; voterCount: number } | null;
'''
t = replace_once(t, hydrate_old, hydrate_new, "hydrate final vote type")

hydrate_old2 = '''      this.martyrAccusedTargetId = snap.martyrAccusedTargetId ?? null;
      this.scriptureTrialPromptId = snap.scriptureTrialPromptId ?? getScriptureTrialForRound(this.round).id;
      this.scriptureTrialResolved = snap.scriptureTrialResolved ?? false;
      this.scriptureTrialCounts = snap.scriptureTrialCounts ?? {};
      this.scriptureTrialChoices = new Map(Object.entries(snap.scriptureTrialChoices ?? {}));
'''
hydrate_new2 = '''      this.martyrAccusedTargetId = snap.martyrAccusedTargetId ?? null;
      this.finalWordsVotes = new Map(Object.entries(snap.finalWordsVotes ?? {}));
      this.lastWordsVoteResult = snap.lastWordsVoteResult ?? null;
'''
t = replace_once(t, hydrate_old2, hydrate_new2, "hydrate final vote values")

t = t.replace('    this.resetScriptureTrial();\n', "")
start = t.find('  // ---------- 말씀 사건: 낮마다 한 번만 참여하는 익명 심리전 ----------')
end = t.find('  // ---------- 낮 채팅 ----------', start)
if start == -1 or end == -1:
    raise SystemExit("scripture block boundaries not found")
t = t[:start] + t[end:]

old_lastwords = '''    if (this.isHost) {
      this.lastWordsTimer = setTimeout(() => this.finalizeEjection(payload.targetId), LAST_WORDS_MS + 500);
      this.persistSnapshot();
    }
  }
'''
new_lastwords = '''    if (this.isHost) {
      this.lastWordsTimer = setTimeout(() => this.finalizeEjection(payload.targetId), LAST_WORDS_MS + 500);
      this.persistSnapshot();
    }
  }

  // ---------- 최후의 발언 후 생사 찬반 투표 ----------
  private applyLastWordsVoteStart(payload: { targetId: string }) {
    if (this.phase === "ended") return;
    const target = this.players.get(payload.targetId);
    if (!target?.alive) return;
    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);
    this.lastWordsTimer = null;
    this.finalWordsVotes.clear();
    this.lastWordsVoteResult = null;
    this.phase = "day-lastwords-vote";
    this.phaseEndsAt = Date.now() + this.settings.voteMs;
    this.emit("phase-change", "day-lastwords-vote");
    this.emit("final-words-vote-update");
    if (this.isHost) {
      this.finalWordsVoteTimer = setTimeout(() => this.resolveFinalWordsVote(), this.settings.voteMs + 500);
      this.persistSnapshot();
    }
  }

  castFinalWordsVote(decision: "execute" | "spare") {
    if (this.phase !== "day-lastwords-vote") return;
    if (!this.me?.alive || this.userId === this.lastWordsTargetId) return;
    const payload = { voterId: this.userId, targetId: this.lastWordsTargetId!, decision };
    this.applyFinalWordsVote(payload);
    this.channel.send({ type: "broadcast", event: "last_words_vote", payload });
  }

  private applyFinalWordsVote(payload: { voterId: string; targetId: string; decision: "execute" | "spare" }) {
    if (this.phase !== "day-lastwords-vote") return;
    if (payload.targetId !== this.lastWordsTargetId) return;
    if (payload.decision !== "execute" && payload.decision !== "spare") return;
    const voter = this.players.get(payload.voterId);
    if (!voter?.alive || payload.voterId === payload.targetId) return;
    if (this.finalWordsVotes.has(payload.voterId)) return;
    this.finalWordsVotes.set(payload.voterId, payload.decision);
    this.emit("final-words-vote-update");
    this.maybeAutoResolveFinalWordsVote();
  }

  private maybeAutoResolveFinalWordsVote() {
    if (!this.isHost || this.phase !== "day-lastwords-vote") return;
    const eligibleCount = this.alivePlayers.filter((p) => p.id !== this.lastWordsTargetId).length;
    if (eligibleCount > 0 && this.finalWordsVotes.size >= eligibleCount) {
      if (this.finalWordsVoteTimer) clearTimeout(this.finalWordsVoteTimer);
      this.finalWordsVoteTimer = null;
      this.resolveFinalWordsVote();
    }
  }

  private resolveFinalWordsVote() {
    if (!this.isHost || this.phase !== "day-lastwords-vote") return;
    if (this.finalWordsVoteTimer) clearTimeout(this.finalWordsVoteTimer);
    this.finalWordsVoteTimer = null;
    const eligibleCount = this.alivePlayers.filter((p) => p.id !== this.lastWordsTargetId).length;
    const yesCount = [...this.finalWordsVotes.values()].filter((v) => v === "execute").length;
    const noCount = [...this.finalWordsVotes.values()].filter((v) => v === "spare").length;
    const executed = eligibleCount > 0 && yesCount > eligibleCount / 2;
    let martyrStrikeId: string | null = null;
    if (executed && this.lastWordsTargetId && this.martyrAccusedTargetId) {
      const martyr = this.players.get(this.lastWordsTargetId);
      const accused = this.players.get(this.martyrAccusedTargetId);
      if (martyr?.role === "martyr" && accused?.alive && isPhariseeAlignedForWin(accused.role)) {
        martyrStrikeId = accused.id;
      }
    }
    const payload = {
      targetId: this.lastWordsTargetId!,
      executed,
      yesCount,
      noCount,
      voterCount: eligibleCount,
      martyrStrikeId,
    };
    this.applyFinalWordsVoteResult(payload);
    this.channel.send({ type: "broadcast", event: "last_words_vote_result", payload });
  }

  private applyFinalWordsVoteResult(payload: { targetId: string; executed: boolean; yesCount: number; noCount: number; voterCount: number; martyrStrikeId?: string | null }) {
    if (this.phase !== "day-lastwords-vote") return;
    this.lastWordsVoteResult = {
      targetId: payload.targetId,
      executed: payload.executed,
      yesCount: payload.yesCount,
      noCount: payload.noCount,
      voterCount: payload.voterCount,
    };
    this.emit("final-words-vote-result", this.lastWordsVoteResult);
    const ejectedId = payload.executed ? payload.targetId : null;
    this.applyEjection({ ejectedId, martyrStrikeId: payload.executed ? (payload.martyrStrikeId ?? null) : null });
  }
'''
t = replace_once(t, old_lastwords, new_lastwords, "last words vote block")

old_finalize = '''  private finalizeEjection(targetId: string) {
    if (!this.isHost) return;
    const ejectedId = targetId;
    // 출교당하는 사람이 순교자이고 실제로 누군가를 고발했다면, 그 대상이 진짜 바리새인 편인지 판정한다
    let martyrStrikeId: string | null = null;
    if (ejectedId && this.martyrAccusedTargetId) {
      const martyr = this.players.get(ejectedId);
      const accused = this.players.get(this.martyrAccusedTargetId);
      if (martyr?.role === "martyr" && accused?.alive && isPhariseeAlignedForWin(accused.role)) {
        martyrStrikeId = accused.id;
      }
    }
    const payload = { ejectedId, martyrStrikeId };
    this.applyEjection(payload);
    this.channel.send({ type: "broadcast", event: "vote_end", payload });
  }
'''
new_finalize = '''  private finalizeEjection(targetId: string) {
    if (!this.isHost) return;
    const payload = { targetId };
    this.applyLastWordsVoteStart(payload);
    this.channel.send({ type: "broadcast", event: "last_words_vote_start", payload });
  }
'''
t = replace_once(t, old_finalize, new_finalize, "finalize ejection")

t = replace_once(
    t,
    '    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);\n    this.winner = payload.winner;\n',
    '    if (this.lastWordsTimer) clearTimeout(this.lastWordsTimer);\n    if (this.finalWordsVoteTimer) clearTimeout(this.finalWordsVoteTimer);\n    this.winner = payload.winner;\n',
    "game end final vote timer",
)
p.write_text(t)

# GameView.tsx
p = Path("src/games/pharisee/GameView.tsx")
v = p.read_text()
v = v.replace('import ScriptureTrialCard from "./ScriptureTrialCard";\n', "")
v = v.replace('const [phase, setPhase] = useState<"lobby" | "night" | "day-discuss" | "day-vote" | "day-lastwords" | "ended">("lobby");', 'const [phase, setPhase] = useState<"lobby" | "night" | "day-discuss" | "day-vote" | "day-lastwords" | "day-lastwords-vote" | "ended">("lobby");')
v = v.replace('    gm.on("scripture-trial-update", rerender);\n', "")
v = v.replace('      if (p === "day-lastwords") soundEngine.play("lastWords");\n', '      if (p === "day-lastwords") soundEngine.play("lastWords");\n      if (p === "day-lastwords-vote") soundEngine.play("voteStart");\n')
v = replace_once(
    v,
    '''          {phase === "night"
            ? "🌙 밤"
            : phase === "day-discuss"
            ? "☀️ 낮 토론"
            : phase === "day-lastwords"
            ? "🕯️ 마지막 유언"
            : "🗳️ 투표"}''',
    '''          {phase === "night"
            ? "🌙 밤"
            : phase === "day-discuss"
            ? "☀️ 낮 토론"
            : phase === "day-lastwords"
            ? "🕯️ 마지막 유언"
            : phase === "day-lastwords-vote"
            ? "⚖️ 생사 결정"
            : "🗳️ 투표"}''',
    "GameView phase label",
)
v = replace_once(
    v,
    '''      {phase === "day-discuss" && (<>
        <ScriptureTrialCard gm={gm} />
        <DayDiscussView gm={gm} />
      </>)}
      {phase === "day-vote" && <DayVoteView gm={gm} />}
      {phase === "day-lastwords" && <LastWordsView gm={gm} />}''',
    '''      {phase === "day-discuss" && <DayDiscussView gm={gm} />}
      {phase === "day-vote" && <DayVoteView gm={gm} />}
      {phase === "day-lastwords" && <LastWordsView gm={gm} />}
      {phase === "day-lastwords-vote" && <FinalWordsVoteView gm={gm} />}''',
    "GameView scripture render",
)
anchor = 'function LastWordsView({ gm }: { gm: GameManager }) {'
if anchor not in v:
    raise SystemExit("LastWordsView anchor not found")
vote_component = r'''function FinalWordsVoteView({ gm }: { gm: GameManager }) {
  const left = useCountdown(gm.phaseEndsAt);
  const target = gm.lastWordsTargetId ? gm.players.get(gm.lastWordsTargetId) : null;
  const isTarget = gm.userId === gm.lastWordsTargetId;
  const me = gm.me;
  const myVote = gm.finalWordsVotes.get(gm.userId);

  if (!me?.alive || isTarget) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 space-y-3">
        <div className="text-center">
          <p className="text-base font-bold text-amber-300">⚖️ 최후의 발언을 들었습니다</p>
          <p className="text-sm text-gray-300 mt-1">
            {isTarget ? `${target?.name ?? "해당 플레이어"}님은 생사 투표에 참여할 수 없습니다.` : "당신은 더 이상 생사 투표에 참여할 수 없습니다."}
          </p>
          <p className="text-xs text-gray-500 mt-2">다른 살아있는 플레이어의 결정을 기다리는 중… {left}초</p>
        </div>
        {gm.lastWordsVoteResult && <FinalWordsVoteResultBanner gm={gm} />}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 space-y-4">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-900 text-xs text-gray-400">⚖️ 생사 결정 · {left}초</div>
        <p className="text-lg font-bold text-white mt-3">{target?.name ?? "누군가"}님의 마지막 발언이 끝났습니다</p>
        <p className="text-sm text-gray-400 mt-1">이 사람을 공동체에 남길까요, 여기서 끝낼까요?</p>
        <p className="text-xs text-gray-500 mt-2">모든 생존 플레이어 중 본인을 제외한 사람만 투표하며, 찬성이 과반수일 때만 사망합니다.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => gm.castFinalWordsVote("execute")}
          disabled={!!myVote}
          className={`min-h-16 rounded-xl border text-sm font-bold cursor-pointer disabled:cursor-default ${
            myVote === "execute" ? "bg-rose-800 border-rose-500 text-white" : "bg-gray-900 border-rose-900 text-rose-200 hover:bg-rose-950"
          }`}
        >
          ☠️ 죽인다
        </button>
        <button
          onClick={() => gm.castFinalWordsVote("spare")}
          disabled={!!myVote}
          className={`min-h-16 rounded-xl border text-sm font-bold cursor-pointer disabled:cursor-default ${
            myVote === "spare" ? "bg-emerald-800 border-emerald-500 text-white" : "bg-gray-900 border-emerald-900 text-emerald-200 hover:bg-emerald-950"
          }`}
        >
          🕊️ 살려준다
        </button>
      </div>

      <p className="text-xs text-center text-gray-500">{myVote ? "투표 완료. 다른 플레이어의 결정을 기다리는 중입니다." : "한 번 선택하면 바꿀 수 없습니다."}</p>
      {gm.lastWordsVoteResult && <FinalWordsVoteResultBanner gm={gm} />}
    </div>
  );
}

function FinalWordsVoteResultBanner({ gm }: { gm: GameManager }) {
  const result = gm.lastWordsVoteResult;
  if (!result) return null;
  return (
    <div className={`rounded-xl p-3 text-center border ${result.executed ? "bg-rose-950/60 border-rose-800" : "bg-emerald-950/60 border-emerald-800"}`}>
      <p className="font-bold text-sm">{result.executed ? "☠️ 과반수 찬성으로 사망이 확정되었습니다." : "🕊️ 과반수 찬성이 성립되지 않아 살아남았습니다."}</p>
      <p className="text-xs text-gray-400 mt-1">죽인다 {result.yesCount} · 살려준다 {result.noCount} · 투표 자격자 {result.voterCount}</p>
    </div>
  );
}

'''
v = v.replace(anchor, vote_component + anchor, 1)
p.write_text(v)

for extra in [Path("src/games/pharisee/ScriptureTrialCard.tsx"), Path("src/games/pharisee/scriptureTrials.ts")]:
    extra.unlink(missing_ok=True)

print("final words majority vote migration applied")

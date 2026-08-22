import { useEffect, useMemo, useRef, useState } from "react";
import { TASK_SPOTS, BIBLE_PHRASES, OFFERING_LABELS, OFFERING_MEANINGS, QUIZ_QUESTIONS } from "./types";
import { playTaskSuccess, playTaskFail, playUiClick } from "./soundManager";
import { ICONS, MaskIcon } from "./icons";
import { PRESS_FX } from "./uiFeedback";

/** 결과 플래시가 뜬 뒤 실제로 onComplete/onCancel을 호출하기까지의 지연 시간(ms).
 *  너무 짧으면 피드백이 눈에 안 띄고, 너무 길면 조작감이 답답해지므로 짧게 잡았다. */
const RESULT_FLASH_MS = 360;

/** 결과 플래시 전용 keyframes. 다른 컴포넌트(EndScreen 등)와 동일하게 <style> 태그로
 *  자체 완결시켜 별도 CSS 파일이 필요 없게 했다. */
function TaskResultStyles() {
  return (
    <style>{`
      @keyframes task-result-ring {
        from { opacity: 0.9; transform: scale(0.6); }
        to { opacity: 0; transform: scale(1.6); }
      }
      @keyframes task-result-icon-pop {
        0% { opacity: 0; transform: scale(0.4); }
        40% { opacity: 1; transform: scale(1.15); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes task-result-shake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-8px); }
        40% { transform: translateX(7px); }
        60% { transform: translateX(-5px); }
        80% { transform: translateX(3px); }
      }
    `}</style>
  );
}

/** 미니게임 성공/실패 순간 화면 전체에 잠깐 덧씌우는 피드백 오버레이.
 *  성공: 초록 링이 번지며 확장 + 체크 아이콘. 실패: 화면이 붉게 흔들리며 X 아이콘. */
function TaskResultFlash({ type }: { type: "success" | "fail" }) {
  const isSuccess = type === "success";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
      style={{ animation: !isSuccess ? "task-result-shake 0.4s ease-in-out" : undefined }}
    >
      <TaskResultStyles />
      <div
        className={`absolute w-40 h-40 rounded-full border-4 ${
          isSuccess ? "border-emerald-400" : "border-rose-500"
        }`}
        style={{ animation: "task-result-ring 0.4s ease-out forwards" }}
      />
      <MaskIcon
        src={isSuccess ? ICONS.checkmark : ICONS.cross}
        color={isSuccess ? "#34d399" : "#f43f5e"}
        className="w-16 h-16"
        style={{
          filter: `drop-shadow(0 0 12px ${isSuccess ? "rgba(52,211,153,0.8)" : "rgba(244,63,94,0.8)"})`,
          animation: "task-result-icon-pop 0.35s ease-out",
        }}
      />
    </div>
  );
}

export function TaskModal({
  taskId,
  onComplete,
  onCancel,
}: {
  taskId: string;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const spot = TASK_SPOTS.find((t) => t.id === taskId)!;
  const [result, setResult] = useState<"success" | "fail" | null>(null);
  // 성공/실패 콜백이 중복 호출되는 걸 막는 가드. state 업데이트는 비동기라 result만으로는
  // 같은 렌더 사이클 안의 중복 호출을 못 막을 수 있어 ref로 한 번 더 잠근다.
  const resolvedRef = useRef(false);
  const resolveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => () => {
    if (resolveTimerRef.current) {
      window.clearTimeout(resolveTimerRef.current);
      resolveTimerRef.current = null;
    }
  }, []);

  // 성공: 초록 피드백을 보여준 뒤 짧게 딜레이하고서 실제 onComplete를 호출한다.
  const handleComplete = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    playTaskSuccess();
    setResult("success");
    resolveTimerRef.current = window.setTimeout(() => {
      resolveTimerRef.current = null;
      onComplete();
    }, RESULT_FLASH_MS);
  };

  // 실패(제한시간 초과)든 사용자가 직접 취소했든 동일한 취소 경로를 타므로 구분 없이
  // "실패" 피드백을 준다 — 대부분의 취소는 사실상 미션을 못 끝낸 것과 같은 결과이기 때문.
  const handleCancel = () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    playTaskFail();
    setResult("fail");
    resolveTimerRef.current = window.setTimeout(() => {
      resolveTimerRef.current = null;
      onCancel();
    }, RESULT_FLASH_MS);
  };

  const taskProps = { onComplete: handleComplete, onCancel: handleCancel };

  let body: React.ReactNode;
  switch (spot.type) {
    case "typing":
      body = <TypingTask {...taskProps} />;
      break;
    case "sort":
      body = <SortTask {...taskProps} />;
      break;
    case "offering":
      body = <OfferingTask {...taskProps} />;
      break;
    case "wiring":
      body = <WiringTask {...taskProps} />;
      break;
    case "mixer":
      body = <MixerTask {...taskProps} />;
      break;
    case "dragdrop":
      body = <DragDropTask {...taskProps} />;
      break;
    case "memory":
      body = <MemoryTask {...taskProps} />;
      break;
    case "timing":
      body = <TimingTask {...taskProps} />;
      break;
    case "mash":
      body = <MashTask {...taskProps} />;
      break;
    case "maze":
      body = <MazeTask {...taskProps} />;
      break;
    case "match":
      body = <MatchTask {...taskProps} />;
      break;
    case "quiz":
      body = <QuizTask {...taskProps} />;
      break;
    case "puzzle":
      body = <PuzzleTask {...taskProps} />;
      break;
    case "whack":
      body = <WhackTask {...taskProps} />;
      break;
    case "balance":
      body = <BalanceTask {...taskProps} />;
      break;
    case "water":
      body = <WaterTask {...taskProps} />;
      break;
    case "lock":
      body = <LockTask {...taskProps} />;
      break;
    case "bells":
      body = <BellsTask {...taskProps} />;
      break;
    default:
      body = <OfferingTask {...taskProps} />;
  }

  return (
    <>
      {body}
      {result && <TaskResultFlash type={result} />}
    </>
  );
}

function Shell({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) {
  // 버그 수정(모바일 UI 잘림): 예전엔 바깥 레이어가 "fixed inset-0 flex items-center justify-center"
  // 뿐이라 스크롤 수단이 전혀 없었다. 가로로 눕힌 좁은 화면에서 미니게임 내용(그리드/퍼즐 등)이
  // 뷰포트보다 세로로 길어지면, 중앙 정렬 때문에 위아래로 튀어나온 부분이 화면 밖으로 밀려나고
  // 스크롤할 방법이 없어 그대로 잘려 보였다(닫기 버튼까지 화면 밖으로 밀려나 못 누르는 경우도 있었다).
  // 바깥 레이어는 단순 스크롤 컨테이너로 두고, 실제 중앙 정렬은 안쪽 wrapper(min-h-full)가
  // 담당하게 분리하면 — 내용이 넘칠 때도 정상적으로 위/아래 스크롤이 가능해진다.
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md text-white my-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onCancel} className={`text-gray-400 hover:text-white text-sm cursor-pointer ${PRESS_FX}`}>
              취소
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/** 배열을 직접 변형하지 않고 새 배열로 섞어 반환한다 (Fisher-Yates) — match/quiz/puzzle 미션에서 공용으로 쓴다. */
function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function TypingTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const entry = useMemo(() => BIBLE_PHRASES[Math.floor(Math.random() * BIBLE_PHRASES.length)], []);
  const phrase = entry.phrase;
  const timeLimit = Math.min(30, 10 + Math.round(phrase.length * 0.4));
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    const normalize = (s: string) => s.trim().replace(/\s+/g, " ");
    const typed = normalize(input);
    if (typed.length < phrase.length - 2) return;
    // 짧은 구절은 정확히, 긴 구절은 오타 1~2자까지 관대하게 허용한다
    const tolerance = phrase.length >= 12 ? 2 : phrase.length >= 8 ? 1 : 0;
    if (levenshtein(typed, normalize(phrase)) <= tolerance) onComplete();
  }, [input, phrase, onComplete]);

  return (
    <Shell title="📖 말씀 타자 치기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-2">아래 구절을 그대로 입력하세요 (남은 시간: {timeLeft}초)</p>
      <p className="bg-gray-800 rounded-lg p-3 mb-1 text-yellow-300 font-medium">{phrase}</p>
      <p className="text-xs text-gray-500 mb-3">— {entry.ref}</p>
      <input
        autoFocus={!(typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches)}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white outline-none focus:border-emerald-400"
        placeholder="여기에 입력하세요"
      />
    </Shell>
  );
}

function SortTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const shuffled = useMemo(() => [1, 2, 3, 4].sort(() => Math.random() - 0.5), []);
  const [clicked, setClicked] = useState<number[]>([]);
  const next = clicked.length + 1;

  const handleClick = (n: number) => {
    if (n !== next) return;
    playUiClick();
    const updated = [...clicked, n];
    setClicked(updated);
    if (updated.length === 4) setTimeout(onComplete, 250);
  };

  return (
    <Shell title="📰 주보 정리" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">흩어진 페이지를 1면부터 순서대로 클릭하세요</p>
      <div className="grid grid-cols-4 gap-3">
        {shuffled.map((n) => (
          <button
            key={n}
            onClick={() => handleClick(n)}
            disabled={clicked.includes(n)}
            className={`aspect-square rounded-lg text-xl font-bold cursor-pointer transition-colors ${PRESS_FX} ${
              clicked.includes(n) ? "bg-emerald-600 text-white" : "bg-gray-800 hover:bg-gray-700 text-gray-200"
            }`}
          >
            {n}면
          </button>
        ))}
      </div>
    </Shell>
  );
}

function OfferingTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const rounds = useMemo(
    () => Array.from({ length: 5 }, () => OFFERING_LABELS[Math.floor(Math.random() * OFFERING_LABELS.length)]),
    []
  );
  const [round, setRound] = useState(0);
  const [shake, setShake] = useState(false);

  const handlePick = (label: string) => {
    if (label === rounds[round]) {
      playUiClick();
      if (round + 1 >= rounds.length) {
        onComplete();
      } else {
        setRound(round + 1);
      }
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
  };

  return (
    <Shell title="🧺 헌금 바구니 정리" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-1">
        봉투: <span className="text-yellow-300 font-bold">{rounds[round]}</span> ({round + 1}/{rounds.length})
      </p>
      <p className="text-xs text-gray-500 mb-3">{OFFERING_MEANINGS[rounds[round]]}</p>
      <div className={`grid grid-cols-3 gap-2 ${shake ? "animate-pulse" : ""}`}>
        {OFFERING_LABELS.map((label) => (
          <button
            key={label}
            onClick={() => handlePick(label)}
            className={`py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 cursor-pointer ${PRESS_FX}`}
          >
            {label} 바구니
          </button>
        ))}
      </div>
    </Shell>
  );
}

function WiringTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const colors = ["#ef4444", "#3b82f6", "#eab308", "#22c55e"];
  const labels = ["기타", "건반", "드럼", "마이크"];
  const targets = useMemo(() => [...colors].sort(() => Math.random() - 0.5), []);
  const [selected, setSelected] = useState<number | null>(null);
  const [connected, setConnected] = useState<Set<number>>(new Set());
  const [wrong, setWrong] = useState<number | null>(null);

  const pickTarget = (ti: number) => {
    if (selected === null) return;
    if (colors[selected] === targets[ti]) {
      playUiClick();
      const updated = new Set(connected).add(selected);
      setConnected(updated);
      setSelected(null);
      if (updated.size === 4) setTimeout(onComplete, 250);
    } else {
      setWrong(ti);
      setTimeout(() => setWrong(null), 300);
      setSelected(null);
    }
  };

  return (
    <Shell title="🎸 찬양팀 배선 연결" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">악기를 클릭한 뒤 같은 색 단자를 클릭해 연결하세요</p>
      <div className="flex justify-between">
        <div className="flex flex-col gap-3">
          {colors.map((c, i) => (
            <button
              key={i}
              onClick={() => !connected.has(i) && setSelected(i)}
              disabled={connected.has(i)}
              className={`w-16 h-11 rounded-lg text-xs text-white flex items-center justify-center cursor-pointer border-2 ${PRESS_FX} ${
                selected === i ? "border-white" : "border-transparent"
              } ${connected.has(i) ? "opacity-40" : ""}`}
              style={{ backgroundColor: c }}
            >
              {labels[i]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {targets.map((c, ti) => (
            <button
              key={ti}
              onClick={() => pickTarget(ti)}
              className={`w-11 h-11 rounded-full cursor-pointer border-2 ${PRESS_FX} ${
                wrong === ti ? "border-red-500 animate-pulse" : "border-gray-600"
              }`}
              style={{ backgroundColor: c, opacity: [...connected].some((i) => colors[i] === c) ? 0.3 : 1 }}
            />
          ))}
        </div>
      </div>
    </Shell>
  );
}

// 믹서기 미션 재료 목록. 정답 순서(레시피)와 버튼이 놓이는 화면 순서를 각각 따로
// 섞어서 쓰기 때문에, 그냥 눈에 보이는 순서를 베끼는 게 아니라 위쪽 레시피를 보고
// 알맞은 재료를 찾아 누르는 방식이 된다.
const MIXER_INGREDIENTS = [
  { emoji: "🥕", label: "당근" },
  { emoji: "🧅", label: "양파" },
  { emoji: "🥔", label: "감자" },
  { emoji: "🍅", label: "토마토" },
];

function shuffleIngredients() {
  return [...MIXER_INGREDIENTS].sort(() => Math.random() - 0.5);
}

/**
 * 🥣 믹서기로 재료 섞기 (TASK_SPOTS: 주방 1).
 * 예전엔 여기서 "방송실 음향 슬라이더 조절"이라는, 위치(주방)와 전혀 안 맞는 화면이
 * 떴다 — 개발 초기 CCTV실 미션 자리에 있던 컴포넌트를 그대로 복붙해서 옮긴 흔적이
 * 남아있었다. 위치·이름에 맞는 완전히 새로운 미니게임으로 교체: 슬라이더 대신
 * 위쪽 레시피 순서를 보고 재료를 순서대로 탭하는 방식이라 한 손가락으로도 쉽고,
 * 실수해도 그 재료만 다시 누르면 되어 이전 슬라이더 방식보다 훨씬 부담이 적다.
 */
function MixerTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const recipeOrder = useMemo(shuffleIngredients, []);
  const buttonOrder = useMemo(shuffleIngredients, []);
  const [step, setStep] = useState(0);
  const [wrong, setWrong] = useState<string | null>(null);

  const handlePick = (label: string) => {
    if (label === recipeOrder[step].label) {
      playUiClick();
      if (step + 1 >= recipeOrder.length) {
        setTimeout(onComplete, 250);
      } else {
        setStep((s) => s + 1);
      }
    } else {
      setWrong(label);
      setTimeout(() => setWrong(null), 300);
    }
  };

  return (
    <Shell title="🥣 믹서기로 재료 섞기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-2">위 레시피 순서대로 아래 재료를 눌러 믹서기에 담으세요</p>
      <div className="flex justify-center gap-3 mb-4 bg-gray-800 rounded-lg py-3">
        {recipeOrder.map((ing, i) => (
          <span key={ing.label} className={`text-2xl transition-opacity ${i < step ? "opacity-25" : ""}`}>
            {ing.emoji}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {buttonOrder.map((ing) => {
          const doneIndex = recipeOrder.findIndex((r) => r.label === ing.label);
          const done = doneIndex < step;
          return (
            <button
              key={ing.label}
              onClick={() => !done && handlePick(ing.label)}
              disabled={done}
              className={`py-4 rounded-lg text-lg font-medium cursor-pointer transition-colors flex items-center justify-center gap-2 ${PRESS_FX} ${
                done
                  ? "bg-emerald-600 text-white"
                  : wrong === ing.label
                    ? "bg-rose-600 text-white"
                    : "bg-gray-800 hover:bg-gray-700 text-gray-200"
              }`}
            >
              <span className="text-2xl">{ing.emoji}</span>
              {ing.label}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function DragDropTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const target = useMemo(
    () => Array.from({ length: 3 }, () => ({ choco: 1 + Math.floor(Math.random() * 3), drink: 1 + Math.floor(Math.random() * 3) })),
    []
  );
  const [trays, setTrays] = useState(target.map(() => ({ choco: 0, drink: 0 })));
  const [activeTray, setActiveTray] = useState(0);
  const [shake, setShake] = useState(false);

  const addItem = (item: "choco" | "drink") => {
    setTrays((prev) => prev.map((t, i) => (i === activeTray ? { ...t, [item]: t[item] + 1 } : t)));
  };

  const handleSubmit = () => {
    const ok = trays.every((t, i) => t.choco === target[i].choco && t.drink === target[i].drink);
    if (ok) onComplete();
    else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setTrays(target.map(() => ({ choco: 0, drink: 0 })));
      }, 400);
    }
  };

  return (
    <Shell title="🍫 수련회 간식 배식" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">식판을 선택하고 버튼으로 지시된 개수만큼 담으세요</p>
      <div className={`grid grid-cols-3 gap-3 mb-4 ${shake ? "animate-pulse" : ""}`}>
        {target.map((t, i) => (
          <button
            key={i}
            onClick={() => setActiveTray(i)}
            className={`rounded-lg p-2 text-center cursor-pointer border-2 ${PRESS_FX} ${
              activeTray === i ? "border-emerald-400 bg-gray-800" : "border-transparent bg-gray-800/60"
            }`}
          >
            <p className="text-xs text-gray-400 mb-1">지시: 🍫{t.choco} 🥤{t.drink}</p>
            <p className="text-sm text-yellow-300">담김: 🍫{trays[i].choco} 🥤{trays[i].drink}</p>
          </button>
        ))}
      </div>
      <div className="flex justify-center gap-4 mb-4">
        <button onClick={() => addItem("choco")} className={`px-4 py-2 bg-amber-700 rounded-lg cursor-pointer text-sm ${PRESS_FX}`}>
          🍫 초코파이 담기
        </button>
        <button onClick={() => addItem("drink")} className={`px-4 py-2 bg-sky-700 rounded-lg cursor-pointer text-sm ${PRESS_FX}`}>
          🥤 음료수 담기
        </button>
      </div>
      <button onClick={handleSubmit} className={`w-full py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer ${PRESS_FX}`}>
        배식 완료
      </button>
    </Shell>
  );
}

function MemoryTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const FRUITS = ["사랑", "희락", "화평", "인내", "자비", "양선", "충성", "온유", "절제"];
  const STAGE_LENGTHS = [3, 4, 5];
  const [stage, setStage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [showIndex, setShowIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [inputIdx, setInputIdx] = useState(0);
  const [penalty, setPenalty] = useState(false);

  useEffect(() => {
    const len = STAGE_LENGTHS[stage];
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * 9));
    setSequence(seq);
    setInputIdx(0);
    setPlaying(true);
    let i = 0;
    const iv = setInterval(() => {
      setShowIndex(seq[i]);
      setTimeout(() => setShowIndex(null), 400);
      i++;
      if (i >= seq.length) {
        clearInterval(iv);
        setTimeout(() => setPlaying(false), 500);
      }
    }, 700);
    return () => clearInterval(iv);
  }, [stage, retryTick]);

  const handleClick = (idx: number) => {
    if (playing || penalty) return;
    if (idx === sequence[inputIdx]) {
      playUiClick();
      if (inputIdx + 1 >= sequence.length) {
        if (stage + 1 >= STAGE_LENGTHS.length) onComplete();
        else setStage((s) => s + 1);
      } else {
        setInputIdx((n) => n + 1);
      }
    } else {
      setPenalty(true);
      setInputIdx(0);
      setTimeout(() => {
        setPenalty(false);
        setRetryTick((t) => t + 1);
      }, 2000);
    }
  };

  return (
    <Shell title="🍇 성령의 열매 패턴 기억" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">
        {playing ? "순서를 잘 보세요..." : penalty ? "틀렸습니다! 잠시 후 다시 시도하세요" : `순서대로 클릭하세요 (${stage + 1}/3단계)`}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {FRUITS.map((f, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`aspect-square rounded-lg text-xs font-bold cursor-pointer transition-colors ${PRESS_FX} ${
              showIndex === i ? "bg-yellow-400 text-black" : "bg-gray-800 hover:bg-gray-700 text-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </Shell>
  );
}
const MASH_EVENT_LABELS = ["여름 수련회", "가을 심방주간", "성탄 축하예배", "부활절 새벽예배", "청년부 부흥회"];

function TimingTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const HITS_NEEDED = 5;
  const ZONE = { start: 42, end: 58 };
  const [pos, setPos] = useState(0);
  const [hits, setHits] = useState(0);
  const [flash, setFlash] = useState<"hit" | "miss" | null>(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const dir = useRef(1);

  useEffect(() => {
    const iv = setInterval(() => {
      setPos((p) => {
        let next = p + dir.current * 2.6;
        if (next >= 100) {
          next = 100;
          dir.current = -1;
        } else if (next <= 0) {
          next = 0;
          dir.current = 1;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  const handlePress = () => {
    const inZone = pos >= ZONE.start && pos <= ZONE.end;
    setFlash(inZone ? "hit" : "miss");
    setTimeout(() => setFlash(null), 200);
    if (inZone) {
      const next = hits + 1;
      setHits(next);
      if (next >= HITS_NEEDED) setTimeout(onComplete, 200);
    }
  };

  return (
    <Shell title="🎹 찬양 반주 맞추기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-2">
        건반이 초록 박자 구간을 지날 때 아래 버튼을 눌러 반주를 맞추세요 ({hits}/{HITS_NEEDED}, 남은 시간: {timeLeft}초)
      </p>
      <div className="relative h-8 bg-gray-800 rounded-lg mb-4 overflow-hidden">
        <div
          className="absolute top-0 h-full bg-emerald-500/30"
          style={{ left: `${ZONE.start}%`, width: `${ZONE.end - ZONE.start}%` }}
        />
        <div
          className={`absolute top-0 w-2 h-full rounded ${flash === "hit" ? "bg-emerald-400" : flash === "miss" ? "bg-rose-500" : "bg-yellow-300"}`}
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <button
        onClick={handlePress}
        className={`w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer font-medium ${PRESS_FX}`}
      >
        건반 누르기
      </button>
    </Shell>
  );
}

function MashTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const label = useMemo(() => MASH_EVENT_LABELS[Math.floor(Math.random() * MASH_EVENT_LABELS.length)], []);
  const NEEDED = 24;
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    // 클릭이 하나도 없어도 자연히 아주 조금씩 사그라들게 해 무한 방치 클리어를 막는다
    const decay = setInterval(() => setProgress((p) => Math.max(0, p - 0.3)), 200);
    return () => clearInterval(decay);
  }, []);

  const handleMash = () => {
    setProgress((p) => {
      const next = Math.min(NEEDED, p + 1);
      if (next >= NEEDED) setTimeout(onComplete, 150);
      return next;
    });
  };

  return (
    <Shell title="📌 행사 현수막 게시" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-2">
        "{label}" 현수막을 연타로 고정하세요 (남은 시간: {timeLeft}초)
      </p>
      <div className="w-full h-4 bg-gray-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-emerald-500 transition-[width] duration-100"
          style={{ width: `${(progress / NEEDED) * 100}%` }}
        />
      </div>
      <button
        onClick={handleMash}
        className={`w-full py-4 bg-amber-600 hover:bg-amber-500 rounded-lg cursor-pointer font-bold text-lg ${PRESS_FX}`}
      >
        📌 고정하기
      </button>
    </Shell>
  );
}

const MAZE_LAYOUTS: { grid: number[][]; start: [number, number]; goal: [number, number] }[] = [
  {
    grid: [
      [0, 0, 1, 0, 0],
      [1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
    ],
    start: [0, 0],
    goal: [4, 4],
  },
  {
    grid: [
      [0, 0, 0, 1, 0],
      [1, 1, 0, 1, 0],
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 0, 0, 0, 0],
    ],
    start: [0, 4],
    goal: [4, 0],
  },
];

function MazeTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const layout = useMemo(() => MAZE_LAYOUTS[Math.floor(Math.random() * MAZE_LAYOUTS.length)], []);
  const [pos, setPos] = useState<[number, number]>(layout.start);
  const [timeLeft, setTimeLeft] = useState(25);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    if (pos[0] === layout.goal[0] && pos[1] === layout.goal[1]) {
      const t = setTimeout(onComplete, 200);
      return () => clearTimeout(t);
    }
  }, [pos, layout.goal, onComplete]);

  const move = (dx: number, dy: number) => {
    setPos(([x, y]) => {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= layout.grid[0].length || ny >= layout.grid.length) return [x, y];
      if (layout.grid[ny][nx] === 1) return [x, y];
      return [nx, ny];
    });
  };

  return (
    <Shell title="📦 구제품 옮기기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">
        박스 미로를 지나 반대편까지 구제품을 옮기세요 (남은 시간: {timeLeft}초)
      </p>
      <div
        className="grid gap-1 mx-auto mb-4"
        style={{ gridTemplateColumns: `repeat(${layout.grid[0].length}, minmax(0, 1fr))`, width: "fit-content" }}
      >
        {layout.grid.map((row, ry) =>
          row.map((cell, rx) => {
            const isPlayer = pos[0] === rx && pos[1] === ry;
            const isGoal = layout.goal[0] === rx && layout.goal[1] === ry;
            return (
              <div
                key={`${rx}-${ry}`}
                className={`w-9 h-9 rounded flex items-center justify-center text-sm ${
                  cell === 1 ? "bg-gray-700" : isGoal ? "bg-emerald-700/50" : "bg-gray-800/60"
                }`}
              >
                {isPlayer ? "🧑" : isGoal ? "🎁" : ""}
              </div>
            );
          })
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 w-32 mx-auto">
        <div />
        <button onClick={() => move(0, -1)} className={`py-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer ${PRESS_FX}`}>▲</button>
        <div />
        <button onClick={() => move(-1, 0)} className={`py-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer ${PRESS_FX}`}>◀</button>
        <button onClick={() => move(0, 1)} className={`py-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer ${PRESS_FX}`}>▼</button>
        <button onClick={() => move(1, 0)} className={`py-2 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer ${PRESS_FX}`}>▶</button>
      </div>
    </Shell>
  );
}

// ======================================================================
// 아래는 미션을 12개에서 20개로 늘리며 새로 추가한 8종 미니게임이다.
// 기존 10종(위쪽)을 다른 위치에 복제하는 대신, 전부 새로운 조작 방식의
// 미니게임으로 만들어 6개의 미션 없는 방(무용실/피아노실 2/휴게실/창고 2/
// 관리실/주방 2)과 인기 허브(기도실/교육실)를 채웠다.
// ======================================================================

const MATCH_EMOJIS = ["🕺", "💃", "🎶", "🙌"];

/** 🕺 무용 동작 카드 짝맞추기 (무용실) — 카드 두 장을 뒤집어 같은 그림을 찾는 짝맞추기(콘센트레이션) 게임. */
function MatchTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const cards = useMemo(
    () => shuffleArr([...MATCH_EMOJIS, ...MATCH_EMOJIS]).map((emoji, id) => ({ id, emoji })),
    []
  );
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    if (matched.size === cards.length) setTimeout(onComplete, 250);
  }, [matched, cards.length, onComplete]);

  const handleClick = (id: number) => {
    if (locked || flipped.includes(id) || matched.has(id)) return;
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length === 2) {
      setLocked(true);
      const [a, b] = next;
      if (cards[a].emoji === cards[b].emoji) {
        playUiClick();
        setMatched((prev) => new Set(prev).add(a).add(b));
        setFlipped([]);
        setLocked(false);
      } else {
        setTimeout(() => {
          setFlipped([]);
          setLocked(false);
        }, 500);
      }
    }
  };

  return (
    <Shell title="🕺 무용 동작 카드 짝맞추기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">같은 동작 카드 두 장을 찾아 짝을 맞추세요 (남은 시간: {timeLeft}초)</p>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => {
          const shown = flipped.includes(c.id) || matched.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => handleClick(c.id)}
              className={`aspect-square rounded-lg text-2xl flex items-center justify-center cursor-pointer transition-colors ${PRESS_FX} ${
                matched.has(c.id) ? "bg-emerald-600" : shown ? "bg-gray-700" : "bg-gray-800 hover:bg-gray-700"
              }`}
            >
              {shown ? c.emoji : "❓"}
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

/** ❓ 성경 상식 OX 퀴즈 (휴게실) — 3문제를 연속으로 O/X 맞히면 완료. */
function QuizTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const rounds = useMemo(() => shuffleArr(QUIZ_QUESTIONS).slice(0, 3), []);
  const [round, setRound] = useState(0);
  const [wrong, setWrong] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  const handlePick = (pick: boolean) => {
    if (pick === rounds[round].a) {
      playUiClick();
      if (round + 1 >= rounds.length) setTimeout(onComplete, 200);
      else setRound((r) => r + 1);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 300);
    }
  };

  return (
    <Shell title="❓ 성경 상식 OX 퀴즈" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-1">
        {round + 1}/{rounds.length}문제 (남은 시간: {timeLeft}초)
      </p>
      <p className={`bg-gray-800 rounded-lg p-3 mb-4 text-yellow-300 font-medium ${wrong ? "animate-pulse" : ""}`}>
        {rounds[round].q}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handlePick(true)}
          className={`py-4 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-lg font-bold cursor-pointer ${PRESS_FX}`}
        >
          O
        </button>
        <button
          onClick={() => handlePick(false)}
          className={`py-4 rounded-lg bg-rose-700 hover:bg-rose-600 text-lg font-bold cursor-pointer ${PRESS_FX}`}
        >
          X
        </button>
      </div>
    </Shell>
  );
}

/** 🔢 비품 번호표 순서 맞추기 (창고 2) — 타일 두 개를 순서대로 클릭해 자리를 맞바꿔 1~5 오름차순으로 정렬. */
function PuzzleTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const initial = useMemo(() => {
    let arr = [1, 2, 3, 4, 5];
    do {
      arr = shuffleArr(arr);
    } while (arr.every((v, i) => v === i + 1));
    return arr;
  }, []);
  const [tiles, setTiles] = useState(initial);
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(25);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    if (tiles.every((v, i) => v === i + 1)) setTimeout(onComplete, 200);
  }, [tiles, onComplete]);

  const handleClick = (idx: number) => {
    if (selected === null) {
      setSelected(idx);
      playUiClick();
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    const next = [...tiles];
    [next[selected], next[idx]] = [next[idx], next[selected]];
    setTiles(next);
    setSelected(null);
    playUiClick();
  };

  return (
    <Shell title="🔢 비품 번호표 순서 맞추기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">
        번호표 두 장을 순서대로 클릭해 자리를 바꿔 1~5 오름차순으로 맞추세요 (남은 시간: {timeLeft}초)
      </p>
      <div className="grid grid-cols-5 gap-2">
        {tiles.map((v, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`aspect-square rounded-lg text-xl font-bold cursor-pointer transition-colors ${PRESS_FX} ${
              selected === i ? "bg-yellow-500 text-black" : "bg-gray-800 hover:bg-gray-700 text-gray-200"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/** 🍽️ 설거지 그릇 빠르게 씻기 (주방 2) — 반짝이는 칸을 재빨리 클릭하는 두더지잡기 스타일 반응 게임. */
function WhackTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const SIZE = 9;
  const NEEDED = 8;
  const [lit, setLit] = useState<number | null>(null);
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    const iv = setInterval(() => setLit(Math.floor(Math.random() * SIZE)), 650);
    return () => clearInterval(iv);
  }, []);

  const handleClick = (i: number) => {
    if (i !== lit) return;
    playUiClick();
    setLit(null);
    setHits((h) => {
      const next = h + 1;
      if (next >= NEEDED) setTimeout(onComplete, 200);
      return next;
    });
  };

  return (
    <Shell title="🍽️ 설거지 그릇 빠르게 씻기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">
        반짝이는 그릇을 재빨리 눌러 씻으세요 ({hits}/{NEEDED}, 남은 시간: {timeLeft}초)
      </p>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: SIZE }).map((_, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`aspect-square rounded-lg text-2xl cursor-pointer transition-colors ${PRESS_FX} ${
              lit === i ? "bg-sky-400" : "bg-gray-800 hover:bg-gray-700"
            }`}
          >
            {lit === i ? "🍽️" : ""}
          </button>
        ))}
      </div>
    </Shell>
  );
}

/** 📦 교재 상자 균형 잡고 나르기 (교육실) — 좌우 버튼으로 흔들리는 상자의 중심을 눌러 누적 시간 동안 유지. */
function BalanceTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const NEEDED_MS = 5000;
  const [pos, setPos] = useState(50);
  const [held, setHeld] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const velRef = useRef(0);
  const resolvedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    const iv = setInterval(() => {
      velRef.current += (Math.random() - 0.5) * 3;
      velRef.current = Math.max(-6, Math.min(6, velRef.current));
      setPos((p) => {
        const next = Math.max(0, Math.min(100, p + velRef.current));
        const inZone = next >= 40 && next <= 60;
        if (inZone) {
          setHeld((h) => {
            const nh = Math.min(NEEDED_MS, h + 120);
            if (nh >= NEEDED_MS && !resolvedRef.current) {
              resolvedRef.current = true;
              setTimeout(onComplete, 150);
            }
            return nh;
          });
        }
        return next;
      });
    }, 120);
    return () => clearInterval(iv);
  }, [onComplete]);

  const push = (dir: -1 | 1) => {
    playUiClick();
    velRef.current += dir * 4;
  };

  return (
    <Shell title="📦 교재 상자 균형 잡고 나르기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-2">
        상자가 한쪽으로 기울지 않게 버튼으로 중심을 잡으세요 ({Math.floor(held / 1000)}/{NEEDED_MS / 1000}초 유지, 남은 시간: {timeLeft}초)
      </p>
      <div className="relative h-6 bg-gray-800 rounded-lg mb-4 overflow-hidden">
        <div className="absolute top-0 h-full bg-emerald-500/30" style={{ left: "40%", width: "20%" }} />
        <div
          className="absolute top-0 w-2 h-full bg-yellow-300 rounded"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        />
      </div>
      <div className="flex justify-center gap-4">
        <button
          onClick={() => push(-1)}
          className={`px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer font-bold ${PRESS_FX}`}
        >
          ◀ 왼쪽
        </button>
        <button
          onClick={() => push(1)}
          className={`px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer font-bold ${PRESS_FX}`}
        >
          오른쪽 ▶
        </button>
      </div>
    </Shell>
  );
}

/** 🪴 로비 화분에 물 주기 (기도실) — 화분 세 개를 각각 몇 번씩만 눌러서 채우면 끝.
 *  예전엔 물이 계속 말라가는(decay) 채로 15초 안에 세 화분을 동시에 유지해야 해서 너무
 *  어렵다는 의견이 있어, 마르는 효과를 없애고 제한시간도 넉넉히 늘렸다 — 이제는 각 화분을
 *  천천히 5번씩만 눌러 채우면 되는 쉬운 미션이다. */
function WaterTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const POTS = 3;
  const CLICKS_NEEDED = 5;
  const [levels, setLevels] = useState<number[]>(Array(POTS).fill(0));
  const [timeLeft, setTimeLeft] = useState(30);
  const resolvedRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    if (!resolvedRef.current && levels.every((v) => v >= CLICKS_NEEDED)) {
      resolvedRef.current = true;
      setTimeout(onComplete, 200);
    }
  }, [levels, onComplete]);

  const water = (i: number) => {
    playUiClick();
    setLevels((prev) => prev.map((v, idx) => (idx === i ? Math.min(CLICKS_NEEDED, v + 1) : v)));
  };

  return (
    <Shell title="🪴 로비 화분에 물 주기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">
        화분 세 개를 각각 {CLICKS_NEEDED}번씩 눌러 물을 주세요 (남은 시간: {timeLeft}초)
      </p>
      <div className="grid grid-cols-3 gap-3">
        {levels.map((v, i) => (
          <button
            key={i}
            onClick={() => water(i)}
            disabled={v >= CLICKS_NEEDED}
            className={`flex flex-col items-center gap-2 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:hover:bg-gray-800 cursor-pointer ${PRESS_FX}`}
          >
            <span className="text-2xl">{v >= CLICKS_NEEDED ? "🌿" : "🪴"}</span>
            <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-[width] duration-150"
                style={{ width: `${(v / CLICKS_NEEDED) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );
}

/** 🔒 서류함 다이얼 자물쇠 맞추기 (관리실) — 메모에 적힌 목표 번호와 똑같이 세 자리 다이얼을 맞추기. */
function LockTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const target = useMemo(() => Array.from({ length: 3 }, () => Math.floor(Math.random() * 10)), []);
  const [digits, setDigits] = useState([0, 0, 0]);
  const [timeLeft, setTimeLeft] = useState(25);

  useEffect(() => {
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) onCancel();
  }, [timeLeft, onCancel]);

  useEffect(() => {
    if (digits.every((d, i) => d === target[i])) setTimeout(onComplete, 200);
  }, [digits, target, onComplete]);

  const bump = (i: number, dir: 1 | -1) => {
    playUiClick();
    setDigits((prev) => prev.map((d, idx) => (idx === i ? (d + dir + 10) % 10 : d)));
  };

  return (
    <Shell title="🔒 서류함 다이얼 자물쇠 맞추기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-1">메모에 적힌 번호와 똑같이 다이얼을 맞추세요 (남은 시간: {timeLeft}초)</p>
      <p className="bg-gray-800 rounded-lg p-2 mb-3 text-center text-yellow-300 font-bold tracking-widest">
        {target.join("  -  ")}
      </p>
      <div className="flex justify-center gap-4">
        {digits.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <button onClick={() => bump(i, 1)} className={`w-10 h-8 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer ${PRESS_FX}`}>
              ▲
            </button>
            <div className="w-12 h-12 flex items-center justify-center bg-gray-800 rounded-lg text-2xl font-bold text-yellow-300">
              {d}
            </div>
            <button onClick={() => bump(i, -1)} className={`w-10 h-8 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer ${PRESS_FX}`}>
              ▼
            </button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

const BELL_COLORS = ["#f43f5e", "#3b82f6", "#eab308", "#22c55e"];
const BELL_STAGE_LENGTHS = [4, 5];

/** 🔔 핸드벨 순서대로 연주하기 (피아노실 2) — 울리는 벨 순서를 보고 그대로 따라 누르는 사이먼 게임. */
function BellsTask({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [stage, setStage] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [sequence, setSequence] = useState<number[]>([]);
  const [ringing, setRinging] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);
  const [inputIdx, setInputIdx] = useState(0);
  const [penalty, setPenalty] = useState(false);

  useEffect(() => {
    const len = BELL_STAGE_LENGTHS[stage];
    const seq = Array.from({ length: len }, () => Math.floor(Math.random() * BELL_COLORS.length));
    setSequence(seq);
    setInputIdx(0);
    setPlaying(true);
    let i = 0;
    const iv = setInterval(() => {
      setRinging(seq[i]);
      setTimeout(() => setRinging(null), 400);
      i++;
      if (i >= seq.length) {
        clearInterval(iv);
        setTimeout(() => setPlaying(false), 500);
      }
    }, 700);
    return () => clearInterval(iv);
  }, [stage, retryTick]);

  const handleClick = (idx: number) => {
    if (playing || penalty) return;
    if (idx === sequence[inputIdx]) {
      playUiClick();
      if (inputIdx + 1 >= sequence.length) {
        if (stage + 1 >= BELL_STAGE_LENGTHS.length) onComplete();
        else setStage((s) => s + 1);
      } else {
        setInputIdx((n) => n + 1);
      }
    } else {
      setPenalty(true);
      setInputIdx(0);
      setTimeout(() => {
        setPenalty(false);
        setRetryTick((t) => t + 1);
      }, 2000);
    }
  };

  return (
    <Shell title="🔔 핸드벨 순서대로 연주하기" onCancel={onCancel}>
      <p className="text-sm text-gray-400 mb-3">
        {playing
          ? "순서를 잘 들으세요..."
          : penalty
            ? "틀렸습니다! 잠시 후 다시 시도하세요"
            : `순서대로 눌러 연주하세요 (${stage + 1}/${BELL_STAGE_LENGTHS.length}단계)`}
      </p>
      <div className="grid grid-cols-4 gap-3">
        {BELL_COLORS.map((c, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={`aspect-square rounded-full cursor-pointer border-4 transition-transform ${PRESS_FX} ${
              ringing === i ? "scale-110 border-white" : "border-transparent"
            }`}
            style={{ backgroundColor: c, opacity: ringing === i ? 1 : 0.75 }}
          />
        ))}
      </div>
    </Shell>
  );
}
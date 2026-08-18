import { useEffect, useRef, useState } from "react";
import { GameManager } from "./GameManager";
import { WaitingOverlay } from "./WaitingOverlay";

const CANVAS_W = 800;
const CANVAS_H = 600;
const MAX_UNDO = 5;

const COLORS = ["#1a1a1a", "#e63946", "#f4a300", "#2a9d8f", "#264653", "#8338ec", "#ff70a6", "#ffffff"];
const SIZES = [4, 10, 20] as const;
/** "은혜 스탬프" — 그림 실력이 부족해도 참여 장벽을 낮추는 장치이자 신앙 소재를 은근히 노출하는 지점 (GDD 3.3절) */
const STAMPS = ["😇", "✝️", "🙏", "🕊️", "🌈", "🎤"];

type Stroke =
  | { kind: "path"; color: string; size: number; points: { x: number; y: number }[] }
  | { kind: "stamp"; emoji: string; x: number; y: number };

/**
 * 그리기 턴(turn % 2 === 1) UI. 직전 사람이 남긴 텍스트(프롬프트 또는 추측)를 보고 그림으로 표현한다.
 * 그림 데이터는 최종적으로 PNG data URL로 직렬화해 체인에 제출한다.
 */
export function CanvasBoard({ gm }: { gm: GameManager }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [undoUsed, setUndoUsed] = useState(0);
  const drawingRef = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState<number>(SIZES[1]);
  const [eraser, setEraser] = useState(false);
  const [stampMode, setStampMode] = useState<string | null>(null);
  const startedAtRef = useRef(Date.now());
  const autoSubmittedRef = useRef(false);
  const [, forceUpdate] = useState(0);
  const [remaining, setRemaining] = useState(gm.settings.drawTimeSec);

  const sourceText = gm.previousEntry?.content ?? "";

  // 새 턴이 시작될 때마다 캔버스/타이머/undo 카운트 초기화
  useEffect(() => {
    startedAtRef.current = Date.now();
    autoSubmittedRef.current = false;
    setStrokes([]);
    setUndoUsed(0);
    setStampMode(null);
    setEraser(false);
  }, [gm.currentTurn]);

  useEffect(() => {
    const rerender = () => forceUpdate((n) => n + 1);
    gm.on("entry-update", rerender);
    gm.on("phase-change", rerender);
    return () => {
      gm.off("entry-update", rerender);
      gm.off("phase-change", rerender);
    };
  }, [gm]);

  useEffect(() => redraw(strokes), [strokes]);

  useEffect(() => {
    const totalSec = gm.settings.drawTimeSec;
    const id = setInterval(() => {
      const left = Math.max(0, totalSec - Math.floor((Date.now() - startedAtRef.current) / 1000));
      setRemaining(left);
      if (left === 0 && !gm.haveISubmittedThisTurn && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submit();
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gm.currentTurn]);

  function redraw(list: Stroke[]) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    list.forEach((s) => {
      if (s.kind === "path") {
        if (s.points.length < 2) return;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        s.points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.stroke();
      } else {
        ctx.font = "48px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(s.emoji, s.x, s.y);
      }
    });
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (gm.haveISubmittedThisTurn) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const pos = getPos(e);
    if (stampMode) {
      setStrokes((prev) => [...prev, { kind: "stamp", emoji: stampMode, x: pos.x, y: pos.y }]);
      return;
    }
    drawingRef.current = {
      kind: "path",
      color: eraser ? "#ffffff" : color,
      size: eraser ? size * 2.5 : size,
      points: [pos],
    };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const current = drawingRef.current;
    if (!current || current.kind !== "path") return;
    const pos = getPos(e);
    current.points.push(pos);
    // 다음 stroke가 strokes 배열에 커밋되기 전까지는 매 이동마다 선분만 즉시 그려 반응성을 유지
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && current.points.length >= 2) {
      const [p1, p2] = current.points.slice(-2);
      ctx.strokeStyle = current.color;
      ctx.lineWidth = current.size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  function handlePointerUp() {
    const current = drawingRef.current;
    if (!current) return;
    setStrokes((prev) => [...prev, current]);
    drawingRef.current = null;
  }

  const undo = () => {
    if (undoUsed >= MAX_UNDO || strokes.length === 0) return;
    setStrokes((prev) => prev.slice(0, -1));
    setUndoUsed((n) => n + 1);
  };
  const clearAll = () => setStrokes([]);

  function submit() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    gm.submitEntry(dataUrl);
  }

  if (gm.haveISubmittedThisTurn) {
    return <WaitingOverlay gm={gm} />;
  }

  return (
    <div className="w-full max-w-[820px] bg-gray-800 rounded-2xl p-4 sm:p-6 text-white flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">🎨 그림으로 표현해보세요</h2>
        <span className={`text-sm font-mono ${remaining <= 5 ? "text-red-400" : "text-gray-400"}`}>{remaining}초</span>
      </div>
      <p className="text-sm bg-gray-900 rounded-lg px-3 py-2 text-amber-300">"{sourceText}"</p>

      <div className="w-full overflow-hidden rounded-lg border border-gray-700 touch-none">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="w-full h-auto bg-white touch-none cursor-crosshair"
          style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setEraser(false);
              setStampMode(null);
            }}
            className={`w-7 h-7 rounded-full border-2 cursor-pointer ${
              !eraser && !stampMode && color === c ? "border-amber-400" : "border-gray-600"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            className={`w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center cursor-pointer border ${
              size === s ? "border-amber-400" : "border-gray-600"
            }`}
          >
            <span className="rounded-full bg-white" style={{ width: s / 1.5, height: s / 1.5 }} />
          </button>
        ))}
        <button
          onClick={() => {
            setEraser((v) => !v);
            setStampMode(null);
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer border ${
            eraser ? "bg-amber-700 border-amber-600" : "bg-gray-700 border-gray-600"
          }`}
        >
          🧹 지우개
        </button>
        <button
          onClick={undo}
          disabled={undoUsed >= MAX_UNDO || strokes.length === 0}
          className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer bg-gray-700 border border-gray-600 disabled:opacity-40 disabled:cursor-default"
        >
          ↩️ 되돌리기 ({MAX_UNDO - undoUsed}회 남음)
        </button>
        <button
          onClick={clearAll}
          className="px-2.5 py-1.5 rounded-lg text-xs cursor-pointer bg-gray-700 border border-gray-600"
        >
          🗑️ 전체 지우기
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-gray-500">은혜 스탬프</span>
        {STAMPS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setStampMode((v) => (v === emoji ? null : emoji))}
            className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center cursor-pointer border ${
              stampMode === emoji ? "border-amber-400 bg-amber-900/40" : "border-gray-600 bg-gray-700"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <button
        onClick={submit}
        className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
      >
        제출
      </button>
    </div>
  );
}
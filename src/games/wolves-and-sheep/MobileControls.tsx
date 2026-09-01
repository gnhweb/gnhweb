import { useEffect, useRef, useState, type PointerEvent } from "react";
import Phaser from "phaser";
import { PRESS_FX, POP_IN_STYLE } from "./uiFeedback";

function vibrate(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(ms);
    } catch {
      // 일부 브라우저는 사용자 제스처 밖에서 호출 시 예외를 던지기도 하므로 무시한다.
    }
  }
}

export function MobileControls({ game }: { game: Phaser.Game }) {
  const [prompt, setPrompt] = useState<{ label: string; type: string }>({ label: "", type: "" });

  useEffect(() => {
    const onPrompt = (data: { label: string; type: string }) => setPrompt(data);
    game.events.on("mobile-prompt", onPrompt);
    return () => {
      game.events.off("mobile-prompt", onPrompt);
    };
  }, [game]);

  return (
    <div className="absolute inset-0 pointer-events-none select-none touch-none">
      <FloatingJoystick game={game} />
      {prompt.type && (
        <button
          key={prompt.type}
          onPointerDown={(e) => {
            e.preventDefault();
            vibrate(15);
            game.events.emit("mobile-action", prompt.type);
          }}
          style={{
            bottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
            right: "calc(1.5rem + env(safe-area-inset-right, 0px))",
            ...POP_IN_STYLE,
          }}
          className={`absolute pointer-events-auto cursor-pointer
                     max-w-[150px] rounded-full bg-indigo-600/90 active:bg-indigo-400
                     text-white text-xs font-medium px-4 py-4 shadow-lg border border-indigo-300/40
                     leading-tight text-center z-10 ${PRESS_FX}`}
        >
          {formatMobileLabel(prompt.label)}
        </button>
      )}
    </div>
  );
}

const KEY_PREFIXES = ["스페이스바로 ", "스페이스바 ", "K키로 ", "B키로 ", "R키로 ", "V키로 ", "H키로 "];
function formatMobileLabel(label: string): string {
  for (const prefix of KEY_PREFIXES) {
    if (label.startsWith(prefix)) return label.slice(prefix.length);
  }
  return label;
}

const JOYSTICK_RADIUS = 46;
const ZONE_WIDTH_RATIO = 0.55;
const ZONE_HEIGHT_RATIO = 0.6;
const EDGE_MARGIN = JOYSTICK_RADIUS * 1.3;

function FloatingJoystick({ game }: { game: Phaser.Game }) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);

  const updateVector = (dx: number, dy: number) => {
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, JOYSTICK_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;
    setKnob({ x: kx, y: ky });
    const norm = clamped < 8 ? 0 : clamped / JOYSTICK_RADIUS;
    game.events.emit("mobile-move", {
      x: norm === 0 ? 0 : (kx / clamped) * norm,
      y: norm === 0 ? 0 : (ky / clamped) * norm,
    });
  };

  const reset = () => {
    activePointerId.current = null;
    setOrigin(null);
    setKnob({ x: 0, y: 0 });
    game.events.emit("mobile-move", { x: 0, y: 0 });
  };

  const onPointerDown = (e: PointerEvent) => {
    if (activePointerId.current !== null) return;
    e.preventDefault();
    vibrate(8);
    activePointerId.current = e.pointerId;
    const zone = zoneRef.current;
    if (!zone) {
      reset();
      return;
    }
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      // 일부 브라우저에서는 해당 pointer의 capture가 허용되지 않을 수 있다.
    }
    const rect = zone.getBoundingClientRect();
    setOrigin({
      x: Math.min(Math.max(e.clientX, rect.left + EDGE_MARGIN), rect.right - EDGE_MARGIN),
      y: Math.min(Math.max(e.clientY, rect.top + EDGE_MARGIN), rect.bottom - EDGE_MARGIN),
    });
    setKnob({ x: 0, y: 0 });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (activePointerId.current !== e.pointerId || !origin) return;
    e.preventDefault();
    updateVector(e.clientX - origin.x, e.clientY - origin.y);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (activePointerId.current !== e.pointerId) return;
    e.preventDefault();
    const zone = zoneRef.current;
    if (zone?.hasPointerCapture(e.pointerId)) {
      try {
        zone.releasePointerCapture(e.pointerId);
      } catch {
        // 이미 브라우저가 capture를 해제한 경우 무시한다.
      }
    }
    reset();
  };

  return (
    <div
      ref={zoneRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="absolute left-0 bottom-0 pointer-events-auto touch-none"
      style={{ width: `${ZONE_WIDTH_RATIO * 100}%`, height: `${ZONE_HEIGHT_RATIO * 100}%` }}
    >
      {origin && (
        <>
          <div
            className="fixed rounded-full bg-white/10 border border-white/25"
            style={{
              left: origin.x - JOYSTICK_RADIUS,
              top: origin.y - JOYSTICK_RADIUS,
              width: JOYSTICK_RADIUS * 2,
              height: JOYSTICK_RADIUS * 2,
              pointerEvents: "none",
            }}
          />
          <div
            className="fixed w-9 h-9 rounded-full bg-indigo-400/90 border border-indigo-200/60"
            style={{
              left: origin.x + knob.x - 18,
              top: origin.y + knob.y - 18,
              pointerEvents: "none",
            }}
          />
        </>
      )}
    </div>
  );
}

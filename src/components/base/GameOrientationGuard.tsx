import { useCallback, useEffect, useState, type ReactNode } from "react";

type GameOrientation = "landscape" | "portrait";
type OrientationLock = "landscape" | "portrait";

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLock) => Promise<void>;
  unlock?: () => void;
};

type ScreenWithLegacyLock = Screen & {
  lockOrientation?: (orientation: string | string[]) => boolean | Promise<boolean>;
  unlockOrientation?: () => void;
};

function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function isCorrectOrientation(orientation: GameOrientation) {
  if (typeof window === "undefined") return true;
  return orientation === "landscape"
    ? window.matchMedia("(orientation: landscape)").matches
    : window.matchMedia("(orientation: portrait)").matches;
}

async function lockOrientation(orientation: GameOrientation) {
  if (typeof window === "undefined" || !isTouchDevice()) return;

  const target = orientation as OrientationLock;
  const screenOrientation = window.screen.orientation as ScreenOrientationWithLock | undefined;

  if (screenOrientation?.lock) {
    try {
      await screenOrientation.lock(target);
      return;
    } catch {
      // iPhone Safari에서는 브라우저 정책상 거절될 수 있다. 레거시 API/fallback을 사용한다.
    }
  }

  const legacyScreen = window.screen as ScreenWithLegacyLock;
  if (legacyScreen.lockOrientation) {
    try {
      await Promise.resolve(legacyScreen.lockOrientation(target));
    } catch {
      // 지원하지 않는 브라우저에서는 방향 안내 오버레이가 최종 fallback이다.
    }
  }
}

function unlockOrientation() {
  if (typeof window === "undefined") return;

  const screenOrientation = window.screen.orientation as ScreenOrientationWithLock | undefined;
  try {
    screenOrientation?.unlock?.();
  } catch {
    // 지원하지 않는 브라우저에서는 아무 작업도 하지 않는다.
  }

  const legacyScreen = window.screen as ScreenWithLegacyLock;
  try {
    legacyScreen.unlockOrientation?.();
  } catch {
    // 지원하지 않는 브라우저에서는 아무 작업도 하지 않는다.
  }
}

export function useGameOrientation(orientation: GameOrientation) {
  const [wrongOrientation, setWrongOrientation] = useState(() => !isCorrectOrientation(orientation));

  const refresh = useCallback(() => {
    setWrongOrientation(!isCorrectOrientation(orientation));
  }, [orientation]);

  useEffect(() => {
    if (!isTouchDevice()) return;

    const handleOrientationChange = () => {
      refresh();
      void lockOrientation(orientation);
    };

    handleOrientationChange();
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", refresh);

    const screenOrientation = window.screen.orientation;
    screenOrientation?.addEventListener?.("change", refresh);

    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", refresh);
      screenOrientation?.removeEventListener?.("change", refresh);
      unlockOrientation();
    };
  }, [orientation, refresh]);

  const retry = useCallback(async () => {
    await lockOrientation(orientation);
    refresh();
  }, [orientation, refresh]);

  return { wrongOrientation, retry };
}

export function GameOrientationGuard({
  orientation,
  children,
}: {
  orientation: GameOrientation;
  children: ReactNode;
}) {
  const { wrongOrientation, retry } = useGameOrientation(orientation);
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    await retry();
    setRetrying(false);
  };

  return (
    <>
      {children}
      {wrongOrientation && (
        <div
          className="fixed inset-0 z-[1000] flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 px-8 text-center text-white"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
          }}
        >
          <div className="text-5xl" aria-hidden>
            {orientation === "landscape" ? "📱↔️" : "📱↕️"}
          </div>
          <p className="text-lg font-bold">
            {orientation === "landscape" ? "휴대폰을 가로로 돌려주세요" : "휴대폰을 세로로 돌려주세요"}
          </p>
          <p className="text-sm text-gray-400">
            {orientation === "landscape"
              ? "이 게임은 가로 화면에서만 플레이할 수 있어요."
              : "이 게임은 세로 화면에서만 플레이할 수 있어요."}
          </p>
          <button
            type="button"
            onClick={() => void handleRetry()}
            disabled={retrying}
            className="min-h-11 rounded-lg border border-gray-700 bg-gray-800 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {retrying ? "화면 방향 확인 중..." : "화면 방향 다시 확인"}
          </button>
        </div>
      )}
    </>
  );
}

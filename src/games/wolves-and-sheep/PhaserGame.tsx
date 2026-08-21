import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Phaser from "phaser";
import { MainScene } from "./MainScene";
import { GameManager } from "./GameManger";
import { TaskModal } from "./TaskModal";
import { MeetingModal } from "./MeetingModal";
import { EndScreen } from "./EndScreen";
import { AbilityPanel } from "./AbilityPanel";
import { MiniMap } from "./MiniMap";
import { AdminMap, SecurityCameras } from "./InvestigationPanels";
import { MobileControls } from "./MobileControls";
import { EjectionOverlay, type EjectionResult } from "./EjectionOverlay";
import {
  ROLE_INFO,
  ROLE_VERSE,
  WORLD_CONCEPT,
  Role,
  ROOMS,
  LOCKABLE_ROOM_IDS,
  isWolfFaction,
  isSheepFaction,
  PRAYER_ROOM,
  BLACKOUT_PROGRESS_NEEDED,
  REACTOR_PANELS,
  CANDLE_SPOTS,
  CANDLE_PRESSES_NEEDED,
  PIPE_PANELS,
} from "./types";
import { GameSettingsPanel } from "./GameSettingsPanel";
import { CosmeticPanel } from "./CosmeticPanel";
import { useAuth } from "@/hooks/useAuth";
import { playSabotageAlarm, playMeetingCall, playEjectResult, playBodyDiscovered, setGhostAudioMode } from "./soundManager";
import { ICONS, MaskIcon } from "./icons";
import { JuiceGlobalStyles, FLASH_FX, READY_PULSE_FX } from "./uiFeedback";

/** 터치스크린 기기 여부 — 세션 내내 바뀌지 않는다고 가정하고 한 번만 계산 */
function isTouchDevice() {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

/** iOS(Safari/인앱 브라우저 포함) 여부. iOS는 <video> 외 요소에 Fullscreen API를 지원하지
 * 않아 document.fullscreenElement가 절대 true가 되지 않는다 — 이 기기에서는 "진짜" 전체화면
 * 대신 CSS fixed 레이어(.game-fullscreen)로 화면을 덮는 방식에만 의존하고, 어차피 성공할 수
 * 없는 브라우저 전체화면 재시도 버튼은 아예 보여주지 않는다. */
function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+는 데스크톱 Safari로 위장하므로 터치 지원 여부로 함께 판별
  const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isAppleTouch || isIpadOS;
}

/** iOS에서 "홈 화면에 추가"로 실행 중인지(standalone 모드) 여부.
 *  standalone일 때는 Safari의 주소창/탭 바 자체가 없어져서 진짜 전체화면이 된다 —
 *  반대로 일반 Safari 탭에서는 어떤 JS 트릭을 써도 그 UI를 완전히 없앨 수 없다
 *  (Apple 정책). 그래서 일반 탭에서는 "전체화면 시도"가 아니라 "홈 화면 추가 안내"가
 *  실질적으로 유일하게 동작하는 해결책이다. */
function isIOSStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia?.("(display-mode: standalone)").matches === true;
}

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** 재접속(이어하기) 지원: 마지막으로 들어가 있던 방 코드를 기억해 두는 로컬 저장소 키.
 * 방에 들어가는 순간 저장하고, "나가기"로 정상 퇴장하면 지운다(PhaserGame.tsx 4-4 참고). */
const ACTIVE_ROOM_STORAGE_KEY = "wolves-active-room";

export function PhaserGame() {
  const { user, profile, profileError } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomCode = searchParams.get("room") || "";
  const [joinInput, setJoinInput] = useState("");

  if (!roomCode) {
    // 재접속(이어하기) 지원: 실수로 나갔던 방이 있으면 랜딩 화면에 "이어서 참가하기" 버튼을 보여준다.
    // 정상적으로 "나가기"를 눌렀을 때만 이 값이 지워지므로, 값이 남아있다는 건 곧 비정상 이탈(새로고침/
    // 탭 종료/뒤로가기 등)이었다는 뜻이다.
    const savedRoom = localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
    return (
      <div className="text-white flex flex-col items-center gap-4 bg-gray-800 rounded-2xl p-8 w-[90%] max-w-sm">
        {savedRoom && (
          <button
            onClick={() => setSearchParams({ room: savedRoom })}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer font-medium"
          >
            이전 게임 이어서 참가하기 ({savedRoom})
          </button>
        )}
        <button
          onClick={() => setSearchParams({ room: randomRoomCode() })}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer font-medium"
        >
          새 방 만들기
        </button>
        <div className="flex items-center gap-2 w-full">
          <div className="h-px bg-gray-600 flex-1" />
          <span className="text-xs text-gray-500">또는</span>
          <div className="h-px bg-gray-600 flex-1" />
        </div>
        <div className="flex gap-2 w-full">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="방 코드 입력"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center tracking-widest outline-none focus:border-indigo-400"
          />
          <button
            onClick={() => joinInput.trim() && setSearchParams({ room: joinInput.trim() })}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg cursor-pointer"
          >
            참가
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="text-white">로그인 정보를 불러오는 중...</div>;
  }

  // profile(닉네임 포함)이 아직 로딩 중이면 여기서 기다린다.
  // 이걸 기다리지 않으면 이름이 "익명"으로 방에 접속해버리고, 아래
  // RoomView의 useEffect는 [roomCode, userId]에만 반응하므로 이름을
  // 나중에 다시 불러와도 그 판 내내 "익명"으로 고정된다.
  if (!profile) {
    if (profileError) {
      return <div className="text-red-400 text-sm px-4 text-center">{profileError}</div>;
    }
    return <div className="text-white">프로필 정보를 불러오는 중...</div>;
  }

  return (
    <RoomView
      roomCode={roomCode}
      userId={user.id}
      userName={profile.name}
      onLeave={() => {
        // 정상적으로 나가는 경우(로비의 "방 나가기" 버튼, 엔드 스크린의 나가기 포함)에는
        // "이어서 참가하기" 버튼이 더 이상 뜨면 안 되므로 저장된 방 코드를 지운다.
        localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
        setSearchParams({});
      }}
    />
  );
}

function RoomView({
  roomCode,
  userId,
  userName,
  onLeave,
}: {
  roomCode: string;
  userId: string;
  userName: string;
  onLeave: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const gmRef = useRef<GameManager | null>(null);

  const [, tick] = useState(0);
  const [phase, setPhase] = useState<"lobby" | "playing" | "meeting" | "ended">("lobby");
  // 버그 수정: roleRevealDone을 "진짜 게임 시작(lobby→playing)"에만 리셋하기 위해 이전
  // phase를 리렌더와 무관하게 즉시 추적하는 ref. phase state는 비동기로 갱신되므로
  // phase-change 이벤트 핸들러 안에서 직접 참조하면 항상 최신값을 즉시 읽을 수 있다.
  const phaseRef = useRef<"lobby" | "playing" | "meeting" | "ended">("lobby");
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [sabotageMenuOpen, setSabotageMenuOpen] = useState(false);
  const [ventMenu, setVentMenu] = useState<{
    ventId: string;
    from: { x: number; y: number };
    options: { id: string; label: string; x: number; y: number }[];
  } | null>(null);
  const [roleRevealDone, setRoleRevealDone] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [ejectionResult, setEjectionResult] = useState<EjectionResult>(null);
  const [discoveryFlash, setDiscoveryFlash] = useState(false);
  const [gameInstance, setGameInstance] = useState<Phaser.Game | null>(null);
  // 진단용(모바일 검은 화면): 화면에 아무것도 안 그려질 때 "왜" 안 그려지는지 사용자가
  // 개발자도구 없이도 알 수 있도록, 씬 생성/업데이트 상태와 에러를 화면에 직접 보여준다.
  const [gameDiag, setGameDiag] = useState<
    { status: "pending" | "ready" | "error" | "timeout"; message?: string }
  >({ status: "pending" });

  const [isTouch] = useState(isTouchDevice);
  const [isIOSDevice] = useState(isIOS);
  const [isIOSStandaloneMode] = useState(isIOSStandalone);
  const [isPortrait, setIsPortrait] = useState(
    typeof window !== "undefined" ? window.matchMedia("(orientation: portrait)").matches : false
  );
  // 전체화면/가로고정 시도는 브라우저 정책상 "사용자가 직접 탭한 이벤트 핸들러 안"에서
  // 동기적으로 호출해야만 허용된다. phase 변화(Supabase realtime)에 반응해 useEffect에서
  // 호출하면 제스처 컨텍스트를 벗어나 있어 대부분 조용히 거부된다 — 그래서 GameEntryOverlay를
  // 두고 탭 한 번을 직접 받아서 그 안에서 호출한다.
  const [fsEntered, setFsEntered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== "undefined" ? !!document.fullscreenElement : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setIsPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // [4단계] 격렬한 조작 중 실수로 핀치줌이 걸리면 캔버스 레이아웃이 깨지므로, 이 게임
  // 화면이 떠 있는 동안(RoomView가 마운트된 동안)에만 viewport meta에서 확대를 막는다.
  // index.html을 직접 고치지 않는 이유는 그러면 사이트의 다른 페이지(공지사항 등)까지
  // 전부 핀치줌이 막혀 접근성이 떨어지기 때문 — 게임 화면을 벗어나면 원래 값으로 되돌린다.
  useEffect(() => {
    if (!isTouch || typeof document === "undefined") return;
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.getAttribute("content");
    meta.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1, user-scalable=no");
    return () => {
      if (original !== null) meta.setAttribute("content", original);
    };
  }, [isTouch]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // 버그 수정(모바일 검은 화면) 안전장치: Phaser의 Scale.RESIZE 모드는 기본적으로
  // window의 resize 이벤트에 반응하는데, 전체화면 진입/화면 회전 전환 도중에는 일부
  // 모바일 브라우저(특히 인앱 브라우저)가 resize 이벤트를 안 보내거나 실제 레이아웃이
  // 자리잡기 "전"의 크기로 한 번만 보내는 경우가 있다. 그 결과 카메라/안개(fogRT)가
  // 과도기 크기에 맞춰진 채로 굳어버려 화면이 새까맣게 보일 수 있었다.
  // fullscreenchange/orientationchange가 발생한 뒤 레이아웃이 안정될 시간을 조금 두고
  // game.scale.refresh()로 실제 컨테이너 크기를 다시 계산시켜, 자동 resize 이벤트를
  // 놓치더라도 화면이 항상 올바른 크기로 복구되도록 한다.
  useEffect(() => {
    if (typeof document === "undefined" || !isTouch) return;
    const forceRescan = () => {
      window.setTimeout(() => {
        gameRef.current?.scale.refresh();
      }, 150);
    };
    document.addEventListener("fullscreenchange", forceRescan);
    const orientation = screen.orientation as ScreenOrientation | undefined;
    orientation?.addEventListener?.("change", forceRescan);
    window.addEventListener("orientationchange", forceRescan);
    // 탭을 유지한 채 백그라운드로 갔다 돌아왔을 때(iOS 앱 전환, 화면 잠금 등)도 같은 이유로
    // 캔버스/카메라 크기가 과도기 값에 맞춰진 채 굳어 있을 수 있어 재계산을 강제한다.
    // (MainScene.updateFogOfWar()에도 매 프레임 자체 복구 로직을 넣어뒀지만, 카메라 크기
    // 자체는 handleResize 경유로만 갱신되므로 여기서도 한 번 더 깨워준다.)
    document.addEventListener("visibilitychange", forceRescan);
    return () => {
      document.removeEventListener("fullscreenchange", forceRescan);
      orientation?.removeEventListener?.("change", forceRescan);
      window.removeEventListener("orientationchange", forceRescan);
      document.removeEventListener("visibilitychange", forceRescan);
    };
  }, [isTouch]);

  // iOS Safari 전용 보정: 일반 탭(홈 화면 추가 X)에서는 주소창/탭 바를 JS로 완전히 없앨 수
  // 없지만, 세로 스크롤이 조금이라도 가능한 상태에서 scrollTo(0, 1)을 주면 주소창이 접히는
  // 경우가 있다(iOS 버전에 따라 효과가 다를 수 있는 best-effort 트릭). standalone(홈 화면
  // 추가) 모드에서는 애초에 주소창이 없어 필요 없다.
  useEffect(() => {
    if (!isIOSDevice || isIOSStandaloneMode || typeof window === "undefined") return;
    const nudge = () => window.setTimeout(() => window.scrollTo(0, 1), 50);
    nudge();
    window.addEventListener("orientationchange", nudge);
    return () => window.removeEventListener("orientationchange", nudge);
  }, [isIOSDevice, isIOSStandaloneMode]);

  // 로비/종료 화면이 아닌 실제 플레이 중(전체화면 레이어가 뷰포트를 덮는 동안)에는
  // 배경 페이지(body) 스크롤을 잠근다. iOS Safari는 <video> 외 요소에 실제 Fullscreen
  // API를 지원하지 않아 우리가 fixed 레이어로 "가짜 전체화면"을 흉내내는데, body 스크롤을
  // 잠그지 않으면 화면을 드래그할 때 배경 페이지가 러버밴드(고무줄) 바운스를 일으켜
  // 게임 화면이 위아래로 튕기거나 밑에 흰 여백이 보이는 문제가 있었다.
  const isImmersivePhase = phase !== "lobby" && phase !== "ended";
  useEffect(() => {
    if (!isImmersivePhase || typeof document === "undefined") return;
    document.body.classList.add("scroll-lock");
    return () => document.body.classList.remove("scroll-lock");
  }, [isImmersivePhase]);

  // 버그 수정: "전체화면은 되는데 시야가 캐릭터 중심에서 계속 붕 떠서 따로 노는" 문제의
  // 실제 원인 — Phaser 카메라는 내부적으로 캐릭터를 정확히 따라가고 있지만, 사이트에
  // 핀치줌/더블탭줌을 막는 처리가 없어서 조이스틱을 드래그하다 보면 iOS/Android 브라우저가
  // 그 제스처를 "페이지 확대·이동"으로 해석해 뷰포트 자체를 확대/이동시켜 버린다. 그러면
  // 캔버스(게임 화면)는 그대로인데 브라우저가 그 위를 확대해서 보여주는 꼴이라, 카메라는
  // 캐릭터에 붙어있어도 화면에는 캐릭터가 중심을 벗어나 둥둥 떠다니는 것처럼 보인다.
  // 게임 화면에 있는 동안만 뷰포트 확대/이동 자체를 막아서 이 오작동을 근본적으로 차단한다.
  useEffect(() => {
    if (!isImmersivePhase || typeof document === "undefined") return;

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    const prevViewportContent = viewportMeta?.getAttribute("content") ?? null;
    viewportMeta?.setAttribute(
      "content",
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    );

    // Safari는 user-scalable=no를 무시하고도 핀치/제스처 줌을 허용하는 경우가 있어
    // gesturestart(iOS 전용)와 두 손가락 터치를 직접 막아 이중으로 방어한다.
    const preventGesture = (e: Event) => e.preventDefault();
    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("touchmove", preventMultiTouch, { passive: false });

    return () => {
      if (viewportMeta && prevViewportContent !== null) {
        viewportMeta.setAttribute("content", prevViewportContent);
      }
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventMultiTouch);
    };
  }, [isImmersivePhase]);

  /** 전체화면 + 가로 고정 시도. 반드시 사용자 탭 핸들러의 첫 동기 호출로만 실행할 것.
   * 참고: iOS Safari는 <video> 외의 일반 엘리먼트에 대한 Fullscreen API를 아예 지원하지
   * 않고, 카카오톡 등 인앱 브라우저도 정책상 이 API 자체를 막아두는 경우가 많다 — 이런
   * 환경에서는 JS로 강제 전체화면을 켤 방법이 없어 RotateOverlay(가로로 돌려달라는 안내)로
   * 대신한다. 아래 webkit 접두사는 그 외 구형/일부 모바일 브라우저 호환을 위한 폴백이다. */
  const requestFullscreenLandscape = () => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    if (!document.fullscreenElement) {
      const req = el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.();
      Promise.resolve(req).catch(() => {
        // 사용자가 거부했거나 브라우저 정책상 막힘 — 무시하고 계속 진행
      });
    }
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    // iOS Safari는 Screen Orientation Lock 자체를 지원하지 않음(애플 정책) —
    // 이 경우 아래 RotateOverlay가 "직접 돌려주세요" 안내로 대신한다.
    orientation.lock?.("landscape").catch(() => {});
  };

  // 버그 수정: 게임이 끝나도 전체화면/가로고정을 풀어주는 코드가 아예 없어서, 한 번 걸리면
  // 로비로 돌아가거나 게임이 끝난 뒤에도 계속 강제 가로 화면으로 남아있었다.
  // exitFullscreen/orientation.unlock을 호출해 원래(세로) 상태로 되돌리고, fsEntered도
  // 초기화해서 다음에 새로 게임에 들어갈 때 다시 진입 오버레이(탭 → 전체화면 요청)가 뜨게 한다.
  const exitFullscreenAndUnlock = () => {
    const doc = document as Document & {
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (document.fullscreenElement) {
      Promise.resolve(document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.()).catch(() => {});
    }
    const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
    orientation.unlock?.();
    setFsEntered(false);
  };

  useEffect(() => {
    // 재접속(이어하기) 지원: 이 방에 실제로 들어왔다는 것을 로컬에 기록해 둔다.
    // 이후 실수로 나가더라도(뒤로가기/새로고침/탭 종료) 랜딩 화면에서 이 방으로 바로 돌아올 수 있다.
    // "나가기"로 정상 퇴장할 때만 지워진다(onLeave 참고).
    localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, roomCode);

    const gm = new GameManager(roomCode, userId, userName);
    gmRef.current = gm;

    const rerender = () => tick((n) => n + 1);
    gm.on("lobby-update", rerender);
    gm.on("settings-update", rerender);
    gm.on("tasks-update", rerender);
    gm.on("blackout-change", rerender);
    gm.on("reactor-change", rerender);
    gm.on("doorlock-change", rerender);
    gm.on("candle-change", rerender);
    gm.on("pipe-change", rerender);
    gm.on("ability-update", rerender);
    // 6-7: 사망(늑대의 습격/추방)으로 유령이 되는 순간을 즉시 반영해야 화면 필터·사운드가
    // 지연 없이 전환된다 — 지금까지는 이 이벤트를 아무도 구독하지 않아 다른 이벤트가
    // 우연히 겹쳐야만 리렌더링됐다.
    gm.on("player-killed", rerender);
    gm.on("phase-change", (p: string) => {
      // 버그 수정: 기존엔 phase가 "playing"이 될 때마다(=회의가 끝나고 다시 이동 페이즈로
      // 돌아올 때마다) roleRevealDone을 매번 false로 되돌려서, 게임 중간중간 회의가 끝날
      // 때마다 역할 소개 화면이 계속 다시 떴다. 역할 소개는 게임이 "lobby → playing"으로
      // 처음 시작될 때 딱 한 번만 보여줘야 하므로, 그 전 phase가 lobby였을 때만(=진짜 게임
      // 시작 시점에만) 리셋한다.
      if (p === "playing" && phaseRef.current === "lobby") setRoleRevealDone(false);
      phaseRef.current = p as "lobby" | "playing" | "meeting" | "ended";
      setPhase(p as "lobby" | "playing" | "meeting" | "ended");
      if (p === "meeting") playMeetingCall();
    });
    gm.on("meeting-result", (ejectedId: string | null) => {
      playEjectResult(!!ejectedId);
      // 상단 한 줄 배너 대신, 결정적 순간을 화면 전체를 장악하는 시네마틱으로 보여준다(기획안 6-6).
      // players 맵은 게임이 계속 진행되며 바뀔 수 있으므로, 지금 이 순간의 이름/역할을 스냅샷으로 캡처한다.
      if (ejectedId) {
        const p = gm.players.get(ejectedId);
        setEjectionResult(p ? { name: p.name, role: p.role } : "tie");
      } else {
        setEjectionResult("tie");
      }
    });
    gm.on("kill-blocked", () => {
      setBanner("🛡️ 누군가 신비롭게 늑대의 습격에서 살아남았습니다...");
      setTimeout(() => setBanner(null), 4000);
    });
    gm.on("player-revived", (payload: { targetName: string; byName: string }) => {
      setBanner(`🙏 중보 기도의 응답 — ${payload.targetName}님이 다시 살아났습니다!`);
      setTimeout(() => setBanner(null), 4500);
    });

    return () => {
      gm.destroy();
      gameRef.current?.destroy(true);
      gameRef.current = null;
      setGameInstance(null);
      // 방을 나가거나(중간 이탈 포함) 컴포넌트가 사라질 때도 전체화면/가로고정이 남아있으면
      // 안 되므로 함께 풀어준다.
      exitFullscreenAndUnlock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, userId]);

  // 버그 수정: 게임 phase가 "ended"(엔드 스크린)로 바뀌는 순간 전체화면/가로고정을 풀어서
  // 유저가 로비로 돌아가지 않고 엔드 스크린만 보고 있어도 세로 화면으로 돌아오게 한다.
  useEffect(() => {
    if (phase === "ended") exitFullscreenAndUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 버그 수정: "같은 인원으로 다시하기"(returnToLobby)로 phase가 ended → lobby로 돌아오면,
  // 이전 판에서 만들어진 Phaser.Game/MainScene 인스턴스가 그대로 남아있어서 다음 판이
  // 시작돼도(phase → playing) 새 게임 인스턴스를 만드는 조건(!gameRef.current)을 만족하지
  // 못해 화면이 갱신되지 않았다. 로비로 돌아오는 시점에 이전 인스턴스를 완전히 파괴하고
  // 참조를 비워서, 다음 라운드가 시작될 때 방장이 로비에서 바꾼 설정값(시야 등)까지
  // 반영된 새 MainScene이 항상 새로 만들어지게 한다. 라운드별 UI 상태도 함께 초기화한다.
  useEffect(() => {
    if (phase !== "lobby") return;
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
      setGameInstance(null);
    }
    setOpenTaskId(null);
    setSabotageMenuOpen(false);
    setVentMenu(null);
    setBanner(null);
    setEjectionResult(null);
  }, [phase]);

  // 버그 수정(모바일 검은 화면): 터치 기기에서는 GameEntryOverlay를 탭하기 전까지
  // 아직 진짜 전체화면/가로 고정 전환이 시작되지도 않은 "세로 상태의 좁은 뷰포트"다.
  // 예전 코드는 phase가 "playing"이 되자마자(=오버레이가 뜨는 바로 그 순간) 곧바로
  // Phaser.Game을 생성하면서 그 좁은/과도기적인 크기를 초기 캔버스 크기로 굳혀버렸다.
  // Scale.RESIZE가 이후 resize 이벤트로 어느 정도 따라잡긴 하지만, 안개(fogRT)처럼
  // "생성 시점 크기"에 맞춰 한 번만 만들어지는 리소스가 어긋나면서 화면 전체가 어두운
  // 안개로 덮인 채(=사실상 새까만 화면) 복구되지 않는 경우가 있었다.
  // 터치 기기에서는 사용자가 실제로 화면을 탭해 전체화면/가로 전환을 "시도한 뒤"
  // (fsEntered === true) 캔버스를 생성해서, 최대한 최종 레이아웃에 가까운 크기로
  // 시작하도록 한다. 이 시점까지는 GameEntryOverlay가 화면을 덮고 있으므로 사용자가
  // 아직 조작할 수 있는 것도 없어 지연에 따른 손해가 없다.
  const readyToMountGame = phase === "playing" && (!isTouch || fsEntered);

  useEffect(() => {
    if (!readyToMountGame || gameRef.current || !containerRef.current || !gmRef.current) return;
    const gm = gmRef.current;
    // 컨테이너(뷰포트 전체를 채우는 fixed 레이어)의 실제 픽셀 크기를 그대로 초기 캔버스
    // 크기로 사용한다. RESIZE 모드는 이후 크기 변화(회전 등)에도 이 크기를 계속 따라간다.
    const initialWidth = containerRef.current.clientWidth || 800;
    const initialHeight = containerRef.current.clientHeight || 600;
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: initialWidth,
      height: initialHeight,
      parent: containerRef.current,
      scene: [MainScene],
      physics: { default: "arcade", arcade: { debug: false } },
      backgroundColor: "#111827",
      // RESIZE: 캔버스 "해상도" 자체를 화면 실제 크기에 맞춘다.
      // - FIT은 비율을 유지하려고 안쪽으로 맞춰서 여백(레터박스)이 생겼고,
      // - ENVELOP은 화면을 꽉 채우려고 렌더링된 화면 가장자리를 잘라냈다 — 그 결과 카메라가
      //   맵 경계(벽)까지 캐릭터를 따라가면 캐릭터가 "잘린 영역"에 위치하게 되어 화면에서
      //   사라지는 문제가 있었다.
      // RESIZE는 자르거나 여백을 두지 않고 실제 화면 크기 그대로 렌더링하므로 이 문제가 없다.
      // 대신 화면 크기가 바뀔 때마다 MainScene에서 카메라/UI 크기를 직접 갱신해줘야 한다
      // (아래 game.scene와 MainScene의 handleResize 참고).
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width: initialWidth,
        height: initialHeight,
      },
    });
    game.scene.start("MainScene", { gm, isTouch });
    gameRef.current = game;
    setGameInstance(game);
    setGameDiag({ status: "pending" });

    // 진단용: MainScene.create()/update()가 던지는 에러를 화면에 직접 보여준다.
    game.events.on("scene-create-done", () => setGameDiag({ status: "ready" }));
    game.events.on("scene-create-error", (message: string) => setGameDiag({ status: "error", message }));
    game.events.on("scene-update-error", (message: string) =>
      setGameDiag((prev) => (prev.status === "ready" ? { status: "error", message } : prev))
    );
    // create()가 아예 시작도 못 했거나(자산 로딩 실패 등) 이벤트 자체가 안 오는 경우를 대비한
    // 최종 타임아웃 — 몇 초가 지나도 "완료" 신호가 없으면 조용히 멈춰있다는 뜻이므로 알려준다.
    const readyTimeout = window.setTimeout(() => {
      setGameDiag((prev) => (prev.status === "pending" ? { status: "timeout" } : prev));
    }, 6000);
    game.events.once("destroy", () => window.clearTimeout(readyTimeout));

    game.events.on("open-task-modal-request", (taskId: string) => setOpenTaskId(taskId));
    game.events.on("open-sabotage-menu-request", () => setSabotageMenuOpen(true));
    // 6-4: 시신을 처음 발견하는 순간 — MainScene이 근접 감지를 하고, 여기서는 짧은 화면
    // 비네트 연출 + 긴장 스팅어만 재생한다(신고 여부와는 무관하게, 발견 즉시 1회).
    game.events.on("body-discovered", () => {
      playBodyDiscovered();
      setDiscoveryFlash(true);
      setTimeout(() => setDiscoveryFlash(false), 900);
    });
    game.events.on(
      "open-vent-menu-request",
      (payload: {
        ventId: string;
        from: { x: number; y: number };
        options: { id: string; label: string; x: number; y: number }[];
      }) => setVentMenu(payload)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToMountGame]);

  // 정전/보일러실 고장/도어락/촛불 화재/배수관 파열 중 하나라도 활성 상태면 "긴급 상황"으로 본다.
  // gm의 각 change 이벤트가 이미 위쪽 useEffect에서 rerender(tick)를 트리거하고 있으므로
  // 여기서는 매 렌더마다 이 값을 다시 계산하기만 하면 된다(별도 구독 불필요).
  const sabotageUrgent =
    !!gmRef.current &&
    (gmRef.current.blackoutActive ||
      gmRef.current.reactorActive ||
      !!gmRef.current.doorLockRoomId ||
      gmRef.current.candleActive ||
      gmRef.current.pipeActive);

  // 이전 렌더의 sabotageUrgent 값을 기억해뒀다가, false→true(발동)/true→false(해제)로
  // "바뀌는 순간"에만 경고음을 재생한다. useEffect의 deps로 sabotageUrgent 값 자체를 쓰기
  // 때문에 값이 실제로 바뀔 때만 콜백이 실행되지만, ref 비교를 한 번 더 두어 start/end를
  // 명확히 구분한다(리렌더 원인과 무관하게 항상 안전).
  const prevSabotageUrgentRef = useRef(false);
  useEffect(() => {
    if (sabotageUrgent && !prevSabotageUrgentRef.current) {
      playSabotageAlarm("start");
    } else if (!sabotageUrgent && prevSabotageUrgentRef.current) {
      playSabotageAlarm("end");
    }
    prevSabotageUrgentRef.current = sabotageUrgent;
  }, [sabotageUrgent]);

  const closeSabotageMenu = () => {
    setSabotageMenuOpen(false);
    gameRef.current?.events.emit("close-sabotage-menu");
  };

  // 6-7: 유령(사망) 상태 — 화면 필터(그레이스케일+블루 톤)와 사운드 로우패스 필터를 함께 전환한다.
  const isGhost = !!gmRef.current && gmRef.current.me?.alive === false && (phase === "playing" || phase === "meeting");
  const prevGhostRef = useRef(false);
  useEffect(() => {
    if (isGhost !== prevGhostRef.current) {
      setGhostAudioMode(isGhost);
      prevGhostRef.current = isGhost;
    }
  }, [isGhost]);

  const gm = gmRef.current;
  if (!gm) return <div className="text-white">연결 중...</div>;

  // ── 로비 오버레이 (항상 게임 컨테이너 위에 렌더링) ──
  const canStart = gm.isHost && gm.presenceOrder.length >= 3;

  return (
    <>
      {/* [Phase 1] 여러 화면이 공유하는 범용 juice keyframes를 앱 루트에서 한 번만 주입한다. */}
      <JuiceGlobalStyles />
      {/* 게임 컨테이너 — phase 전환 시에도 DOM에서 제거되지 않도록 항상 렌더링한다.
          React가 이 div를 unmount하면 Phaser의 Scale.RESIZE가 부모 크기 0x0을 감지해
          내부 RenderTexture의 프레임버퍼를 0x0으로 만들려다 "Incomplete Attachment" 크래시가 난다.
          visibility: hidden은 레이아웃 크기를 유지한 채 숨기므로 이 문제를 근본적으로 막는다. */}
      <div
        className="game-fullscreen fixed inset-0 z-[100] w-screen h-dvh bg-gray-900"
        style={{ visibility: (phase === 'playing' || phase === 'meeting') ? 'visible' : 'hidden' }}
      >
        {isTouch && !fsEntered && (phase === 'playing' || phase === 'meeting') && (
          <GameEntryOverlay
            showIOSHomeScreenTip={isIOSDevice && !isIOSStandaloneMode}
            onEnter={() => {
              requestFullscreenLandscape();
              setFsEntered(true);
            }}
          />
        )}
        {isTouch && fsEntered && isPortrait && (phase === 'playing' || phase === 'meeting') && <RotateOverlay />}
        {!roleRevealDone && (phase === 'playing' || phase === 'meeting') && <RoleRevealOverlay role={gm.myRole} onDone={() => setRoleRevealDone(true)} />}
        {/* Phaser의 Scale.FIT 모드는 이 부모 요소의 실제 렌더 크기에 맞춰 캔버스를 축소/확대한다.
            부모(위 div)가 항상 뷰포트 전체(fixed inset-0)이므로 이 컨테이너도 항상 w-full h-full로
            꽉 채워야 FIT 계산이 실제 화면 크기와 정확히 일치한다. */}
        <div
          ref={containerRef}
          className="w-full h-full transition-[filter] duration-500 ease-out"
          style={isGhost ? { filter: "grayscale(0.7) sepia(0.15) hue-rotate(175deg) brightness(0.85)" } : undefined}
        />
        {(phase === "playing" || phase === "meeting") &&
          (gameDiag.status === "error" || gameDiag.status === "timeout") && (
            <GameDiagOverlay
              diag={gameDiag}
              isTouch={isTouch}
              isIOSDevice={isIOSDevice}
              fsEntered={fsEntered}
              isFullscreen={isFullscreen}
              isPortrait={isPortrait}
              rendererType={gameRef.current?.renderer.type === Phaser.CANVAS ? "canvas" : "webgl"}
              containerSize={
                containerRef.current
                  ? `${containerRef.current.clientWidth}x${containerRef.current.clientHeight}`
                  : "알 수 없음"
              }
            />
          )}
        {(phase === 'playing' || phase === 'meeting') && (
          <>
            {/* 우상단 HUD 묶음(미션 진행도 / 늑대 쿨다운 / 미니맵)을 한 flex 컨테이너에 모아
                세로로 쌓이게 했다. 예전엔 각자 top/right 값을 따로 하드코딩해서(0.5rem, 5rem 등)
                모바일처럼 카드 높이가 조금만 달라져도 서로 겹쳐버리는 문제가 있었다. */}
            <div
              className="absolute z-40 flex flex-col items-end gap-2"
              style={{
                top: "calc(0.5rem + env(safe-area-inset-top, 0px))",
                right: "calc(0.5rem + env(safe-area-inset-right, 0px))",
              }}
            >
              <HUD gm={gm} />
              <WolfCooldownHUD gm={gm} />
              {phase === "playing" && <MiniMap gm={gm} game={gameInstance} />}
            </div>
            <AbilityPanel gm={gm} />
            {phase === "playing" && <AdminMap gm={gm} />}
            {phase === "playing" && <SecurityCameras gm={gm} />}
            {phase === "playing" && <MissionCompass gm={gm} />}
            <GhostChatPanel gm={gm} />
            {isGhost && <GhostMiniHud gm={gm} />}
            {isTouch && gameInstance && <MobileControls game={gameInstance} />}
            {/* iOS는 Fullscreen API를 지원하지 않아 document.fullscreenElement가 절대 true가 될 수
                없다 — 이 버튼을 보여줘도 눌러봤자 아무 효과가 없어 오히려 "전체화면이 안 된다"는
                인상만 준다. iOS에서는 우리가 이미 CSS(.game-fullscreen)로 화면을 꽉 채우고 있으므로
                버튼 자체를 숨긴다. */}
            {isTouch && !isIOSDevice && fsEntered && !isFullscreen && (
              <button
                onClick={requestFullscreenLandscape}
                style={{
                  top: "calc(0.5rem + env(safe-area-inset-top, 0px))",
                  left: "calc(0.5rem + env(safe-area-inset-left, 0px))",
                }}
                className="absolute z-40 bg-gray-900/80 border border-gray-600 rounded-lg px-2 py-1.5 text-white text-xs cursor-pointer"
              >
                ⛶ 전체화면
              </button>
            )}
            {/* 기존 배너(정전/보일러실/도어락 텍스트)는 그대로 두고, 그 위에 시청각 긴급 연출만 추가한다 */}
            <SabotageAlertOverlay active={sabotageUrgent} />
            {gm.blackoutActive && (
              <>
                {/* 은은한 암전 톤만 화면 전체에 깔고, 안내 문구는 화면을 가리지 않도록
                    왼쪽 옆으로 뺀 작은 배너로 옮겼다(예전엔 텍스트가 화면 정중앙을 꽉 채워
                    정작 자기 캐릭터/길을 볼 수 없었다). */}
                <div className="absolute inset-0 bg-black/35 pointer-events-none" />
                {/* [버그 수정] 이 배너가 미션 나침반(MissionCompass, top: 3rem / left: 0.5rem)과
                    거의 같은 좌상단 자리(top-14 left-2)에 z-40으로 겹쳐 있어서, DOM에서 나침반보다
                    나중에 그려지는 이 불투명(bg-black/90) 박스가 나침반의 빨간 화살표(🌑 기도실 —
                    정전 수리)를 완전히 가려버리고 있었다. 정작 정전이 터졌을 때 기도실 방향을
                    알려주는 화살표가 안 보이던 원인이 이것 — 나침반 아래로 내려서 겹치지 않게 한다. */}
                <div
                  style={{ top: "calc(6.25rem + env(safe-area-inset-top, 0px))" }}
                  className="absolute left-2 z-40 bg-black/90 border border-yellow-500/60 rounded-lg px-3 py-2 text-xs text-yellow-200 text-left pointer-events-none max-w-[180px]"
                >
                  <p className="text-sm font-bold text-yellow-300 mb-1">🌑 어둠의 시험</p>
                  <p className="text-yellow-200/70 mb-1">"빛 되신 주를 붙들라"</p>
                  <p className="mb-1">기도실로 이동해 스페이스바를 연타하세요</p>
                  {/* [버그 수정] 예전엔 진행도를 전혀 보여주지 않아서, 스페이스바를 눌러도
                      실제로 반영되고 있는 건지 알 방법이 없었다 — 반경 밖에 서 있어서 입력이
                      씹히고 있어도 눈치챌 수 없었다. 몇 번 더 눌러야 하는지 숫자로 보여준다. */}
                  <p className="text-emerald-300 font-semibold">
                    합심 기도 {Math.min(gm.blackoutProgress, BLACKOUT_PROGRESS_NEEDED)} / {BLACKOUT_PROGRESS_NEEDED}
                  </p>
                </div>
              </>
            )}
            {gm.reactorActive && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-rose-950/90 border border-rose-500 rounded-lg px-4 py-2 text-xs text-white text-center pointer-events-none">
                <p className="font-bold text-rose-300 mb-1">🔧 보일러실 고장! 두 명이 각자 다른 패널을 고쳐야 합니다</p>
                <p className="text-rose-200/70 mb-1">함께 힘을 모아야 이겨낼 수 있습니다</p>
                <p className="flex gap-4 justify-center">
                  <span className={gm.reactorLeftFixed ? "text-emerald-400" : "text-rose-300"}>
                    왼쪽 패널 {gm.reactorLeftFixed ? "✅ 완료" : "❌ 미수리"}
                  </span>
                  <span className={gm.reactorRightFixed ? "text-emerald-400" : "text-rose-300"}>
                    오른쪽 패널 {gm.reactorRightFixed ? "✅ 완료" : "❌ 미수리"}
                  </span>
                </p>
              </div>
            )}
            {gm.doorLockRoomId && (
              <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-rose-950/90 border border-rose-500 rounded-lg px-4 py-2 text-xs text-white text-center pointer-events-none">
                <p className="font-bold text-rose-300">
                  🔒 닫힌 문 — {ROOMS.find((r) => r.id === gm.doorLockRoomId)?.label ?? "어딘가"}의 문이 잠겼습니다
                </p>
                <p className="text-rose-200/70">다른 길을 찾으세요</p>
              </div>
            )}
            {banner && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-gray-900/95 border border-gray-600 px-4 py-2 rounded-lg text-sm max-w-[90%] text-center">
                {banner}
              </div>
            )}
            {discoveryFlash && (
              // 6-4: 시신을 처음 발견하는 순간의 비네트 — 화면 가장자리가 붉게 조여드는 짧은 임팩트.
              <div
                className="absolute inset-0 pointer-events-none z-40"
                style={{ animation: "body-discovery-vignette 0.9s ease-out" }}
              >
                <style>{`
                  @keyframes body-discovery-vignette {
                    0% { box-shadow: inset 0 0 0 0 rgba(190,18,60,0); }
                    12% { box-shadow: inset 0 0 140px 40px rgba(190,18,60,0.55); }
                    100% { box-shadow: inset 0 0 0 0 rgba(190,18,60,0); }
                  }
                `}</style>
              </div>
            )}
            {openTaskId && (
              <TaskModal
                taskId={openTaskId}
                onComplete={() => {
                  gm.completeTask(openTaskId);
                  setOpenTaskId(null);
                  gameRef.current?.events.emit("close-task-modal");
                }}
                onCancel={() => {
                  setOpenTaskId(null);
                  gameRef.current?.events.emit("close-task-modal");
                }}
              />
            )}
            {phase === "meeting" && <MeetingModal gm={gm} />}
            <EjectionOverlay result={ejectionResult} onDone={() => setEjectionResult(null)} />
            {sabotageMenuOpen && (
              <SabotageMenu
                gm={gm}
                onTrigger={(fn) => {
                  fn();
                  closeSabotageMenu();
                }}
                onCancel={closeSabotageMenu}
              />
            )}
            {ventMenu && (
              <VentMenu
                from={ventMenu.from}
                options={ventMenu.options}
                onSelect={(targetId) => {
                  gameRef.current?.events.emit("vent-select", targetId);
                  setVentMenu(null);
                }}
                onCancel={() => {
                  gameRef.current?.events.emit("close-vent-menu");
                  setVentMenu(null);
                }}
              />
            )}
          </>
        )}
      </div>

      {/* ── 로비 오버레이: 게임 컨테이너 위에 z-[110]으로 얹어 렌더링 ── */}
      {phase === "lobby" && (
        // 버그 수정(모바일 UI 잘림/겹침): 예전엔 "flex items-center justify-center"뿐이라 스크롤이
        // 안 됐다 — 게임 설정 패널을 펼치거나(슬라이더 여러 개) 꾸미기 패널을 펼치면(모자/펫 그리드)
        // 세로로 짧은 모바일 화면에서는 내용이 뷰포트보다 길어지는데, 넘친 위/아래 부분이 화면
        // 밖으로 밀려나면서 "게임 시작" 버튼까지 눌리지 않는 경우가 있었다. 바깥 레이어를 스크롤
        // 컨테이너로, 안쪽 wrapper를 중앙 정렬 담당으로 분리해 내용이 길어져도 스크롤로 전부 볼 수 있게 한다.
        <div className="fixed inset-0 z-[110] overflow-y-auto bg-gray-900">
          <div className="min-h-full flex items-center justify-center p-4">
          <div className="text-white flex flex-col items-center gap-5 bg-gray-800 rounded-2xl p-8 w-full max-w-md my-auto">
            <div className="text-center">
              <p className="text-sm text-gray-400">방 코드</p>
              <p className="text-3xl font-black tracking-[0.3em] text-indigo-300">{roomCode}</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed text-center border-t border-b border-gray-700/60 py-3">
              {WORLD_CONCEPT}
            </p>
            <div className="w-full bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-2">참가자 ({gm.presenceOrder.length}명, 최소 3명 필요)</p>
              <div className="space-y-1.5">
                {gm.presenceOrder.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span>{i === 0 ? "👑" : "🙋"}</span>
                    <span>{p.name}</span>
                    {p.id === userId && <span className="text-xs text-gray-500">(나)</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">8명 이상이면 목자·선지자·거짓 선지자가 등장해요.</p>
            </div>
            <GameSettingsPanel gm={gm} />
            <CosmeticPanel gm={gm} />
            {gm.isHost ? (
              <button
                onClick={() => gm.startGame()}
                disabled={!canStart}
                className="w-full py-3 rounded-lg font-medium cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 bg-indigo-600 hover:bg-indigo-500"
              >
                {canStart ? "게임 시작" : "최소 3명 이상 모여야 시작할 수 있어요"}
              </button>
            ) : (
              <p className="text-sm text-gray-400">방장이 게임을 시작하길 기다리는 중...</p>
            )}
            <button onClick={onLeave} className="text-xs text-gray-500 hover:text-gray-300 cursor-pointer">
              방 나가기
            </button>
          </div>
          </div>
        </div>
      )}

      {/* ── 엔드 스크린 오버레이 ── */}
      {phase === "ended" && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900">
          <EndScreen gm={gm} onExit={onLeave} />
        </div>
      )}
    </>
  );
}

/** B키로 열리는 사보타지 선택 메뉴. 메인(5종 선택) / 도어락 방 선택 2단계 뷰. */
function SabotageMenu({
  gm,
  onTrigger,
  onCancel,
}: {
  gm: GameManager;
  onTrigger: (fn: () => void) => void;
  onCancel: () => void;
}) {
  const [view, setView] = useState<"main" | "door">("main");
  const now = Date.now();

  return (
    // 버그 수정(모바일 UI 잘림): 바깥 레이어에 스크롤 수단이 없어 방 목록(도어락 뷰)이 길어지면
    // 화면 밖으로 밀려나 잘렸다. Shell(TaskModal.tsx)과 동일한 패턴 — 바깥은 스크롤 컨테이너,
    // 안쪽 wrapper가 중앙 정렬을 맡는다.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md text-white my-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">🐺 사보타지</h3>
            <button
              onClick={view === "door" ? () => setView("main") : onCancel}
              className="text-gray-400 hover:text-white text-sm cursor-pointer"
            >
              {view === "door" ? "← 뒤로" : "취소"}
            </button>
          </div>

          {view === "main" && (
            <div className="space-y-2">
              <button
                disabled={!gm.canSabotage(now)}
                onClick={() => onTrigger(() => gm.triggerBlackout())}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-rose-700/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <p className="font-medium">🌑 어둠의 시험 (정전)</p>
                <p className="text-xs text-gray-400">기도실에서 다 같이 스페이스바를 연타해야 해결됩니다.</p>
              </button>
              <button
                disabled={!gm.canReactorSabotage(now)}
                onClick={() => onTrigger(() => gm.triggerReactorSabotage())}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-rose-700/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <p className="font-medium">🔧 보일러실 고장</p>
                <p className="text-xs text-gray-400">
                  양 진영 2명이 각각 다른 패널로 가야 고칠 수 있어요. 제한 시간 내 못 고치면 늑대 승리!
                </p>
              </button>
              <button
                disabled={!gm.canDoorSabotage(now)}
                onClick={() => setView("door")}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-rose-700/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <p className="font-medium">🔒 닫힌 문 (도어락)</p>
                <p className="text-xs text-gray-400">특정 방의 문을 잠가 양들을 가둡니다.</p>
              </button>
              <button
                disabled={!gm.canCandleSabotage(now)}
                onClick={() => onTrigger(() => gm.triggerCandleSabotage())}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-rose-700/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <p className="font-medium">🕯️ 촛불 화재</p>
                <p className="text-xs text-gray-400">
                  지도 곳곳 4곳 중 랜덤으로 2곳에 불이 붙어요. 양 진영 2명이 흩어져 각자 스페이스바를 연타로
                  꺼야 합니다. 제한 시간 내 못 끄면 늑대 승리!
                </p>
              </button>
              <button
                disabled={!gm.canPipeSabotage(now)}
                onClick={() => onTrigger(() => gm.triggerPipeSabotage())}
                className="w-full text-left px-3 py-2.5 rounded-lg bg-gray-800 hover:bg-rose-700/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <p className="font-medium">🚰 배수관 파열</p>
                <p className="text-xs text-gray-400">
                  양 진영 2명이 주방 2와 도서실 밸브를 동시에 잠가야 해요. 제한 시간 내 못 잠그면 늑대 승리!
                </p>
              </button>
            </div>
          )}

          {view === "door" && (
            <div className="space-y-1.5">
              {LOCKABLE_ROOM_IDS.map((roomId) => {
                const room = ROOMS.find((r) => r.id === roomId);
                if (!room) return null;
                return (
                  <button
                    key={roomId}
                    onClick={() => onTrigger(() => gm.triggerDoorLock(roomId))}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-rose-700/60 cursor-pointer"
                  >
                    {room.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * V키로 갈림길 벤트(출구 2개 이상)에 들어갔을 때, 어느 벤트로 나갈지 고르는 메뉴.
 * 예전엔 목적지 이름만 나열한 텍스트 목록이었는데, 벤트 개수가 늘면서 방 이름만
 * 보고는 실제로 어느 쪽으로 이동하는지 감이 잘 안 왔다. 지금은 출발 벤트(from) 기준
 * 각 목적지의 실제 맵 좌표로 각도를 계산해 화살표를 그 방향으로 회전시켜 보여준다
 * — 화살표를 누르면 바로 그 방향의 벤트로 이동한다.
 */
function VentMenu({
  from,
  options,
  onSelect,
  onCancel,
}: {
  from: { x: number; y: number };
  options: { id: string; label: string; x: number; y: number }[];
  onSelect: (targetId: string) => void;
  onCancel: () => void;
}) {
  return (
    // 버그 수정(모바일 UI 잘림): 벤트 출구가 많은 방에서는 목록이 길어질 수 있어 같은 패턴으로 스크롤 가능하게 함.
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-teal-600/60 rounded-2xl p-6 w-full max-w-sm text-white my-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">💨 환풍구 — 어디로 나갈까요?</h3>
            <button onClick={onCancel} className="text-gray-400 hover:text-white text-sm cursor-pointer">
              취소
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {options.map((o) => {
              // 화면 좌표계는 y가 아래로 증가 → atan2(dy, dx) 그대로가 화면상 방향과 맞는다.
              // 화살표 아이콘은 기본값이 "오른쪽(0°)"을 가리키게 그려서 회전값을 그대로 적용한다.
              const angleDeg = (Math.atan2(o.y - from.y, o.x - from.x) * 180) / Math.PI;
              return (
                <button
                  key={o.id}
                  onClick={() => onSelect(o.id)}
                  className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl bg-gray-800 hover:bg-teal-700/60 border border-teal-500/20 active:scale-95 transition-transform cursor-pointer"
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    style={{ transform: `rotate(${angleDeg}deg)` }}
                    className="text-teal-300 shrink-0"
                  >
                    <path
                      d="M3 12h14M12 5l7 7-7 7"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                  <span className="text-xs text-center leading-tight">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 터치 기기에서 플레이 화면에 처음 진입했을 때 뜨는 탭 유도 오버레이.
 * 전체화면/가로고정 API는 반드시 "사용자 탭 이벤트 안"에서 직접 호출해야 브라우저가 허용하므로,
 * 이 화면의 onClick이 그 유일한 진입점 역할을 한다.
 */
function GameEntryOverlay({
  onEnter,
  showIOSHomeScreenTip,
}: {
  onEnter: () => void;
  showIOSHomeScreenTip: boolean;
}) {
  return (
    <button
      onClick={onEnter}
      className="fixed inset-0 z-[110] bg-gray-950 flex flex-col items-center justify-center gap-4 text-white px-8 cursor-pointer"
    >
      <div className="text-5xl">🐑</div>
      <p className="text-lg font-bold text-center">화면을 터치해서 시작하기</p>
      <p className="text-sm text-gray-400 text-center">
        전체화면 · 가로 모드로 전환을 시도해요.
        <br />
        기기에 따라 자동으로 안 되면 직접 돌려주세요.
      </p>
      {showIOSHomeScreenTip && (
        // iOS Safari는 정책상 일반 탭에서 주소창/탭 바를 없애는 게 불가능하다 — 그 UI까지
        // 완전히 없는 진짜 전체화면을 원하면 "홈 화면에 추가"로 여는 게 유일한 방법이라 안내한다.
        <p className="text-xs text-indigo-300/80 text-center max-w-xs leading-relaxed">
          공유 버튼(
          <span aria-hidden>⎋</span>
          )에서 "홈 화면에 추가"를 하면 주소창 없이 더 꽉 찬 화면으로 즐길 수 있어요.
        </p>
      )}
    </button>
  );
}

/**
 * 진단용 오버레이: 게임 화면이 새까맣게 나올 때(=MainScene이 그려지지 않을 때) 원인을
 * 개발자도구 없이도 화면에서 바로 확인할 수 있게 보여준다. 실제 발생 시 이 화면을
 * 캡처해서 개발자에게 보내면 원인을 훨씬 빨리 찾을 수 있다.
 */
function GameDiagOverlay({
  diag,
  isTouch,
  isIOSDevice,
  fsEntered,
  isFullscreen,
  isPortrait,
  rendererType,
  containerSize,
}: {
  diag: { status: "pending" | "ready" | "error" | "timeout"; message?: string };
  isTouch: boolean;
  isIOSDevice: boolean;
  fsEntered: boolean;
  isFullscreen: boolean;
  isPortrait: boolean;
  rendererType: string;
  containerSize: string;
}) {
  return (
    <div className="absolute inset-0 z-[105] bg-gray-950/97 flex flex-col items-center justify-center gap-3 text-white px-6 text-center overflow-y-auto py-6">
      <div className="text-4xl">🐑💥</div>
      <p className="text-lg font-bold">
        {diag.status === "error" ? "게임 화면을 그리는 중 오류가 발생했어요" : "게임 화면 로딩이 너무 오래 걸려요"}
      </p>
      <p className="text-xs text-gray-400 max-w-xs">
        이 화면을 그대로 캡처해서 보내주시면 원인을 빠르게 찾을 수 있어요.
      </p>
      <div className="bg-gray-900 border border-rose-500/50 rounded-lg p-3 text-left text-[11px] leading-relaxed w-full max-w-sm space-y-1">
        <p className="text-rose-300 font-semibold">status: {diag.status}</p>
        {diag.message && <p className="text-rose-200 break-all">message: {diag.message}</p>}
        <p>isTouch: {String(isTouch)}</p>
        <p>isIOSDevice: {String(isIOSDevice)}</p>
        <p>fsEntered: {String(fsEntered)}</p>
        <p>isFullscreen: {String(isFullscreen)}</p>
        <p>isPortrait: {String(isPortrait)}</p>
        <p>renderer: {rendererType}</p>
        <p>containerSize: {containerSize}</p>
        <p>userAgent: {typeof navigator !== "undefined" ? navigator.userAgent : "?"}</p>
      </div>
    </div>
  );
}

/** 탭 후에도 세로 방향인 기기(주로 iOS)에게 직접 회전을 안내하는 오버레이 */
function RotateOverlay() {
  return (
    <div className="fixed inset-0 z-[100] bg-gray-950 flex flex-col items-center justify-center gap-4 text-white px-8">
      <div className="text-5xl animate-bounce">📱</div>
      <p className="text-lg font-bold text-center">화면을 가로로 돌려주세요</p>
      <p className="text-sm text-gray-400 text-center">
        이 게임은 가로 모드에서 플레이하도록 만들어졌어요.
        <br />
        휴대폰을 옆으로 돌리면 자동으로 시작됩니다.
      </p>
    </div>
  );
}

/**
 * 사보타지(정전/보일러실 고장/도어락) 발동 중에 화면 테두리를 붉게 맥박(pulse)시키는 오버레이.
 * Phaser 캔버스 내부가 아니라 캔버스 바깥의 순수 DOM 위에 CSS로 얹는 방식을 택했다 —
 * 씬 렌더 루프와 무관하게 독립적으로 애니메이션되어 구현이 간단하고, 캔버스 좌표계도 건드리지 않는다.
 * inset box-shadow를 keyframe으로 흔들어 "화면 안쪽에서 경고색이 번쩍인다"는 느낌을 낸다.
 */
function SabotageAlertOverlay({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <>
      <style>{`
        @keyframes sabotage-alert-pulse {
          0%, 100% { box-shadow: inset 0 0 70px 12px rgba(220, 38, 38, 0.6), inset 0 0 20px 4px rgba(250, 204, 21, 0.35); }
          50% { box-shadow: inset 0 0 130px 34px rgba(220, 38, 38, 0.15), inset 0 0 20px 4px rgba(250, 204, 21, 0.1); }
        }
      `}</style>
      <div
        className="absolute inset-0 z-40 pointer-events-none"
        style={{ animation: "sabotage-alert-pulse 1.1s ease-in-out infinite" }}
      />
      <MaskIcon
        src={ICONS.warning}
        color="#facc15"
        className="absolute top-3 left-1/2 -translate-x-1/2 z-40 w-6 h-6 pointer-events-none"
        style={{ animation: "sabotage-alert-pulse 1.1s ease-in-out infinite" }}
      />
    </>
  );
}

function RoleRevealOverlay({ role, onDone }: { role: Role; onDone: () => void }) {
  const info = ROLE_INFO[role];
  const verse = ROLE_VERSE[role];
  // 버그 수정(모바일 UI 잘림): 매 라운드 시작마다 뜨는 화면인데, 강제 가로 모드(세로 폭이
  // 짧은) 화면에서는 이모지+제목+말씀+설명+버튼을 다 쌓으면 뷰포트보다 세로로 길어질 수 있었다.
  // 예전에는 flex-col justify-center로 "가운데 정렬 + 스크롤 불가"였던 탓에, 넘친 만큼 위아래가
  // 그대로 화면 밖으로 잘려서 특히 "시작할게요" 버튼 자체가 안 보이는 경우까지 있었다.
  // 바깥 레이어는 스크롤 컨테이너로 두고, 안쪽 wrapper(min-h-full)가 중앙 정렬을 맡도록 분리한다.
  return (
    <div className="absolute inset-0 z-50 overflow-y-auto bg-black/95 text-white">
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-8">
        <p className="text-6xl mb-4">{info.emoji}</p>
        <h2 className="text-2xl font-bold mb-2 text-center">{info.title}</h2>
        <p className="text-sm text-yellow-200/80 italic text-center mb-1">"{verse.verse}"</p>
        <p className="text-xs text-gray-500 text-center mb-4">— {verse.ref}</p>
        <p className="text-sm text-gray-400 max-w-xs text-center mb-6">{info.desc}</p>
        <button
          onClick={onDone}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-medium cursor-pointer"
        >
          확인했어요, 시작할게요
        </button>
      </div>
    </div>
  );
}

function HUD({ gm }: { gm: GameManager }) {
  // [수정] 팀 전체(all-player) 진행도는 "다들 자기 몫을 하고 있는지"를 유추할 수 있는
  // 단서가 되어 임포스터/시민 정체가 간접적으로 드러나는 문제가 있었다. 그래서 전체
  // 게이지는 완전히 없애고, 내게 배정된 미션만 기준으로 한 개인 진행도만 보여준다.
  const myTotal = gm.myTaskSpots.length;
  const myCompleted = gm.myTaskSpots.filter((t) => gm.myCompletedTasks.has(t.id)).length;
  const progress = myTotal > 0 ? Math.min(1, myCompleted / myTotal) : 0;
  // [Phase 1] 진행률이 "실제로 늘어난 순간"에만 막대를 밝게 반짝여서(FLASH_FX),
  // 내가 방금 미션을 끝냈다는 게 화면에 바로 반영됐다는 확신을 준다. 값이 그대로거나
  // 줄어들 때(재접속 등)는 반짝이지 않는다.
  const prevProgressRef = useRef(progress);
  const [justFilled, setJustFilled] = useState(false);
  useEffect(() => {
    if (progress > prevProgressRef.current) {
      setJustFilled(true);
      const t = window.setTimeout(() => setJustFilled(false), 400);
      prevProgressRef.current = progress;
      return () => window.clearTimeout(t);
    }
    prevProgressRef.current = progress;
  }, [progress]);

  return (
    <div className="bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white w-[min(11rem,45vw)]">
      <div className="flex justify-between mb-1">
        <span>내 미션 진행도</span>
        {myTotal > 0 ? (
          <span className={justFilled ? "text-emerald-300 font-semibold" : undefined}>
            {Math.round(progress * 100)}%
          </span>
        ) : (
          <span className="text-gray-500">배정 없음</span>
        )}
      </div>
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full bg-emerald-500 transition-[width] duration-500 ease-out ${justFilled ? FLASH_FX : ""}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="mt-2 text-gray-400">
        생존: {gm.alivePlayers.length} / {gm.players.size}
      </p>
    </div>
  );
}

/** 6-7: 유령 전용 미니 HUD — 산 사람들의 화면(HUD)과 겹치지 않도록 하단에 고정하고,
 * 유령이 궁금해할 두 가지(팀 전체 잔여 미션, 진영별 생존자 수)만 담백하게 보여준다. */
function GhostMiniHud({ gm }: { gm: GameManager }) {
  const remainingTasks = Math.max(0, gm.totalTasksRequired - gm.totalTasksCompleted);
  const aliveSheep = gm.alivePlayers.filter((p) => isSheepFaction(p.role)).length;
  const aliveWolves = gm.alivePlayers.filter((p) => isWolfFaction(p.role)).length;
  return (
    <div
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      className="absolute left-1/2 -translate-x-1/2 bg-indigo-950/90 border border-indigo-400/40 rounded-lg px-4 py-1.5 text-xs text-indigo-100 flex items-center gap-3 pointer-events-none"
    >
      <span>👻 유령 관전 중</span>
      <span className="text-indigo-300/60">|</span>
      <span>📋 잔여 미션 {remainingTasks}개</span>
      <span className="text-indigo-300/60">|</span>
      <span>🐑 {aliveSheep}</span>
      <span>🐺 {aliveWolves}</span>
    </div>
  );
}

/**
 * [Phase 1 - 6-2] 쿨다운 하나(처치 또는 사보타지)를 원형 게이지 + 잔여 초 텍스트로 표시.
 * 기존에는 라벨 + 채워지는 막대(bar) 형태였는데, AbilityPanel의 "준비됨" 펄스 연출과
 * 스타일이 어긋나 있었다. 여기서는 원형 진행 링(테두리 색 = 진영 컬러)을 채워가다가
 * 다 차면 링 전체가 READY_PULSE_FX로 은은하게 맥동해 "지금 눌러도 된다"를 같은 문법으로
 * 전달하도록 AbilityPanel과 시각 언어를 통일했다.
 */
function CooldownGauge({
  label,
  icon,
  remainingMs,
  totalMs,
  color,
}: {
  label: string;
  icon: string;
  remainingMs: number;
  totalMs: number;
  color: string;
}) {
  const ready = remainingMs <= 0;
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / totalMs)) : 1;
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct);
  return (
    <div className="flex flex-col items-center gap-1 w-16">
      <div className={`relative w-11 h-11 ${ready ? READY_PULSE_FX : ""} rounded-full`}>
        <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" stroke="#374151" strokeWidth="4" />
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.25s linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm leading-none">{icon}</div>
      </div>
      <span className={`text-[10px] leading-none ${ready ? "text-emerald-400 font-medium" : "text-gray-400"}`}>
        {ready ? "준비됨" : `${Math.ceil(remainingMs / 1000)}초`}
      </span>
      <span className="text-[9px] text-gray-500 leading-none text-center">{label}</span>
    </div>
  );
}

/**
 * 유령(사망자) 전용 채팅 패널. 살아있는 플레이어에게는 절대 렌더링되지 않는다 —
 * gm.me.alive가 false인 경우에만 이 컴포넌트가 반환값을 만들어낸다.
 * 회의 중이 아니어도(플레이 화면 전체에서) 항상 떠 있어서, 죽은 사람들끼리
 * 자유롭게 잡담하거나 정보를 주고받을 수 있게 한다 — 산 사람들의 게임에는 영향 없음.
 */
function GhostChatPanel({ gm }: { gm: GameManager }) {
  const [, forceUpdate] = useState(0);
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onUpdate = () => forceUpdate((n) => n + 1);
    gm.on("ghost-chat-update", onUpdate);
    return () => {
      gm.off("ghost-chat-update", onUpdate);
    };
  }, [gm]);

  useEffect(() => {
    if (!open) return;
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [gm.ghostChatLog.length, open]);

  if (gm.me?.alive !== false) return null;

  const send = () => {
    if (!input.trim()) return;
    gm.sendGhostChat(input.trim());
    setInput("");
  };

  return (
    <div
      style={{
        bottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))",
        left: "calc(0.5rem + env(safe-area-inset-left, 0px))",
      }}
      className="absolute z-40 w-[min(16rem,92vw)] bg-gray-900/95 border border-indigo-500/50 rounded-lg text-white text-xs overflow-hidden"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-indigo-950/60 cursor-pointer"
      >
        <span className="font-semibold">👻 유령 채팅 (나만 볼 수 있어요)</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <>
          <div ref={logRef} className="h-32 overflow-y-auto px-3 py-2 space-y-1 bg-gray-900/80">
            {gm.ghostChatLog.length === 0 && <p className="text-gray-500">아직 대화가 없습니다...</p>}
            {gm.ghostChatLog.map((m) => (
              <p key={m.id}>
                <span className="text-indigo-300 font-semibold">{m.senderName}: </span>
                <span>{m.text}</span>
              </p>
            ))}
          </div>
          <div className="flex gap-1 p-2 border-t border-gray-700">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="유령끼리만 보여요..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 outline-none focus:border-indigo-400"
            />
            <button onClick={send} className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 rounded cursor-pointer">
              전송
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** 늑대 진영 전용: 처치/사보타지 쿨다운을 실시간으로 보여준다. 250ms마다 강제 리렌더해서 초 단위로 갱신. */
function WolfCooldownHUD({ gm }: { gm: GameManager }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  if (!gm.me?.alive || !isWolfFaction(gm.myRole)) return null;

  const now = Date.now();
  const killRemaining = Math.max(0, gm.killCooldownUntil - now);
  const sabotageRemaining = Math.max(0, gm.sabotageCooldownUntil - now);

  return (
    <div className="bg-gray-900/90 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white flex gap-3">
      <CooldownGauge
        label="처치"
        icon="🗡️"
        remainingMs={killRemaining}
        totalMs={gm.settings.killCooldownMs}
        color="#f43f5e"
      />
      <CooldownGauge
        label="사보타지"
        icon="💣"
        remainingMs={sabotageRemaining}
        totalMs={gm.settings.sabotageCooldownMs}
        color="#f59e0b"
      />
    </div>
  );
}

/**
 * 양 진영(양/목자/선지자/거짓 선지자/중보자) 전용: 내 남은 미션 목록 + 지금 향해야 할
 * 지점을 가리키는 화살표.
 * - 평소엔 아직 완료하지 못한 미션 중 가장 가까운 곳(또는 목록에서 직접 고른 곳)을 가리킨다.
 * - 정전/보일러실 고장/촛불 화재/배수관 파열 사보타지가 터지면 우선순위가 바뀌어, 그걸
 *   해결할 위치(기도실/패널/촛불/밸브)를 빨간 화살표로 가리킨다 — 굳이 목록에서 안 골라도 자동으로 전환된다.
 * 내 좌표(gm.me.x/y)는 MainScene이 실시간으로 갱신하는 값이라, MiniMap과 동일하게
 * 별도 이벤트 구독 없이 일정 주기로 다시 그려주기만 하면 충분하다.
 */
function MissionCompass({ gm }: { gm: GameManager }) {
  const [, tick] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 300);
    return () => clearInterval(id);
  }, []);

  // [수정] 사보타지가 발생했을 때 늑대(임포스터) 진영도 해결 지점을 화살표로 안내받고
  // 직접 고칠 수 있도록, 양 진영 전용이던 나침반을 사보타지가 진행 중일 때는 늑대에게도
  // 보여준다. 평소(사보타지가 없을 때)엔 늑대는 돌아야 할 개인 미션이 없으므로 그대로
  // 나침반을 숨긴다 — 유령이 된 뒤에도 남은 미션을 계속 수행할 수 있도록 살아있을 때만
  // 보이던 조건은 이미 빠져 있다.
  const isWolf = isWolfFaction(gm.myRole);
  const sabotageActive = gm.blackoutActive || gm.reactorActive || gm.candleActive || gm.pipeActive;
  if (isWolf && !sabotageActive) return null;

  const px = gm.me.x;
  const py = gm.me.y;
  const remainingTasks = isWolf ? [] : gm.myTaskSpots.filter((t) => !gm.myCompletedTasks.has(t.id));

  let target: { x: number; y: number; label: string } | null = null;
  let urgent = false;
  // [수정] 보일러실/촛불/배수관 사보타지는 시간 안에 못 고치면 늑대 승리로 끝나는데도
  // 남은 시간이 양과 임포스터 모두에게 전혀 보이지 않았다. 각 분기에서 endsAt을 채워두고
  // 아래에서 카운트다운으로 함께 표시한다. 늑대 승리로 이어지지 않는 정전은 대상이 아니다.
  let deadlineEndsAt: number | null = null;

  if (gm.blackoutActive) {
    target = { x: PRAYER_ROOM.x, y: PRAYER_ROOM.y, label: `🌑 ${PRAYER_ROOM.label} — 정전 수리` };
    urgent = true;
  } else if (gm.reactorActive) {
    const leftOpen = !gm.reactorLeftFixed;
    const rightOpen = !gm.reactorRightFixed;
    if (leftOpen && rightOpen) {
      const dl = Math.hypot(REACTOR_PANELS.left.x - px, REACTOR_PANELS.left.y - py);
      const dr = Math.hypot(REACTOR_PANELS.right.x - px, REACTOR_PANELS.right.y - py);
      target = dl <= dr
        ? { x: REACTOR_PANELS.left.x, y: REACTOR_PANELS.left.y, label: `🔧 ${REACTOR_PANELS.left.label} — 보일러실 수리` }
        : { x: REACTOR_PANELS.right.x, y: REACTOR_PANELS.right.y, label: `🔧 ${REACTOR_PANELS.right.label} — 보일러실 수리` };
    } else if (leftOpen) {
      target = { x: REACTOR_PANELS.left.x, y: REACTOR_PANELS.left.y, label: `🔧 ${REACTOR_PANELS.left.label} — 보일러실 수리` };
    } else if (rightOpen) {
      target = { x: REACTOR_PANELS.right.x, y: REACTOR_PANELS.right.y, label: `🔧 ${REACTOR_PANELS.right.label} — 보일러실 수리` };
    }
    urgent = true;
    deadlineEndsAt = gm.reactorEndsAt;
  } else if (gm.candleActive) {
    const idA = gm.candleSpotIds[0];
    const idB = gm.candleSpotIds[1];
    const spotA = CANDLE_SPOTS[idA];
    const spotB = CANDLE_SPOTS[idB];
    const aOpen = !gm.candleAFixed;
    const bOpen = !gm.candleBFixed;
    if (aOpen && bOpen) {
      const da = Math.hypot(spotA.x - px, spotA.y - py);
      const db = Math.hypot(spotB.x - px, spotB.y - py);
      target = da <= db
        ? { x: spotA.x, y: spotA.y, label: `🕯️ ${spotA.label} — 촛불 진화 (${gm.candleAProgress}/${CANDLE_PRESSES_NEEDED})` }
        : { x: spotB.x, y: spotB.y, label: `🕯️ ${spotB.label} — 촛불 진화 (${gm.candleBProgress}/${CANDLE_PRESSES_NEEDED})` };
    } else if (aOpen) {
      target = { x: spotA.x, y: spotA.y, label: `🕯️ ${spotA.label} — 촛불 진화 (${gm.candleAProgress}/${CANDLE_PRESSES_NEEDED})` };
    } else if (bOpen) {
      target = { x: spotB.x, y: spotB.y, label: `🕯️ ${spotB.label} — 촛불 진화 (${gm.candleBProgress}/${CANDLE_PRESSES_NEEDED})` };
    }
    urgent = true;
    deadlineEndsAt = gm.candleEndsAt;
  } else if (gm.pipeActive) {
    const aOpen = !gm.pipeAFixed;
    const bOpen = !gm.pipeBFixed;
    if (aOpen && bOpen) {
      const da = Math.hypot(PIPE_PANELS.a.x - px, PIPE_PANELS.a.y - py);
      const db = Math.hypot(PIPE_PANELS.b.x - px, PIPE_PANELS.b.y - py);
      target = da <= db
        ? { x: PIPE_PANELS.a.x, y: PIPE_PANELS.a.y, label: `🚰 ${PIPE_PANELS.a.label} — 배수관 수리` }
        : { x: PIPE_PANELS.b.x, y: PIPE_PANELS.b.y, label: `🚰 ${PIPE_PANELS.b.label} — 배수관 수리` };
    } else if (aOpen) {
      target = { x: PIPE_PANELS.a.x, y: PIPE_PANELS.a.y, label: `🚰 ${PIPE_PANELS.a.label} — 배수관 수리` };
    } else if (bOpen) {
      target = { x: PIPE_PANELS.b.x, y: PIPE_PANELS.b.y, label: `🚰 ${PIPE_PANELS.b.label} — 배수관 수리` };
    }
    urgent = true;
    deadlineEndsAt = gm.pipeEndsAt;
  } else {
    const selected = selectedTaskId ? remainingTasks.find((t) => t.id === selectedTaskId) : undefined;
    const chosen =
      selected ??
      remainingTasks.reduce<typeof remainingTasks[number] | undefined>((best, t) => {
        const d = Math.hypot(t.x - px, t.y - py);
        const bestD = best ? Math.hypot(best.x - px, best.y - py) : Infinity;
        return d < bestD ? t : best;
      }, undefined);
    if (chosen) target = { x: chosen.x, y: chosen.y, label: `📍 ${chosen.label}` };
  }

  const angleDeg = target ? (Math.atan2(target.y - py, target.x - px) * 180) / Math.PI : 0;
  const remainingSec = deadlineEndsAt !== null ? Math.max(0, Math.ceil((deadlineEndsAt - Date.now()) / 1000)) : null;

  return (
    <div
      style={{
        // 좌상단 고정: 터치 기기의 전체화면 버튼(같은 좌상단, calc(0.5rem + safe-area))과
        // 겹치지 않도록 그보다 조금 아래에서 시작한다.
        top: "calc(3rem + env(safe-area-inset-top, 0px))",
        left: "calc(0.5rem + env(safe-area-inset-left, 0px))",
      }}
      className="absolute z-40 flex flex-col items-start gap-1 w-[min(14rem,92vw)]"
    >
      <button
        onClick={() => setExpanded((e) => (isWolf ? false : !e))}
        className={`flex items-center gap-2 bg-gray-900/90 border rounded-lg px-2 py-1.5 text-white text-xs ${
          isWolf ? "cursor-default" : "cursor-pointer"
        } ${urgent ? "border-rose-500" : "border-gray-700"}`}
      >
        {target ? (
          <span
            className={`inline-block text-lg leading-none ${urgent ? "text-rose-400" : "text-yellow-300"}`}
            style={{ transform: `rotate(${angleDeg}deg)`, transition: "transform 0.15s linear" }}
          >
            ➤
          </span>
        ) : (
          <span className="text-lg leading-none text-emerald-400">✅</span>
        )}
        <span className="truncate">{target ? target.label : "모든 미션 완료!"}</span>
        {remainingSec !== null && (
          <span className="shrink-0 font-mono text-rose-300 font-bold">⏱ {remainingSec}s</span>
        )}
        {!isWolf && <span className="text-gray-500">{expanded ? "▴" : "▾"}</span>}
      </button>
      {!isWolf && expanded && (
        <div className="bg-gray-900/95 border border-gray-700 rounded-lg p-2 w-full text-white text-xs max-h-64 overflow-y-auto">
          <p className="font-bold text-yellow-300 mb-1">📋 내 미션 ({remainingTasks.length}개 남음)</p>
          {remainingTasks.length === 0 ? (
            <p className="text-gray-500">모든 미션을 완료했습니다!</p>
          ) : (
            <div className="space-y-1">
              {remainingTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`w-full text-left px-2 py-1 rounded cursor-pointer ${
                    selectedTaskId === t.id ? "bg-indigo-700/60" : "bg-gray-800 hover:bg-gray-700"
                  }`}
                >
                  {t.label} <span className="text-gray-500">({t.zone})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
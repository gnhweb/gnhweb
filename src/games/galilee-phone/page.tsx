import { useEffect, useRef, useState } from "react";
import { GameOrientationGuard } from "@/components/base/GameOrientationGuard";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { GameManager } from "./GameManager";
import { LobbyPanel } from "./LobbyPanel";
import { WritingPanel } from "./WritingPanel";
import { CanvasBoard } from "./CanvasBoard";
import { GalleryReveal } from "./GalleryReveal";
import { AwardsCeremony } from "./AwardsCeremony";

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function GalileePhone() {
  return (
    <GameOrientationGuard orientation="portrait">
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 py-10 px-4">
        <h1 className="text-white text-2xl font-bold mb-1">🕊️ 갈릴리폰</h1>
        <p className="text-gray-400 text-sm mb-4">말이 그림 되고, 그림이 말씀 되고</p>
        <GalileePhoneGame />
      </div>
    </GameOrientationGuard>
  );
}

function GalileePhoneGame() {
  const { user, profile, profileError } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const roomCode = searchParams.get("room") || "";
  const [joinInput, setJoinInput] = useState("");

  if (!roomCode) {
    return (
      <div className="text-white flex flex-col items-center gap-4 bg-gray-800 rounded-2xl p-8 w-[90%] max-w-sm">
        <button
          onClick={() => setSearchParams({ room: randomRoomCode() })}
          className="w-full py-3 bg-amber-700 hover:bg-amber-600 rounded-lg cursor-pointer font-medium"
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
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center tracking-widest outline-none focus:border-amber-400"
          />
          <button
            onClick={() => {
              if (joinInput.trim()) setSearchParams({ room: joinInput.trim() });
            }}
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
      onLeave={() => setSearchParams({})}
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
  const gmRef = useRef<GameManager | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const gm = new GameManager(roomCode, userId, userName);
    gmRef.current = gm;
    const rerender = () => tick((n) => n + 1);
    gm.on("lobby-update", rerender);
    gm.on("phase-change", rerender);
    return () => gm.destroy();
  }, [roomCode, userId, userName]);

  const gm = gmRef.current;
  if (!gm) return <div className="text-white">방에 접속하는 중...</div>;

  if (gm.phase === "lobby") {
    return <LobbyPanel gm={gm} onLeave={onLeave} />;
  }

  if (gm.phase === "prompt" || gm.phase === "guessing") {
    return <WritingPanel gm={gm} />;
  }

  if (gm.phase === "drawing") {
    return <CanvasBoard gm={gm} />;
  }

  if (gm.phase === "reveal") {
    return <GalleryReveal gm={gm} />;
  }

  if (gm.phase === "awards") {
    return <AwardsCeremony gm={gm} onLeave={onLeave} />;
  }

  return (
    <div className="text-white bg-gray-800 rounded-2xl p-8 w-[90%] max-w-sm text-center">
      <p className="text-sm text-gray-300">현재 단계: {gm.phase}</p>
    </div>
  );
}
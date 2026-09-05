import { GameOrientationGuard } from "@/components/base/GameOrientationGuard";
import { PhariseeGame } from "@/games/pharisee/GameView";

export default function Pharisee() {
  return (
    <GameOrientationGuard orientation="portrait">
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 py-10">
        <h1 className="text-white text-2xl font-bold mb-1">바리새인을 찾아라</h1>
        <p className="text-gray-400 text-sm mb-4">마피아를 성경버전으로 즐겨보세요!</p>
        <PhariseeGame />
      </div>
    </GameOrientationGuard>
  );
}
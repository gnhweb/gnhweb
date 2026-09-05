import { GameOrientationGuard } from "@/components/base/GameOrientationGuard";
import { PhaserGame } from "@/games/wolves-and-sheep/PhaserGame";

export default function WolvesAndSheep() {
  return (
    <GameOrientationGuard orientation="landscape">
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900">
        <h1 className="text-white text-2xl font-bold mb-4">양과 늑대: 거짓 선지자를 찾아라!</h1>
        <PhaserGame />
      </div>
    </GameOrientationGuard>
  );
}
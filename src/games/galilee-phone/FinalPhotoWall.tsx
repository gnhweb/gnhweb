import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GameManager } from "./GameManager";
import { ChainEntry } from "./types";

/**
 * 시상식 결과 화면 맨 마지막에 붙는 "오늘의 모든 그림" 사진 벽.
 * 이번 판에서 나온 모든 체인의 그림(드로잉) 항목을 전부 모아 그리드로 한 번에 보여준다.
 * 탭하면 확대해서 크게 볼 수 있다.
 */
export function FinalPhotoWall({ gm }: { gm: GameManager }) {
  const [zoomed, setZoomed] = useState<{ entry: ChainEntry; chainIdx: number } | null>(null);
  const photos = gm.allRevealedDrawings;

  if (photos.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-xl p-3 border border-gray-700 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-300 text-center">🖼️ 오늘의 모든 그림 ({photos.length}장)</p>
      <div className="grid grid-cols-3 gap-2">
        {photos.map(({ chain, entry }, i) => (
          <button
            key={`${chain.id}-${entry.turnIndex}`}
            onClick={() => setZoomed({ entry, chainIdx: i })}
            className="rounded-lg overflow-hidden border border-gray-700 bg-white cursor-pointer aspect-square"
          >
            <img
              src={entry.content}
              alt={`${entry.authorName}님의 그림`}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 text-center">사진을 탭하면 크게 볼 수 있어요</p>

      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
            onClick={() => setZoomed(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full flex flex-col gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="rounded-xl overflow-hidden border border-gray-700 bg-white">
                <img src={zoomed.entry.content} alt={`${zoomed.entry.authorName}님의 그림`} className="w-full h-auto" />
              </div>
              <p className="text-center text-sm text-gray-300">🎨 {zoomed.entry.authorName}님의 그림</p>
              <button
                onClick={() => setZoomed(null)}
                className="mx-auto mt-1 px-4 py-1.5 rounded-full bg-gray-700 hover:bg-gray-600 text-xs cursor-pointer"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
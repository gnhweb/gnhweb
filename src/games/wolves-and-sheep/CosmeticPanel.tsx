import { useEffect, useState } from "react";
import { GameManager } from "./GameManger";
import {
  CosmeticDef,
  HAT_CATALOG,
  PET_CATALOG,
  isUnlocked,
  loadCosmeticStats,
  unlockLabel,
  unlockProgress,
} from "./cosmetics";
import { Icon, ICONS, MaskIcon } from "./icons";
import { PRESS_FX, POP_IN_STYLE } from "./uiFeedback";
import { playUiClick, playPanelToggle } from "./soundManager";
import { CosmeticPreviewStage } from "./CosmeticPreviewStage";

/**
 * 로비에서 모자/펫을 미리보고 장착하는 패널. GameSettingsPanel과 같은 접이식 카드 스타일을 따른다.
 * 해금 기준(cosmetics.ts)을 못 채운 항목은 자물쇠로 흐리게 표시하고 클릭해도 장착되지 않는다.
 * 장착한 코스메틱은 gm.setEquipped()를 거쳐 presence로 방 전체에 알려지고,
 * 게임이 시작되면 game_start 페이로드에 실려 다른 사람 화면에도 같은 모자/펫으로 보인다.
 */
export function CosmeticPanel({ gm }: { gm: GameManager }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"hat" | "pet">("hat");
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const onUpdate = () => forceUpdate((n) => n + 1);
    gm.on("lobby-update", onUpdate);
    return () => {
      gm.off("lobby-update", onUpdate);
    };
  }, [gm]);

  const stats = loadCosmeticStats();
  const catalog = tab === "hat" ? HAT_CATALOG : PET_CATALOG;
  const equippedId = tab === "hat" ? gm.myEquipped.hat : gm.myEquipped.pet;

  const equip = (def: CosmeticDef) => {
    if (!isUnlocked(def.unlock, stats)) return;
    playUiClick();
    const next = { ...gm.myEquipped };
    if (tab === "hat") next.hat = def.id === "none" ? null : def.id;
    else next.pet = def.id === "none" ? null : def.id;
    gm.setEquipped(next);
  };

  const toggleOpen = () => {
    playPanelToggle(!open);
    setOpen((o) => !o);
  };

  return (
    <div className="w-full bg-gray-900 rounded-xl overflow-hidden">
      <button
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between px-4 py-3 text-xs text-gray-300 cursor-pointer ${PRESS_FX}`}
      >
        <span className="font-semibold">🎩 꾸미기 (모자·펫)</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={POP_IN_STYLE}>
          {/* 6-1: 실시간 회전·걷기 미리보기 스테이지 — 지금 장착한 모자/펫이 실제로
              어떻게 보이는지 아이콘만으로는 알기 어려워서 추가했다. */}
          <CosmeticPreviewStage id={gm.userId} cosmetics={{ hat: gm.myEquipped.hat, pet: gm.myEquipped.pet }} />
          <div className="flex gap-2">
            <button
              onClick={() => {
                playUiClick();
                setTab("hat");
              }}
              className={`flex-1 py-1.5 text-[11px] rounded-lg cursor-pointer ${PRESS_FX} ${
                tab === "hat" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400"
              }`}
            >
              모자
            </button>
            <button
              onClick={() => {
                playUiClick();
                setTab("pet");
              }}
              className={`flex-1 py-1.5 text-[11px] rounded-lg cursor-pointer ${PRESS_FX} ${
                tab === "pet" ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400"
              }`}
            >
              펫
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {catalog.map((def) => {
              const unlocked = isUnlocked(def.unlock, stats);
              const progress = unlockProgress(def.unlock, stats);
              const isEquipped = (equippedId ?? "none") === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => equip(def)}
                  disabled={!unlocked}
                  title={unlocked ? def.name : `${def.name} — ${unlockLabel(def.unlock)}`}
                  className={`relative aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 cursor-pointer ${PRESS_FX}
                    ${isEquipped ? "bg-indigo-600 ring-2 ring-indigo-300" : "bg-gray-800"}
                    ${unlocked ? "" : "opacity-40 cursor-not-allowed"}`}
                >
                  <span className="text-lg leading-none">{def.emoji}</span>
                  <span className="text-[9px] text-gray-300 leading-tight text-center px-0.5">{def.name}</span>
                  {isEquipped && unlocked && (
                    <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Icon src={ICONS.checkmark} className="w-2 h-2" />
                    </span>
                  )}
                  {!unlocked && (
                    <MaskIcon src={ICONS.locked} color="#9ca3af" className="absolute top-1 right-1 w-2.5 h-2.5" />
                  )}
                  {!unlocked && progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700 rounded-b-lg overflow-hidden">
                      <div className="h-full bg-indigo-400" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500">
            누적 미션 {stats.tasksCompleted}회 · 게임 {stats.gamesPlayed}판 · 승리 {stats.gamesWon}회로 새 아이템이
            풀려요.
          </p>
        </div>
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { GameManager } from "./GameManger";
import { GAME_SETTINGS_FIELDS, GameSettings, DEFAULT_GAME_SETTINGS, GameSettingFieldDef } from "./types";
import { Icon, ICONS } from "./icons";
import { PRESS_FX, POP_IN_STYLE } from "./uiFeedback";
import { playUiClick, playPanelToggle } from "./soundManager";

function formatValue(field: GameSettingFieldDef, rawValue: number) {
  if (field.unit === "s") return `${Math.round(rawValue / 1000)}초`;
  if (field.unit === "px") return `${rawValue}px`;
  // "count" 단위는 대부분 "OO회"(횟수)지만, 미션 개수는 횟수가 아니라 종류 수이므로 따로 표기한다.
  if (field.key === "taskPoolSize") return `${rawValue}개`;
  return rawValue === 0 ? "없음" : `${rawValue}회`;
}

function toSliderValue(field: GameSettingFieldDef, rawValue: number) {
  return field.unit === "s" ? Math.round(rawValue / 1000) : rawValue;
}

function toRawValue(field: GameSettingFieldDef, sliderValue: number) {
  return field.unit === "s" ? sliderValue * 1000 : sliderValue;
}

/**
 * 어몽어스처럼 방장이 로비에서 킬 쿨다운/투표 시간/사보타지/시야 등 게임 요소값을 조절하는 패널.
 * 방장에게는 슬라이더가, 참가자에게는 방장이 정한 현재 값이 읽기 전용으로 보인다.
 * 값이 바뀌면 GameManager가 방 전체에 브로드캐스트하므로 이 컴포넌트는 gm.settings를
 * 그대로 읽기만 하고, "settings-update" 이벤트가 오면 리렌더한다.
 */
export function GameSettingsPanel({ gm }: { gm: GameManager }) {
  const [, forceUpdate] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onUpdate = () => forceUpdate((n) => n + 1);
    const onLobby = () => forceUpdate((n) => n + 1);
    gm.on("settings-update", onUpdate);
    gm.on("lobby-update", onLobby);
    return () => {
      gm.off("settings-update", onUpdate);
      gm.off("lobby-update", onLobby);
    };
  }, [gm]);

  const isHost = gm.isHost;

  const setField = (field: GameSettingFieldDef, sliderValue: number) => {
    gm.updateSettings({ [field.key]: toRawValue(field, sliderValue) } as Partial<GameSettings>);
  };

  const resetDefaults = () => {
    playUiClick();
    gm.updateSettings(DEFAULT_GAME_SETTINGS);
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
        <span className="font-semibold inline-flex items-center gap-1.5">
          <Icon
            src={ICONS.gear}
            className="w-3.5 h-3.5 opacity-90"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.25s ease-out" }}
          />
          게임 설정{!isHost ? " (방장만 변경 가능)" : ""}
        </span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3" style={POP_IN_STYLE}>
          {GAME_SETTINGS_FIELDS.map((field) => {
            const rawValue = gm.settings[field.key];
            const sliderValue = toSliderValue(field, rawValue);
            return (
              <div key={field.key}>
                <div className="flex justify-between items-baseline text-xs mb-1">
                  <span className="text-gray-300">{field.label}</span>
                  <span className="text-indigo-300 font-semibold">{formatValue(field, rawValue)}</span>
                </div>
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={sliderValue}
                  disabled={!isHost}
                  onChange={(e) => setField(field, Number(e.target.value))}
                  className="w-full accent-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-0.5">{field.desc}</p>
              </div>
            );
          })}
          {isHost && (
            <button
              onClick={resetDefaults}
              className="w-full py-1.5 text-xs rounded-lg bg-gray-800 hover:bg-gray-700 cursor-pointer text-gray-300"
            >
              기본값으로 초기화
            </button>
          )}
        </div>
      )}
    </div>
  );
}
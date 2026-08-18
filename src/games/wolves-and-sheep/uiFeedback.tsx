/**
 * Phase 1 "인터랙션 피드백 표준화(Juice Layer)" 공용 유틸.
 *
 * 지금까지는 컴포넌트마다(MeetingModal, EndScreen, TaskModal ...) 각자 <style> 태그로
 * keyframes를 따로 선언해왔다. 그 패턴 자체는 "파일 하나로 완결된다"는 장점이 있어 유지하되,
 * 여러 화면에서 반복되는 범용 연출(버튼 눌림, 팝인, 값 증가 플래시, 준비완료 펄스)만
 * 이 파일 하나로 모아 중복을 줄이고 톤을 통일한다.
 *
 * 사용법:
 *  - 버튼/클릭 요소에는 className에 PRESS_FX를 그대로 추가한다.
 *  - 앱 루트(PhaserGame.tsx)에서 <JuiceGlobalStyles /> 를 한 번만 마운트한다.
 */

/** 모든 클릭형 요소에 공통으로 붙이는 눌림 피드백. 어몽어스식 "눌렀다"는 확신을
 *  0.1초 스케일 축소로 즉시 전달한다. 기존에 파일마다 제각각이던
 *  "active:scale-95 transition-transform"류 클래스를 이 상수로 표준화한다. */
export const PRESS_FX = "active:scale-95 transition-transform duration-100 ease-out";

/** 값이 막 갱신된 요소(진행률 바 등)에 짧게 붙였다 떼는 강조 플래시 클래스. */
export const FLASH_FX = "juice-flash";

/** 새로 나타나는 패널/카드에 붙이는 표준 팝인 애니메이션 스타일 객체. */
export const POP_IN_STYLE = { animation: "juice-pop-in 0.18s ease-out" } as const;

/** 준비 완료(쿨다운 종료 등) 상태를 부드러운 펄스로 강조할 때 쓰는 클래스. */
export const READY_PULSE_FX = "juice-ready-pulse";

export function JuiceGlobalStyles() {
  return (
    <style>{`
      @keyframes juice-pop-in {
        from { opacity: 0; transform: scale(0.94) translateY(4px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes juice-flash {
        0% { filter: brightness(1); }
        35% { filter: brightness(1.7); }
        100% { filter: brightness(1); }
      }
      .juice-flash { animation: juice-flash 0.4s ease-out; }
      @keyframes juice-ready-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.5); }
        50% { box-shadow: 0 0 0 6px rgba(52,211,153,0); }
      }
      .juice-ready-pulse { animation: juice-ready-pulse 1.6s ease-out infinite; }
    `}</style>
  );
}

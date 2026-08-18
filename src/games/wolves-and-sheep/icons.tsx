/**
 * Kenney "Game icons" 팩(CC0, kenney.nl)에서 가져온 벡터 아이콘.
 * 흰색 단색 PNG라 다크 테마 배경 위에 바로 쓸 수 있고, 필요하면 CSS mask로 색을 입힌다.
 *
 * 파일을 프로젝트에 직접 업로드하지 않고 공개 CC0 미러(GitHub)의 raw URL을 그대로 참조한다.
 * (Readdy 등 이미지 파일 업로드 창구가 마땅치 않은 환경에서도 코드만 붙여넣으면 바로 동작하도록)
 * 출처: https://github.com/ETdoFresh/kenney.nl (CC0 1.0 Universal — 상업적 이용 무료, 크레딧 표기 불필요)
 * 원본: https://kenney.nl/assets/game-icons
 */
import type { CSSProperties } from "react";

const KENNEY_BASE =
  "https://raw.githubusercontent.com/ETdoFresh/kenney.nl/45df48c4d45f8716216b1a9e22df0b69cd9f5932/gameicons/PNG/White/1x";

export const ICONS = {
  gear: `${KENNEY_BASE}/gear.png`,
  locked: `${KENNEY_BASE}/locked.png`,
  unlocked: `${KENNEY_BASE}/unlocked.png`,
  checkmark: `${KENNEY_BASE}/checkmark.png`,
  cross: `${KENNEY_BASE}/cross.png`,
  warning: `${KENNEY_BASE}/warning.png`,
  star: `${KENNEY_BASE}/star.png`,
  door: `${KENNEY_BASE}/door.png`,
};

/** 단색(흰색) 아이콘을 원하는 색으로 정확히 칠해서 보여준다 (CSS mask 방식 — hue-rotate 근사치가 아니라 정확한 색). */
export function MaskIcon({
  src,
  color,
  className,
  style,
}: {
  src: string;
  color: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{
        display: "inline-block",
        backgroundColor: color,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
    />
  );
}

export function Icon({
  src,
  className,
  style,
  alt = "",
}: {
  src: string;
  className?: string;
  style?: CSSProperties;
  alt?: string;
}) {
  return <img src={src} alt={alt} draggable={false} className={className} style={style} />;
}

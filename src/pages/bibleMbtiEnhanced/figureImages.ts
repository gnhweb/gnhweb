// Bible MBTI portraits: each result uses the supplied storybook-style character art.
// The result-page layout is unchanged; this file only swaps the portrait source.
const order = ['다니엘','요셉','룻','바나바','베드로','느헤미야','에스더','디모데','다윗','마리아','아브라함','모세','여호수아','사무엘','엘리야','이사야','예레미야','바울','요한','마르다'] as const;

const spriteUrl = '/bible-mbti/figure-portraits.webp';
const cols = 5;
const cellWidth = 80;
const cellHeight = 63;

const makePortrait = (index: number) => {
  const x = -(index % cols) * cellWidth;
  const y = -Math.floor(index / cols) * cellHeight;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cellWidth} ${cellHeight}"><image href="${spriteUrl}" x="${x}" y="${y}" width="${cols * cellWidth}" height="${4 * cellHeight}" preserveAspectRatio="none"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const figureImagePaths: Record<string, string> = Object.fromEntries(
  order.map((name, index) => [name, makePortrait(index)]),
);

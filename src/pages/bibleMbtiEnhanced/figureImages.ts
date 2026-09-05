type FigureStyle = { bg: string; robe: string; hair: string; prop: string };

const styles: Record<string, FigureStyle> = {
  '다니엘': { bg: '#e8eef7', robe: '#6d839e', hair: '#3f302b', prop: 'lion' },
  '요셉': { bg: '#f2d6a6', robe: '#d3a13b', hair: '#4a3328', prop: 'grain' },
  '룻': { bg: '#f2e8fb', robe: '#8b6aa8', hair: '#4b3026', prop: 'grain' },
  '바나바': { bg: '#e9f1f8', robe: '#4e8d73', hair: '#4a332b', prop: 'hand' },
  '베드로': { bg: '#ffebe6', robe: '#b85f4d', hair: '#40302b', prop: 'net' },
  '느헤미야': { bg: '#e7eef9', robe: '#667e9f', hair: '#40302d', prop: 'wall' },
  '에스더': { bg: '#fbe7f3', robe: '#b15b8e', hair: '#402b25', prop: 'crown' },
  '디모데': { bg: '#e6f3f7', robe: '#587e94', hair: '#523a2c', prop: 'book' },
  '다윗': { bg: '#b7d9b5', robe: '#4e8b73', hair: '#4a3025', prop: 'harp' },
  '마리아': { bg: '#edf3f9', robe: '#6688a8', hair: '#5a3d31', prop: 'heart' },
  '아브라함': { bg: '#f7eadc', robe: '#b27b4c', hair: '#4a3329', prop: 'staff' },
  '모세': { bg: '#b9def0', robe: '#c86b52', hair: '#4d392f', prop: 'tablet' },
  '여호수아': { bg: '#cfe6f5', robe: '#557f9e', hair: '#493027', prop: 'shield' },
  '사무엘': { bg: '#f7eadc', robe: '#ae7951', hair: '#4c352b', prop: 'lamp' },
  '엘리야': { bg: '#f5e8df', robe: '#8a5b3f', hair: '#3c2e29', prop: 'flame' },
  '이사야': { bg: '#e7f0f8', robe: '#54758f', hair: '#4a342b', prop: 'scroll' },
  '예레미야': { bg: '#eeeaf0', robe: '#7b5c57', hair: '#49362e', prop: 'tear' },
  '바울': { bg: '#eaf3e4', robe: '#6b7f59', hair: '#3e302a', prop: 'scroll' },
  '요한': { bg: '#e6f2f8', robe: '#527d9a', hair: '#49352d', prop: 'scroll' },
  '마르다': { bg: '#fae8e8', robe: '#b06b68', hair: '#4b3028', prop: 'jar' },
};

const propSvg: Record<string, string> = {
  tablet: '<rect x="0" y="0" width="25" height="31" rx="3" fill="#d9bb7c"/><path d="M7 9h11M7 15h11M7 21h8"/>',
  staff: '<path d="M8 32V4q0-7 6-7t6 7"/>',
  shield: '<path d="M2 2h28v22q-14 10-28 0Z" fill="#d9b45f"/><path d="M16 2v24M5 10h22"/>',
  harp: '<path d="M4 4q24 8 22 27H20Q20 14 4 10Z"/><path d="M8 11v17M14 13v14M20 15v11"/>',
  grain: '<path d="M14 31V4"/><path d="M14 11Q5 9 6 3Q13 3 14 11M14 18Q23 16 22 10Q15 10 14 18M14 24Q5 22 6 16Q13 16 14 24"/>',
  crown: '<path d="M2 24L5 5l11 10L27 5l3 19Z" fill="#e2b84f"/><path d="M4 29h25"/>',
  lion: '<circle cx="15" cy="16" r="12" fill="#c68b52"/><circle cx="11" cy="14" r="2"/><circle cx="19" cy="14" r="2"/><path d="M11 21q4 3 8 0"/>',
  scroll: '<path d="M5 4h22v26H5z" fill="#e3c98e"/><path d="M9 10h14M9 16h12M9 22h9"/>',
  net: '<path d="M2 5l28 25M30 5L2 30M2 17h28M16 3v29"/>',
  wall: '<path d="M2 30V8h28v22Z" fill="#c69d72"/><path d="M2 14h28M2 22h28M10 8v6M22 8v6M7 14v8M17 14v8M27 14v8"/>',
  book: '<path d="M3 5q8-5 13 0v25q-5-5-13 0Z" fill="#c89b62"/><path d="M29 5q-8-5-13 0v25q5-5 13 0Z" fill="#b68151"/>',
  hand: '<path d="M15 29V11q0-3 3-3t3 3v7M21 18v-7q0-3 3-3t3 3v11M15 17v-6q0-3-3-3t-3 3v9M9 20l-5-4q-3-2-4 1l9 10h12"/>',
  heart: '<path d="M16 29S2 21 2 11C2 5 10 3 16 10c6-7 14-5 14 1 0 10-14 18-14 18Z" fill="#d76b67"/>',
  flame: '<path d="M16 31Q4 25 8 15q2-5 6-9 0 7 6 9 4-7 1-13 12 9 7 20-4 7-12 9Z" fill="#e18a42"/>',
  tear: '<path d="M16 3Q5 16 8 23q2 7 8 7t8-7Q27 16 16 3Z" fill="#7db5d4"/>',
  lamp: '<path d="M9 4h14l4 7H5Z" fill="#e2bb66"/><path d="M9 11h14v17H9Z" fill="#d39b4c"/>',
  jar: '<path d="M8 6h16l3 7-3 17H8L5 13Z" fill="#c58b65"/><path d="M10 4h12v5H10Z"/>',
};

function makePortrait({ bg, robe, hair, prop }: FigureStyle): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect x="6" y="6" width="188" height="188" rx="28" fill="${bg}"/>
<circle cx="34" cy="32" r="18" fill="#fff2bf" opacity=".9"/>
<path d="M8 120Q55 80 104 116T194 108V194H8Z" fill="#86a96c"/>
<path d="M8 151Q54 130 96 151T194 144V194H8Z" fill="#6f9460"/>
<ellipse cx="100" cy="178" rx="47" ry="10" fill="#536b54" opacity=".22"/>
<path d="M64 180Q67 132 100 127Q133 132 136 180Z" fill="${robe}"/>
<path d="M72 146Q55 158 51 177M128 146Q145 158 149 177" fill="none" stroke="${robe}" stroke-width="16" stroke-linecap="round"/>
<circle cx="100" cy="94" r="39" fill="#e0ad80"/>
<path d="M62 94Q64 52 100 48Q137 52 138 95Q126 73 101 73Q77 74 62 94Z" fill="${hair}"/>
<path d="M66 100Q72 126 100 132Q128 126 134 100Q122 113 100 113Q78 113 66 100Z" fill="${hair}" opacity=".88"/>
<ellipse cx="85" cy="94" rx="5" ry="7" fill="#4b3428"/><ellipse cx="115" cy="94" rx="5" ry="7" fill="#4b3428"/>
<circle cx="83.5" cy="92" r="1.8" fill="#fff"/><circle cx="113.5" cy="92" r="1.8" fill="#fff"/>
<path d="M90 110Q100 116 110 110" fill="none" stroke="#8a5138" stroke-width="3" stroke-linecap="round"/>
<g transform="translate(138 62)" fill="none" stroke="#8c5b35" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${propSvg[prop]}</g>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const figureImagePaths: Record<string, string> = Object.fromEntries(
  Object.entries(styles).map(([name, style]) => [name, makePortrait(style)]),
);

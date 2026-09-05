type FigureStyle = { bg: string; hill1: string; hill2: string; robe: string; hair: string; prop: string; female?: boolean };

const styles: Record<string, FigureStyle> = {
  '다니엘': { bg: '#9fc7d9', hill1: '#7d9f68', hill2: '#6f8f5e', robe: '#6d7d9b', hair: '#4b3025', prop: 'lion' },
  '요셉': { bg: '#f4d69c', hill1: '#9dbb72', hill2: '#78985e', robe: '#d9a33b', hair: '#4b3025', prop: 'grain' },
  '룻': { bg: '#e7d9bf', hill1: '#a9bd78', hill2: '#7e9d63', robe: '#8e7099', hair: '#4b3025', prop: 'grain', female: true },
  '바나바': { bg: '#b9d7e4', hill1: '#89aa6d', hill2: '#6e9259', robe: '#5c8d73', hair: '#4a3028', prop: 'hand' },
  '베드로': { bg: '#f1c5ad', hill1: '#91ad6b', hill2: '#6f8e58', robe: '#b95d4e', hair: '#3f2d26', prop: 'net' },
  '느헤미야': { bg: '#c7d9e8', hill1: '#8ca66b', hill2: '#6d8d58', robe: '#637e9e', hair: '#3f3028', prop: 'wall' },
  '에스더': { bg: '#e8d0dc', hill1: '#9bb46e', hill2: '#718d59', robe: '#a8588a', hair: '#432c27', prop: 'crown', female: true },
  '디모데': { bg: '#bcd8e4', hill1: '#88a96b', hill2: '#6f915b', robe: '#587e94', hair: '#4b342a', prop: 'book' },
  '다윗': { bg: '#9fc8a2', hill1: '#7d9e63', hill2: '#638a55', robe: '#4e8b73', hair: '#4a3025', prop: 'harp' },
  '마리아': { bg: '#b8d2df', hill1: '#8ea96c', hill2: '#6f8e58', robe: '#6788a8', hair: '#5a3d31', prop: 'heart', female: true },
  '아브라함': { bg: '#e7cda9', hill1: '#9cad6d', hill2: '#708c58', robe: '#a77a4d', hair: '#4a3328', prop: 'staff' },
  '모세': { bg: '#acd3df', hill1: '#8fae6d', hill2: '#6e8f58', robe: '#c65e4c', hair: '#4b382f', prop: 'tablet' },
  '여호수아': { bg: '#b8d9e7', hill1: '#8eaa6c', hill2: '#6f9058', robe: '#557d9d', hair: '#443027', prop: 'shield' },
  '사무엘': { bg: '#e5cfb1', hill1: '#a2b772', hill2: '#78945c', robe: '#a87350', hair: '#4c352b', prop: 'lamp' },
  '엘리야': { bg: '#d7c2a7', hill1: '#92aa6b', hill2: '#718e58', robe: '#875a3e', hair: '#3c2e29', prop: 'flame' },
  '이사야': { bg: '#bcd5e2', hill1: '#8ba96c', hill2: '#6e8d58', robe: '#54758f', hair: '#4a342b', prop: 'scroll' },
  '예레미야': { bg: '#c8d4d1', hill1: '#8da86c', hill2: '#6d8c58', robe: '#765a55', hair: '#49362e', prop: 'tear' },
  '바울': { bg: '#c5d9c2', hill1: '#8fa96c', hill2: '#6f8e58', robe: '#667b57', hair: '#3e302a', prop: 'scroll' },
  '요한': { bg: '#b9d5e1', hill1: '#8ba86b', hill2: '#6e8d58', robe: '#527d9a', hair: '#49352d', prop: 'scroll' },
  '마르다': { bg: '#ead0c6', hill1: '#9aad6c', hill2: '#738f59', robe: '#b06a68', hair: '#4b3028', prop: 'jar', female: true },
};

const propSvg: Record<string, string> = {
  tablet: '<rect x="0" y="0" width="28" height="34" rx="4" fill="#d7bd83" stroke="#9d7d49" stroke-width="2"/><path d="M6 9h16M6 16h16M6 23h12"/>',
  staff: '<path d="M18 38V8q0-9 8-9t8 9"/>',
  shield: '<path d="M2 2h36v30q-18 14-36 0Z" fill="#d9b45f" stroke="#8d6b3e" stroke-width="2"/><path d="M20 2v31M6 13h28"/>',
  harp: '<path d="M3 4q31 9 28 36H20Q21 17 3 10Z" fill="#9d6739"/><path d="M8 12v28M16 15v25M24 18v22" stroke="#e9c17b" stroke-width="2"/>',
  grain: '<path d="M18 38V5"/><path d="M18 12Q4 8 6 1Q16 2 18 12M18 22Q32 18 30 11Q20 12 18 22M18 31Q4 27 6 20Q16 21 18 31" fill="#d7b45f"/>',
  crown: '<path d="M2 30l4-25 14 14L31 2l7 28Z" fill="#e1b84f" stroke="#a67932" stroke-width="2"/><path d="M4 35h34"/>',
  lion: '<circle cx="20" cy="20" r="15" fill="#d89b5a"/><circle cx="15" cy="18" r="3"/><circle cx="25" cy="18" r="3"/><path d="M15 27q5 4 10 0" fill="none" stroke="#70462f" stroke-width="2.5"/>',
  scroll: '<path d="M5 3h30v35H5Z" fill="#e4c98f" stroke="#9d7b4a" stroke-width="2"/><path d="M11 11h18M11 18h16M11 25h13"/>',
  net: '<path d="M2 4l36 34M38 4L2 38M2 17h36M20 3v35"/>',
  wall: '<path d="M2 38V7h36v31Z" fill="#c99e6c"/><path d="M2 16h36M2 27h36M12 7v9M27 7v9M8 16v11M20 16v11M32 16v11"/>',
  book: '<path d="M3 6q10-6 17 1v31q-8-6-17 0Z" fill="#b98756"/><path d="M37 6q-10-6-17 1v31q8-6 17 0Z" fill="#a8754c"/><path d="M8 15h10M8 22h10M27 15h10M27 22h10" stroke="#f1dfb8" stroke-width="2"/>',
  hand: '<path d="M18 36V12q0-5 5-5t5 5v12M28 22V9q0-5 5-5t5 5v21M38 25V13q0-5 5-5t5 5v18M18 22l-10-8q-4-3-6 2l15 20h22"/>',
  heart: '<path d="M20 38S2 27 2 15C2 6 13 3 20 12 27 3 38 6 38 15c0 12-18 23-18 23Z" fill="#d8736d" stroke="#a44e4a" stroke-width="2"/>',
  lamp: '<path d="M8 5h24l5 10H3Z" fill="#e0b861" stroke="#9b7339" stroke-width="2"/><path d="M9 15h22v23H9Z" fill="#d09a4e" stroke="#9b7339" stroke-width="2"/><path d="M20 1q-5 6 0 9" stroke="#e58f42" stroke-width="2"/>',
  flame: '<path d="M20 39Q5 31 10 18q3-8 10-15 0 10 8 14 6-9 2-17 16 12 8 28-5 10-18 11Z" fill="#e28b43" stroke="#ad6130" stroke-width="2"/>',
  tear: '<path d="M20 3Q7 18 10 27q2 9 10 9t10-9Q33 18 20 3Z" fill="#72afd0" stroke="#4e88a7" stroke-width="2"/>',
  jar: '<path d="M10 10h20l6 10-5 18H9L4 20Z" fill="#c68a66" stroke="#8f5d45" stroke-width="2"/><path d="M12 4h16v7H12Z" fill="#b97858" stroke="#8f5d45" stroke-width="2"/>',
};

function makePortrait({ bg, hill1, hill2, robe, hair, prop, female }: FigureStyle): string {
  const hairShape = female
    ? `<path d="M70 101Q65 62 110 48Q155 62 150 103Q143 83 110 79Q77 83 70 101Z" fill="${hair}"/><path d="M73 91Q64 108 71 132" fill="none" stroke="${hair}" stroke-width="10" stroke-linecap="round"/><path d="M147 91Q156 108 149 132" fill="none" stroke="${hair}" stroke-width="10" stroke-linecap="round"/>`
    : `<path d="M70 100Q72 54 110 49Q148 54 150 101Q137 78 110 78Q83 78 70 100Z" fill="${hair}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#f8efd7"/></linearGradient><linearGradient id="robe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${robe}"/><stop offset="1" stop-color="#8b684f"/></linearGradient></defs>
<rect x="5" y="5" width="210" height="210" rx="34" fill="url(#sky)"/><circle cx="34" cy="34" r="15" fill="#fff0b5" opacity=".92"/>
<path d="M5 123Q42 88 80 112T148 109T215 98V215H5Z" fill="${hill1}"/><path d="M5 151Q54 120 96 143T215 132V215H5Z" fill="${hill2}"/>
<path d="M16 153Q48 139 76 151T132 150T202 143" fill="none" stroke="#d7c790" stroke-width="5" opacity=".75"/>
<ellipse cx="110" cy="191" rx="49" ry="10" fill="#53634a" opacity=".2"/>
<path d="M70 191Q74 133 110 128Q146 133 150 191Z" fill="url(#robe)"/><path d="M80 151Q61 170 57 190M140 151Q159 170 163 190" fill="none" stroke="${robe}" stroke-width="18" stroke-linecap="round"/>
<circle cx="110" cy="101" r="40" fill="#e1ad7f"/>${hairShape}<path d="M76 111Q84 132 110 136Q136 132 144 111Q131 124 110 124Q89 124 76 111Z" fill="${hair}" opacity=".88"/>
<ellipse cx="94" cy="100" rx="6" ry="8" fill="#4b3428"/><ellipse cx="126" cy="100" rx="6" ry="8" fill="#4b3428"/><circle cx="92" cy="98" r="2.2" fill="white"/><circle cx="124" cy="98" r="2.2" fill="white"/><path d="M99 118Q110 125 121 118" fill="none" stroke="#8a5138" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="111" r="5" fill="#e99d91" opacity=".35"/><circle cx="138" cy="111" r="5" fill="#e99d91" opacity=".35"/>
<g transform="translate(137 63)" fill="none" stroke="#8c5b35" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${propSvg[prop]}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const figureImagePaths: Record<string, string> = Object.fromEntries(
  Object.entries(styles).map(([name, style]) => [name, makePortrait(style)]),
);

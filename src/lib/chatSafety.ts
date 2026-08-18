/**
 * 게임 내 실시간 채팅(바리새인을 찾아라, 양과 늑대)에서 공통으로 쓰는
 * 최소한의 안전장치. 학생회 웹사이트라는 특성상 서버가 따로 검열하지
 * 않는 P2P 브로드캐스트 채팅이라, 아래 규칙은 "보내는 쪽" 클라이언트에서
 * 적용된다. 완벽한 서버단 검열은 아니지만, 실수로 인한 도배나 흔한
 * 비속어는 이 정도로도 대부분 걸러진다.
 */

/** 메시지 하나의 최대 글자 수 */
export const MAX_CHAT_LENGTH = 200;

/** 같은 사람이 메시지를 연속으로 보낼 수 있는 최소 간격(ms) — 도배 방지 */
export const CHAT_COOLDOWN_MS = 1200;

/**
 * 자주 쓰이는 한글/영어 비속어 목록. 완전한 필터는 아니고, 변형(초성,
 * 띄어쓰기 삽입 등)까지 다 잡아내진 못하지만 가장 흔한 원형은 걸러준다.
 * 필요하면 이 배열에 단어만 추가하면 된다.
 */
const BANNED_WORDS = [
  "씨발",
  "시발",
  "ㅅㅂ",
  "개새끼",
  "개새기",
  "병신",
  "ㅄ",
  "좆",
  "지랄",
  "미친놈",
  "미친년",
  "닥쳐",
  "꺼져",
  "죽어버려",
  "fuck",
  "shit",
  "bitch",
  "asshole",
];

/** 문자열 안의 금칙어를 같은 글자 수의 *** 로 치환한다 */
export function censorProfanity(text: string): string {
  let result = text;
  for (const word of BANNED_WORDS) {
    if (!word) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    result = result.replace(re, (match) => "*".repeat(match.length));
  }
  return result;
}

/** 전송 직전 메시지 정제: 앞뒤 공백 제거 → 길이 제한 → 비속어 치환 */
export function sanitizeChatText(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_CHAT_LENGTH);
  return censorProfanity(trimmed);
}
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function file(rel) { return path.join(root, rel); }
function read(rel) { return fs.readFileSync(file(rel), 'utf8'); }
function write(rel, content) { fs.writeFileSync(file(rel), content, 'utf8'); }

let pharisee = read('src/games/pharisee/GameManager.ts');
pharisee = pharisee.replace(/\n\s*this\.resolveScriptureTrial\(\);/m, '');
write('src/games/pharisee/GameManager.ts', pharisee);

const voiceChat = file('src/games/pharisee/VoiceChat.tsx');
if (!fs.existsSync(voiceChat)) {
  fs.writeFileSync(voiceChat, `/** Legacy compatibility component for the existing GameView import. */\nexport default function VoiceChat() {\n  return null;\n}\n`, 'utf8');
}

let wolves = read('src/games/wolves-and-sheep/GameManger.ts');
wolves = wolves.replace(/\n  private hasActiveSabotage\(\) \{ return this\.activeSabotageKind !== null; \}\n\n  canSabotage\(/m, '\n  canSabotage(');
wolves = wolves.replace(
  'private applyMeetingEnd(payload: { ejectedId: string | null }) {',
  'private applyMeetingEnd(payload: { ejectedId: string | null; role?: Role | null }) {',
);
write('src/games/wolves-and-sheep/GameManger.ts', wolves);

let taskModal = read('src/games/wolves-and-sheep/TaskModal.tsx');
taskModal = taskModal.replace(
  'const resolveTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);',
  'const resolveTimerRef = useRef<number | null>(null);',
);
write('src/games/wolves-and-sheep/TaskModal.tsx', taskModal);

let sw = read('src/sw.ts');
sw = sw.replace(/\n\s*vibrate: \[120, 60, 120\],/m, '');
write('src/sw.ts', sw);

let auth = read('src/hooks/useAuth.tsx');
auth = auth.replace(
  "import { authenticateRegisteredPasskey, isPasskeySupported } from '@/lib/passkey';",
  "import { authenticateRegisteredPasskey, isPasskeySupported, signInWithPasskey as signInWithPasskeyLib } from '@/lib/passkey';",
);
auth = auth.replace(
  "  signIn: (email: string, password: string) => Promise<{ error: string | null; user: User | null }>;\n",
  "  signIn: (email: string, password: string) => Promise<{ error: string | null; user: User | null }>;\n  signInWithPasskey: () => Promise<{ error: string | null }>;\n",
);
auth = auth.replace(
  '  const signOut = useCallback(async () => {',
  "  const signInWithPasskey = useCallback(async () => {\n    if (!isPasskeySupported()) return { error: '이 기기에서 패스키 로그인을 사용할 수 없습니다.' };\n    const result = await signInWithPasskeyLib();\n    return { error: result.error?.message ?? null };\n  }, []);\n\n  const signOut = useCallback(async () => {",
);
auth = auth.replace(
  'value={{ user, profile, loading, profileError, profileRetrying, retryProfile, signIn, signUp, signOut,',
  'value={{ user, profile, loading, profileError, profileRetrying, retryProfile, signIn, signInWithPasskey, signUp, signOut,',
);
write('src/hooks/useAuth.tsx', auth);

let router = read('src/router/config.tsx');
router = router.replace(
  '{ path: "/reports/review", element: <AuthGuard minRole="teacher">{withSuspense(<ReviewPage />)}</AuthGuard> },',
  '{ path: "/reports/review", element: <AuthGuard minRole="president">{withSuspense(<ReviewPage />)}</AuthGuard> },',
);
router = router.replace(
  'const ReviewPage = lazy(() => import("@/pages/reports/review/page"));',
  'const ReviewPage = lazy(() => import("@/pages/reports/review/workflow"));',
);
write('src/router/config.tsx', router);

let home = read('src/pages/home/page.tsx');
const homeHelperAnchor = "function formatDateShort(dateStr: string) {\n  return formatKoreanDate(dateStr, { month: 'numeric', day: 'numeric' }).replace(/\\s/g, '');\n}\n";
const homeHelper = `\nconst CLUB_CALENDAR_DOT_CLASSES: Record<string, string> = {\n  saeullim: 'bg-primary-500',\n  cheonjipoong: 'bg-secondary-500',\n  cheonjihu: 'bg-accent-500',\n  munhwabu: 'bg-primary-700',\n  cheonhwarae_cheongmyeong: 'bg-secondary-700',\n};\n\nfunction getClubCalendarDotClass(clubId: string | null) {\n  return clubId ? CLUB_CALENDAR_DOT_CLASSES[clubId] || 'bg-foreground-500' : 'bg-foreground-500';\n}\n`;
if (!home.includes('const CLUB_CALENDAR_DOT_CLASSES')) {
  home = home.replace(homeHelperAnchor, homeHelperAnchor + homeHelper);
}
const oldHomeDot = '<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-secondary-400"></span>';
const newHomeDot = `<span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex max-w-[24px] items-center justify-center gap-0.5 overflow-hidden" aria-label="이 날짜의 동아리 일정">\n                            {Array.from(new Set(d.events.map(event => event.target_club).filter((clubId): clubId is string => Boolean(clubId))))\n                              .slice(0, 3)\n                              .map(clubId => (\n                                <span key={clubId} className={\\`h-1.5 w-1.5 flex-shrink-0 rounded-full \\${getClubCalendarDotClass(clubId)}\\`} title={clubs.find(club => club.id === clubId)?.name || clubId} />\n                              ))}\n                            {Array.from(new Set(d.events.map(event => event.target_club).filter((clubId): clubId is string => Boolean(clubId)))).length > 3 && (\n                              <span className="text-[7px] font-bold leading-none text-foreground-500">+</span>\n                            )}\n                          </span>`;
if (home.includes(oldHomeDot)) {
  home = home.replace(oldHomeDot, newHomeDot);
}
write('src/pages/home/page.tsx', home);

console.log('Legacy TypeScript normalization complete.');

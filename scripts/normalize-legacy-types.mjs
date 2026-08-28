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

console.log('Legacy TypeScript normalization complete.');

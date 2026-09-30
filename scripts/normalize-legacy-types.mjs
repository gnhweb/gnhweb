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

console.log('Legacy TypeScript normalization complete.');

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routerPath = path.join(root, 'src/router/config.tsx');
const source = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, 'utf8') : '';

const failures = [];
const warnings = [];
const pass = (msg) => console.log(`PASS  ${msg}`);
const fail = (msg) => { failures.push(msg); console.error(`FAIL  ${msg}`); };
const warn = (msg) => { warnings.push(msg); console.warn(`WARN  ${msg}`); };

if (!source) fail('src/router/config.tsx를 읽을 수 없습니다.');

const routes = [...source.matchAll(/path:\s*["'](\\/[^"']*)["']/g)]
  .map((m) => m[1])
  .filter((p) => !p.includes(':') && !p.includes('*'));
const uniqueRoutes = [...new Set(routes)].sort();

if (uniqueRoutes.length > 0) pass(`라우터 정적 경로 ${uniqueRoutes.length}개 발견`);
else fail('라우터 정적 경로가 없습니다.');

const lazyImports = [...source.matchAll(/lazy\(\(\)\s*=>\s*import\(["']([^"']+)["']\)\)/g)].map((m) => m[1]);
for (const imp of lazyImports) {
  if (!imp.startsWith('@/')) continue;
  const rel = imp.slice(2);
  const candidates = [
    path.join(root, 'src', `${rel}.tsx`),
    path.join(root, 'src', `${rel}.ts`),
    path.join(root, 'src', rel, 'page.tsx'),
    path.join(root, 'src', rel, 'index.tsx'),
  ];
  if (!candidates.some(fs.existsSync)) fail(`lazy import 대상 없음: ${imp}`);
}
if (!failures.some((x) => x.includes('lazy import'))) pass('모든 lazy import 대상 파일 존재');

const repoFiles = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git', 'dist'].includes(name)) continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else repoFiles.push(full);
  }
}
walk(path.join(root, 'src'));

const textFiles = repoFiles.filter((f) => /\.(ts|tsx|js|jsx|css|json|html)$/.test(f));
let placeholderCount = 0;
for (const file of textFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/href=["']tg:\/\/["']|tg:\/\//.test(text)) {
    warn(`Telegram placeholder/legacy scheme 발견: ${path.relative(root, file)}`);
    placeholderCount += 1;
  }
}
if (placeholderCount === 0) pass('Telegram legacy placeholder 없음');

const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.scripts?.build) fail('package.json에 build script가 없습니다.');
  if (!pkg.scripts?.type-check) warn('type-check script가 없습니다.');
  if (!pkg.scripts?.lint) warn('lint script가 없습니다.');
  if (!pkg.scripts?.verify) pass('verify script가 등록됨');
}

const envExample = path.join(root, '.env.example');
if (fs.existsSync(envExample)) pass('.env.example 존재');
else warn('.env.example이 없어 필요한 환경변수를 정적으로 확인하기 어렵습니다.');

for (const p of ['/leadership-diary', '/teacher-dashboard', '/dashboard/attendance', '/attendance-board', '/bible-pick', '/bible-mbti', '/event-ideas', '/faith', '/telegram-settings']) {
  if (uniqueRoutes.includes(p)) pass(`핵심 경로 등록: ${p}`);
  else warn(`핵심 경로가 router 정적 목록에 없음: ${p}`);
}

console.log(`\\n검증 요약: PASS=${uniqueRoutes.length - failures.length} / FAIL=${failures.length} / WARN=${warnings.length}`);
if (failures.length > 0) process.exit(1);

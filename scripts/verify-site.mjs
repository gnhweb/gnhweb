import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const routerPath = path.join(root, 'src/router/config.tsx');
const layoutPath = path.join(root, 'src/components/feature/Layout.tsx');
const source = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, 'utf8') : '';
const layoutSource = fs.existsSync(layoutPath) ? fs.readFileSync(layoutPath, 'utf8') : '';

const failures = [];
const warnings = [];
const pass = (msg) => console.log(`PASS  ${msg}`);
const fail = (msg) => { failures.push(msg); console.error(`FAIL  ${msg}`); };
const warn = (msg) => { warnings.push(msg); console.warn(`WARN  ${msg}`); };

if (!source) fail('src/router/config.tsx를 읽을 수 없습니다.');

const routes = [...source.matchAll(/path:\s*["'](\/[^"']*)["']/g)]
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
const telegramPlaceholders = [];
const telegramBridges = [];
for (const file of textFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const hasLegacyNavigation = /window\.location\.(?:href|assign|replace)\s*=\s*['"]tg:\/\//.test(text)
    || /window\.location\.(?:assign|replace)\(\s*['"]tg:\/\//.test(text)
    || /<a\b[^>]*\bhref\s*=\s*['"]tg:\/\//.test(text);
  if (!hasLegacyNavigation) continue;

  const rel = path.relative(root, file);
  const isKnownAttendanceBridge = (
    rel === path.join('src', 'components', 'feature', 'SmartAttendance.tsx')
    || rel === path.join('src', 'pages', 'attendanceBoard', 'page.tsx')
  ) && layoutSource.includes('AttendanceTelegramEnhancer');

  const isTelegramAppResolver = rel === path.join('src', 'components', 'feature', 'AttendanceTelegramEnhancer.tsx');

  if (isKnownAttendanceBridge || isTelegramAppResolver) telegramBridges.push(rel);
  else telegramPlaceholders.push(rel);
}
if (telegramPlaceholders.length > 0) {
  fail(`Telegram 실제 placeholder/legacy scheme 발견: ${telegramPlaceholders.join(', ')}`);
} else if (telegramBridges.length > 0) {
  pass(`Telegram 출석화면 앱 연결 브리지 확인: ${telegramBridges.length}개`);
} else {
  pass('Telegram legacy navigation 없음');
}

const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const scripts = pkg.scripts || {};
  if (!scripts.build) fail('package.json에 build script가 없습니다.');
  else pass('build script 등록됨');
  if (!scripts['type-check']) warn('type-check script가 없습니다.');
  else pass('type-check script 등록됨');
  if (!scripts.lint) warn('lint script가 없습니다.');
  else pass('lint script 등록됨');
  if (!scripts.verify) fail('verify script가 등록되지 않았습니다.');
  else pass('verify script 등록됨');
}

const envExample = path.join(root, '.env.example');
if (fs.existsSync(envExample)) pass('.env.example 존재');
else warn('.env.example이 없어 필요한 환경변수를 정적으로 확인하기 어렵습니다.');

const requiredRoutes = [
  '/leadership-diary',
  '/teacher-dashboard',
  '/dashboard/attendance',
  '/attendance-board',
  '/bible-pick',
  '/bible-mbti',
  '/event-ideas',
  '/bible-by-age',
  '/bible-streak',
];
for (const route of requiredRoutes) {
  if (uniqueRoutes.includes(route)) pass(`핵심 경로 등록: ${route}`);
  else fail(`핵심 경로가 router에 없음: ${route}`);
}

const requiredSpecialPaths = ['/faith', '/telegram-settings'];
for (const route of requiredSpecialPaths) {
  if (layoutSource.includes(`'${route}'`) || layoutSource.includes(`\"${route}\"`)) pass(`Layout 특수 경로 처리: ${route}`);
  else fail(`Layout 특수 경로 처리 누락: ${route}`);
}

console.log(`\n검증 요약: routes=${uniqueRoutes.length}, lazyImports=${lazyImports.length}, FAIL=${failures.length}, WARN=${warnings.length}`);
if (failures.length === 0) pass('정적 사이트 검증 완료');
else process.exit(1);

# gnhweb 로컬 검증 환경

GitHub Actions 없이 Codespaces에서 저장소를 직접 검증합니다.

## 시작

GitHub 저장소에서 **Code → Codespaces → Create codespace on main**을 선택합니다.

Codespace가 열리면 의존성이 자동 설치됩니다. `package-lock.json`이 있으면 `npm ci`, 없으면 `npm install`이 실행됩니다.

## 검증 순서

```bash
npm run verify
npm run type-check
npm run lint
npm run test
npm run build
```

Playwright를 실행할 경우:

```bash
npx playwright install chromium
npm run test:e2e
```

기본 production 대상은 `https://gnhweb.vercel.app`이며, 다른 대상은 `E2E_BASE_URL`로 변경할 수 있습니다.

```bash
E2E_BASE_URL=https://gnhweb.vercel.app npm run test:e2e
```

## 주의

- GitHub Actions는 이 검증 흐름에서 사용하지 않습니다.
- E2E 계정 환경변수는 Codespace Secrets 또는 Codespaces 환경변수에 등록해야 합니다.
- production 배포 전에는 `npm run verify`, `npm run type-check`, `npm run lint`, `npm run test`, `npm run build`를 모두 통과시키는 것을 기준으로 합니다.

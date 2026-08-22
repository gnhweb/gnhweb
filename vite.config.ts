import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import AutoImport from "unplugin-auto-import/vite";
import { VitePWA } from "vite-plugin-pwa";

const rawBase = process.env.BASE_PATH || "/";
const base = rawBase === "/" ? "/" : `/${rawBase.replace(/^\/+|\/+$/g, "")}/`;
const isPreview = process.env.IS_PREVIEW ? true : false;

export default defineConfig({
  define: {
    __BASE_PATH__: JSON.stringify(base),
    __IS_PREVIEW__: JSON.stringify(isPreview),
    __READDY_PROJECT_ID__: JSON.stringify(process.env.PROJECT_ID || ""),
    __READDY_VERSION_ID__: JSON.stringify(process.env.VERSION_ID || ""),
    __READDY_AI_DOMAIN__: JSON.stringify(process.env.READDY_AI_DOMAIN || ""),
  },
  plugins: [
    react(),
    AutoImport({
      imports: [
        {
          react: [
            ["default", "React"],
            "useState",
            "useEffect",
            "useContext",
            "useReducer",
            "useCallback",
            "useMemo",
            "useRef",
            "useImperativeHandle",
            "useLayoutEffect",
            "useDebugValue",
            "useDeferredValue",
            "useId",
            "useInsertionEffect",
            "useSyncExternalStore",
            "useTransition",
            "startTransition",
            "lazy",
            "memo",
            "forwardRef",
            "createContext",
            "createElement",
            "cloneElement",
            "isValidElement",
          ],
        },
        {
          "react-router-dom": [
            "useNavigate",
            "useLocation",
            "useParams",
            "useSearchParams",
            "Link",
            "NavLink",
            "Navigate",
            "Outlet",
          ],
        },
        {
          "react-i18next": ["useTranslation", "Trans"],
        },
      ],
      dts: true,
    }),
    VitePWA({
      registerType: "autoUpdate",
      // "auto"로 두면 새 배포가 나와도 기기가 백그라운드에서만 조용히 감지하고
      // 화면은 새로고침 전까지 계속 예전 CSS/JS를 보여줌 → 기기별 화면이 서로 달라 보이는 원인.
      // false로 바꾸고 src/pwa.ts에서 직접 등록해 "새 버전 감지 즉시 자동 새로고침"을 강제한다.
      injectRegister: false,
      includeAssets: ["favicon.ico", "apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "강학",
        short_name: "강학",
        description: "강학 운영 플랫폼 - 보고, 출석, 동아리, 행정을 한 곳에서",
        lang: "ko",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#0b0e1a",
        theme_color: "#0b0e1a",
        orientation: "portrait",
        icons: [
          {
            src: "pwa-192x192.png?v=2", // 캐시 강제 갱신용 버전 추가
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png?v=2", // 캐시 강제 갱신용 버전 추가
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-maskable-512x512.png?v=2", // 캐시 강제 갱신용 버전 추가
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  base,
  build: {
    sourcemap: false, // 디버깅 소스맵 생성을 꺼서 빌드 용량 대폭 감소
    outDir: 'out',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // 초기 홈 진입에 모든 기능이 묶이지 않도록 라우트는 React.lazy로 분리하고,
        // 무거운 서드파티 라이브러리도 별도 청크로 분리합니다.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/scheduler/')) {
            return 'vendor';
          }
          if (id.includes('/@supabase/')) return 'supabase';
          if (id.includes('html2canvas') || id.includes('dom-to-image-more')) return 'canvas';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('phaser')) return 'game-phaser';
          if (id.includes('/three/') || id.includes('@react-three/')) return 'game-three';
          if (id.includes('firebase')) return 'firebase';
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
});

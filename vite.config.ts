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
    {
      name: "align-teacher-attendance-population",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("/src/pages/teacherDashboard/page.tsx")) return code;
        const oldBlock = `let studentsQuery = supabase
        .from('user_roles')
        .select('user_id, name, club, is_expelled, is_active')
        .eq('role', 'member');
      if (effectiveClub !== 'all') {
        studentsQuery = studentsQuery.eq('club', effectiveClub);
      }
      const { data: allStudentsRaw } = await studentsQuery;
      // 전체 학생 수는 user_id 기준으로 중복을 제거합니다.
      // 동아리 미지정 학생도 '전체' 집계에는 포함합니다.
      const uniqueStudents = new Map<string, { user_id: string; name: string; club: string | null; is_expelled?: boolean; is_active?: boolean }>();
      for (const rawStudent of ((allStudentsRaw || []) as { user_id: string; name: string; club: string | null; is_expelled?: boolean; is_active?: boolean }[])) {
        if (rawStudent.is_expelled || rawStudent.is_active === false) continue;
        const existing = uniqueStudents.get(rawStudent.user_id);
        if (!existing || (!existing.club && rawStudent.club)) {
          uniqueStudents.set(rawStudent.user_id, rawStudent);
        }
      }
      const allStudents = Array.from(uniqueStudents.values());`;
        const newBlock = `let studentsQuery = supabase
        .from('user_roles')
        .select('user_id, name, club, is_expelled, is_active, role, approval_status')
        .eq('is_active', true)
        .eq('approval_status', 'approved')
        .not('role', 'in', '(teacher,chief)');
      if (effectiveClub !== 'all') {
        studentsQuery = studentsQuery.eq('club', effectiveClub);
      }
      const { data: allStudentsRaw } = await studentsQuery;
      // 실시간 출석 현황판과 동일한 모집단으로 집계해 숫자/미응답이 어긋나지 않도록 합니다.
      const studentRows = ((allStudentsRaw || []) as { user_id: string; name: string; club: string | null; is_expelled?: boolean; is_active?: boolean; role?: string; approval_status?: string }[])
        .filter((student) => !student.is_expelled && Boolean(student.user_id) && student.club !== 'cheonhwarae_cheongmyeong');
      const uniqueStudents = new Map<string, { user_id: string; name: string; club: string | null; is_expelled?: boolean; is_active?: boolean }>();
      for (const rawStudent of studentRows) {
        const existing = uniqueStudents.get(rawStudent.user_id);
        if (!existing || (!existing.club && rawStudent.club)) {
          uniqueStudents.set(rawStudent.user_id, rawStudent);
        }
      }
      const allStudents = Array.from(uniqueStudents.values());`;
        if (!code.includes(oldBlock)) return code;
        return code.replace(oldBlock, newBlock);
      },
    },
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
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
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
          { src: "pwa-192x192.png?v=2", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png?v=2", sizes: "512x512", type: "image/png" },
          { src: "pwa-maskable-512x512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  base,
  build: {
    sourcemap: false,
    outDir: 'out',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router') || id.includes('/scheduler/')) return 'vendor';
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
  resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
  server: { port: 3000, host: "0.0.0.0" },
});
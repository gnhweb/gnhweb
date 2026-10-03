import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/hooks/useMobileMenu";

const SHOW_AT_TOP_Y = 40;

interface TabDef {
  key: "home" | "clubs" | "game" | "prayer" | "suggestions" | "journal";
  label: string;
  icon: string;
  activeIcon: string;
  path?: string;
}

const TABS: TabDef[] = [
  { key: "home", label: "홈", icon: "ri-home-5-line", activeIcon: "ri-home-5-fill", path: "/" },
  { key: "clubs", label: "동아리", icon: "ri-group-line", activeIcon: "ri-group-fill", path: "/clubs" },
  { key: "game", label: "게임", icon: "ri-gamepad-line", activeIcon: "ri-gamepad-fill" },
  { key: "prayer", label: "기도 릴레이", icon: "ri-heart-3-line", activeIcon: "ri-heart-3-fill", path: "/prayer-relay" },
  { key: "suggestions", label: "건의·질문", icon: "ri-question-answer-line", activeIcon: "ri-question-answer-fill" },
  { key: "journal", label: "신앙일기", icon: "ri-book-3-line", activeIcon: "ri-book-3-fill", path: "/faith-journal" },
];

const GAME_PLAY_PATHS = ["/games", "/wolves-and-sheep", "/pharisee", "/galilee-phone", "/bible-quiz"];

const GAME_LINKS = [
  { label: "양과 늑대", path: "/wolves-and-sheep", icon: "ri-user-3-line" },
  { label: "바리새인을 찾아라", path: "/pharisee", icon: "ri-search-eye-line" },
  { label: "갈릴리폰", path: "/galilee-phone", icon: "ri-chat-smile-3-line" },
  { label: "성경퀴즈", path: "/bible-quiz", icon: "ri-question-answer-line" },
];

const COMMUNITY_LINKS = [
  { label: "건의사항", path: "/suggestions", icon: "ri-lightbulb-line" },
  { label: "질문있어요", path: "/qna-board", icon: "ri-question-line" },
];

export default function BottomTabBar() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { mobileOpen, setMobileOpen } = useMobileMenu();
  const [visible, setVisible] = useState(true);
  const [openMenu, setOpenMenu] = useState<"game" | "suggestions" | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY <= SHOW_AT_TOP_Y);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    const viewport = window.visualViewport;
    const updateKeyboardState = () => {
      if (!viewport) return;
      const heightGap = window.innerHeight - viewport.height;
      const keyboardVisible = heightGap > Math.max(120, window.innerHeight * 0.18);
      document.body.classList.toggle("ios-keyboard-open", keyboardVisible);
      setKeyboardOpen(keyboardVisible);
    };

    updateKeyboardState();
    viewport?.addEventListener("resize", updateKeyboardState);
    viewport?.addEventListener("scroll", updateKeyboardState);
    window.addEventListener("resize", updateKeyboardState);

    const handleFocusOut = () => {
      window.setTimeout(updateKeyboardState, 120);
    };

    document.addEventListener("focusin", updateKeyboardState);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      viewport?.removeEventListener("resize", updateKeyboardState);
      viewport?.removeEventListener("scroll", updateKeyboardState);
      window.removeEventListener("resize", updateKeyboardState);
      document.body.classList.remove("ios-keyboard-open");
      document.removeEventListener("focusin", updateKeyboardState);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, [location.pathname]);

  useEffect(() => {
    setOpenMenu(null);
  }, [location.pathname]);

  if (!user) return null;

  const shouldShow = visible && !mobileOpen && !keyboardOpen;

  const isTabActive = (tab: TabDef) => {
    if (tab.key === "game") {
      return GAME_PLAY_PATHS.some((path) => location.pathname.startsWith(path));
    }
    if (tab.key === "suggestions") {
      return location.pathname.startsWith("/suggestions") || location.pathname.startsWith("/qna-board");
    }
    if (!tab.path) return false;
    if (tab.path === "/") return location.pathname === "/";
    return location.pathname.startsWith(tab.path);
  };

  const closeMenu = () => setOpenMenu(null);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.nav
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="md:hidden fixed bottom-0 left-0 right-0 z-50"
          aria-label="하단 바로가기"
        >
          <AnimatePresence>
            {openMenu && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="absolute bottom-[calc(100%+0.5rem)] left-3 right-3 rounded-card border border-background-200 bg-background-100 p-2 shadow-card-lg"
                role="menu"
                aria-label={openMenu === "game" ? "게임 메뉴" : "건의·질문 메뉴"}
              >
                <div className="grid grid-cols-2 gap-2">
                  {(openMenu === "game" ? GAME_LINKS : COMMUNITY_LINKS).map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={closeMenu}
                      role="menuitem"
                      className="flex min-h-12 items-center gap-2.5 rounded-input px-3 text-sm font-semibold text-foreground-700 hover:bg-background-200 active:bg-background-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-foreground-200 dark:hover:bg-background-200"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                        <i className={item.icon} aria-hidden="true" />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full rounded-t-[20px] border-t border-background-200 bg-background-100 pb-safe shadow-card-lg dark:bg-background-100">
            <div className="grid grid-cols-6 px-1 pt-2 pb-1.5">
              {TABS.map((tab) => {
                const active = isTabActive(tab);
                const isMenuTab = tab.key === "game" || tab.key === "suggestions";

                const content = (
                  <motion.div
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="flex min-h-14 w-full flex-col items-center justify-center gap-1"
                  >
                    <i
                      className={`${active ? tab.activeIcon : tab.icon} text-[24px] ${active ? "text-primary-600 dark:text-primary-400" : "text-foreground-500 dark:text-foreground-400"}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`whitespace-nowrap text-[11px] leading-tight ${active ? "font-bold text-primary-600 dark:text-primary-400" : "font-medium text-foreground-500 dark:text-foreground-400"}`}
                    >
                      {tab.label}
                    </span>
                  </motion.div>
                );

                if (isMenuTab) {
                  const menuKey = tab.key as "game" | "suggestions";
                  const expanded = openMenu === menuKey;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setOpenMenu(expanded ? null : menuKey)}
                      aria-expanded={expanded}
                      aria-haspopup="menu"
                      aria-label={`${tab.label} 메뉴`}
                      className="flex min-w-0 items-center justify-center rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    key={tab.key}
                    to={tab.path!}
                    onClick={closeMenu}
                    aria-current={active ? "page" : undefined}
                    className="flex min-w-0 items-center justify-center rounded-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

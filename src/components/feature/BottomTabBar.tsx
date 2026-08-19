import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useMobileMenu } from "@/hooks/useMobileMenu";

// 맨 위(스크롤 0)에서는 숨기고, 사용자가 아래로 스크롤해야만 하단 탭바가 나타난다.
const SHOW_AFTER_SCROLL_Y = 40;

// 모바일에서 가장 자주 쓰는 5개 동선을 엄지 존(하단)에 고정한다.
// - 라우팅/권한/데이터 로직은 전혀 건드리지 않고, 기존 페이지로 이동만 시킨다.
// - 가운데 "갓겜" 탭만 시각적으로 튀어나온 원형 버튼으로 강조(인스타의 + 버튼 포지션).
// - 마지막 "더보기" 탭은 Navbar의 기존 전체화면 모바일 메뉴를 그대로 연다(로직 재사용).
interface TabDef {
  key: string;
  label: string;
  icon: string;
  activeIcon: string;
  path?: string;
}

const TABS: TabDef[] = [
  {
    key: "home",
    label: "홈",
    icon: "ri-home-5-line",
    activeIcon: "ri-home-5-fill",
    path: "/",
  },
  {
    key: "clubs",
    label: "동아리",
    icon: "ri-group-line",
    activeIcon: "ri-group-fill",
    path: "/clubs",
  },
  {
    key: "game",
    label: "갓겜",
    icon: "ri-gamepad-line",
    activeIcon: "ri-gamepad-fill",
    path: "/games",
  },
  {
    key: "quiz",
    label: "성경퀴즈",
    icon: "ri-question-answer-line",
    activeIcon: "ri-question-answer-fill",
    path: "/bible-quiz",
  },
  {
    key: "more",
    label: "더보기",
    icon: "ri-menu-line",
    activeIcon: "ri-menu-fill",
  },
];

// 갓겜 허브에서 진입하는 개별 게임 라우트 — 게임 플레이 중에도 하단 탭의 "갓겜"이 활성 상태로 보이게 한다.
const GAME_PLAY_PATHS = ["/wolves-and-sheep", "/pharisee", "/galilee-phone"];

export default function BottomTabBar() {
  const location = useLocation();
  const { user, profile } = useAuth();
  const { mobileOpen, setMobileOpen } = useMobileMenu();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 페이지 이동 시엔 항상 맨 위(숨김 상태)에서 시작한다.
    setVisible(window.scrollY > SHOW_AFTER_SCROLL_Y);

    const handleScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_SCROLL_Y);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  if (!user) return null;

  // 더보기 메뉴가 열려 있을 땐 스크롤 위치와 상관없이 탭바를 보여준다(활성 표시를 위해).
  const shouldShow = visible || mobileOpen;

  const isTabActive = (tab: TabDef) => {
    if (tab.key === "more") return mobileOpen;
    if (!tab.path) return false;
    if (tab.path === "/") return location.pathname === "/";
    if (tab.key === "game")
      return (
        GAME_PLAY_PATHS.some((p) => location.pathname.startsWith(p)) ||
        location.pathname.startsWith(tab.path)
      );
    return location.pathname.startsWith(tab.path);
  };

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.nav
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
          className="md:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe"
          aria-label="하단 바로가기"
        >
          <div className="mx-3 mb-3 rounded-[24px] bg-white/85 backdrop-blur-lg shadow-card-lg border border-background-200/60">
            <div className="flex items-end justify-between px-2 pt-2 pb-1.5">
              {TABS.map((tab) => {
                const active = isTabActive(tab);
                const isCenter = tab.key === "game";

                const content = (
                  <motion.div
                    whileTap={{ y: -2, scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="flex flex-col items-center justify-end gap-0.5 flex-1"
                  >
                    {isCenter ? (
                      <div
                        className={`w-14 h-14 -mt-6 rounded-full flex items-center justify-center bg-gradient-to-br from-primary-500 to-accent-500 shadow-card-lg ${
                          active ? "ring-2 ring-primary-200" : ""
                        }`}
                      >
                        <i
                          className={`${active ? tab.activeIcon : tab.icon} text-white text-2xl`}
                        ></i>
                      </div>
                    ) : tab.key === "more" && profile?.profile_image ? (
                      <div
                        className={`w-7 h-7 rounded-full overflow-hidden ${
                          active
                            ? "ring-2 ring-primary-500"
                            : "ring-1 ring-background-200"
                        }`}
                      >
                        <img
                          src={profile.profile_image}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <i
                        className={`${active ? tab.activeIcon : tab.icon} text-[22px] ${
                          active ? "text-primary-600" : "text-foreground-400"
                        }`}
                      ></i>
                    )}
                    <span
                      className={`text-[10px] leading-none ${
                        active
                          ? "text-primary-600 font-bold"
                          : "text-foreground-400 font-medium"
                      } ${isCenter ? "mt-0.5" : ""}`}
                    >
                      {tab.label}
                    </span>
                  </motion.div>
                );

                if (tab.key === "more") {
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setMobileOpen(!mobileOpen)}
                      className="flex-1 flex justify-center cursor-pointer"
                      aria-label="더보기 메뉴"
                    >
                      {content}
                    </button>
                  );
                }

                return (
                  <Link
                    key={tab.key}
                    to={tab.path!}
                    className="flex-1 flex justify-center cursor-pointer"
                    onClick={() => setMobileOpen(false)}
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

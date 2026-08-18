import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

// 갓겜 허브 — 완성된 게임 목록을 넷플릭스/앱스토어 느낌의 큰 썸네일 카드로 보여준다.
// 절대 규칙: 게임 로직(로비/방코드/역할배정/이동/미션/투표 등)은 전혀 건드리지 않고,
// 각 게임 라우트로 이동만 시키는 진입점 화면이다.
interface GameCard {
  path: string;
  title: string;
  tagline: string;
  icon: string;
  gradient: string;
  status: 'live' | 'soon';
}

const GAMES: GameCard[] = [
  {
    path: '/wolves-and-sheep',
    title: '양과 늑대',
    tagline: '거짓 선지자를 찾아라!',
    icon: 'ri-user-3-line',
    gradient: 'from-rose-500 via-primary-500 to-accent-500',
    status: 'live',
  },
  {
    path: '/pharisee',
    title: '바리새인을 찾아라',
    tagline: '숨어있는 바리새인을 지목하라',
    icon: 'ri-search-eye-line',
    gradient: 'from-amber-500 via-orange-500 to-rose-500',
    status: 'live',
  },
  {
    path: '/galilee-phone',
    title: '갈릴리폰',
    tagline: '말씀을 전달해 완성하라',
    icon: 'ri-chat-smile-3-line',
    gradient: 'from-sky-500 via-secondary-500 to-primary-500',
    status: 'live',
  },
];

export default function GameHub() {
  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="text-center mb-8 md:mb-12">
            <div className="inline-flex items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-gradient-to-br from-primary-500 to-accent-500 mb-4 md:mb-5 shadow-card-lg">
              <i className="ri-gamepad-line text-3xl text-white"></i>
            </div>
            <h1 className="text-xl md:text-3xl font-bold text-foreground-950 mb-2 md:mb-3">갓겜</h1>
            <p className="text-foreground-600 text-sm">함께 즐기는 신앙 게임, 원하는 게임을 골라 시작하세요</p>
          </div>

          {/* 게임 목록 — 넷플릭스/앱스토어 느낌의 가로 스크롤 큰 썸네일 카드 */}
          <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-2 md:gap-5 md:mx-0 md:px-0 md:overflow-visible">
            {GAMES.map((game, i) => (
              <motion.div
                key={game.path}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.07, 0.3) }}
                className="flex-shrink-0 w-[78%] sm:w-[46%] md:w-auto snap-start"
              >
                <Link to={game.path} className="block">
                  <motion.div
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className={`relative aspect-[3/4] md:aspect-[16/10] rounded-[20px] overflow-hidden shadow-card cursor-pointer bg-gradient-to-br ${game.gradient}`}
                  >
                    {/* 배경 장식 아이콘 */}
                    <i className={`${game.icon} absolute -right-4 -bottom-4 text-[140px] text-white/15`}></i>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"></div>

                    <div className="absolute top-3 left-3">
                      <div className="w-11 h-11 rounded-2xl bg-background-100/20 backdrop-blur flex items-center justify-center">
                        <i className={`${game.icon} text-xl text-white`}></i>
                      </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h2 className="text-lg font-bold text-white leading-tight mb-1">{game.title}</h2>
                      <p className="text-xs text-white/80 mb-3 line-clamp-1">{game.tagline}</p>
                      <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-background-100 text-foreground-950 text-xs font-bold">
                        <i className="ri-play-fill"></i>
                        PLAY
                      </span>
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}

            {/* 추후 추가될 게임 안내 카드 */}
            <div className="flex-shrink-0 w-[78%] sm:w-[46%] md:w-auto snap-start">
              <div className="aspect-[3/4] md:aspect-[16/10] rounded-[20px] border-2 border-dashed border-background-300 flex flex-col items-center justify-center text-center p-6">
                <div className="w-11 h-11 rounded-2xl bg-background-100 flex items-center justify-center mb-3">
                  <i className="ri-hourglass-line text-xl text-foreground-400"></i>
                </div>
                <p className="text-sm font-semibold text-foreground-600 mb-1">새 게임 준비 중</p>
                <p className="text-xs text-foreground-400">곧 새로운 갓겜으로 찾아올게요</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
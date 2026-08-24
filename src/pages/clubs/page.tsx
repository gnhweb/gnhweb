import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clubs, clubIcons } from '@/mocks/clubs';
import { supabase } from '@/lib/supabase';

interface ClubDetailContent {
  description?: string;
  schedule?: string;
  activities?: string[];
}

export default function Clubs() {
  const [clubBannerMap, setClubBannerMap] = useState<Record<string, { card_image_url: string | null }>>({});
  const [clubDetailMap, setClubDetailMap] = useState<Record<string, ClubDetailContent>>({});

  useEffect(() => {
    Promise.resolve(
      supabase
        .from('club_banners')
        .select('club, card_image_url')
    )
      .then(({ data }) => {
        if (data) {
          const map: Record<string, { card_image_url: string | null }> = {};
          data.forEach((b: { club: string; card_image_url: string | null }) => {
            map[b.club] = { card_image_url: b.card_image_url };
          });
          setClubBannerMap(map);
        }
      })
      .catch(() => {});

    Promise.resolve(
      supabase
        .from('club_posts')
        .select('club, content')
        .eq('type', 'detail')
    )
      .then(({ data }) => {
        if (data) {
          const map: Record<string, ClubDetailContent> = {};
          data.forEach((row: { club: string; content: unknown }) => {
            let content = row.content;
            if (typeof content === 'string') {
              try { content = JSON.parse(content); } catch { content = {}; }
            }
            const c = (content as Record<string, unknown>) || {};
            map[row.club] = {
              description: (c.description as string) || '',
              schedule: (c.schedule as string) || '',
              activities: Array.isArray(c.activities) ? c.activities as string[] : [],
            };
          });
          setClubDetailMap(map);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-24 md:py-16 scroll-mt-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8 md:mb-12"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-background-100/80 backdrop-blur mb-4 md:mb-5">
            <i className="ri-group-line text-3xl text-primary-600"></i>
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-foreground-950 mb-2 md:mb-3">동아리 소개</h1>
          <p className="text-foreground-600 text-sm md:text-base leading-relaxed max-w-xl mx-auto">
            강릉 학생회는 5개의 동아리로 구성되어 있습니다.<br />
            각 동아리는 고유한 사명으로 하나님께 영광을 돌리고 있습니다.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8 hidden md:grid">
          {clubs.map((club, index) => {
            const clubBanner = clubBannerMap[club.id];
            const clubDetail = clubDetailMap[club.id];
            const displayDescription = clubDetail?.description || club.description;
            const displaySchedule = clubDetail?.schedule || club.schedule;
            const displayActivities = (clubDetail?.activities && clubDetail.activities.length > 0)
              ? clubDetail.activities
              : club.activities;
            return (
              <motion.div
                key={club.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Link
                  to={`/clubs/${club.id}`}
                  className="block bg-background-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 group h-full"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl">
                    {clubBanner?.card_image_url ? (
                      <img
                        src={clubBanner.card_image_url}
                        alt={club.name}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${club.color}`}></div>
                    )}
                    <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full bg-gradient-to-r ${club.color} text-white text-xs font-semibold`}>
                      {club.subtitle}
                    </div>
                  </div>
                  <div className="p-5 md:p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-xl ${club.iconBg} flex items-center justify-center`}>
                        <i className={`${clubIcons[club.id]} text-xl ${club.iconText}`}></i>
                      </div>
                      <h2 className="text-xl font-bold text-foreground-950 break-words">{club.name}</h2>
                    </div>
                    <p className="text-sm text-foreground-600 leading-relaxed mb-4">{displayDescription}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {displayActivities.slice(0, 3).map((act, i) => (
                        <span key={i} className="text-xs bg-background-50 text-foreground-600 px-2.5 py-1 rounded-full border border-background-200 whitespace-nowrap">
                          {act.length > 18 ? act.slice(0, 18) + '...' : act}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-background-200">
                      <span className="text-xs text-foreground-500">{displaySchedule.split(' / ')[0]}</span>
                      <span className="text-xs text-primary-600 font-medium flex items-center gap-1 group-hover:gap-2 transition-all whitespace-nowrap">
                        자세히 보기
                        <i className="ri-arrow-right-line text-xs"></i>
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* ── 모바일 전용: 인스타 프로필 카드 느낌의 세로 카드 리스트 ── */}
        <div className="md:hidden space-y-4">
          {clubs.map((club, index) => {
            const clubBanner = clubBannerMap[club.id];
            const clubDetail = clubDetailMap[club.id];
            const displayDescription = clubDetail?.description || club.description;
            const displaySchedule = clubDetail?.schedule || club.schedule;
            const displayActivities = (clubDetail?.activities && clubDetail.activities.length > 0)
              ? clubDetail.activities
              : club.activities;
            return (
              <motion.div
                key={`m-${club.id}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.3) }}
              >
                <motion.div whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                  <Link
                    to={`/clubs/${club.id}`}
                    className="relative z-10 block rounded-[20px] shadow-card cursor-pointer min-h-[280px] touch-manipulation"
                  >
                    <div className="absolute inset-0 overflow-hidden rounded-[20px]">
                      {clubBanner?.card_image_url ? (
                        <img
                          src={clubBanner.card_image_url}
                          alt={club.name}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${club.color}`}></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                    </div>

                    <div className="relative z-10 pt-3 pl-3 flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full ${club.iconBg} flex items-center justify-center backdrop-blur`}>
                        <i className={`${clubIcons[club.id]} text-sm ${club.iconText}`}></i>
                      </div>
                    </div>

                    <div className="relative z-10 mt-[210px] p-4 pb-5">
                      <h2 className="text-lg font-bold text-white leading-tight mb-1">{club.name}</h2>
                      <p className="text-[11px] text-white/80 leading-relaxed break-words mb-2">{displayDescription}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-semibold bg-background-100/20 backdrop-blur text-white px-2 py-1 rounded-full break-words">
                          <i className="ri-calendar-line mr-1"></i>{displaySchedule.split(' / ')[0]}
                        </span>
                        {displayActivities.slice(0, 1).map((act, i) => (
                          <span key={i} className="text-[10px] font-semibold bg-background-100/20 backdrop-blur text-white px-2 py-1 rounded-full break-words">
                            {act.length > 14 ? act.slice(0, 14) + '...' : act}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 text-center"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-foreground-500 hover:text-foreground-800 transition-colors"
          >
            <i className="ri-arrow-left-line"></i>
            홈으로 돌아가기
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

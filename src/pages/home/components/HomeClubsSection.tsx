import { Link } from 'react-router-dom';
import { clubs } from '@/mocks/clubs';

interface HomeClubsSectionProps {
  clubBannerMap: Record<string, { card_image_url: string | null }>;
}

const CLUB_ICON_MAP: Record<string, string> = {
  saeullim: 'ri-music-line',
  cheonjipoong: 'ri-flag-line',
  cheonjihu: 'ri-heart-pulse-line',
  munhwabu: 'ri-camera-lens-line',
  cheonhwarae_cheongmyeong: 'ri-mic-line',
};

export default function HomeClubsSection({ clubBannerMap }: HomeClubsSectionProps) {
  return (
<section className="max-w-6xl mx-auto px-4 md:px-6 mb-8">
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-bold text-foreground-950 flex items-center gap-2">
      <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-emerald-100"><i className="ri-group-line text-emerald-600 text-sm"></i></span>
      동아리 소개
    </h2>
    <Link to="/clubs" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 whitespace-nowrap cursor-pointer">전체보기 <i className="ri-arrow-right-s-line text-sm"></i></Link>
  </div>

  {/* 모바일/데스크톱 레이아웃을 CSS(md:hidden)로만 나누면 둘 다 DOM에 렌더링되어
      <img> 태그가 뷰포트와 무관하게 항상 다운로드되는 문제가 있었다 (동아리 카드
      이미지가 방문마다 2배로 받아졌던 원인). isMobile로 실제 필요한 쪽 하나만 렌더링한다. */}
  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
    {clubs.map((club) => (
      <Link key={club.id} to={`/clubs/${club.id}`} className="group relative bg-background-100 rounded-card border border-background-200 overflow-hidden hover:border-primary-200 hover:shadow-card transition-all duration-300 cursor-pointer">
        <div className="relative h-32 overflow-hidden">
          {clubBannerMap[club.id]?.card_image_url ? (
            <img
              src={clubBannerMap[club.id].card_image_url!}
              alt={`${club.name} 동아리 카드`}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${club.color}`}></div>
          )}
          <div className={`absolute inset-0 bg-gradient-to-b ${club.color} opacity-30 group-hover:opacity-20 transition-opacity`}></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
          <div className={`absolute top-2.5 left-2.5 w-7 h-7 rounded-card ${club.iconBg} flex items-center justify-center`}>
            <i className={`${CLUB_ICON_MAP[club.id]} text-sm ${club.iconText}`}></i>
          </div>
        </div>
        <div className="p-3">
          <p className="font-bold text-foreground-950 text-sm whitespace-nowrap overflow-hidden text-ellipsis">{club.name}</p>
          <p className="text-[11px] text-foreground-500 mt-0.5 truncate">{club.subtitle}</p>
        </div>
      </Link>
    ))}
  </div>
</section>
  );
}

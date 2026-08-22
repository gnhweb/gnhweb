import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { getInternationalAge } from '@/lib/age';
import InstaCard from '@/components/base/InstaCard';
import { todayKey } from '@/lib/date';

interface SeniorStatus {
  totalSeniors: number;
  connectedYouthGroup: number;
  upcomingRevealCount: number;
  checklistProgress: number;
}

function isGraduating(profile: any): boolean {
  if (!profile) return false;
  if (profile.graduation_expected === true) return true;
  if (profile.grade === '고3') return true;
  return getInternationalAge(profile.birth_year || 0, profile.birth_month || 0, profile.birth_day || 0) >= 19;
}

export default function SeniorSection() {
  const { user, profile, hasRole } = useAuth();
  const isSeniorStudent = isGraduating(profile);
  const isTeacherOrChief = hasRole('teacher') || hasRole('chief');
  const canAccess = user && (isSeniorStudent || isTeacherOrChief);

  const [status, setStatus] = useState<SeniorStatus>({ totalSeniors: 0, connectedYouthGroup: 0, upcomingRevealCount: 0, checklistProgress: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAccess) return;
    loadStatus();
  }, [canAccess]);

  const loadStatus = async () => {
    try {
      const { count: seniorCount } = await supabase.from('user_roles').select('*', { count: 'exact', head: true }).or('grade.eq.고3,graduation_expected.eq.true');
      const { count: revealCount } = await supabase.from('senior_rolling_papers').select('*', { count: 'exact', head: true }).gte('reveal_date', todayKey());
      const { data: checklist } = await supabase.from('senior_checklist').select('*');
      const completed = checklist ? checklist.filter((c: any) => c.completed).length : 0;
      const total = checklist ? checklist.length : 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      setStatus({
        totalSeniors: seniorCount || 0,
        connectedYouthGroup: 0,
        upcomingRevealCount: revealCount || 0,
        checklistProgress: progress,
      });
    } catch { /* ignore */ }
    setLoading(false);
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-graduation-cap-line text-2xl text-amber-600"></i>
          </div>
          <h2 className="text-lg font-bold text-foreground-950 mb-2">고3구역 접근 권한이 없습니다</h2>
          <p className="text-sm text-foreground-600">고3 학생 또는 교사·부장만 열람할 수 있어요.</p>
        </div>
      </div>
    );
  }

  const features = [
    { path: '/senior/roadmap', label: '신앙 마일스톤 로드맵', desc: '학업 일정과 함께 기도제목, 선배 응원을 확인하세요', icon: 'ri-road-map-line', color: 'amber' },
    { path: '/senior/calendar', label: '고3 전용 캘린더', desc: '수련회·기도모임 등 고3만의 일정을 확인하세요', icon: 'ri-calendar-event-line', color: 'emerald' },
    { path: '/senior/connection', label: '졸업 후 연계 안내', desc: '청년부·대학부 연계 절차와 연락처를 확인하세요', icon: 'ri-link', color: 'sky' },
    { path: '/senior/proposals', label: '헌신예배 제안·투표', desc: '함께 만들어가는 헌신예배, 제안하고 투표하세요', icon: 'ri-vip-crown-line', color: 'rose' },
    { path: '/senior/rolling-paper', label: '온라인 롤링페이퍼', desc: '친구들에게 마음을 담은 편지를 남겨보세요', icon: 'ri-message-3-line', color: 'violet' },
    { path: '/senior/checklist', label: '헌신예배 체크리스트', desc: '임원·교사가 함께 보는 실시간 준비 현황', icon: 'ri-task-line', color: 'teal' },
  ];

  const colorMap: Record<string, { bg: string; icon: string; border: string; text: string; hover: string }> = {
    amber: { bg: 'bg-amber-100', icon: 'text-amber-600', border: 'border-amber-200', text: 'text-amber-700', hover: 'hover:bg-amber-50' },
    emerald: { bg: 'bg-emerald-100', icon: 'text-emerald-600', border: 'border-emerald-200', text: 'text-emerald-700', hover: 'hover:bg-emerald-50' },
    sky: { bg: 'bg-sky-100', icon: 'text-sky-600', border: 'border-sky-200', text: 'text-sky-700', hover: 'hover:bg-sky-50' },
    rose: { bg: 'bg-rose-100', icon: 'text-rose-600', border: 'border-rose-200', text: 'text-rose-700', hover: 'hover:bg-rose-50' },
    violet: { bg: 'bg-violet-100', icon: 'text-violet-600', border: 'border-violet-200', text: 'text-violet-700', hover: 'hover:bg-violet-50' },
    teal: { bg: 'bg-teal-100', icon: 'text-teal-600', border: 'border-teal-200', text: 'text-teal-700', hover: 'hover:bg-teal-50' },
  };

  const gradientMap: Record<string, string> = {
    amber: 'from-amber-400 to-orange-400',
    emerald: 'from-emerald-400 to-teal-400',
    sky: 'from-sky-400 to-primary-400',
    rose: 'from-rose-400 to-accent-400',
    violet: 'from-violet-400 to-secondary-400',
    teal: 'from-teal-400 to-emerald-400',
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 mb-5">
              <i className="ri-graduation-cap-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">고3구역</h1>
            <p className="text-sm text-foreground-600">졸업을 앞둔 고3 학생들을 위한 특별한 공간</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
                {[
                  { label: '고3 학생', value: status.totalSeniors, icon: 'ri-user-star-line', color: 'amber' },
                  { label: '연계 예정', value: `${status.totalSeniors}명`, icon: 'ri-link', color: 'sky' },
                  { label: '곧 공개될 편지', value: status.upcomingRevealCount, icon: 'ri-message-3-line', color: 'violet' },
                  { label: '헌신예배 준비', value: `${status.checklistProgress}%`, icon: 'ri-task-line', color: 'teal' },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="bg-background-100 border border-background-200 rounded-2xl p-4 text-center"
                  >
                    <div className={`w-8 h-8 rounded-lg ${stat.color === 'amber' ? 'bg-amber-100' : stat.color === 'sky' ? 'bg-sky-100' : stat.color === 'violet' ? 'bg-violet-100' : 'bg-teal-100'} flex items-center justify-center mx-auto mb-2`}>
                      <i className={`${stat.icon} text-sm ${stat.color === 'amber' ? 'text-amber-600' : stat.color === 'sky' ? 'text-sky-600' : stat.color === 'violet' ? 'text-violet-600' : 'text-teal-600'}`}></i>
                    </div>
                    <p className="text-xl font-bold text-foreground-950">{stat.value}</p>
                    <p className="text-xs text-foreground-600 mt-1">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* ===== PC (md 이상) — 기존 카드 그리드 그대로 ===== */}
              <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map((feature, i) => {
                  const c = colorMap[feature.color];
                  return (
                    <motion.div
                      key={feature.path}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.06 }}
                    >
                      <Link
                        to={feature.path}
                        className={`block bg-background-100 border ${c.border} rounded-2xl p-5 transition-all duration-200 ${c.hover} cursor-pointer group`}
                      >
                        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
                          <i className={`${feature.icon} text-lg ${c.icon}`}></i>
                        </div>
                        <h3 className="text-sm font-bold text-foreground-950 mb-1.5 group-hover:text-foreground-800 transition-colors">{feature.label}</h3>
                        <p className="text-xs text-foreground-600 leading-relaxed">{feature.desc}</p>
                        <div className="flex items-center gap-1 mt-3 text-xs font-medium md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <span className={c.text}>바로가기</span>
                          <i className={`ri-arrow-right-line ${c.icon} text-xs`}></i>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              {/* ===== 모바일 (md 미만) — 벤또 2열 카드 그리드 ===== */}
              <div className="md:hidden grid grid-cols-2 gap-3">
                {features.map((feature, i) => (
                  <motion.div
                    key={feature.path}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 10) * 0.06 }}
                  >
                    <InstaCard className="p-4">
                      <Link to={feature.path} className="block">
                        <InstaCard.Icon className={`bg-gradient-to-br ${gradientMap[feature.color]} w-10 h-10`}>
                          <i className={`${feature.icon} text-white text-lg`}></i>
                        </InstaCard.Icon>
                        <InstaCard.Title className="text-sm leading-tight">{feature.label}</InstaCard.Title>
                        <InstaCard.Subtitle className="line-clamp-2 leading-snug">{feature.desc}</InstaCard.Subtitle>
                      </Link>
                    </InstaCard>
                  </motion.div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
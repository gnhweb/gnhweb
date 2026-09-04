import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_HIERARCHY } from '@/types/auth';
import type { UserRole } from '@/types/auth';
import { MEETING_CLUB_OPTIONS, MEETING_CLUB_LABELS, canAccessMeetingClub } from '@/constants/meetingClubs';

import type { MeetingMinute } from '@/types/meeting';

const TAG_COLORS: Record<string, string> = {
  출석률: 'bg-rose-100 text-rose-700',
  심방: 'bg-violet-100 text-violet-700',
  수련회: 'bg-amber-100 text-amber-700',
  예산: 'bg-emerald-100 text-emerald-700',
  홍보: 'bg-sky-100 text-sky-700',
  SNS: 'bg-pink-100 text-pink-700',
  콘텐츠: 'bg-indigo-100 text-indigo-700',
  시스템개선: 'bg-teal-100 text-teal-700',
  사역방향: 'bg-primary-100 text-primary-700',
  동아리협력: 'bg-secondary-100 text-secondary-700',
};

export default function MeetingsPage() {
  const { profile, secondaryClubs } = useAuth();
  const [meetings, setMeetings] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedClub, setSelectedClub] = useState<string>('all');

  const role = profile?.role as UserRole;
  const canWrite = role && ROLE_HIERARCHY[role] >= ROLE_HIERARCHY.assistant_zone_leader;

  useEffect(() => {
    const load = async () => {
      try {
        const { supabase } = await import('@/lib/supabase');
        const { data, error } = await supabase
          .from('meeting_minutes')
          .select('*')
          .order('date', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          setMeetings(
            data.map((m: Record<string, unknown>) => ({
              id: m.id as string,
              date: m.date as string,
              title: m.title as string,
              club: (m.club as string) || undefined,
              attendees: (m.attendees as string[]) || [],
              summary: (m.summary as string) || '',
              decisions: (m.decisions as string[]) || [],
              issues: (m.issues as string[]) || [],
              bottlenecks: (m.bottlenecks as string[]) || [],
              unresolvedItems: (m.unresolved_items as string[]) || [],
              tags: (m.tags as string[]) || [],
              authorId: m.author_id as string,
              authorName: (m.author_name as string) || '익명',
              createdAt: m.created_at as string,
            }))
          );
        }
      } catch {
        setError('회의록을 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
      }
      setLoading(false);
    };
    load();
  }, []);

  const accessibleMeetings = useMemo(
    () => meetings.filter(m => canAccessMeetingClub(m.club, role, profile?.club, secondaryClubs)),
    [meetings, role, profile?.club, secondaryClubs]
  );

  const availableClubTabs = useMemo(
    () => MEETING_CLUB_OPTIONS.filter(opt => canAccessMeetingClub(opt.id, role, profile?.club, secondaryClubs)),
    [role, profile?.club, secondaryClubs]
  );

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    accessibleMeetings.forEach(m => m.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [accessibleMeetings]);

  const filtered = useMemo(() => {
    return accessibleMeetings.filter(m => {
      const matchSearch = !search || m.title.includes(search) || m.attendees.some(a => a.includes(search));
      const matchTag = !selectedTag || m.tags.includes(selectedTag);
      const matchClub = selectedClub === 'all' || (m.club || '') === selectedClub;
      return matchSearch && matchTag && matchClub;
    });
  }, [accessibleMeetings, search, selectedTag, selectedClub]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin mx-auto mb-4"></div>
        <p className="text-sm text-foreground-600">회의록을 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">사명자 회의록</h1>
            <p className="text-sm text-foreground-600">회의 내용을 기록하고 AI로 반복 이슈를 분석합니다</p>
          </div>
          {canWrite && (
            <Link
              to="/meetings/write"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap cursor-pointer"
            >
              <i className="ri-add-line text-lg"></i>
              회의록 작성
            </Link>
          )}
        </div>

        <Link
          to="/notebook"
          className="group flex items-center gap-4 mb-6 p-4 md:p-5 rounded-2xl bg-gradient-to-br from-primary-600 via-primary-500 to-violet-600 hover:brightness-105 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_15%_30%,white,transparent_35%)]"></div>
          <div className="w-11 h-11 rounded-xl bg-background-100/15 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0 relative">
            <i className="ri-robot-2-fill text-white text-xl"></i>
          </div>
          <div className="flex-1 min-w-0 relative">
            <p className="text-sm font-bold text-white">AI 회의 코파일럿과 대화하기</p>
            <p className="text-xs text-white/75 mt-0.5">강릉학생회만의 독자적인 AI 회의 도우미 — 안건 구조화부터 Action Item 도출까지</p>
          </div>
          <i className="ri-arrow-right-line text-white/80 text-xl group-hover:translate-x-1 transition-transform flex-shrink-0 relative"></i>
        </Link>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4 -mx-1 px-1">
          <button
            onClick={() => setSelectedClub('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${selectedClub === 'all' ? 'bg-primary-500 text-white' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}
          >
            전체
          </button>
          {availableClubTabs.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedClub(opt.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${selectedClub === opt.id ? 'bg-primary-500 text-white' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              placeholder="회의 제목 또는 참석자 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-background-100 border border-background-200 rounded-xl outline-none focus:border-primary-400 transition-colors"
            />
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-foreground-400 text-sm"></i>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${!selectedTag ? 'bg-primary-100 text-primary-700' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}
            >
              전체
            </button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${selectedTag === tag ? (TAG_COLORS[tag] || 'bg-primary-100 text-primary-700') : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-foreground-500">
            <i className="ri-chat-check-line text-4xl block mb-3"></i>
            {error ? (
              <>
                <p className="text-sm">{error}</p>
                <button onClick={() => { setError(null); setLoading(true); }} className="mt-3 px-4 py-2 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 cursor-pointer">다시 시도</button>
              </>
            ) : (
              <>
                <p className="text-sm">아직 등록된 회의록이 없어요</p>
                <p className="text-xs mt-1">새로운 회의록을 작성해보세요</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((meeting, idx) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: idx * 0.04 }}
              >
                <Link
                  to={`/meetings/${meeting.id}`}
                  className="block bg-background-100 border border-background-200 rounded-2xl p-5 hover:border-primary-300 transition-all duration-200 cursor-pointer group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-base font-bold text-foreground-950 group-hover:text-primary-700 transition-colors truncate">
                          {meeting.title}
                        </h3>
                        {meeting.club && (
                          <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-100 text-secondary-700 whitespace-nowrap">
                            {MEETING_CLUB_LABELS[meeting.club as keyof typeof MEETING_CLUB_LABELS] || meeting.club}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground-600 line-clamp-2 mb-3">{meeting.summary}</p>
                      <div className="flex items-center gap-3 text-xs text-foreground-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <i className="ri-calendar-line"></i>
                          {meeting.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <i className="ri-user-line"></i>
                          {meeting.attendees.length}명 참석
                        </span>
                        {meeting.issues.length > 0 && (
                          <span className="flex items-center gap-1 text-rose-600">
                            <i className="ri-error-warning-line"></i>
                            이슈 {meeting.issues.length}건
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <i className="ri-price-tag-3-line"></i>
                          {meeting.tags.slice(0, 3).join(', ')}{meeting.tags.length > 3 ? ` +${meeting.tags.length - 3}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center">
                      <i className="ri-arrow-right-s-line text-foreground-400 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all text-xl"></i>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

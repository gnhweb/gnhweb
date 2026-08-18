import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { MISSION_CATEGORIES } from '@/constants/missionBadges';

interface WallEntry {
  id: string;
  mission_id: string;
  mission_title: string;
  mission_category: string;
  student_id: string;
  student_name: string;
  student_club: string;
  proof_image_url: string | null;
  proof_note: string | null;
  reviewed_at: string;
}

const CLUB_LABELS: Record<string, string> = {
  saeullim: '새울림',
  cheonjipoong: '천지풍',
  cheonjihu: '천지후',
  munhwabu: '문화부',
  cheonhwarae_cheongmyeong: '천화래와 청명',
};

export default function MissionWallPage() {
  const [entries, setEntries] = useState<WallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadWall();
  }, []);

  const loadWall = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: aData, error: aErr } = await supabase
        .from('mission_assignments')
        .select('*')
        .eq('status', 'completed')
        .order('reviewed_at', { ascending: false })
        .limit(60);

      if (aErr) throw aErr;
      if (!aData || aData.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const missionIds = [...new Set(aData.map((a: { mission_id: string }) => a.mission_id))];
      const { data: mData } = await supabase
        .from('missions')
        .select('id, title, category')
        .in('id', missionIds);

      const missionMap = new Map((mData || []).map((m: { id: string; title: string; category: string }) => [m.id, m]));

      const studentIds = [...new Set(aData.map((a: { student_id: string }) => a.student_id))];
      const { data: uData } = await supabase
        .from('user_roles')
        .select('user_id, name, club')
        .in('user_id', studentIds)
        .eq('is_active', true);

      const userMap = new Map((uData || []).map((u: { user_id: string; name: string; club: string }) => [u.user_id, { name: u.name, club: u.club }]));

      const wall: WallEntry[] = aData.map((a: { id: string; mission_id: string; student_id: string; proof_image_url: string | null; proof_note: string | null; reviewed_at: string }) => {
        const mission = missionMap.get(a.mission_id);
        const user = userMap.get(a.student_id);
        return {
          id: a.id,
          mission_id: a.mission_id,
          mission_title: mission?.title || '삭제된 미션',
          mission_category: mission?.category || 'general',
          student_id: a.student_id,
          student_name: user?.name || '알 수 없음',
          student_club: user?.club || '',
          proof_image_url: a.proof_image_url,
          proof_note: a.proof_note,
          reviewed_at: a.reviewed_at,
        };
      });

      setEntries(wall);
    } catch {
      setError('인증 내역을 불러오는 중 문제가 발생했어요. 다시 시도해주세요');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6 md:mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-emerald-100 border border-emerald-200 mb-5">
              <i className="ri-gallery-line text-3xl text-emerald-600"></i>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-1">사명 인증 게시판</h1>
            <p className="text-sm text-foreground-600">완료된 작은 사명들의 인증 기록이에요</p>
          </div>

          {error && (
            <div className="mb-6 px-4 py-3 bg-accent-100 border border-accent-200 rounded-xl flex items-center justify-between text-sm text-accent-700">
              <span className="flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</span>
              <button onClick={loadWall} className="text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          {entries.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-background-200 flex items-center justify-center mx-auto mb-4">
                <i className="ri-medal-line text-3xl text-foreground-400"></i>
              </div>
              <p className="text-sm text-foreground-500 mb-1">아직 인증된 사명이 없어요</p>
              <p className="text-xs text-foreground-400">미션을 완료하면 여기에 인증 기록이 표시됩니다</p>
              <Link
                to="/missions/board"
                className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-medal-line"></i>내 작은 사명 보기
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {entries.map((entry, idx) => {
                const cat = MISSION_CATEGORIES[entry.mission_category] || MISSION_CATEGORIES.general;
                const clubLabel = CLUB_LABELS[entry.student_club] || entry.student_club;
                const reviewDate = new Date(entry.reviewed_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="bg-background-100 border border-background-200 rounded-2xl overflow-hidden hover:border-emerald-200 transition-colors"
                  >
                    {/* Proof image */}
                    {entry.proof_image_url ? (
                      <button
                        onClick={() => setSelectedImage(entry.proof_image_url)}
                        className="w-full aspect-square bg-background-200 relative overflow-hidden cursor-pointer group"
                      >
                        <img
                          src={entry.proof_image_url}
                          alt={`${entry.mission_title} 인증 사진`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <i className="ri-zoom-in-line text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                        </div>
                      </button>
                    ) : (
                      <div className="w-full aspect-square bg-background-200 flex items-center justify-center">
                        <i className={`${cat.icon} text-4xl text-foreground-300`}></i>
                      </div>
                    )}

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <i className={`${cat.icon} text-emerald-600 text-sm`}></i>
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-foreground-950 truncate">{entry.mission_title}</h3>
                          <p className="text-xs text-foreground-500">{cat.label}</p>
                        </div>
                      </div>

                      {entry.proof_note && (
                        <p className="text-xs text-foreground-600 leading-relaxed mb-3 line-clamp-2">
                          "{entry.proof_note}"
                        </p>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-foreground-500">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground-700">{entry.student_name}</span>
                          {clubLabel && (
                            <span className="px-1.5 py-0.5 rounded-full bg-background-200 text-foreground-500">
                              {clubLabel}
                            </span>
                          )}
                        </div>
                        <span>{reviewDate}</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Image lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-background-100/20 flex items-center justify-center cursor-pointer hover:bg-background-100/30 transition-colors"
          >
            <i className="ri-close-line text-white text-xl"></i>
          </button>
          <img
            src={selectedImage}
            alt="인증 사진 확대"
            className="max-w-full max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
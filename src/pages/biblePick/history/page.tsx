import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const HISTORY_STORAGE_KEY = 'bible_picks_history';

interface BiblePickRecord {
  id: string;
  emotion: string;
  situation: string;
  verse: string;
  reference: string;
  practice: string;
  prayers: string[];
  created_at: string;
}

const ALL_EMOTIONS = [
  '기쁨', '감사', '설렘', '평안', '슬픔', '불안', '걱정', '두려움',
  '답답함', '화남', '지침', '외로움', '무기력', '혼란', '후회', '미안함', '희망',
];

const EMOTION_COLORS: Record<string, string> = {
  '기쁨': 'bg-primary-100 text-primary-700',
  '감사': 'bg-accent-100 text-accent-700',
  '설렘': 'bg-secondary-100 text-secondary-700',
  '평안': 'bg-secondary-100 text-secondary-700',
  '슬픔': 'bg-accent-100 text-accent-700',
  '불안': 'bg-background-200 text-foreground-700',
  '걱정': 'bg-secondary-100 text-secondary-700',
  '두려움': 'bg-accent-100 text-accent-700',
  '답답함': 'bg-accent-100 text-accent-700',
  '화남': 'bg-accent-100 text-accent-700',
  '지침': 'bg-secondary-100 text-secondary-700',
  '외로움': 'bg-secondary-100 text-secondary-700',
  '무기력': 'bg-background-200 text-foreground-700',
  '혼란': 'bg-background-200 text-foreground-700',
  '후회': 'bg-accent-100 text-accent-700',
  '미안함': 'bg-accent-100 text-accent-700',
  '희망': 'bg-primary-100 text-primary-700',
};

const EMOTION_TAB_COLORS: Record<string, string> = {
  '기쁨': 'text-primary-700 bg-primary-100',
  '감사': 'text-accent-700 bg-accent-100',
  '설렘': 'text-secondary-700 bg-secondary-100',
  '평안': 'text-secondary-700 bg-secondary-100',
  '슬픔': 'text-accent-700 bg-accent-100',
  '불안': 'text-foreground-700 bg-background-200',
  '걱정': 'text-secondary-700 bg-secondary-100',
  '두려움': 'text-accent-700 bg-accent-100',
  '답답함': 'text-accent-700 bg-accent-100',
  '화남': 'text-accent-700 bg-accent-100',
  '지침': 'text-secondary-700 bg-secondary-100',
  '외로움': 'text-secondary-700 bg-secondary-100',
  '무기력': 'text-foreground-700 bg-background-200',
  '혼란': 'text-foreground-700 bg-background-200',
  '후회': 'text-accent-700 bg-accent-100',
  '미안함': 'text-accent-700 bg-accent-100',
  '희망': 'text-primary-700 bg-primary-100',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${day} ${h}:${min}`;
  } catch {
    return iso;
  }
}

export default function BiblePickHistory() {
  const { user } = useAuth();
  const [records, setRecords] = useState<BiblePickRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEmotion, setSelectedEmotion] = useState<string>('전체');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    const all: BiblePickRecord[] = [];

    if (user) {
      const { data, error: dbErr } = await supabase
        .from('bible_picks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (dbErr) {
        setError('기록을 불러오지 못했습니다.');
      } else if (data) {
        for (const row of data) {
          all.push({
            id: row.id,
            emotion: row.emotion,
            situation: row.situation,
            verse: row.verse,
            reference: row.reference,
            practice: row.practice || '',
            prayers: Array.isArray(row.prayers) ? row.prayers : [],
            created_at: row.created_at,
          });
        }
      }
    }

    try {
      const local = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
      for (const item of local) {
        all.push({
          id: item.created_at || `local-${Math.random()}`,
          emotion: item.emotion,
          situation: item.situation,
          verse: item.verse,
          reference: item.reference,
          practice: item.practice || '',
          prayers: Array.isArray(item.prayers) ? item.prayers : [],
          created_at: item.created_at || '',
        });
      }
    } catch {
      // ignore localStorage parse error
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRecords(all);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 감정별 카운트 계산
  const emotionCounts = useMemo(() => {
    const counts: Record<string, number> = { '전체': records.length };
    for (const r of records) {
      counts[r.emotion] = (counts[r.emotion] || 0) + 1;
    }
    return counts;
  }, [records]);

  // 필터링된 기록
  const filteredRecords = useMemo(() => {
    if (selectedEmotion === '전체') return records;
    return records.filter((r) => r.emotion === selectedEmotion);
  }, [records, selectedEmotion]);

  const handleDelete = async (record: BiblePickRecord) => {
    setDeletingId(record.id);

    if (user && record.id && !record.id.startsWith('local-')) {
      const { error: delErr } = await supabase
        .from('bible_picks')
        .delete()
        .eq('id', record.id);

      if (delErr) {
        setError('삭제에 실패했습니다.');
        setDeletingId(null);
        return;
      }
    } else {
      try {
        const local = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
        const filtered = local.filter(
          (item: BiblePickRecord) => item.created_at !== record.created_at
        );
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered));
      } catch {
        // ignore
      }
    }

    setRecords((prev) => prev.filter((r) => r.id !== record.id));
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-3 border-primary-200 animate-spin border-t-transparent"></div>
          </div>
          <p className="text-foreground-600 text-sm">기록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-14">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-[20px] bg-background-100 border border-background-200 mb-4">
            <i className="ri-history-line text-2xl text-primary-600"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">나의 말씀 히스토리</h1>
          <p className="text-sm text-foreground-600">지금까지 주신 말씀을 모아서 묵상해보세요</p>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-accent-100 border border-accent-200 rounded-[20px] flex items-center gap-3">
            <i className="ri-error-warning-line text-accent-600"></i>
            <p className="text-sm text-accent-700">{error}</p>
            <button
              onClick={loadRecords}
              className="ml-auto text-sm text-accent-600 hover:text-accent-800 font-medium cursor-pointer whitespace-nowrap"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Emotion Filter Tabs */}
        {records.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {/* 전체 탭 */}
              <button
                onClick={() => setSelectedEmotion('전체')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer flex-shrink-0 ${
                  selectedEmotion === '전체'
                    ? 'bg-foreground-950 text-background-50'
                    : 'bg-background-100 text-foreground-600 hover:text-foreground-950 hover:bg-background-50 border border-background-200'
                }`}
              >
                전체
                <span className={`text-xs ${selectedEmotion === '전체' ? 'text-white/70' : 'text-gray-400'}`}>
                  {emotionCounts['전체']}
                </span>
              </button>

              {/* 감정별 탭 - 기록이 있는 감정만 표시 */}
              {ALL_EMOTIONS.filter((e) => emotionCounts[e] > 0).map((emotion) => {
                const isActive = selectedEmotion === emotion;
                const tabColor = EMOTION_TAB_COLORS[emotion] || 'text-gray-600 bg-gray-100';
                return (
                  <button
                    key={emotion}
                    onClick={() => setSelectedEmotion(emotion)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 whitespace-nowrap cursor-pointer flex-shrink-0 ${
                      isActive
                        ? `${tabColor}`
                        : 'bg-background-100 text-foreground-600 hover:text-foreground-950 hover:bg-background-50 border border-background-200'
                    }`}
                  >
                    {emotion}
                    <span className={`text-xs ${isActive ? 'opacity-70' : 'text-gray-400'}`}>
                      {emotionCounts[emotion]}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Empty State - no records at all */}
        {!loading && records.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-primary-100 flex items-center justify-center">
              <i className="ri-book-2-line text-3xl text-primary-400"></i>
            </div>
            <h3 className="text-lg font-semibold text-foreground-950 mb-2">아직 뽑은 말씀이 없어요</h3>
            <p className="text-sm text-foreground-600 mb-6">말씀뽑기에서 감정을 선택하고 말씀을 받아보세요</p>
            <Link
              to="/bible-pick"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-book-open-line"></i>
              말씀뽑기 하러가기
            </Link>
          </motion.div>
        )}

        {/* Empty State - filtered result */}
        {records.length > 0 && filteredRecords.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-background-200 flex items-center justify-center">
              <i className="ri-emotion-line text-2xl text-foreground-500"></i>
            </div>
            <h3 className="text-base font-semibold text-foreground-700 mb-1">
              '{selectedEmotion}' 감정으로 뽑은 말씀이 없어요
            </h3>
            <p className="text-sm text-foreground-600 mb-5">다른 감정을 선택하거나 새로운 말씀을 뽑아보세요</p>
            <button
              onClick={() => setSelectedEmotion('전체')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-foreground-600 hover:text-foreground-950 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-arrow-go-back-line"></i>
              전체 보기
            </button>
          </motion.div>
        )}

        {/* Records List */}
        <AnimatePresence>
          {filteredRecords.map((record, index) => (
            <motion.div
              key={record.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
              transition={{ delay: Math.min(index * 0.05, 0.3) }}
              className="bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 mb-4 relative overflow-hidden"
            >
              {/* Top accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary-500"></div>

              {/* Header row: emotion + date */}
              <div className="flex items-center justify-between mb-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${EMOTION_COLORS[record.emotion] || 'bg-gray-100 text-gray-600'}`}>
                  {record.emotion}
                </span>
                <span className="text-xs text-foreground-600">{formatDate(record.created_at)}</span>
              </div>

              {/* Situation */}
              <div className="mb-3">
                <p className="text-sm text-foreground-600 mb-0.5">상황</p>
                <p className="text-sm text-foreground-700 font-medium">{record.situation}</p>
              </div>

              {/* Verse */}
              <div className="mb-4">
                <p className="font-quote text-base md:text-lg leading-[1.75] text-foreground-900">
                  {record.verse}
                </p>
                <p className="text-right text-xs font-semibold text-primary-600 mt-1.5">{record.reference}</p>
              </div>

              {/* Practice + Prayers */}
              {(record.practice || (record.prayers && record.prayers.length > 0)) && (
                <div className="border-t border-background-200 pt-3.5 mb-1 space-y-3">
                  {record.practice && (
                    <div className="flex gap-2.5">
                      <i className="ri-footprint-line text-accent-600 text-sm mt-0.5 flex-shrink-0"></i>
                      <p className="text-sm text-foreground-700 leading-relaxed">{record.practice}</p>
                    </div>
                  )}
                  {record.prayers && record.prayers.length > 0 && (
                    <div className="flex gap-2.5">
                      <i className="ri-moon-line text-secondary-600 text-sm mt-0.5 flex-shrink-0"></i>
                      <div className="space-y-1">
                        {record.prayers.map((p, i) => (
                          <p key={i} className="text-sm text-foreground-700 leading-relaxed">{p}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Delete button */}
              <div className="text-right">
                <button
                  onClick={() => handleDelete(record)}
                  disabled={deletingId === record.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-foreground-600 hover:text-accent-600 hover:bg-accent-100 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <i className={`${deletingId === record.id ? 'ri-loader-4-line animate-spin' : 'ri-delete-bin-line'}`}></i>
                  삭제
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Bottom CTA */}
        {records.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center mt-8"
          >
            <Link
              to="/bible-pick"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-primary-200 text-primary-700 font-semibold text-sm hover:bg-primary-50 hover:border-primary-400 transition-all duration-300 cursor-pointer whitespace-nowrap"
            >
              <i className="ri-add-line"></i>
              새로운 말씀 뽑기
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
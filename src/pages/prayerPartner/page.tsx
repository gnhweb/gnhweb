import { formatLocalDate } from '@/lib/date';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface MemberData {
  user_id: string;
  name: string;
  gender: string;
}

interface Pair {
  id: string;
  pairName: string;
  members: string[];
  startDate: string;
  status: 'active' | 'completed';
}

export default function PrayerPartner() {
  const { user, profile } = useAuth();
  const [allMembers, setAllMembers] = useState<MemberData[]>([]);
  const [currentPairs, setCurrentPairs] = useState<Pair[]>([]);
  const [history, setHistory] = useState<Pair[]>([]);
  const [showGenerate, setShowGenerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [insufficient, setInsufficient] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('user_id, name, gender, role')
          .eq('is_active', true)
          .not('role', 'in', '("teacher","chief")');
        if (data) {
          setAllMembers(data.map((d: any) => ({ user_id: d.user_id, name: d.name, gender: d.gender || '' })));
        }

        const { data: dbPairs } = await supabase
          .from('prayer_partners')
          .select('*')
          .order('created_at', { ascending: false });

        if (dbPairs) {
          const mapped: Pair[] = dbPairs.map((p: any) => ({
            id: p.id,
            pairName: p.pair_name,
            members: p.members,
            startDate: p.start_date,
            status: p.status,
          }));
          setCurrentPairs(mapped.filter(p => p.status === 'active'));
          setHistory(mapped.filter(p => p.status === 'completed'));
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    loadData();
  }, []);

  function shuffleAndPair(names: string[]): string[][] {
    const arr = [...names];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const pairs: string[][] = [];
    for (let i = 0; i < arr.length; i += 2) {
      if (i + 1 < arr.length) {
        pairs.push([arr[i], arr[i + 1]]);
      } else {
        if (pairs.length > 0) {
          pairs[pairs.length - 1].push(arr[i]);
        } else {
          pairs.push([arr[i]]);
        }
      }
    }
    return pairs;
  }

  const handleGenerate = async () => {
    const males = allMembers.filter(m => m.gender === '남');
    const females = allMembers.filter(m => m.gender === '여');
    const others = allMembers.filter(m => m.gender !== '남' && m.gender !== '여');

    const allPairs: string[][] = [];
    allPairs.push(...shuffleAndPair(males.map(m => m.name)));
    allPairs.push(...shuffleAndPair(females.map(m => m.name)));
    if (others.length >= 2) {
      allPairs.push(...shuffleAndPair(others.map(m => m.name)));
    } else if (others.length === 1 && allPairs.length > 0) {
      allPairs[allPairs.length - 1].push(others[0].name);
    }

    if (allPairs.length === 0) {
      setInsufficient(true);
      return;
    }

    setSaving(true);

    try {
      // Move current active pairs to completed
      if (currentPairs.length > 0) {
        const { error: updateError } = await supabase
          .from('prayer_partners')
          .update({ status: 'completed' })
          .eq('status', 'active');
        if (updateError) console.error('Failed to complete old pairs:', updateError);
      }

      // Insert new pairs
      const today = formatLocalDate(new Date());
      const insertData = allPairs.map((p, i) => ({
        pair_name: `기도 파트너 ${i + 1}조`,
        members: p,
        start_date: today,
        status: 'active',
      }));

      const { error: insertError } = await supabase
        .from('prayer_partners')
        .insert(insertData);
      if (insertError) throw insertError;

      // Reload from DB
      const { data: dbPairs } = await supabase
        .from('prayer_partners')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbPairs) {
        const mapped: Pair[] = dbPairs.map((p: any) => ({
          id: p.id,
          pairName: p.pair_name,
          members: p.members,
          startDate: p.start_date,
          status: p.status,
        }));
        setCurrentPairs(mapped.filter(p => p.status === 'active'));
        setHistory(mapped.filter(p => p.status === 'completed'));
      }

      // Send notifications
      const nameToId = new Map(allMembers.map(m => [m.name, m.user_id]));
      for (const pair of allPairs) {
        for (const memberName of pair) {
          const memberId = nameToId.get(memberName);
          if (memberId) {
            const partnerNames = pair.filter(n => n !== memberName).join(', ');
            try {
              await supabase.from('notifications').insert({
                user_id: memberId,
                type: 'prayer_partner',
                title: '신앙 짝꿍 매칭 완료!',
                message: `이번 달 신앙 짝꿍이 매칭되었습니다: ${partnerNames}`,
                is_read: false,
                link_url: '/prayer-partner',
              });
            } catch { /* notification non-critical */ }
          }
        }
      }
    } catch { /* ignore */ }

    setSaving(false);
    setShowGenerate(false);
    setInsufficient(false);
  };

  const handleDeleteHistory = async () => {
    if (!confirm('지난 매칭 기록을 모두 삭제할까요?')) return;
    try {
      await supabase.from('prayer_partners').delete().eq('status', 'completed');
      setHistory([]);
    } catch { /* ignore */ }
  };

  const handleDeleteActive = async () => {
    if (!confirm('현재 활성 매칭을 모두 삭제할까요?')) return;
    try {
      await supabase.from('prayer_partners').delete().eq('status', 'active');
      setCurrentPairs([]);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-rose-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-rose-100 border border-rose-200 mb-5">
              <i className="ri-heart-pulse-line text-3xl text-rose-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">랜덤 신앙 짝꿍</h1>
            <p className="text-sm text-foreground-600">남자는 남자끼리, 여자는 여자끼리 — 매달 랜덤으로 매칭된 파트너와 서로 기도해주는 따뜻한 연결</p>
          </div>

          {insufficient && (
            <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-5 mb-6 text-center">
              <p className="text-sm text-amber-700 font-semibold">매칭 가능한 인원이 부족합니다</p>
              <p className="text-xs text-amber-600 mt-1">같은 성별끼리 최소 2명 이상의 학생회원이 가입되어 있어야 매칭이 가능해요</p>
            </div>
          )}

          {user && (
            <div className="mb-6">
              <button
                onClick={() => setShowGenerate(true)}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-500 text-background-50 text-sm font-bold hover:bg-rose-600 transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {saving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> 저장 중...</> : <><i className="ri-shuffle-line"></i> 새 매칭 생성</>}
              </button>
            </div>
          )}

          {currentPairs.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-foreground-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>이번 달 짝꿍
                </h2>
                <button
                  onClick={handleDeleteActive}
                  className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  <i className="ri-delete-bin-line mr-1"></i>비우기
                </button>
              </div>
              <div className="space-y-3">
                {currentPairs.map((pair, idx) => (
                  <motion.div key={pair.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.3) }} className="bg-background-100 border border-background-200 rounded-[20px] p-4">
                    <p className="text-xs font-medium text-foreground-600 mb-2">{pair.pairName} · {pair.startDate}부터</p>
                    <div className="flex items-center gap-3">
                      {pair.members.map((m, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-rose-600">{m.charAt(0)}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground-900">{m}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {currentPairs.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3">
                <i className="ri-heart-line text-2xl text-rose-300"></i>
              </div>
              <p className="text-sm text-foreground-600">아직 매칭이 없어요. 새 매칭을 생성해보세요!</p>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-foreground-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-foreground-400"></span>지난 매칭 ({history.length})
                </h2>
                <button
                  onClick={handleDeleteHistory}
                  className="text-xs text-rose-500 hover:text-rose-600 cursor-pointer"
                >
                  <i className="ri-delete-bin-line mr-1"></i>기록 삭제
                </button>
              </div>
              <div className="space-y-2">
                {history.map((pair, idx) => (
                  <div key={pair.id || idx} className="flex items-center gap-3 p-3 bg-background-100 rounded-xl">
                    <span className="text-xs text-foreground-600 flex-shrink-0">{pair.startDate}</span>
                    <div className="flex items-center gap-2">
                      {pair.members.map((m, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-[10px] font-bold text-gray-500">{m.charAt(0)}</span>
                          </div>
                          <span className="text-sm text-foreground-700">{m}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {showGenerate && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowGenerate(false)}>
          <div className="bg-background-100 rounded-[20px] p-6 max-w-sm w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <i className="ri-shuffle-line text-2xl text-rose-600"></i>
            </div>
            <h3 className="text-lg font-bold mb-2">새 매칭 생성</h3>
            <p className="text-sm text-foreground-600 mb-2">이전 매칭은 지난 기록으로 저장되고,</p>
            <p className="text-sm text-foreground-600 mb-6">남자끼리, 여자끼리 새로운 짝꿍이 랜덤으로 매칭됩니다</p>
            <div className="flex gap-2">
              <button onClick={() => setShowGenerate(false)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm cursor-pointer">취소</button>
              <button onClick={handleGenerate} className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold cursor-pointer whitespace-nowrap">매칭하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
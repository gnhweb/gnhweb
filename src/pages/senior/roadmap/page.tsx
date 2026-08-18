import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface PrayerTopic {
  id: string;
  phase_key: string;
  label: string;
  content: string;
  sort_order: number;
}

interface Encouragement {
  id: string;
  phase_key: string;
  author_name: string;
  content: string;
  sort_order: number;
}

interface MilestonePhase {
  key: string;
  label: string;
  period: string;
  icon: string;
  color: 'amber' | 'orange' | 'rose' | 'emerald' | 'violet' | 'sky';
}

const ACADEMIC_PHASES: MilestonePhase[] = [
  { key: 'summer_vacation', label: '여름방학 집중', period: '7~8월', icon: 'ri-sun-line', color: 'amber' },
  { key: 'application_prep', label: '원서접수 준비', period: '9월', icon: 'ri-file-text-line', color: 'orange' },
  { key: 'application_submit', label: '원서접수', period: '9~10월', icon: 'ri-file-copy-line', color: 'rose' },
  { key: 'csat', label: '수능', period: '11월', icon: 'ri-pencil-line', color: 'violet' },
  { key: 'result_waiting', label: '결과 발표 대기', period: '12월', icon: 'ri-hourglass-line', color: 'sky' },
  { key: 'post_admission', label: '합격 후 준비', period: '12~2월', icon: 'ri-check-double-line', color: 'emerald' },
];

const PHASE_CLASSES: Record<string, { bg: string; border: string; text: string; dotBg: string; lineBg: string }> = {
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dotBg: 'bg-amber-100', lineBg: 'bg-amber-200' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dotBg: 'bg-orange-100', lineBg: 'bg-orange-200' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dotBg: 'bg-rose-100', lineBg: 'bg-rose-200' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dotBg: 'bg-violet-100', lineBg: 'bg-violet-200' },
  sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dotBg: 'bg-sky-100', lineBg: 'bg-sky-200' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dotBg: 'bg-emerald-100', lineBg: 'bg-emerald-200' },
};

interface UserProgress {
  phase_key: string;
  completed: boolean;
}

export default function SeniorRoadmap() {
  const { user, profile, hasRole } = useAuth();
  const isTeacherOrChief = hasRole('teacher') || hasRole('chief');

  const [prayerTopics, setPrayerTopics] = useState<PrayerTopic[]>([]);
  const [encouragements, setEncouragements] = useState<Encouragement[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  // Editing state
  const [editingPrayer, setEditingPrayer] = useState<string | null>(null);
  const [editingPrayerContent, setEditingPrayerContent] = useState('');
  const [editingEncourage, setEditingEncourage] = useState<string | null>(null);
  const [editingEncourageContent, setEditingEncourageContent] = useState('');
  const [editingEncourageAuthor, setEditingEncourageAuthor] = useState('');
  const [showAddPrayer, setShowAddPrayer] = useState(false);
  const [showAddEncourage, setShowAddEncourage] = useState(false);
  const [newPrayerPhase, setNewPrayerPhase] = useState('summer_vacation');
  const [newPrayerLabel, setNewPrayerLabel] = useState('');
  const [newPrayerContent, setNewPrayerContent] = useState('');
  const [newEncouragePhase, setNewEncouragePhase] = useState('summer_vacation');
  const [newEncourageAuthor, setNewEncourageAuthor] = useState('');
  const [newEncourageContent, setNewEncourageContent] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prayerRes, encourageRes] = await Promise.all([
        supabase.from('prayer_topics').select('*').order('sort_order'),
        supabase.from('senior_encouragements').select('*').order('sort_order'),
      ]);
      setPrayerTopics((prayerRes.data || []) as PrayerTopic[]);
      setEncouragements((encourageRes.data || []) as Encouragement[]);

      if (user) {
        const { data: progressData } = await supabase
          .from('graduation_transition')
          .select('checklist')
          .eq('user_id', user.id)
          .maybeSingle();
        if (progressData?.checklist && Array.isArray(progressData.checklist)) {
          const completed = (progressData.checklist as any[])
            .filter((c: any) => c.completed)
            .map((c: any) => c.phase_key);
          setUserProgress(completed.map((pk: string) => ({ phase_key: pk, completed: true })));
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const togglePhaseComplete = async (phaseKey: string) => {
    if (!user || !isTeacherOrChief) return;
    const alreadyDone = userProgress.some(p => p.phase_key === phaseKey && p.completed);
    if (alreadyDone) {
      setUserProgress(prev => prev.filter(p => p.phase_key !== phaseKey));
    } else {
      setUserProgress(prev => [...prev, { phase_key: phaseKey, completed: true }]);
    }
  };

  const savePrayerTopic = async (id: string, content: string) => {
    setSaving(true);
    await supabase.from('prayer_topics').update({ content, updated_at: new Date().toISOString() }).eq('id', id);
    setPrayerTopics(prev => prev.map(p => p.id === id ? { ...p, content } : p));
    setEditingPrayer(null);
    setSaving(false);
  };

  const deletePrayerTopic = async (id: string) => {
    await supabase.from('prayer_topics').delete().eq('id', id);
    setPrayerTopics(prev => prev.filter(p => p.id !== id));
  };

  const addPrayerTopic = async () => {
    if (!newPrayerLabel.trim() || !newPrayerContent.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('prayer_topics').insert({
      phase_key: newPrayerPhase,
      label: newPrayerLabel.trim(),
      content: newPrayerContent.trim(),
      sort_order: prayerTopics.length,
      created_by: user?.id,
    }).select().single();
    if (data) setPrayerTopics(prev => [...prev, data as PrayerTopic]);
    setShowAddPrayer(false);
    setNewPrayerLabel('');
    setNewPrayerContent('');
    setSaving(false);
  };

  const saveEncouragement = async (id: string) => {
    setSaving(true);
    await supabase.from('senior_encouragements').update({
      author_name: editingEncourageAuthor,
      content: editingEncourageContent,
    }).eq('id', id);
    setEncouragements(prev => prev.map(e => e.id === id ? { ...e, author_name: editingEncourageAuthor, content: editingEncourageContent } : e));
    setEditingEncourage(null);
    setSaving(false);
  };

  const deleteEncouragement = async (id: string) => {
    await supabase.from('senior_encouragements').delete().eq('id', id);
    setEncouragements(prev => prev.filter(e => e.id !== id));
  };

  const addEncouragement = async () => {
    if (!newEncourageAuthor.trim() || !newEncourageContent.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('senior_encouragements').insert({
      phase_key: newEncouragePhase,
      author_name: newEncourageAuthor.trim(),
      content: newEncourageContent.trim(),
      sort_order: encouragements.length,
      created_by: user?.id,
    }).select().single();
    if (data) setEncouragements(prev => [...prev, data as Encouragement]);
    setShowAddEncourage(false);
    setNewEncourageAuthor('');
    setNewEncourageContent('');
    setSaving(false);
  };

  const completedCount = userProgress.length;
  const totalCount = ACADEMIC_PHASES.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6">
            <Link to="/senior" className="inline-flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer mb-4">
              <i className="ri-arrow-left-line"></i> 고3구역
            </Link>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 mb-5">
              <i className="ri-road-map-line text-3xl text-amber-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">신앙 마일스톤 로드맵</h1>
            <p className="text-sm text-foreground-600">학업 일정과 함께 기도제목, 선배 응원을 확인하세요</p>
          </div>

          {/* Progress bar */}
          <div className="bg-background-100 border border-background-200 rounded-2xl p-5 mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground-800">전체 진행률</span>
              <span className="text-sm font-bold text-amber-600">{progressPercent}%</span>
            </div>
            <div className="h-2.5 bg-background-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full"
              />
            </div>
            <p className="text-xs text-foreground-500 mt-2">{completedCount}/{totalCount} 단계 완료</p>
          </div>

          {/* Admin controls */}
          {isTeacherOrChief && (
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <button onClick={() => setShowAddPrayer(!showAddPrayer)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold hover:bg-amber-200 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i> 기도제목 추가
              </button>
              <button onClick={() => setShowAddEncourage(!showAddEncourage)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-semibold hover:bg-violet-200 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i> 응원 메시지 추가
              </button>
              {saving && <span className="text-xs text-foreground-500">저장 중...</span>}
            </div>
          )}

          {/* Add prayer form */}
          <AnimatePresence>
            {showAddPrayer && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <select value={newPrayerPhase} onChange={e => setNewPrayerPhase(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-amber-200 bg-background-100 outline-none cursor-pointer">
                    {ACADEMIC_PHASES.map(p => <option key={p.key} value={p.key}>{p.label} ({p.period})</option>)}
                  </select>
                  <input type="text" value={newPrayerLabel} onChange={e => setNewPrayerLabel(e.target.value)} placeholder="기도제목 제목" maxLength={60} className="w-full px-3 py-2 text-sm rounded-xl border border-amber-200 bg-background-100 outline-none" />
                  <textarea value={newPrayerContent} onChange={e => setNewPrayerContent(e.target.value)} placeholder="기도제목 내용" maxLength={300} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-amber-200 bg-background-100 outline-none resize-none" />
                  <div className="flex items-center gap-2">
                    <button onClick={addPrayerTopic} disabled={!newPrayerLabel.trim() || !newPrayerContent.trim()} className="px-4 py-2 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">추가</button>
                    <button onClick={() => { setShowAddPrayer(false); setNewPrayerLabel(''); setNewPrayerContent(''); }} className="text-sm text-foreground-500 cursor-pointer">취소</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showAddEncourage && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
                <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 space-y-3">
                  <select value={newEncouragePhase} onChange={e => setNewEncouragePhase(e.target.value)} className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 bg-background-100 outline-none cursor-pointer">
                    {ACADEMIC_PHASES.map(p => <option key={p.key} value={p.key}>{p.label} ({p.period})</option>)}
                  </select>
                  <input type="text" value={newEncourageAuthor} onChange={e => setNewEncourageAuthor(e.target.value)} placeholder="작성자 이름" maxLength={30} className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 bg-background-100 outline-none" />
                  <textarea value={newEncourageContent} onChange={e => setNewEncourageContent(e.target.value)} placeholder="응원 메시지" maxLength={300} rows={2} className="w-full px-3 py-2 text-sm rounded-xl border border-violet-200 bg-background-100 outline-none resize-none" />
                  <div className="flex items-center gap-2">
                    <button onClick={addEncouragement} disabled={!newEncourageAuthor.trim() || !newEncourageContent.trim()} className="px-4 py-2 rounded-full bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">추가</button>
                    <button onClick={() => { setShowAddEncourage(false); setNewEncourageAuthor(''); setNewEncourageContent(''); }} className="text-sm text-foreground-500 cursor-pointer">취소</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timeline */}
          <div className="relative">
            <div className="absolute left-6 top-3 bottom-3 w-0.5 bg-background-200" />

            {ACADEMIC_PHASES.map((phase, idx) => {
              const cls = PHASE_CLASSES[phase.color];
              const isExpanded = expandedPhase === phase.key;
              const isComplete = userProgress.some(p => p.phase_key === phase.key && p.completed);
              const phasePrayers = prayerTopics.filter(p => p.phase_key === phase.key);
              const phaseEncourages = encouragements.filter(e => e.phase_key === phase.key);

              return (
                <div key={phase.key} className="relative pl-16 pb-8 last:pb-0">
                  {/* Dot */}
                  <div className={`absolute left-4 w-5 h-5 rounded-full border-2 ${isComplete ? 'bg-emerald-500 border-emerald-500' : `${cls.bg} ${cls.border}`} flex items-center justify-center cursor-pointer z-10 ${isTeacherOrChief ? 'hover:scale-110 transition-transform' : ''}`} onClick={() => isTeacherOrChief && togglePhaseComplete(phase.key)}>
                    {isComplete && <i className="ri-check-line text-white text-[10px]"></i>}
                  </div>

                  {/* Content */}
                  <div className={`${cls.bg} border ${cls.border} rounded-2xl p-5`}>
                    <div className="flex items-center justify-between mb-2" onClick={() => setExpandedPhase(isExpanded ? null : phase.key)} style={{ cursor: 'pointer' }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl ${cls.dotBg} flex items-center justify-center`}>
                          <i className={`${phase.icon} ${cls.text} text-sm`}></i>
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground-950">{phase.label}</h3>
                          <p className="text-xs text-foreground-600">{phase.period}</p>
                        </div>
                      </div>
                      <i className={`ri-arrow-down-s-line text-foreground-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}></i>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="mt-4 pt-4 border-t border-background-200 space-y-4">
                            {/* Prayer topics */}
                            {phasePrayers.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-foreground-800 mb-2 flex items-center gap-1.5">
                                  <i className="ri-hand-heart-line text-amber-500"></i>
                                  이 시기에 함께 기도할 제목
                                </h4>
                                <div className="space-y-1.5">
                                  {phasePrayers.map(pt => (
                                    <div key={pt.id} className="bg-background-100/70 rounded-xl p-3 group">
                                      {editingPrayer === pt.id ? (
                                        <div className="space-y-2">
                                          <textarea value={editingPrayerContent} onChange={e => setEditingPrayerContent(e.target.value)} rows={2} maxLength={300} className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-200 outline-none resize-none" />
                                          <div className="flex items-center gap-1.5">
                                            <button onClick={() => savePrayerTopic(pt.id, editingPrayerContent)} className="text-xs text-emerald-600 font-medium cursor-pointer">저장</button>
                                            <button onClick={() => setEditingPrayer(null)} className="text-xs text-foreground-500 cursor-pointer">취소</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <p className="text-xs font-semibold text-foreground-800">{pt.label}</p>
                                            <p className="text-xs text-foreground-600 mt-0.5">{pt.content}</p>
                                          </div>
                                          {isTeacherOrChief && (
                                            <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                              <button onClick={() => { setEditingPrayer(pt.id); setEditingPrayerContent(pt.content); }} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-foreground-700 hover:bg-amber-100 cursor-pointer">
                                                <i className="ri-edit-line text-xs"></i>
                                              </button>
                                              <button onClick={() => deletePrayerTopic(pt.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                                                <i className="ri-delete-bin-line text-xs"></i>
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Encouragements */}
                            {phaseEncourages.length > 0 && (
                              <div>
                                <h4 className="text-xs font-semibold text-foreground-800 mb-2 flex items-center gap-1.5">
                                  <i className="ri-chat-heart-line text-violet-500"></i>
                                  선배들의 응원 한마디
                                </h4>
                                <div className="space-y-1.5">
                                  {phaseEncourages.map(enc => (
                                    <div key={enc.id} className="bg-background-100/70 rounded-xl p-3 group">
                                      {editingEncourage === enc.id ? (
                                        <div className="space-y-2">
                                          <input type="text" value={editingEncourageAuthor} onChange={e => setEditingEncourageAuthor(e.target.value)} maxLength={30} className="w-full px-3 py-1.5 text-xs rounded-lg border border-violet-200 outline-none" placeholder="작성자" />
                                          <textarea value={editingEncourageContent} onChange={e => setEditingEncourageContent(e.target.value)} rows={2} maxLength={300} className="w-full px-3 py-1.5 text-xs rounded-lg border border-violet-200 outline-none resize-none" />
                                          <div className="flex items-center gap-1.5">
                                            <button onClick={() => saveEncouragement(enc.id)} className="text-xs text-emerald-600 font-medium cursor-pointer">저장</button>
                                            <button onClick={() => setEditingEncourage(null)} className="text-xs text-foreground-500 cursor-pointer">취소</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <p className="text-xs text-foreground-600 leading-relaxed">"{enc.content}"</p>
                                            <p className="text-[11px] font-semibold text-violet-600 mt-1">— {enc.author_name}</p>
                                          </div>
                                          {isTeacherOrChief && (
                                            <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                              <button onClick={() => { setEditingEncourage(enc.id); setEditingEncourageContent(enc.content); setEditingEncourageAuthor(enc.author_name); }} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-foreground-700 hover:bg-violet-100 cursor-pointer">
                                                <i className="ri-edit-line text-xs"></i>
                                              </button>
                                              <button onClick={() => deleteEncouragement(enc.id)} className="w-7 h-7 rounded-full flex items-center justify-center text-foreground-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                                                <i className="ri-delete-bin-line text-xs"></i>
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {phasePrayers.length === 0 && phaseEncourages.length === 0 && (
                              <p className="text-xs text-foreground-500 py-2">이 시기의 기도제목과 응원 메시지가 아직 없습니다.</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
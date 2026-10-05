import { useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import AiQuestions from '@/pages/faithDiary/components/AiQuestions';
import { MOODS, STORY_TYPES, type Mood, type StoryType } from '@/pages/faithDiary/lib';

interface DiaryComposerProps {
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

// 오늘 하루를 한 번에 기록하는 통합 작성 모달.
//  · 말씀과 묵상(필수) → faith_journal_entries
//  · 신앙의 순간(선택) → faith_storybooks
//  · 회개와 기도(선택) → repentance_journals
export default function DiaryComposer({ userId, onClose, onSaved }: DiaryComposerProps) {
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [scripture, setScripture] = useState('');
  const [mood, setMood] = useState<Mood>('reflective');
  const [content, setContent] = useState('');

  const [momentOn, setMomentOn] = useState(false);
  const [momentType, setMomentType] = useState<StoryType>('grace');
  const [momentTitle, setMomentTitle] = useState('');
  const [momentDesc, setMomentDesc] = useState('');
  const [momentFile, setMomentFile] = useState<File | null>(null);

  const [repentOn, setRepentOn] = useState(false);
  const [repentContent, setRepentContent] = useState('');
  const [repentScripture, setRepentScripture] = useState('');
  const [repentPrayer, setRepentPrayer] = useState('');

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = content.trim().length > 0 && !!date && !saving;

  // AI 추천 질문을 눌렀을 때 묵상 칸에 질문을 넣어 답을 이어 쓸 수 있게 함
  const handlePickQuestion = (q: string) => {
    setContent(prev => (prev.trim() ? `${prev}\n${q}\n` : `${q}\n`));
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      // 1) 말씀과 묵상 (필수)
      const { error: journalErr } = await supabase.from('faith_journal_entries').insert({
        user_id: userId,
        scripture: scripture.trim() || null,
        content: content.trim(),
        mood,
        entry_date: date,
      });
      if (journalErr) throw journalErr;

      // 2) 신앙의 순간 (선택)
      if (momentOn && momentTitle.trim()) {
        let photoUrl = '';
        if (momentFile) {
          setUploading(true);
          const ext = momentFile.name.split('.').pop();
          const path = `storybook/${userId}-${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('Public').upload(path, momentFile, { upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
            photoUrl = urlData.publicUrl;
          }
          setUploading(false);
        }
        const { error: momentErr } = await supabase.from('faith_storybooks').insert({
          author_id: userId,
          title: momentTitle.trim(),
          description: momentDesc.trim() || null,
          event_type: momentType,
          event_date: date,
          photo_url: photoUrl || null,
        });
        if (momentErr) throw momentErr;
      }

      // 3) 회개와 기도 (선택)
      if (repentOn && repentContent.trim()) {
        const { error: repentErr } = await supabase.from('repentance_journals').insert({
          author_id: userId,
          title: `${date} 회개 기록`,
          content: repentContent.trim(),
          scripture: repentScripture.trim() || null,
          prayer: repentPrayer.trim() || null,
        });
        if (repentErr) throw repentErr;
      }

      onSaved();
    } catch {
      setError('저장 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.');
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="bg-background-50 w-full md:max-w-lg rounded-t-[24px] md:rounded-[24px] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-background-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
              <i className="ri-quill-pen-line text-base"></i>
            </span>
            <div>
              <h3 className="text-base font-bold text-foreground-950">오늘의 신앙일기</h3>
              <p className="text-[11px] text-foreground-500">하루를 한 번에 기록해요</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-background-200 flex items-center justify-center text-foreground-500 cursor-pointer">
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* ① 말씀과 묵상 */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                <i className="ri-book-open-line text-xs"></i>
              </span>
              <h4 className="text-sm font-bold text-foreground-950">말씀과 묵상</h4>
              <span className="text-[10px] font-semibold text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded-full">필수</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-100 focus:border-primary-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">오늘 읽은 말씀</label>
                <input
                  type="text"
                  value={scripture}
                  onChange={e => setScripture(e.target.value)}
                  placeholder="예: 빌립보서 4:13"
                  maxLength={80}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-100 focus:border-primary-400 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1.5">오늘의 마음</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(MOODS) as Mood[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMood(m)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer whitespace-nowrap transition-colors ${
                        mood === m ? MOODS[m].chip : 'bg-background-100 text-foreground-500 border-background-200'
                      }`}
                    >
                      <i className={MOODS[m].icon}></i>{MOODS[m].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-600 mb-1">묵상과 일기</label>
                <div className="mb-3">
                  <AiQuestions variant="inline" onPick={handlePickQuestion} />
                </div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="말씀을 통해 깨달은 것, 오늘 하루의 감사와 다짐을 적어보세요..."
                  rows={4}
                  maxLength={1000}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-background-200 bg-background-100 focus:border-primary-400 outline-none resize-none"
                />
                <p className="text-[11px] text-foreground-400 mt-1 text-right">{content.length}/1000</p>
              </div>
            </div>
          </section>

          {/* ② 신앙의 순간 (선택) */}
          <section className="rounded-2xl border border-background-200 bg-background-100/60 p-4">
            <button onClick={() => setMomentOn(v => !v)} className="w-full flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center">
                  <i className="ri-star-line text-xs"></i>
                </span>
                <span className="text-sm font-bold text-foreground-950">신앙의 순간</span>
                <span className="text-[10px] font-semibold text-foreground-400 bg-background-200 px-1.5 py-0.5 rounded-full">선택</span>
              </span>
              <i className={`ri-add-line text-foreground-400 transition-transform ${momentOn ? 'rotate-45' : ''}`}></i>
            </button>
            {momentOn && (
              <div className="space-y-3 mt-4">
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1.5">유형</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(STORY_TYPES) as StoryType[]).map(t => (
                      <button
                        key={t}
                        onClick={() => setMomentType(t)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                          momentType === t ? STORY_TYPES[t].chip : 'bg-background-200 text-foreground-500'
                        }`}
                      >
                        <i className={STORY_TYPES[t].icon}></i>{STORY_TYPES[t].label}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={momentTitle}
                  onChange={e => setMomentTitle(e.target.value)}
                  placeholder="제목 (예: 기도 응답, 수련회 은혜)"
                  maxLength={50}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-accent-400 outline-none"
                />
                <textarea
                  value={momentDesc}
                  onChange={e => setMomentDesc(e.target.value)}
                  placeholder="그 순간의 감동을 자세히 남겨보세요..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-accent-400 outline-none resize-none"
                />
                <div>
                  <label className="block text-xs font-medium text-foreground-600 mb-1">사진 (선택)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setMomentFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-foreground-600 file:mr-3 file:px-3 file:py-1.5 file:rounded-full file:border-0 file:bg-accent-100 file:text-accent-700 file:text-xs file:font-semibold file:cursor-pointer cursor-pointer"
                  />
                </div>
              </div>
            )}
          </section>

          {/* ③ 회개와 기도 (선택) */}
          <section className="rounded-2xl border border-background-200 bg-background-100/60 p-4">
            <button onClick={() => setRepentOn(v => !v)} className="w-full flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <i className="ri-hand-heart-line text-xs"></i>
                </span>
                <span className="text-sm font-bold text-foreground-950">회개와 기도</span>
                <span className="text-[10px] font-semibold text-foreground-400 bg-background-200 px-1.5 py-0.5 rounded-full">선택</span>
              </span>
              <i className={`ri-add-line text-foreground-400 transition-transform ${repentOn ? 'rotate-45' : ''}`}></i>
            </button>
            {repentOn && (
              <div className="space-y-3 mt-4">
                <textarea
                  value={repentContent}
                  onChange={e => setRepentContent(e.target.value)}
                  placeholder="회개할 내용을 솔직하게 적어보세요..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-rose-400 outline-none resize-none"
                />
                <input
                  type="text"
                  value={repentScripture}
                  onChange={e => setRepentScripture(e.target.value)}
                  placeholder="관련 성경 구절 (선택)"
                  maxLength={80}
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-rose-400 outline-none"
                />
                <textarea
                  value={repentPrayer}
                  onChange={e => setRepentPrayer(e.target.value)}
                  placeholder="회개의 기도"
                  rows={2}
                  maxLength={300}
                  className="w-full px-4 py-3 text-sm rounded-xl border border-background-200 bg-background-50 focus:border-rose-400 outline-none resize-none"
                />
              </div>
            )}
          </section>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-xl p-3">
              <p className="text-xs text-accent-700 flex items-center gap-1.5">
                <i className="ri-error-warning-line"></i>{error}
              </p>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex gap-2 px-5 py-4 border-t border-background-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full border border-background-200 text-sm font-medium text-foreground-600 hover:bg-background-100 cursor-pointer whitespace-nowrap"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-3 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            {uploading ? '사진 업로드 중...' : saving ? '저장 중...' : '기록 저장하기'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
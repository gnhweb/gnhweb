import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { writeSimbangLetter } from '@/lib/nvidiaNim';
import type { SimbangLetter } from '@/lib/nvidiaNim';

const SITUATION_PRESETS = [
  { label: '시험 기간', icon: 'ri-book-open-line' },
  { label: '3주 결석', icon: 'ri-calendar-close-line' },
  { label: '새 신자', icon: 'ri-user-add-line' },
  { label: '진로 고민', icon: 'ri-compass-line' },
  { label: '친구 갈등', icon: 'ri-user-unfollow-line' },
  { label: '무기력/번아웃', icon: 'ri-emotion-sad-line' },
  { label: '전학/이사', icon: 'ri-truck-line' },
  { label: '가정 문제', icon: 'ri-home-heart-line' },
];

const TONE_PRESETS = [
  { key: '따뜻함', label: '따뜻하게', icon: 'ri-sun-line', desc: '포근하고 다정한 말투' },
  { key: '유쾌함', label: '유쾌하게', icon: 'ri-emotion-laugh-line', desc: '밝고 에너지 넘치는 말투' },
  { key: '진지함', label: '진지하게', icon: 'ri-heart-3-line', desc: '성숙하고 깊이 있는 말투' },
];

interface LetterHistory {
  id: string;
  date: string;
  name: string;
  situation: string;
  tone: string;
  message: string;
}

const HISTORY_KEY = 'pastoral_letter_history';

function loadHistory(): LetterHistory[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(history: LetterHistory[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export default function PastoralLetter() {
  const [studentName, setStudentName] = useState('');
  const [situation, setSituation] = useState('');
  const [customSituation, setCustomSituation] = useState('');
  const [tone, setTone] = useState('따뜻함');
  const [message, setMessage] = useState<SimbangLetter | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<LetterHistory[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const finalSituation = customSituation || situation;

  useEffect(() => { saveHistory(history); }, [history]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !finalSituation.trim()) return;

    setIsLoading(true);
    setError('');
    setCopied(false);
    setPreviewMode(false);
    try {
      const result = await writeSimbangLetter(studentName.trim(), finalSituation.trim(), tone);
      setMessage(result);

      const newEntry: LetterHistory = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        name: studentName.trim(),
        situation: finalSituation.trim(),
        tone,
        message: result.message,
      };
      setHistory(prev => [newEntry, ...prev].slice(0, 30));
    } catch (err) {
      setError(err instanceof Error ? err.message : '메시지 생성에 실패했어요');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message.message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = message.message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setStudentName('');
    setSituation('');
    setCustomSituation('');
    setMessage(null);
    setError('');
    setCopied(false);
    setPreviewMode(false);
  };

  const handleLoadHistory = (entry: LetterHistory) => {
    setStudentName(entry.name);
    setSituation(entry.situation);
    setCustomSituation('');
    setTone(entry.tone);
    setMessage({ message: entry.message, tone: entry.tone, verseRef: '', followUpQuestions: [] });
  };

  const renderMessagePreview = () => {
    if (!message) return null;
    if (previewMode) {
      return (
        <div className="bg-background-100 rounded-2xl p-5 border border-background-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-background-100">
            <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center">
              <i className="ri-kakao-talk-fill text-xl text-secondary-600"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground-950">{studentName}</p>
              <p className="text-xs text-foreground-500">카카오톡 메시지 미리보기</p>
            </div>
          </div>
          <div className="bg-secondary-50 rounded-xl p-4">
            <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">{message.message}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="bg-secondary-50 rounded-2xl p-5 border border-secondary-100">
        <p className="text-sm text-foreground-800 leading-relaxed whitespace-pre-wrap">{message.message}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-secondary-100 border border-secondary-200 mb-5">
            <i className="ri-chat-smile-2-line text-3xl text-secondary-600"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">10초 완성 맞춤형 심방 편지</h1>
          <p className="text-sm text-foreground-600">
            학생 이름과 상황만 입력하면 AI가 따뜻한 카톡 메시지를 만들어 드려요
          </p>
        </motion.div>

        {/* History toggle */}
        {history.length > 0 && !message && (
          <div className="text-center mb-4">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="inline-flex items-center gap-1.5 text-xs text-foreground-500 hover:text-secondary-600 transition-colors cursor-pointer"
            >
              <i className={`${showHistory ? 'ri-arrow-up-s-line' : 'ri-history-line'}`}></i>
              {showHistory ? '히스토리 접기' : `지난 편지 보기 (${history.length}통)`}
            </button>
          </div>
        )}

        <AnimatePresence>
          {showHistory && history.length > 0 && !message && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-4">
                <p className="text-xs font-bold text-foreground-600 mb-3">최근 작성한 편지</p>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {history.slice(0, 10).map((h, i) => (
                    <button
                      key={i}
                      onClick={() => handleLoadHistory(h)}
                      className="w-full text-left p-3 rounded-xl bg-background-50 hover:bg-background-200/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground-800">{h.name} · {h.situation}</p>
                          <p className="text-xs text-foreground-500 mt-0.5">
                            {formatKoreanDate(h.date)} · {h.tone} 톤
                          </p>
                        </div>
                        <i className="ri-arrow-right-s-line text-foreground-400"></i>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Form */}
        {!message && (
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleGenerate}
            className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8 mb-6"
          >
            {/* Student Name */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-foreground-700 mb-2">대상 학생 이름</label>
              <input
                type="text"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="예) 김지민"
                maxLength={20}
                className="w-full px-4 py-3 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-secondary-400 transition-colors"
              />
            </div>

            {/* Tone selection */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-foreground-700 mb-2">메시지 톤 선택</label>
              <div className="grid grid-cols-3 gap-2">
                {TONE_PRESETS.map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTone(t.key)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      tone === t.key
                        ? 'bg-secondary-500 text-background-50'
                        : 'bg-background-50 border border-background-200 text-foreground-600 hover:border-secondary-300'
                    }`}
                  >
                    <i className={`${t.icon} text-lg`}></i>
                    <span>{t.label}</span>
                    <span className="text-[10px] opacity-70">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Situation Presets */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-foreground-700 mb-2">상황 선택</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {SITUATION_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => { setSituation(preset.label); setCustomSituation(''); }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      situation === preset.label
                        ? 'bg-secondary-500 text-background-50'
                        : 'bg-background-50 border border-background-200 text-foreground-600 hover:border-secondary-300'
                    }`}
                  >
                    <i className={`${preset.icon} text-base`}></i>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Situation */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-foreground-700 mb-2">직접 입력 (선택)</label>
              <input
                type="text"
                value={customSituation}
                onChange={e => { setCustomSituation(e.target.value); setSituation(''); }}
                placeholder="예) 수능이 한 달 남았어요"
                maxLength={50}
                className="w-full px-4 py-3 text-sm bg-background-50 border border-background-200 rounded-xl outline-none focus:border-secondary-400 transition-colors"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={!studentName.trim() || !finalSituation.trim() || isLoading}
              className="w-full py-3.5 rounded-[20px] bg-secondary-500 text-background-50 dark:text-foreground-950 font-semibold text-base hover:bg-secondary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <i className={`${isLoading ? 'ri-loader-4-line animate-spin' : 'ri-magic-line'} text-lg`}></i>
              {isLoading ? 'AI가 메시지를 작성 중...' : '메시지 생성하기'}
            </button>
          </motion.form>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-10 md:p-14 text-center max-w-sm w-full mx-4">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-secondary-200 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-4 border-secondary-400 animate-spin border-t-transparent"></div>
                <div className="absolute inset-2 rounded-full bg-secondary-100 flex items-center justify-center">
                  <i className="ri-chat-smile-2-line text-3xl text-secondary-600"></i>
                </div>
              </div>
              <p className="text-lg font-semibold text-foreground-950 mb-2">마음을 담은 편지 작성 중</p>
              <p className="text-sm text-foreground-600">AI가 {studentName} 학생을 위한 메시지를 만들고 있어요</p>
            </div>
          </div>
        )}

        {/* Result */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center">
                    <i className="ri-kakao-talk-fill text-secondary-600"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground-950">{studentName} 학생에게</p>
                    <p className="text-xs text-foreground-500">{finalSituation} · {message.tone || tone} 톤</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewMode(!previewMode)}
                    className="text-xs px-2 py-1 rounded-lg bg-background-200 text-foreground-600 hover:bg-background-300 transition-colors cursor-pointer"
                  >
                    {previewMode ? '기본 보기' : '카톡 미리보기'}
                  </button>
                </div>
              </div>

              {renderMessagePreview()}

              {/* Follow-up questions */}
              {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                <div className="mt-4 bg-background-50 rounded-xl p-4 border border-background-200">
                  <p className="text-xs font-bold text-foreground-600 mb-2">후속 대화 추천</p>
                  <div className="flex flex-wrap gap-2">
                    {message.followUpQuestions.map((q, i) => (
                      <span key={i} className="text-xs px-2.5 py-1.5 rounded-full bg-secondary-50 text-secondary-700 border border-secondary-100">
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Verse reference */}
              {message.verseRef && (
                <div className="mt-4 bg-primary-50 rounded-xl p-3 border border-primary-100">
                  <p className="text-xs text-primary-700">
                    <i className="ri-bookmark-line mr-1"></i> 인용 성경: {message.verseRef}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap mt-5">
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 cursor-pointer whitespace-nowrap ${
                    copied
                      ? 'bg-emerald-500 text-white'
                      : 'bg-secondary-500 text-background-50 dark:text-foreground-950 hover:bg-secondary-600'
                  }`}
                >
                  <i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} text-base`}></i>
                  {copied ? '복사 완료!' : '메시지 복사하기'}
                </button>
                <button
                  onClick={() => { setMessage(null); setStudentName(''); setSituation(''); setCustomSituation(''); setCopied(false); setPreviewMode(false); }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-background-200 text-foreground-600 font-semibold text-sm hover:bg-background-50 transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-arrow-left-line"></i>
                  새로 만들기
                </button>
                <button
                  onClick={() => {
                    setMessage(null);
                    setSituation('');
                    setCustomSituation('');
                    setCopied(false);
                    setPreviewMode(false);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-secondary-200 text-secondary-700 font-semibold text-sm hover:bg-secondary-50 transition-all cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-user-add-line"></i>
                  다른 학생에게
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
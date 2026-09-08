import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { fetchMbtiResult } from '@/lib/nvidiaNim';
import type { MbtiResult } from '@/lib/nvidiaNim';
import { notifyUser } from '@/lib/mobileFeedback';

const questions = [
  { id: 1, axis: 'action', question: '친구가 힘들어할 때 나는?', icon: 'ri-heart-line', options: ['바로 달려가서 위로한다', '옆에서 조용히 기도해 준다', '실질적인 해결책을 같이 찾아본다', '친구가 편하게 털어놓을 수 있게 기다려 준다'] },
  { id: 2, axis: 'mindset', question: '새로운 일이 주어졌을 때 내 태도는?', icon: 'ri-lightbulb-line', options: ['일단 믿음으로 도전한다!', '기도하고 신중하게 준비한다', '계획부터 세우고 체계적으로 접근한다', '주변 사람들과 협력하며 진행한다'] },
  { id: 3, axis: 'leadership', question: '내가 생각하는 리더십은?', icon: 'ri-star-line', options: ['카리스마 있게 앞에서 이끄는 것', '겸손히 섬기며 따르게 하는 것', '지혜롭게 판단하고 결정하는 것', '모두의 이야기를 듣고 조율하는 것'] },
  { id: 4, axis: 'crisis', question: '내 앞에 큰 장애물이 나타났을 때?', icon: 'ri-shield-line', options: ['하나님의 뜻이라 믿고 정면 돌파한다', '무릎 꿇고 기도하며 지혜를 구한다', '침착하게 대안을 찾아서 우회한다', '주변에 도움을 요청하며 함께 헤쳐 나간다'] },
  { id: 5, axis: 'action', question: '주일예배 후 나는 주로?', icon: 'ri-restaurant-line', options: ['친구들과 함께 점심 먹으며 교제한다', '혼자 조용히 말씀 묵상을 한다', '다음 주 일정과 준비물을 점검한다', '새로 온 친구를 챙겨 안내한다'] },
  { id: 6, axis: 'mindset', question: '기도할 때 나는?', icon: 'ri-hand-heart-line', options: ['열정적으로 소리 내어 기도한다', '조용히 마음속으로 기도한다', '구체적인 기도 제목을 적어가며 기도한다', '다른 사람의 기도 제목을 함께 기도한다'] },
  { id: 7, axis: 'leadership', question: '모임을 준비할 때 내 역할은?', icon: 'ri-group-line', options: ['분위기를 띄우고 진행을 이끈다', '말씀과 찬양을 준비한다', '장소와 물품을 꼼꼼히 체크한다', '참석자들을 확인하고 연락한다'] },
  { id: 8, axis: 'crisis', question: '친구와 의견이 갈릴 때 나는?', icon: 'ri-chat-check-line', options: ['내 의견을 당당하게 주장한다', '상대방의 의견을 먼저 존중하며 듣는다', '중재안을 찾아 모두가 만족하게 해결한다', '시간이 지나면 자연스럽게 해결될 거라 믿는다'] },
];

const MBTI_CHARACTER_INDEX: Record<string, number> = {
  모세: 0, 아브라함: 1, 여호수아: 2, 다윗: 3, 요셉: 4,
  룻: 5, 에스더: 6, 다니엘: 7, 바울: 8, 베드로: 9,
  느헤미야: 10, 디모데: 11, 바나바: 12, 마리아: 13, 엘리야: 14,
  이사야: 15, 예레미야: 16, 사무엘: 17, 마르다: 18, 요한: 19,
};

const MBTI_CHARACTER_SLUG: Record<string, string> = {
  모세: 'moses', 아브라함: 'abraham', 여호수아: 'joshua', 다윗: 'david', 요셉: 'joseph',
  룻: 'ruth', 에스더: 'esther', 다니엘: 'daniel', 바울: 'paul', 베드로: 'peter',
  느헤미야: 'nehemiah', 디모데: 'timothy', 바나바: 'barnabas', 마리아: 'mary', 엘리야: 'elijah',
  이사야: 'isaiah', 예레미야: 'jeremiah', 사무엘: 'samuel', 마르다: 'martha', 요한: 'john',
};

function CharacterIllustration({ name, className }: { name: string; className?: string }) {
  const slug = MBTI_CHARACTER_SLUG[name];
  if (!slug) return <div className={className} aria-hidden="true" />;

  return (
    <div role="img" aria-label={`${name} 성경인물 일러스트`} className={`relative overflow-hidden ${className ?? ''}`}>
      <img
        src={`/bible-mbti/characters-new/${slug}.svg`}
        alt={`${name} 성경인물`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain"
        onError={(event) => {
          const image = event.currentTarget;
          if (image.dataset.fallback === 'true') return;
          image.dataset.fallback = 'true';
          image.src = `/bible-mbti/characters-new/${slug}.svg`;
        }}
      />
    </div>
  );
}

const axisLabels: Record<string, { left: string; right: string }> = {
  action: { left: '적극적 행동파', right: '신중한 기도파' },
  mindset: { left: '열정적 도전파', right: '체계적 준비파' },
  leadership: { left: '카리스마 리더', right: '섬김의 리더' },
  crisis: { left: '정면 돌파형', right: '협력 극복형' },
};

function useCountUp(target: number, duration: number = 800, startDelay: number = 0) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf: number;
    const startTime = performance.now() + startDelay;
    const animate = (now: number) => {
      if (now < startTime) { raf = requestAnimationFrame(animate); return; }
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, startDelay]);
  return display;
}

function CountUpBar({ label, value, delay }: { label: string; value: number; delay: number }) {
  const display = useCountUp(value, 1000, delay);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-foreground-700 w-14 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-background-200 overflow-hidden"><motion.div className="h-full rounded-full bg-accent-400" initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, delay: delay / 1000, ease: [0.34, 1.56, 0.64, 1] }} /></div>
      <span className="text-xs font-bold text-accent-600 w-8 text-left flex-shrink-0">{display}</span>
    </div>
  );
}

export default function BibleMbti() {
  const [currentStep, setCurrentStep] = useState(0); const [answers, setAnswers] = useState<string[]>([]); const [result, setResult] = useState<MbtiResult | null>(null); const [isLoading, setIsLoading] = useState(false); const [error, setError] = useState(''); const [direction, setDirection] = useState(1); const [isCapturing, setIsCapturing] = useState(false); const [toastMessage, setToastMessage] = useState(''); const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('info'); const [showSparkles, setShowSparkles] = useState(false); const resultCardRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (result) { setTimeout(() => setShowSparkles(true), 200); setTimeout(() => setShowSparkles(false), 2500); } }, [result]);
  const handleAnswer = async (answer: string) => { if (isLoading) return; if (currentStep >= questions.length - 1 && answers.length >= questions.length) return; const newAnswers = [...answers, answer]; setAnswers(newAnswers); setDirection(1); if (currentStep < questions.length - 1) { setCurrentStep(currentStep + 1); return; } setIsLoading(true); setError(''); try { const res = await fetchMbtiResult(newAnswers.slice(0, questions.length)); setResult(res); setCurrentStep(currentStep + 1); } catch (err) { setError(err instanceof Error ? err.message : '잠시 후 다시 시도해주세요'); } finally { setIsLoading(false); } };
  const handleBack = () => { if (currentStep > 0 && !result) { setDirection(-1); setCurrentStep(currentStep - 1); setAnswers(answers.slice(0, -1)); setError(''); } };
  const handleReset = () => { setCurrentStep(0); setAnswers([]); setResult(null); setError(''); setDirection(1); setShowSparkles(false); };
  const handleCapture = useCallback(async () => { setIsCapturing(true); try { notifyUser('결과 이미지를 준비하고 있어요.'); } finally { setIsCapturing(false); } }, []);
  const progress = Math.min(100, Math.round((currentStep / questions.length) * 100));
  const currentQuestion = questions[currentStep];
  const containerVariants: Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
  const itemVariants: Variants = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
  return <div className="min-h-screen bg-background-50"><div className="mx-auto max-w-2xl px-4 py-8 pb-28 md:px-6 md:py-14"><header className="mb-8 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary-200 bg-primary-100"><i className="ri-user-heart-line text-3xl text-primary-600"/></div><h1 className="text-2xl font-black text-foreground-950 md:text-3xl">말씀 MBTI</h1><p className="mt-2 text-sm text-foreground-600">학생회에서의 나를 돌아보고, 나와 닮은 성경인물을 찾아보세요.</p></header>{result ? <motion.div variants={containerVariants} initial="hidden" animate="visible"><div ref={resultCardRef} className="relative aspect-square w-full max-w-md mx-auto rounded-[20px] overflow-hidden mb-4 bg-gradient-to-br from-accent-500 via-primary-500 to-secondary-500 flex flex-col items-center justify-center text-center p-8"><AnimatePresence>{showSparkles && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} className="absolute inset-0 pointer-events-none z-0">{Array.from({ length: 12 }).map((_, i) => <motion.div key={i} initial={{ opacity: 0, scale: 0, x: '50%', y: '50%' }} animate={{ opacity: [0,1,0], scale: [0,1.5,0], x: `${30 + Math.random()*40}%`, y: `${30 + Math.random()*40}%` }} transition={{ duration: 1.5 + Math.random(), delay: i*0.1, repeat: 1 }} className="absolute w-3 h-3 rounded-full bg-background-100/60" />)}</motion.div>}</AnimatePresence><motion.div variants={itemVariants} className="relative z-10"><motion.div animate={{ scale: [0,1.2,1], rotate: [0,-5,3,0] }} transition={{ duration: 0.7, ease: [0.34,1.56,0.64,1], delay: 0.1 }} className="w-24 h-24 rounded-full bg-background-100/20 backdrop-blur-sm border-4 border-white/40 flex items-center justify-center mx-auto mb-5 relative"><CharacterIllustration name={result.character} className="h-20 w-20 rounded-full relative z-10 overflow-hidden border-2 border-background-100/70" /></motion.div></motion.div><motion.div variants={itemVariants} className="relative z-10"><div className="inline-block px-4 py-1.5 rounded-full bg-background-100/20 backdrop-blur-sm text-white text-sm font-bold mb-4">{result.matchingPhrase}</div></motion.div><motion.h2 variants={itemVariants} className="text-3xl font-black text-white mb-3 relative z-10">{result.character}</motion.h2><motion.p variants={itemVariants} className="text-sm text-white/85 leading-relaxed max-w-xs mx-auto line-clamp-3 relative z-10">{result.description}</motion.p><div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-1.5 text-white/70 text-[11px] font-semibold relative z-10"><i className="ri-book-open-line"></i>강릉학생회 · 성경인물 MBTI</div></div><div className="space-y-4">{Object.entries(result.scores ?? {}).map(([key, value], index) => <div key={key} className="rounded-2xl border border-background-200 bg-background-100 p-4"><div className="flex justify-between text-xs font-bold text-foreground-700 mb-2"><span>{axisLabels[key]?.left ?? key}</span><span>{axisLabels[key]?.right ?? ''}</span></div><CountUpBar label="" value={Number(value)} delay={index * 120} /></div>)}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={handleReset} className="min-h-12 rounded-xl border border-background-200 bg-background-100 text-sm font-bold text-foreground-700">다시 검사</button><button type="button" onClick={handleCapture} disabled={isCapturing} className="min-h-12 rounded-xl bg-primary-500 text-sm font-bold text-white disabled:opacity-60">{isCapturing ? '준비 중…' : '결과 저장'}</button></div></div></motion.div> : <><div className="mb-5"><div className="mb-2 flex justify-between text-xs text-foreground-500"><span>{Math.min(currentStep + 1, questions.length)} / {questions.length}</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-background-200"><div className="h-full rounded-full bg-primary-500 transition-all" style={{ width: `${progress}%` }} /></div></div>{currentQuestion && <AnimatePresence mode="wait" custom={direction}><motion.div key={currentQuestion.id} initial={{ opacity: 0, x: direction * 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -20 }} className="rounded-[22px] border border-background-200 bg-background-100 p-5 md:p-7"><div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600"><i className={`${currentQuestion.icon} text-lg`} /></div><span className="text-sm font-bold text-primary-700">질문 {currentQuestion.id}</span></div><h2 className="mb-6 text-xl font-bold leading-relaxed text-foreground-950 md:text-2xl">{currentQuestion.question}</h2><div className="space-y-3">{currentQuestion.options.map(option => <button key={option} type="button" onClick={() => handleAnswer(option)} disabled={isLoading} className="min-h-14 w-full rounded-2xl border border-background-200 bg-background-50 px-4 text-left text-sm font-semibold text-foreground-800 transition active:scale-[.99] hover:border-primary-300 hover:bg-primary-50 disabled:opacity-60">{option}</button>)}</div>{error && <p className="mt-4 rounded-xl bg-accent-50 p-3 text-sm text-accent-700">{error}</p>}{currentStep > 0 && <button type="button" onClick={handleBack} disabled={isLoading} className="mt-5 text-sm text-foreground-500">이전 질문</button>}</motion.div></AnimatePresence>}</>}</div></div>;
}

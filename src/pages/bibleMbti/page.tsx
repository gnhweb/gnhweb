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

function CharacterIllustration({ name, className }: { name: string; className?: string }) {
  const index = MBTI_CHARACTER_INDEX[name];
  if (index === undefined) return <div className={className} aria-hidden="true" />;
  const column = index % 5;
  const row = Math.floor(index / 5);
  const x = column * 25;
  const y = row * (100 / 3);
  return (
    <div
      role="img"
      aria-label={`${name} 성경인물 일러스트`}
      className={`bg-no-repeat bg-cover ${className ?? ''}`}
      style={{
        backgroundImage: name === '다윗'
          ? 'url(https://christian-witness.org/wp-content/uploads/2024/12/david_clipart_illustration_available.jpg)'
          : 'url(/bible-mbti/characters-cute.svg)',
        backgroundPosition: name === '다윗' ? 'center' : `${x}% ${y}%`,
      }}
    />
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
  const handleRetry = () => { setError(''); const cappedAnswers = answers.slice(0, questions.length); setIsLoading(true); fetchMbtiResult(cappedAnswers).then(res => { setResult(res); setCurrentStep(questions.length); }).catch(err => { setError(err instanceof Error ? err.message : '잠시 후 다시 시도해주세요'); }).finally(() => { setIsLoading(false); }); };
  const progressPct = ((currentStep + (result ? 1 : 0)) / questions.length) * 100;
  const computeAxisScore = (axis: string) => { const axisIndices = questions.map((q, i) => (q.axis === axis ? i : -1)).filter(i => i !== -1); if (axisIndices.length === 0) return 50; const weights = [12, 9, -8, -11]; let score = 50; axisIndices.forEach(qIdx => { if (qIdx < answers.length) { const idx = questions[qIdx].options.indexOf(answers[qIdx]); if (idx >= 0 && idx < weights.length) score += weights[idx]; } }); return Math.max(8, Math.min(92, score)); };
  const isBalancedScore = (score: number) => score >= 48 && score <= 52;
  const handleShareImage = async () => { if (!resultCardRef.current || isCapturing) return; setIsCapturing(true); const captureElement = resultCardRef.current; const originalWidth = captureElement.style.width; const originalMaxWidth = captureElement.style.maxWidth; try { await new Promise(resolve => setTimeout(resolve, 300)); const rect = captureElement.getBoundingClientRect(); captureElement.style.width = `${rect.width}px`; captureElement.style.maxWidth = `${rect.width}px`; const dpr = Math.min(window.devicePixelRatio || 2, 3); const scale = Math.max(dpr, 2); try { const { default: html2canvas } = await import('html2canvas'); const canvas = await html2canvas(captureElement, { scale, useCORS: true, allowTaint: false, backgroundColor: '#ffffff', width: rect.width, height: captureElement.scrollHeight }); const dataUrl = canvas.toDataURL('image/png', 0.95); const link = document.createElement('a'); link.download = `성경MBTI_${result?.character || '결과'}.png`; link.href = dataUrl; link.click(); return; } catch (html2canvasErr) { console.warn('html2canvas failed, trying dom-to-image-more fallback:', html2canvasErr); } const fontLinks: HTMLLinkElement[] = []; document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => { const href = link.getAttribute('href') || ''; if (href.includes('fonts.googleapis.com') || href.includes('cdnjs.cloudflare.com')) { fontLinks.push(link); link.remove(); } }); try { const { toPng } = await import('dom-to-image-more'); const dataUrl = await toPng(captureElement, { quality: 0.95, cacheBust: true, width: rect.width * scale, height: captureElement.scrollHeight * scale, style: { transform: `scale(${scale})`, transformOrigin: 'top left', width: `${rect.width}px` } }); const link = document.createElement('a'); link.download = `성경MBTI_${result?.character || '결과'}.png`; link.href = dataUrl; link.click(); } catch (domToImageErr) { console.error('dom-to-image-more also failed:', domToImageErr); throw domToImageErr; } finally { fontLinks.forEach((link) => { document.head.appendChild(link); }); } } catch (err) { console.error('Image capture failed:', err); notifyUser('이미지 저장에 실패했어요. 다시 시도해주세요.'); } finally { if (resultCardRef.current) { resultCardRef.current.style.width = originalWidth || ''; resultCardRef.current.style.maxWidth = originalMaxWidth || ''; } setIsCapturing(false); } };
  const containerVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }; const itemVariants: Variants = { hidden: { opacity: 0, y: 24, scale: 0.96 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 200, damping: 20 } } };
  return (<div className="min-h-screen bg-background-50"><div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16"><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10"><div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 mb-5"><i className="ri-user-heart-line text-3xl text-accent-600"></i></div><h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">성경 인물 MBTI</h1><p className="text-sm text-foreground-600">{result ? '당신과 닮은 성경 속 인물을 찾았어요!' : '8가지 질문에 답하고 나와 닮은 성경 인물을 찾아보세요'}</p></motion.div>
  {!result && <div className="mb-8"><div className="w-full h-2.5 rounded-full bg-background-200 overflow-hidden"><motion.div className="h-full rounded-full bg-accent-500" initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4 }} /></div><div className="flex items-center justify-between mt-2"><p className="text-xs text-foreground-500">{currentStep + 1} / {questions.length}</p>{currentStep > 0 && <button onClick={handleBack} className="text-xs text-foreground-500 hover:text-accent-600 transition-colors cursor-pointer flex items-center gap-1"><i className="ri-arrow-left-line"></i> 이전 질문</button>}</div></div>}
  {isLoading && <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center"><motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-background-100... (truncated)
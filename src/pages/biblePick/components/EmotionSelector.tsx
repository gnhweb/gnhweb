import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const emotions = [
  { key: '기쁨', icon: 'ri-emotion-happy-line', bg: 'bg-primary-100', text: 'text-primary-700', border: 'border-primary-200 hover:border-primary-400' },
  { key: '감사', icon: 'ri-heart-line', bg: 'bg-accent-100', text: 'text-accent-700', border: 'border-accent-200 hover:border-accent-400' },
  { key: '설렘', icon: 'ri-star-line', bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200 hover:border-secondary-400' },
  { key: '평안', icon: 'ri-mental-health-line', bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200 hover:border-secondary-400' },
  { key: '슬픔', icon: 'ri-emotion-sad-line', bg: 'bg-accent-100', text: 'text-accent-700', border: 'border-accent-200 hover:border-accent-400' },
  { key: '불안', icon: 'ri-cloud-line', bg: 'bg-background-200', text: 'text-foreground-700', border: 'border-background-300/60 hover:border-background-400' },
  { key: '걱정', icon: 'ri-contrast-drop-line', bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200 hover:border-secondary-400' },
  { key: '두려움', icon: 'ri-thunderstorms-line', bg: 'bg-accent-100', text: 'text-accent-700', border: 'border-accent-200 hover:border-accent-400' },
  { key: '답답함', icon: 'ri-lock-line', bg: 'bg-accent-100', text: 'text-accent-700', border: 'border-accent-200 hover:border-accent-400' },
  { key: '화남', icon: 'ri-emotion-line', bg: 'bg-accent-100', text: 'text-accent-700', border: 'border-accent-200 hover:border-accent-400' },
  { key: '지침', icon: 'ri-moon-line', bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200 hover:border-secondary-400' },
  { key: '외로움', icon: 'ri-user-5-line', bg: 'bg-secondary-100', text: 'text-secondary-700', border: 'border-secondary-200 hover:border-secondary-400' },
  { key: '무기력', icon: 'ri-zzz-line', bg: 'bg-background-200', text: 'text-foreground-700', border: 'border-background-300/60 hover:border-background-400' },
  { key: '혼란', icon: 'ri-question-line', bg: 'bg-background-200', text: 'text-foreground-700', border: 'border-background-300/60 hover:border-background-400' },
  { key: '후회', icon: 'ri-history-line', bg: 'bg-accent-100', text: 'text-accent-700', border: 'border-accent-200 hover:border-accent-400' },
  { key: '미안함', icon: 'ri-hand-heart-line', bg: 'bg-accent-100', text: 'text-accent-700', border: 'border-accent-200 hover:border-accent-400' },
  { key: '희망', icon: 'ri-sun-line', bg: 'bg-primary-100', text: 'text-primary-700', border: 'border-primary-200 hover:border-primary-400' },
];

interface EmotionSelectorProps {
  onSelect: (emotion: string) => void;
}

export default function EmotionSelector({ onSelect }: EmotionSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 mb-5">
          <i className="ri-book-open-line text-3xl text-primary-600"></i>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-3">말씀 뽑기</h1>
        <p className="text-foreground-600 text-sm md:text-base leading-relaxed">
          지금 내 마음과 가장 가까운 감정을 선택해 주세요<br />
          주님께서 당신을 위한 말씀을 준비하고 계십니다
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
        {emotions.map((em, index) => (
          <motion.button
            key={em.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.04 }}
            onClick={() => onSelect(em.key)}
            className={`relative flex flex-col items-center justify-center p-4 md:p-5 rounded-[20px] ${em.bg} border-2 ${em.border} cursor-pointer transition-all duration-300 hover:scale-105 group`}
          >
            <div className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center mb-2">
              <i className={`${em.icon} text-2xl md:text-3xl ${em.text} group-hover:scale-110 transition-transform duration-300`}></i>
            </div>
            <span className={`text-sm md:text-base font-semibold ${em.text} whitespace-nowrap`}>{em.key}</span>
          </motion.button>
        ))}
      </div>

      <div className="text-center mt-8">
        <Link
          to="/bible-pick/history"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-amber-600 transition-colors cursor-pointer"
        >
          <i className="ri-history-line"></i>
          지금까지 뽑은 말씀 보기
        </Link>
      </div>
    </motion.div>
  );
}
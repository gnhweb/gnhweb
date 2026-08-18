import { useState } from 'react';
import { motion } from 'framer-motion';

interface SituationInputProps {
  emotion: string;
  onSubmit: (text: string) => void;
  onBack: () => void;
  error?: string;
}

const emotionTags: Record<string, string> = {
  '기쁨': 'ri-emotion-happy-line',
  '감사': 'ri-heart-line',
  '설렘': 'ri-star-line',
  '평안': 'ri-mental-health-line',
  '슬픔': 'ri-emotion-sad-line',
  '불안': 'ri-cloud-line',
  '걱정': 'ri-contrast-drop-line',
  '두려움': 'ri-thunderstorms-line',
  '답답함': 'ri-lock-line',
  '화남': 'ri-emotion-line',
  '지침': 'ri-moon-line',
  '외로움': 'ri-user-5-line',
  '무기력': 'ri-zzz-line',
  '혼란': 'ri-question-line',
  '후회': 'ri-history-line',
  '미안함': 'ri-hand-heart-line',
  '희망': 'ri-sun-line',
};

export default function SituationInput({ emotion, onSubmit, onBack, error }: SituationInputProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().length === 0) return;
    onSubmit(text.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-foreground-600 hover:text-foreground-950 transition-colors mb-8 group cursor-pointer"
      >
        <i className="ri-arrow-left-line group-hover:-translate-x-1 transition-transform duration-200"></i>
        <span className="text-sm">다시 선택하기</span>
      </button>

      <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
            <i className={`${emotionTags[emotion] || 'ri-heart-line'} text-xl text-primary-600`}></i>
          </div>
          <div>
            <p className="text-sm text-foreground-600">선택한 감정</p>
            <p className="text-lg font-bold text-foreground-950">{emotion}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-foreground-700 mb-2">
            지금 나의 상황을 한 줄로 적어주세요
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="예) 내일 중요한 발표가 있어서 너무 떨려요"
            maxLength={200}
            rows={3}
            className="w-full px-4 py-3 rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all resize-none text-sm text-foreground-950 placeholder-foreground-600"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-foreground-600">{text.length}/200</span>
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
              <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={text.trim().length === 0}
            className="mt-5 w-full py-3.5 rounded-[20px] bg-primary-500 text-background-50 font-semibold text-base hover:bg-primary-600 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <i className="ri-book-open-line text-lg"></i>
            나를 위한 말씀 뽑기
          </button>
        </form>
      </div>
    </motion.div>
  );
}
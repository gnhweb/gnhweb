import { useDiaryQuestions } from '@/pages/faithDiary/useDiaryQuestions';

interface AiQuestionsProps {
  /** 질문을 눌렀을 때 실행할 동작 (작성 화면에서 일기에 넣기 등) */
  onPick?: (question: string) => void;
  /** card: 메인 화면용 독립 카드 / inline: 작성 화면 안쪽 블록 */
  variant?: 'card' | 'inline';
}

// 매일 새로워지는 신앙 묵상 질문을 AI가 만들어 보여주는 공용 컴포넌트.
export default function AiQuestions({ onPick, variant = 'card' }: AiQuestionsProps) {
  const { questions, loading, error, revealed, reveal, refresh } = useDiaryQuestions();
  const isCard = variant === 'card';

  return (
    <div
      className={
        isCard
          ? 'rounded-[20px] border border-accent-100 bg-gradient-to-br from-accent-50 to-primary-50 p-5'
          : 'rounded-2xl border border-accent-100 bg-accent-50/60 p-4'
      }
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full bg-accent-100 text-accent-600 flex items-center justify-center flex-shrink-0">
          <i className="ri-sparkling-2-line text-base"></i>
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground-950">AI 추천 질문</h3>
          <p className="text-[11px] text-foreground-500">매일 새로운 묵상 질문으로 신앙일기를 도와드려요</p>
        </div>
      </div>

      {/* 접힌 상태 — 질문 받기 버튼 */}
      {!revealed ? (
        <button
          onClick={reveal}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-full bg-accent-500 text-white text-sm font-semibold hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap"
        >
          <i className="ri-sparkling-2-line"></i> 추천 질문 받기
        </button>
      ) : loading ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-6 text-sm text-foreground-500">
          <span className="w-4 h-4 rounded-full border-2 border-accent-400 border-t-transparent animate-spin"></span>
          질문을 준비하고 있어요...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl bg-background-50 border border-background-200 p-3">
          <p className="text-xs text-accent-700 flex items-center gap-1.5">
            <i className="ri-error-warning-line"></i>{error}
          </p>
          <button onClick={refresh} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {questions.map((q, i) =>
            onPick ? (
              <button
                key={`${i}-${q}`}
                onClick={() => onPick(q)}
                className="w-full text-left flex items-start gap-2.5 p-3 rounded-xl bg-background-50 border border-background-200 hover:border-accent-300 transition-colors cursor-pointer"
              >
                <span className="w-5 h-5 rounded-full bg-accent-100 text-accent-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground-700 leading-relaxed flex-1">{q}</span>
                <i className="ri-add-line text-accent-500 mt-0.5 flex-shrink-0"></i>
              </button>
            ) : (
              <div
                key={`${i}-${q}`}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-background-50 border border-background-200"
              >
                <span className="w-5 h-5 rounded-full bg-accent-100 text-accent-700 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-sm text-foreground-700 leading-relaxed">{q}</span>
              </div>
            ),
          )}
          <button
            onClick={refresh}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-accent-600 hover:text-accent-700 transition-colors cursor-pointer"
          >
            <i className="ri-refresh-line"></i> 다른 질문 받기
          </button>
        </div>
      )}
    </div>
  );
}
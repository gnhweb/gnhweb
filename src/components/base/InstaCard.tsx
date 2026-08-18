import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * 표준 카드 패턴 (모바일 "인스타 감성" 리디자인 공통 기준)
 * - 모서리: rounded-[20px] (기존 --card 토큰과 동일)
 * - 그림자: 기본 shadow-card, 탭 시 shadow-card-lg
 * - 탭 피드백: whileTap scale 0.97 (전역 통일 값)
 * - 내부 구조: 상단 아이콘/이미지 → 중앙 굵은 타이틀 → 하단 옅은 설명
 *
 * 사용 예시:
 * <InstaCard onClick={() => navigate('/clubs')}>
 *   <InstaCard.Icon className="bg-gradient-to-br from-primary-400 to-accent-400">
 *     <i className="ri-group-line text-white text-xl" />
 *   </InstaCard.Icon>
 *   <InstaCard.Title>동아리</InstaCard.Title>
 *   <InstaCard.Subtitle>5개 동아리 둘러보기</InstaCard.Subtitle>
 * </InstaCard>
 */
interface InstaCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

function InstaCard({ children, onClick, className = '' }: InstaCardProps) {
  const Comp = onClick ? motion.button : motion.div;
  return (
    <Comp
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className={`rounded-[20px] bg-background-100 shadow-card hover:shadow-card-lg transition-shadow text-left w-full overflow-hidden ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </Comp>
  );
}

function Icon({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${className}`}>
      {children}
    </div>
  );
}

function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-base font-bold text-foreground-950 ${className}`}>{children}</p>;
}

function Subtitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-xs text-foreground-500 mt-0.5 ${className}`}>{children}</p>;
}

InstaCard.Icon = Icon;
InstaCard.Title = Title;
InstaCard.Subtitle = Subtitle;

export default InstaCard;

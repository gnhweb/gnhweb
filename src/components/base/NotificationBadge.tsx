interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export default function NotificationBadge({ count, className = '' }: NotificationBadgeProps) {
  if (count <= 0) return null;

  const label = count > 9 ? '9+' : String(count);

  return (
    <span
      aria-label={`새 알림 ${label}`}
      className={`absolute -right-1 -top-1 z-10 min-w-4 h-4 px-1 rounded-chip bg-accent-600 text-background-50 text-[9px] font-bold leading-4 text-center shadow-card dark:bg-accent-500 dark:text-background-950 ${className}`}
    >
      {label}
    </span>
  );
}

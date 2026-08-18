import { useAuth } from '@/hooks/useAuth';

export default function DynamicWatermark() {
  const { user, profile } = useAuth();

  const displayText = profile?.name || user?.email || '';

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 1px,
            rgba(0,0,0,0.06) 1px,
            rgba(0,0,0,0.06) 1px
          )`,
        }}
      />
      {displayText && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[1px] font-black text-foreground-950 whitespace-nowrap opacity-[0.02]">
            {displayText}
          </span>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';

export default function RealtimeClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[now.getDay()];

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-foreground-500 font-medium whitespace-nowrap">
      <i className="ri-calendar-line"></i>
      {year}.{month}.{day}({weekday})
      <span className="text-foreground-400 mx-0.5">·</span>
      <i className="ri-time-line"></i>
      {hours}:{minutes}:{seconds}
    </span>
  );
}
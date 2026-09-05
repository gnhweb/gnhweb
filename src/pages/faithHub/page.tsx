import { Link } from 'react-router-dom';

const sections = [
  {
    title: '말씀과 기도',
    icon: 'ri-book-open-line',
    items: [
      ['/bible-pick', '말씀뽑기', '지금 내 마음과 상황을 적고 말씀·묵상·기도를 한 번에 받아보세요.'],
      ['/bible-mbti', '말씀 MBTI', '나의 신앙 성향을 알아보고 말씀과 연결해 보세요.'],
      ['/bible-by-age', '연령별 말씀', '지금의 삶과 나이에 맞는 말씀을 찾아보세요.'],
      ['/bible-marathon', '성경 완독', '읽기와 완독의 흐름을 이어가세요.'],
    ],
  },
  {
    title: '기록과 성장',
    icon: 'ri-seedling-line',
    items: [
      ['/bible-pick/history', '말씀 히스토리', '받았던 말씀을 다시 보고 마음을 이어가세요.'],
      ['/bible-streak', '말씀 스트릭', '매일 말씀을 가까이하는 습관을 만들어보세요.'],
      ['/faith-journal', '신앙일기', '묵상·신앙의 순간·회개와 회복을 한 곳에 기록해요.'],
      ['/year-end-summary', '월별 결산', '한 달의 신앙 여정을 천천히 돌아보세요.'],
    ],
  },
  {
    title: '함께 기도하기',
    icon: 'ri-heart-2-line',
    items: [
      ['/prayer-partner', '신앙 짝꿍', '서로를 위해 기도하며 함께 걸어가세요.'],
      ['/prayer-relay', '기도 릴레이', '혼자가 아닌 공동체의 기도로 이어가세요.'],
    ],
  },
];

export default function FaithHubPage() {
  return (
    <div className="min-h-screen bg-background-50">
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-8 md:px-6 md:pb-16 md:pt-14">
        <header className="mb-7 rounded-[28px] border border-primary-100 bg-gradient-to-br from-primary-50 via-background-100 to-background-100 p-6 text-center shadow-sm md:p-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-primary-200 bg-background-100">
            <i className="ri-heart-2-line text-3xl text-primary-600" />
          </div>
          <p className="text-xs font-bold tracking-[0.16em] text-primary-600">GNH · 신앙</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground-950 md:text-3xl">말씀을 만나고, 마음을 돌보고, 다시 걸어가는 곳</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-foreground-600">신앙 기록은 하나로 모았어요. 말씀을 붙잡고, 마음을 돌아보고, 중요한 은혜의 순간을 남기며 나의 신앙이 어떻게 자라고 있는지 천천히 돌아보세요.</p>
          <Link to="/faith-journal" className="mt-5 inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-2xl bg-primary-500 px-5 text-sm font-bold text-background-50 shadow-sm transition active:scale-[0.99]">
            <i className="ri-quill-pen-line" /> 신앙일기 시작하기
          </Link>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          {sections.map((section) => (
            <section key={section.title} className="rounded-[24px] border border-background-200 bg-background-100 p-4 shadow-sm md:p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><i className={section.icon} /></span>
                <h2 className="font-bold text-foreground-950">{section.title}</h2>
              </div>
              <div className="space-y-1">
                {section.items.map(([path, label, desc]) => (
                  <Link key={path} to={path} className="flex min-h-14 items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-primary-50">
                    <span className="min-w-0"><span className="block text-sm font-semibold text-foreground-800">{label}</span><span className="mt-0.5 block text-xs leading-5 text-foreground-500">{desc}</span></span>
                    <i className="ri-arrow-right-s-line shrink-0 text-foreground-400" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50/70 p-4 text-sm leading-6 text-primary-900"><b>신앙일기의 방향</b><span className="ml-2">매일 완벽하게 쓰는 것이 목표가 아니에요. 말씀 앞에서 솔직해지고, 돌아볼 것은 돌아보고, 오늘의 작은 순종을 하나씩 쌓아가는 것이 목표예요.</span></div>
      </div>
    </div>
  );
}

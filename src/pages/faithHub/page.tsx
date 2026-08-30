import { Link } from 'react-router-dom';

const sections = [
  { title:'말씀', icon:'ri-book-open-line', items:[['/bible-pick','말씀뽑기','지금 내 상황에 맞는 말씀'],['/bible-pick?mode=sleep','자기전','하루를 내려놓는 묵상'],['/bible-pick?mode=prayer','기도','기도제목과 말씀'],['/bible-mbti','말씀 MBTI','나의 신앙 성향'],['/bible-by-age','연령별 말씀','나이에 맞는 말씀'],['/bible-marathon','성경 완독','읽기와 완독']] },
  { title:'기록·성장', icon:'ri-seedling-line', items:[['/bible-pick/history','말씀 히스토리','받았던 말씀 다시 보기'],['/bible-streak','말씀 스트릭','매일 말씀 습관'],['/faith-storybook','신앙 스토리북','나의 신앙 이야기'],['/faith-journal','신앙 일지','묵상과 기록'],['/repentance-journal','회개 저널','돌아보고 다시 시작하기'],['/year-end-summary','월별 결산','한 달의 신앙 돌아보기']] },
  { title:'기도·관계', icon:'ri-heart-2-line', items:[['/prayer-partner','신앙 짝꿍','함께 기도하기'],['/prayer-relay','기도 릴레이','공동 기도 참여']] },
];

export default function FaithHubPage(){
  return <div className="min-h-screen bg-background-50"><div className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-14 pb-28">
    <header className="mb-8 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-100 border border-primary-200"><i className="ri-heart-2-line text-3xl text-primary-600"/></div><h1 className="text-2xl md:text-3xl font-black text-foreground-950">신앙</h1><p className="mt-2 text-sm text-foreground-600">말씀·기도·기록·성장을 한 곳에서 이어가세요.</p></header>
    <div className="grid gap-4 md:grid-cols-3">{sections.map(section=><section key={section.title} className="rounded-[22px] border border-background-200 bg-background-100 p-4 md:p-5 shadow-sm"><div className="mb-3 flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600"><i className={section.icon}/></span><h2 className="font-bold text-foreground-950">{section.title}</h2></div><div className="space-y-1">{section.items.map(([path,label,desc])=><Link key={path} to={path} className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-primary-50 transition"><span className="min-w-0"><span className="block text-sm font-semibold text-foreground-800">{label}</span><span className="block truncate text-xs text-foreground-500">{desc}</span></span><i className="ri-arrow-right-s-line shrink-0 text-foreground-400"/></Link>)}</div></section>)}</div>
    <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/70 p-4 text-sm text-primary-800"><b>신앙 영역 안내</b><span className="ml-2">기존 기능은 삭제하지 않고 각 기능의 기존 주소도 그대로 유지합니다.</span></div>
  </div></div>;
}

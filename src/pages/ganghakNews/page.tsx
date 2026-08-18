import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface NewsItem {
  id: string;
  title: string;
  content: string;
  author_name: string;
  category: string;
  image_url: string | null;
  created_at: string;
}

const ISSUE_NUMBER = 1; // Start from issue 1, increment with each publish cycle

function formatIssueDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, '');
}

function categorySuffix(cat: string): string {
  const map: Record<string, string> = {
    '행사': '행사 소식',
    '믿음': '믿음 칼럼',
    '학생회': '학생회 소식',
    '기도': '기도 요청',
    '선교': '선교 현장',
  };
  return map[cat] || cat;
}

export default function GanghakNewsList() {
  const { user, hasRole } = useAuth();
  const canWrite = user && hasRole('assistant_zone_leader');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('ganghak_news')
        .select('*')
        .order('created_at', { ascending: false });
      setNews((data as NewsItem[]) || []);
    } catch {
      setError('뉴스를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date();
  const printDate = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 발행`;
  const issueNo = `제${ISSUE_NUMBER + news.length}호`;

  // Split into lead + secondary + rest
  const leadArticle = news[0] || null;
  const secondaryArticles = news.slice(1, 4);
  const restArticles = news.slice(4);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-foreground-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-12">

        {/* ═══ 신문 헤드 ═══ */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center border-b-4 border-foreground-950 pb-3 mb-1">
            <h1
              className="text-2xl md:text-7xl font-black text-foreground-950 tracking-tight leading-none"
              style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}
            >
              강학 뉴스
            </h1>
            <p className="text-xs text-foreground-500 tracking-[0.2em] uppercase mt-1">
              GANGHAK STUDENT ASSOCIATION NEWS
            </p>
          </div>

          {/* Masthead Row */}
          <div className="flex items-center justify-between py-1.5 border-b border-foreground-900 mb-5">
            <span className="text-[11px] text-foreground-600">{issueNo}</span>
            <span className="text-[11px] text-foreground-600 font-medium">{printDate}</span>
            <div className="flex items-center gap-2">
              {canWrite && (
                <Link
                  to="/ganghak-news/write"
                  className="flex items-center gap-1 px-3 py-1 rounded-full bg-foreground-950 text-background-50 text-[11px] font-semibold hover:bg-foreground-800 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-quill-pen-line text-xs"></i>
                  기사 작성
                </Link>
              )}
            </div>
          </div>
        </motion.div>

        {error && (
          <div className="bg-rose-100 border border-rose-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-rose-700">{error}</p>
            <button onClick={() => { setError(null); loadNews(); }} className="text-xs text-rose-600 underline cursor-pointer mt-1">다시 시도</button>
          </div>
        )}

        {news.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-foreground-300 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-background-200 flex items-center justify-center mx-auto mb-4">
              <i className="ri-newspaper-line text-2xl text-foreground-400"></i>
            </div>
            <p className="text-sm text-foreground-500 mb-4">아직 등록된 기사가 없습니다</p>
            {canWrite && (
              <Link to="/ganghak-news/write" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground-950 text-background-50 text-sm font-semibold hover:bg-foreground-800 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-quill-pen-line"></i>첫 기사 작성하기
              </Link>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>

            {/* ═══ Lead Article ═══ */}
            {leadArticle && (
              <div className="border-b-2 border-foreground-900 pb-6 mb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Lead content */}
                  <div className="lg:col-span-2">
                    {/* Section label */}
                    <p className="text-[10px] font-black tracking-[0.3em] uppercase text-foreground-500 border-b border-foreground-300 pb-1 mb-3">
                      {categorySuffix(leadArticle.category)}
                    </p>
                    <Link to={`/ganghak-news/${leadArticle.id}`} className="group block cursor-pointer">
                      <h2
                        className="text-2xl md:text-4xl font-black text-foreground-950 leading-tight mb-2 group-hover:underline"
                        style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}
                      >
                        {leadArticle.title}
                      </h2>
                    </Link>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-foreground-500">기자 {leadArticle.author_name}</span>
                      <span className="text-[10px] text-foreground-400">|</span>
                      <span className="text-[10px] text-foreground-500">{formatIssueDate(leadArticle.created_at)}</span>
                    </div>
                    <p className="text-sm text-foreground-700 leading-relaxed line-clamp-4" style={{ fontFamily: '"Noto Serif KR", serif' }}>
                      {stripHtml(leadArticle.content).slice(0, 300)}...
                    </p>
                    <Link to={`/ganghak-news/${leadArticle.id}`} className="inline-flex items-center gap-1 text-xs font-bold text-foreground-950 hover:underline mt-2 cursor-pointer whitespace-nowrap">
                      전문 읽기 <i className="ri-arrow-right-line"></i>
                    </Link>
                  </div>

                  {/* Lead image */}
                  <div className="lg:col-span-1">
                    {leadArticle.image_url && (
                      <Link to={`/ganghak-news/${leadArticle.id}`} className="block cursor-pointer">
                        <img
                          src={leadArticle.image_url}
                          alt={leadArticle.title}
                          className="w-full h-48 md:h-56 object-cover border border-foreground-200"
                        />
                      </Link>
                    )}
                    <p className="text-[10px] text-foreground-400 mt-1 italic text-center">
                      {leadArticle.image_url ? '사진 제공: 강학 학생회' : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ Secondary Articles — 3-column grid ═══ */}
            {secondaryArticles.length > 0 && (
              <div className={`grid gap-5 border-b-2 border-foreground-900 pb-6 mb-6 grid-cols-1 md:grid-cols-${Math.min(secondaryArticles.length, 3)}`}>
                {secondaryArticles.map((item, idx) => (
                  <div key={item.id} className={`${idx < secondaryArticles.length - 1 ? 'md:border-r md:border-foreground-200 md:pr-5' : ''}`}>
                    <p className="text-[9px] font-black tracking-[0.3em] uppercase text-foreground-400 border-b border-foreground-200 pb-1 mb-2">
                      {categorySuffix(item.category)}
                    </p>
                    <Link to={`/ganghak-news/${item.id}`} className="group block cursor-pointer">
                      <h3
                        className="text-base md:text-lg font-bold text-foreground-950 leading-snug mb-2 group-hover:underline"
                        style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}
                      >
                        {item.title}
                      </h3>
                    </Link>
                    <p className="text-xs text-foreground-600 leading-relaxed line-clamp-3 mb-2" style={{ fontFamily: '"Noto Serif KR", serif' }}>
                      {stripHtml(item.content).slice(0, 150)}
                    </p>
                    <p className="text-[10px] text-foreground-400">
                      {item.author_name} · {formatIssueDate(item.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* ═══ Rest — compact list ═══ */}
            {restArticles.length > 0 && (
              <div>
                <p className="text-[10px] font-black tracking-[0.3em] uppercase text-foreground-500 border-b border-foreground-300 pb-1 mb-4">더 많은 기사</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                  {restArticles.map((item) => (
                    <Link key={item.id} to={`/ganghak-news/${item.id}`} className="group flex items-start gap-2 py-2 border-b border-foreground-100 cursor-pointer">
                      <span className={`flex-shrink-0 text-[9px] font-black tracking-widest text-foreground-400 uppercase pt-0.5 w-14`}>{categorySuffix(item.category)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground-900 group-hover:underline truncate" style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}>{item.title}</p>
                        <p className="text-[10px] text-foreground-400">{item.author_name} · {formatIssueDate(item.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        )}

        {/* Footer rule */}
        <div className="border-t-2 border-foreground-950 mt-10 pt-3 text-center">
          <p className="text-[10px] text-foreground-400 tracking-widest uppercase">
            강릉 학생회 · 스스로 신앙하는 거침없는 학생회
          </p>
        </div>
      </div>
    </div>
  );
}
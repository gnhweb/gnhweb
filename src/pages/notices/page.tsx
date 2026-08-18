import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

interface NoticeItem {
  id: string;
  author_id: string;
  author_name?: string;
  title: string;
  content: string;
  category?: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export default function Notices() {
  const { profile } = useAuth();
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('notices')
          .select('id, author_id, author_name, title, content, category, is_pinned, created_at, updated_at')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setNotices(data || []);
      } catch {
        setError('공지사항을 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchNotices();
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
          <div className="flex items-center justify-center py-20">
            <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-10">
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-[20px] bg-background-100 border border-background-200 mb-4 md:mb-5">
                <i className="ri-megaphone-line text-2xl md:text-3xl text-primary-600"></i>
              </div>
              <h1 className="text-xl md:text-3xl font-bold text-foreground-950 mb-2 md:mb-3">공지사항</h1>
              <p className="text-foreground-600 text-sm">강릉 학생회의 주요 소식을 확인하세요</p>
            </div>
            {profile && profile.role !== 'member' && (
              <Link
                to="/notices/write"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap self-start"
              >
                <i className="ri-add-line"></i>
                공지 작성
              </Link>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6"
            >
              <p className="text-sm text-accent-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                {error}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 text-xs text-accent-600 underline cursor-pointer"
              >
                다시 시도
              </button>
            </motion.div>
          )}

          {notices.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-[20px] bg-background-100 border border-background-200 flex items-center justify-center mx-auto mb-4">
                <i className="ri-megaphone-line text-2xl text-foreground-500"></i>
              </div>
              <p className="text-foreground-600 text-sm mb-4">아직 등록된 공지사항이 없어요</p>
              {profile && profile.role !== 'member' ? (
                <Link
                  to="/notices/write"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <i className="ri-add-line"></i>
                  첫 공지 작성하기
                </Link>
              ) : (
                <p className="text-xs text-foreground-600">작성 권한이 없습니다</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice, index) => (
                <motion.div
                  key={notice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Link
                    to={`/notices/${notice.id}`}
                    className="block bg-background-100 border border-background-200 rounded-[20px] p-5 md:p-6 hover:border-background-300/60 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 hidden sm:block">
                        {notice.is_pinned ? (
                          <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                            <i className="ri-pushpin-line text-lg text-primary-600"></i>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-background-200 flex items-center justify-center">
                            <i className="ri-file-text-line text-lg text-foreground-500"></i>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
                            notice.category === '긴급'
                              ? 'bg-rose-100 text-rose-700 border border-rose-300'
                              : notice.is_pinned
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-background-200 text-foreground-600'
                          }`}>
                            {notice.category || '일반'}
                          </span>
                          {notice.category === '긴급' && (
                            <span className="text-xs text-rose-500 font-bold flex items-center gap-1">
                              <i className="ri-alert-fill"></i> 긴급
                            </span>
                          )}
                          {notice.is_pinned && (
                            <span className="text-xs text-primary-500 font-medium">고정</span>
                          )}
                          {notice.author_name && (
                            <span className="text-xs text-foreground-500">
                              <i className="ri-user-line mr-0.5"></i>{notice.author_name}
                            </span>
                          )}
                        </div>
                        <h2 className="text-base md:text-lg font-bold text-foreground-950 group-hover:text-primary-600 transition-colors mb-1">
                          {notice.title}
                        </h2>
                        <p className="text-sm text-foreground-600 line-clamp-2">{notice.content.split('\n')[0]}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className="text-xs text-foreground-600 whitespace-nowrap">{formatDate(notice.created_at)}</span>
                        <div className="mt-2">
                          <i className="ri-arrow-right-s-line text-foreground-500 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all inline-block"></i>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-10 text-center"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-foreground-600 hover:text-foreground-950 transition-colors"
          >
            <i className="ri-arrow-left-line"></i>
            홈으로 돌아가기
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
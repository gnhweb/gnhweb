import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

export default function NoticeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, hasRole } = useAuth();
  const [notice, setNotice] = useState<NoticeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchNotice = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('notices')
          .select('id, author_id, author_name, title, content, category, is_pinned, created_at, updated_at')
          .eq('id', id)
          .maybeSingle();

        if (fetchError) throw fetchError;
        setNotice(data);

        // Mark as read in Supabase for cross-device/account sync.
        if (data && id) {
          if (user?.id) {
            const { error: readError } = await supabase
              .from('notice_reads')
              .upsert(
                { user_id: user.id, notice_id: id },
                { onConflict: 'user_id,notice_id', ignoreDuplicates: true }
              );

            if (readError) {
              // Preserve the previous browser-local behavior as a fallback.
              try {
                const key = `notice_reads:${user.id}`;
                const raw = localStorage.getItem(key);
                const reads: string[] = raw ? JSON.parse(raw) : [];
                if (!reads.includes(id)) {
                  reads.push(id);
                  localStorage.setItem(key, JSON.stringify(reads));
                }
              } catch { /* ignore */ }
            }
          } else {
            try {
              const raw = localStorage.getItem('notice_reads');
              const reads: string[] = raw ? JSON.parse(raw) : [];
              if (!reads.includes(id)) {
                reads.push(id);
                localStorage.setItem('notice_reads', JSON.stringify(reads));
              }
            } catch { /* ignore */ }
          }
        }
      } catch {
        setError('공지사항을 불러오는 중 오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchNotice();
  }, [id, user?.id]);

  const canModify = Boolean(
    notice && (
      notice.author_id === user?.id ||
      hasRole('teacher') ||
      hasRole('chief')
    )
  );

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { data: deletedNotice, error: deleteError } = await supabase
        .from('notices')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();

      if (deleteError) {
        setError(deleteError.message || '삭제 중 오류가 발생했습니다');
        setShowDeleteConfirm(false);
        return;
      }

      if (!deletedNotice) {
        setError('공지사항을 삭제할 권한이 없거나 이미 삭제된 공지사항입니다.');
        setShowDeleteConfirm(false);
        return;
      }

      navigate('/notices');
    } catch {
      setError('삭제 중 오류가 발생했습니다');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatKoreanDate(dateStr, { year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/ /g, '.');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-loader-4-line animate-spin text-2xl text-primary-500"></i>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-foreground-600 mb-4">{error}</p>
          <Link to="/notices" className="text-primary-600 hover:text-primary-700 font-medium">공지사항 목록으로</Link>
        </div>
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-foreground-600 mb-4">공지사항을 찾을 수 없습니다</p>
          <Link to="/notices" className="text-primary-600 hover:text-primary-700 font-medium">공지사항 목록으로</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            onClick={() => navigate('/notices')}
            className="flex items-center gap-2 text-foreground-600 hover:text-foreground-950 transition-colors mb-6 text-sm group cursor-pointer"
          >
            <i className="ri-arrow-left-line group-hover:-translate-x-1 transition-transform duration-200"></i>
            공지사항 목록
          </button>

          <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
            <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
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
                    <i className="ri-alert-fill"></i> 긴급 공지
                  </span>
                )}
                {notice.author_name && (
                  <span className="text-xs text-foreground-500">
                    <i className="ri-user-line mr-0.5"></i>{notice.author_name}
                  </span>
                )}
                <span className="text-xs text-foreground-600">{formatDate(notice.created_at)}</span>
                {notice.created_at !== notice.updated_at && (
                  <span className="text-xs text-foreground-500">· 수정됨</span>
                )}
              </div>

              {canModify && (
                <div className="flex items-center gap-1.5">
                  <Link
                    to={`/notices/${notice.id}/edit`}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-foreground-700 bg-background-200 hover:bg-background-300/60 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-edit-line"></i>
                    수정
                  </Link>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-accent-600 bg-accent-100 hover:bg-accent-200 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <i className="ri-delete-bin-line"></i>
                    삭제
                  </button>
                </div>
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-foreground-950 mb-6">{notice.title}</h1>

            <div className="text-sm md:text-base text-foreground-700 leading-relaxed whitespace-pre-line">
              {notice.content}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Link
              to="/notices"
              className="inline-flex items-center gap-2 text-sm text-foreground-600 hover:text-foreground-950 transition-colors"
            >
              <i className="ri-arrow-left-line"></i>
              목록으로
            </Link>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-background-100 border border-background-200 rounded-[20px] p-6 max-w-sm w-full"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-accent-100 flex items-center justify-center mx-auto mb-4">
                  <i className="ri-alert-line text-xl text-accent-600"></i>
                </div>
                <h3 className="text-lg font-bold text-foreground-950 mb-2">공지사항 삭제</h3>
                <p className="text-sm text-foreground-600 mb-6">
                  정말 이 공지사항을 삭제할까요?<br />이 작업은 되돌릴 수 없어요.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-4 py-2 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 rounded-full bg-accent-500 text-background-50 text-sm font-medium hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? '삭제 중...' : '삭제하기'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
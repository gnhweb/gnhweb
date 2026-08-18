import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

const CATEGORIES = ['일반', '긴급', '행사', '모집', '교육', '기도제목'];

export default function NoticeWrite() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefilled = (location.state as { prefilledTitle?: string; prefilledContent?: string } | null) || {};

  const [title, setTitle] = useState(prefilled.prefilledTitle || '');
  const [content, setContent] = useState(prefilled.prefilledContent || '');
  const [category, setCategory] = useState('일반');
  const [isPinned, setIsPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'member') {
      navigate('/notices');
    }
  }, [profile, navigate]);

  const validate = (): string | null => {
    if (!title.trim()) return '제목을 입력해주세요';
    if (title.length > 100) return '제목은 100자 이내로 작성해주세요';
    if (!content.trim()) return '내용을 입력해주세요';
    if (content.length > 5000) return '내용은 5000자 이내로 작성해주세요';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSaving(true);

    try {
      const { error: insertError } = await supabase
        .from('notices')
        .insert({
          author_id: profile!.user_id,
          author_name: profile!.name,
          title: title.trim(),
          content: content.trim(),
          category,
          is_pinned: isPinned,
        });

      if (insertError) {
        setError(insertError.message);
        return;
      }

      // Send notification to all active students
      try {
        const { data: students } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('is_active', true);
        if (students && students.length > 0) {
          const notifications = students.map((s: { user_id: string }) => ({
            user_id: s.user_id,
            type: 'notice',
            title: '새 공지사항',
            message: `[${category}] ${title.trim()}`,
            is_read: false,
            link_url: '/notices',
          }));
          await supabase.from('notifications').insert(notifications);
        }
      } catch { /* notification non-critical */ }

      navigate('/notices');
    } catch {
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <button
              onClick={() => navigate('/notices')}
              className="flex items-center gap-1.5 text-sm text-foreground-600 hover:text-foreground-950 transition-colors mb-3 cursor-pointer"
            >
              <i className="ri-arrow-left-line"></i>
              공지사항 목록으로
            </button>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">공지사항 작성</h1>
            <p className="text-sm text-foreground-600">강릉 학생회 공지를 등록합니다</p>
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
            </motion.div>
          )}

          <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-bookmark-line mr-1.5 text-foreground-600"></i>
                카테고리
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      category === cat
                        ? 'bg-primary-100 text-primary-700'
                        : 'bg-background-200 text-foreground-600 hover:bg-background-300/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-edit-line mr-1.5 text-foreground-600"></i>
                제목
                <span className="text-foreground-500 font-normal ml-1">({title.length}/100)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="공지 제목을 입력하세요"
                maxLength={100}
                className="w-full px-4 py-2.5 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                <i className="ri-file-text-line mr-1.5 text-foreground-600"></i>
                내용
                <span className="text-foreground-500 font-normal ml-1">({content.length}/5000)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="공지 내용을 상세히 작성해주세요..."
                rows={10}
                maxLength={5000}
                className="w-full px-4 py-3 rounded-[13px] border border-background-200 text-sm text-foreground-950 bg-background-50 focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPinned(!isPinned)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isPinned ? 'bg-primary-100 text-primary-700' : 'bg-background-200 text-foreground-600 hover:bg-background-300/60'
                }`}
              >
                <i className={`ri-pushpin-line ${isPinned ? 'text-primary-600' : ''}`}></i>
                {isPinned ? '상단 고정됨' : '상단 고정'}
              </button>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => navigate('/notices')}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-close-line"></i>
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-send-plane-line"></i>
                {saving ? '등록 중...' : '등록하기'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
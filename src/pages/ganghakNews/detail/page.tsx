import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface NewsDetail {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  category: string;
  image_url: string | null;
  created_at: string;
}

function formatFullDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function GanghakNewsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isChief = hasRole('chief');
  const [item, setItem] = useState<NewsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDetail();
  }, [id]);

  const loadDetail = async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('ganghak_news')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!data) {
        setError('존재하지 않는 기사입니다.');
        return;
      }
      setItem(data as NewsDetail);
    } catch {
      setError('기사를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('정말 이 기사를 삭제할까요?')) return;
    setDeleting(true);
    try {
      const { error: delErr } = await supabase
        .from('ganghak_news')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      navigate('/ganghak-news', { replace: true });
    } catch {
      setError('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const canEdit = user && item && (item.author_id === user.id || isChief);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-foreground-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="min-h-screen bg-[#f5f0e8] flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground-600 mb-4">{error}</p>
          <Link to="/ganghak-news" className="text-foreground-800 hover:underline font-medium cursor-pointer">← 목록으로</Link>
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="min-h-screen bg-[#f5f0e8]">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>

          {/* Back to List */}
          <div className="flex items-center justify-between mb-6">
            <Link to="/ganghak-news" className="flex items-center gap-1.5 text-xs font-semibold text-foreground-600 hover:text-foreground-950 transition-colors cursor-pointer group">
              <i className="ri-arrow-left-line group-hover:-translate-x-1 transition-transform duration-200"></i>
              강학뉴스 목록
            </Link>
            <div className="w-px h-4 bg-foreground-200"></div>
            <span className="text-[10px] text-foreground-400 uppercase tracking-widest">강릉 학생회</span>
          </div>

          {/* Newspaper masthead stripe */}
          <div className="border-t-4 border-b border-foreground-950 pt-2 pb-1.5 mb-5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black tracking-[0.3em] uppercase text-foreground-500">{item.category}</span>
              <span className="text-[9px] text-foreground-400">{formatFullDate(item.created_at)} {formatTime(item.created_at)} 발행</span>
            </div>
          </div>

          {/* Headline */}
          <h1
            className="text-2xl md:text-4xl font-black text-foreground-950 leading-tight mb-4"
            style={{ fontFamily: '"Noto Serif KR", Georgia, serif' }}
          >
            {item.title}
          </h1>

          {/* Byline */}
          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-foreground-200">
            <div className="w-8 h-8 rounded-full bg-foreground-200 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-foreground-700">{item.author_name.charAt(0)}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground-800">{item.author_name} 기자</p>
              <p className="text-[10px] text-foreground-500">강릉 학생회</p>
            </div>
          </div>

          {/* Hero image */}
          {item.image_url && (
            <div className="mb-6">
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full h-56 md:h-72 object-cover border border-foreground-200"
              />
              <p className="text-[10px] text-foreground-400 italic mt-1 text-center">사진 제공: 강학 학생회</p>
            </div>
          )}

          {/* Article body — improved readability */}
          <div
            className="text-sm md:text-base leading-[2.1] text-foreground-800"
            style={{ fontFamily: '"Noto Serif KR", serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {item.content}
          </div>

          {/* Decorative rule */}
          <div className="flex items-center gap-3 mt-8 mb-6">
            <div className="flex-1 h-px bg-foreground-200"></div>
            <i className="ri-cross-line text-foreground-300 text-xs"></i>
            <div className="flex-1 h-px bg-foreground-200"></div>
          </div>

          {/* Edit / Delete */}
          {canEdit && (
            <div className="flex items-center gap-3">
              <Link
                to={`/ganghak-news/${item.id}/edit`}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-foreground-300 text-sm font-medium text-foreground-700 hover:bg-foreground-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                <i className="ri-edit-line text-sm"></i>수정
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-rose-200 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <i className="ri-delete-bin-line text-sm"></i>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-sm text-rose-600 mt-3">{error}</p>
          )}

          {/* Bottom nav */}
          <div className="border-t-2 border-foreground-900 mt-8 pt-3 text-center">
            <p className="text-[10px] text-foreground-400 tracking-widest uppercase">
              강릉 학생회 · 스스로 신앙하는 거침없는 학생회
            </p>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
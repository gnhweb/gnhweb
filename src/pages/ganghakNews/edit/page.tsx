import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const CATEGORIES = ['일반', '행사', '공지', '인터뷰', '칼럼'];

export default function GanghakNewsEdit() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, hasRole } = useAuth();
  const navigate = useNavigate();
  const canEdit = user && hasRole('assistant_zone_leader');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('일반');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadArticle();
  }, [id]);

  const loadArticle = async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('ganghak_news')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (fetchErr) throw fetchErr;
      if (!data) {
        setNotFound(true);
        return;
      }
      if (user && data.author_id !== user.id && !hasRole('chief')) {
        setError('자신이 작성한 기사만 수정할 수 있습니다.');
        return;
      }
      setTitle(data.title || '');
      setContent(data.content || '');
      setCategory(data.category || '일반');
      setImageUrl(data.image_url || '');
      setOriginalImageUrl(data.image_url || null);
    } catch {
      setError('기사를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      // Delete old image from storage if exists
      if (originalImageUrl) {
        try {
          const urlObj = new URL(originalImageUrl);
          const pathParts = urlObj.pathname.split('/');
          const bucketIndex = pathParts.findIndex(p => p === 'Public');
          if (bucketIndex !== -1) {
            const oldPath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from('Public').remove([oldPath]);
          }
        } catch { /* ignore */ }
      }
      const ext = file.name.split('.').pop();
      const path = `news/news-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
      setOriginalImageUrl(null);
    } catch {
      setError('이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveImage = async () => {
    if (originalImageUrl) {
      try {
        const urlObj = new URL(originalImageUrl);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.findIndex(p => p === 'Public');
        if (bucketIndex !== -1) {
          const oldPath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('Public').remove([oldPath]);
        }
      } catch { /* ignore */ }
    }
    if (imageUrl && imageUrl !== originalImageUrl) {
      try {
        const urlObj = new URL(imageUrl);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.findIndex(p => p === 'Public');
        if (bucketIndex !== -1) {
          const oldPath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('Public').remove([oldPath]);
        }
      } catch { /* ignore */ }
    }
    setImageUrl('');
    setOriginalImageUrl(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || !profile || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: updateErr } = await supabase
        .from('ganghak_news')
        .update({
          title: title.trim(),
          content: content.trim(),
          category,
          image_url: imageUrl || null,
        })
        .eq('id', id);

      if (updateErr) throw updateErr;
      navigate(`/ganghak-news/${id}`);
    } catch {
      setError('뉴스 수정 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-accent-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-shield-keyhole-line text-3xl text-accent-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">접근 권한이 없습니다</p>
          <p className="text-sm text-foreground-600">사명자 이상만 뉴스를 수정할 수 있습니다</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-foreground-600 mb-4">존재하지 않는 기사입니다</p>
          <button onClick={() => navigate('/ganghak-news')} className="text-primary-600 hover:underline font-medium cursor-pointer">목록으로</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">강학뉴스 수정</h1>
            <p className="text-sm text-foreground-600">기사 내용을 수정해주세요</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
            </div>
          )}

          <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 space-y-5">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">카테고리</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      category === cat ? 'bg-sky-500 text-white' : 'bg-background-100 text-foreground-600 hover:bg-background-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">제목</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="뉴스 제목을 입력하세요"
                maxLength={100}
                className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-sky-400 outline-none"
              />
            </div>

            {/* Image */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">대표 이미지 (선택)</label>
              {imageUrl ? (
                <div className="relative">
                  <img src={imageUrl} alt="대표 이미지" className="w-full h-40 object-cover rounded-xl" />
                  <button
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-rose-500 cursor-pointer transition-colors"
                  >
                    <i className="ri-close-line text-sm"></i>
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-32 rounded-xl border-2 border-dashed border-background-300 bg-background-50 cursor-pointer hover:border-sky-300 hover:bg-sky-50/30 transition-colors">
                  <i className="ri-image-add-line text-2xl text-foreground-400"></i>
                  <span className="text-sm text-foreground-500">{uploading ? '업로드 중...' : '이미지 추가하기'}</span>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                </label>
              )}
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">내용</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="뉴스 내용을 작성해주세요..."
                rows={10}
                maxLength={5000}
                className="w-full px-4 py-3 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-sky-400 outline-none resize-none"
              />
              <p className="text-xs text-foreground-500 mt-1 text-right">{content.length}/5000</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => navigate(`/ganghak-news/${id}`)}
                className="flex-1 py-3 rounded-full border border-background-200 text-foreground-600 text-sm font-medium hover:bg-background-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || !content.trim() || submitting}
                className="flex-1 py-3 rounded-full bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {submitting ? '수정 중...' : '뉴스 수정하기'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clubs } from '@/mocks/clubs';
import PhotoLightbox from '@/components/feature/PhotoLightbox';
import { CategoryChip, CategoryChipRow } from '@/components/base/CategoryChip';
import { formatDateKey } from '@/lib/date';
import { resizeImageFile, thumbFileNameFor } from '@/lib/imageResize';

interface PhotoMemory {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  photo_url: string;
  thumb_url: string | null;
  club: string | null;
  created_at: string;
}

const PAGE_SIZE = 24;

export default function MemoryBoard() {
  const { user, profile, hasRole } = useAuth();
  const isEditor = user && (hasRole('assistant_zone_leader') || hasRole('teacher') || hasRole('chief'));

  const [filter, setFilter] = useState<'all' | string>('all');
  const [photos, setPhotos] = useState<PhotoMemory[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { loadPhotos(); }, []);
  useEffect(() => { setVisibleCount(PAGE_SIZE); setLightboxIndex(null); }, [filter]);

  useEffect(() => {
    const channel = supabase
      .channel('memory_photos_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memory_photos' }, (payload) => {
        const newPhoto = payload.new as PhotoMemory;
        setPhotos(prev => prev.some(p => p.id === newPhoto.id) ? prev : [newPhoto, ...prev]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'memory_photos' }, (payload) => {
        setPhotos(prev => prev.filter(p => p.id !== (payload.old as { id: string }).id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('memory_photos')
        .select('*')
        .order('created_at', { ascending: false });
      if (fetchErr) throw fetchErr;
      setPhotos(data || []);
    } catch {
      setError('추억을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim() || !profile || uploading) return;
    setUploading(true);
    setError(null);
    let displayPath: string | null = null;
    let thumbPath: string | null = null;
    try {
      const safeName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.jpg`;
      displayPath = `memories/${user!.id}/${safeName}`;
      thumbPath = `memories/${user!.id}/${thumbFileNameFor(safeName)}`;

      const [displayBlob, thumbBlob] = await Promise.all([
        resizeImageFile(uploadFile, { maxDimension: 1280, quality: 0.78, mimeType: 'image/jpeg' }),
        resizeImageFile(uploadFile, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg' }),
      ]);

      const { error: displayErr } = await supabase.storage
        .from('Public')
        .upload(displayPath, displayBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
      if (displayErr) throw new Error(`사진 업로드 실패: ${displayErr.message}`);

      const { error: thumbErr } = await supabase.storage
        .from('Public')
        .upload(thumbPath, thumbBlob, { upsert: true, contentType: 'image/jpeg', cacheControl: '31536000' });
      if (thumbErr) throw new Error(`썸네일 업로드 실패: ${thumbErr.message}`);

      const displayUrl = supabase.storage.from('Public').getPublicUrl(displayPath).data.publicUrl;
      const thumbUrl = supabase.storage.from('Public').getPublicUrl(thumbPath).data.publicUrl;

      const { error: insertErr } = await supabase
        .from('memory_photos')
        .insert({
          author_id: user!.id,
          author_name: profile.name,
          title: uploadTitle.trim(),
          photo_url: displayUrl,
          thumb_url: thumbUrl,
          club: profile.club || null,
        });
      if (insertErr) throw new Error(`DB 저장 실패: ${insertErr.message}`);

      setUploadTitle('');
      setUploadFile(null);
      setShowUpload(false);
      await loadPhotos();
    } catch (e) {
      const paths = [displayPath, thumbPath].filter((path): path is string => Boolean(path));
      if (paths.length) {
        try { await supabase.storage.from('Public').remove(paths); } catch { /* best-effort cleanup */ }
      }
      console.error('Upload error:', e);
      setError(e instanceof Error ? e.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photo: PhotoMemory) => {
    try {
      const storagePaths: string[] = [];
      for (const url of [photo.photo_url, photo.thumb_url]) {
        if (!url) continue;
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split('/');
          const bucketIndex = pathParts.findIndex(p => p === 'Public');
          if (bucketIndex !== -1) storagePaths.push(pathParts.slice(bucketIndex + 1).join('/'));
        } catch { /* ignore malformed url */ }
      }
      if (storagePaths.length) {
        try { await supabase.storage.from('Public').remove(storagePaths); } catch { /* ignore storage cleanup errors */ }
      }
      const { error: deleteErr } = await supabase.from('memory_photos').delete().eq('id', photo.id);
      if (deleteErr) throw new Error(`삭제 실패: ${deleteErr.message}`);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
    } catch (e) {
      console.error('Delete error:', e);
      setError(e instanceof Error ? e.message : '삭제 중 오류가 발생했습니다.');
    }
  };

  const handleDeleteAtIndex = async (index: number) => {
    const photo = visiblePhotos[index];
    if (!photo) return;
    setDeletingIndex(index);
    await handleDeletePhoto(photo);
    setDeletingIndex(null);
    setLightboxIndex(prev => {
      if (prev === null) return prev;
      const remaining = visiblePhotos.length - 1;
      if (remaining <= 0) return null;
      return Math.min(prev, remaining - 1);
    });
  };

  const filteredPhotos = filter === 'all' ? photos : photos.filter(p => p.club === filter);
  const visiblePhotos = filteredPhotos.slice(0, visibleCount);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-rose-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-rose-100 border border-rose-200 mb-5">
              <i className="ri-image-line text-3xl text-rose-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">추억창</h1>
            <p className="text-sm text-foreground-600">학생회의 소중한 순간들을 사진으로 남겨보세요</p>
          </div>

          {error && (
            <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
              <p className="text-sm text-accent-700"><i className="ri-error-warning-line mr-1"></i>{error}</p>
              <button onClick={() => { setError(null); loadPhotos(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
            </div>
          )}

          <div className="hidden md:flex items-center gap-2 mb-8 flex-wrap justify-center">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${filter === 'all' ? 'bg-rose-500 text-white' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>전체 추억</button>
            {clubs.map(c => (
              <button key={c.id} onClick={() => setFilter(filter === c.id ? 'all' : c.id)} className={`px-4 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${filter === c.id ? 'bg-rose-500 text-white' : 'bg-background-100 text-foreground-600 hover:bg-background-200'}`}>{c.name}</button>
            ))}
          </div>

          <div className="md:hidden mb-6">
            <CategoryChipRow>
              <CategoryChip active={filter === 'all'} onClick={() => setFilter('all')}>전체 추억</CategoryChip>
              {clubs.map(c => <CategoryChip key={c.id} active={filter === c.id} onClick={() => setFilter(filter === c.id ? 'all' : c.id)}>{c.name}</CategoryChip>)}
            </CategoryChipRow>
          </div>

          <div className="hidden md:grid grid-cols-2 md:grid-cols-3 gap-4">
            {visiblePhotos.map((photo, idx) => (
              <motion.div key={photo.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} onClick={() => setLightboxIndex(idx)} className="group cursor-pointer rounded-xl overflow-hidden bg-background-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="aspect-[4/3] overflow-hidden"><img src={photo.thumb_url || photo.photo_url} alt={photo.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-foreground-800 truncate">{photo.title}</p>
                  <div className="flex items-center justify-between mt-1"><span className="text-xs text-foreground-600">{photo.author_name}</span><span className="text-xs text-foreground-500">{formatDateKey(photo.created_at)}</span></div>
                  {photo.club && <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">{clubs.find(c => c.id === photo.club)?.name}</span>}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="md:hidden grid grid-cols-3 gap-0.5">
            {visiblePhotos.map((photo, idx) => (
              <motion.div key={`m-${photo.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx * 0.03, 0.3) }} whileTap={{ scale: 0.97 }} onClick={() => setLightboxIndex(idx)} className="relative aspect-square cursor-pointer overflow-hidden bg-background-100">
                <img src={photo.thumb_url || photo.photo_url} alt={photo.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </motion.div>
            ))}
          </div>

          {visiblePhotos.length < filteredPhotos.length && (
            <div className="flex justify-center mt-6">
              <button onClick={() => setVisibleCount(count => Math.min(count + PAGE_SIZE, filteredPhotos.length))} className="px-5 py-2.5 rounded-full bg-background-100 border border-background-200 text-sm font-semibold text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer">
                사진 더 보기 ({filteredPhotos.length - visiblePhotos.length}장)
              </button>
            </div>
          )}

          {filteredPhotos.length === 0 && <div className="text-center py-16"><p className="text-sm text-foreground-600">아직 추억이 없어요</p></div>}

          {isEditor && <div className="text-center mt-8"><button onClick={() => setShowUpload(true)} className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 transition-all cursor-pointer"><i className="ri-upload-line"></i> 사진 올리기</button></div>}
        </motion.div>
      </div>

      {lightboxIndex !== null && <PhotoLightbox photos={visiblePhotos.map(p => p.photo_url)} thumbUrls={visiblePhotos.map(p => p.thumb_url || p.photo_url)} captions={visiblePhotos.map(p => p.title)} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} onDelete={isEditor ? handleDeleteAtIndex : undefined} canDelete={isEditor ? (index) => visiblePhotos[index]?.author_id === user?.id : undefined} deletingIndex={deletingIndex} />}

      {showUpload && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-background-100 rounded-[20px] p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">사진 올리기</h3>
            <input type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="제목" maxLength={30} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-rose-400 mb-4" />
            <input type="file" accept="image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="w-full text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowUpload(false)} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm cursor-pointer">취소</button>
              <button onClick={handleUpload} disabled={!uploadFile || !uploadTitle.trim() || uploading} className="flex-1 py-2.5 rounded-full bg-rose-500 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer">{uploading ? '업로드 중...' : '올리기'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

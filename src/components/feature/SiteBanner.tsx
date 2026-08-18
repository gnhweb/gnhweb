import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import ImageCropModal from '@/components/feature/ImageCropModal';

export default function SiteBanner() {
  const { user, hasRole } = useAuth();
  const canManage = user && hasRole('assistant_zone_leader');
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [bannerId, setBannerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBanner();
  }, []);

  const loadBanner = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('site_banners')
        .select('id, image_url')
        .limit(1)
        .maybeSingle();
      if (data?.image_url) {
        setBannerUrl(data.image_url);
        setBannerId(data.id);
      } else if (data?.id) {
        setBannerId(data.id);
      }
    } catch (err) {
      console.warn('Failed to load site banner:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    setCropOpen(true);
    if (e.target) e.target.value = '';
  };

  const handleCroppedUpload = async (blob: Blob, fileName: string) => {
    if (!user || !blob) return;
    setCropOpen(false);
    setUploading(true);
    setError(null);
    try {
      // Delete old Storage file if exists
      if (bannerUrl) {
        try {
          const urlObj = new URL(bannerUrl);
          const pathParts = urlObj.pathname.split('/');
          const bucketIndex = pathParts.findIndex(p => p === 'Public');
          if (bucketIndex !== -1) {
            const oldPath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from('Public').remove([oldPath]);
          }
        } catch { /* ignore */ }
      }

      // Upload cropped blob to Storage
      const path = `banners/banner-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
      const newUrl = urlData.publicUrl;

      // Upsert into DB
      const { error: dbErr } = await supabase
        .from('site_banners')
        .upsert({
          id: bannerId || undefined,
          image_url: newUrl,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        });
      if (dbErr) throw dbErr;

      // Refresh
      const { data: freshData } = await supabase
        .from('site_banners')
        .select('id, image_url')
        .limit(1)
        .maybeSingle();
      if (freshData) {
        setBannerId(freshData.id);
        setBannerUrl(freshData.image_url);
      } else {
        setBannerUrl(newUrl);
      }
    } catch (err: any) {
      console.error('Banner upload failed:', err);
      setError(err?.message || '배너 이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
      setCropFile(null);
    }
  };

  const handleRemove = async () => {
    if (!user || !bannerUrl) return;
    setRemoving(true);
    setError(null);
    try {
      try {
        const urlObj = new URL(bannerUrl);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.findIndex(p => p === 'Public');
        if (bucketIndex !== -1) {
          const oldPath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('Public').remove([oldPath]);
        }
      } catch { /* ignore */ }

      if (bannerId) {
        const { error: dbErr } = await supabase
          .from('site_banners')
          .update({ image_url: null, updated_by: user.id, updated_at: new Date().toISOString() })
          .eq('id', bannerId);
        if (dbErr) throw dbErr;
      }
      setBannerUrl(null);
    } catch (err: any) {
      console.error('Banner remove failed:', err);
      setError(err?.message || '배너 이미지 삭제 중 오류가 발생했습니다.');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return null;
  if (!bannerUrl && !canManage) return null;

  return (
    <>
      <div className="relative group">
        {bannerUrl ? (
          <div className="relative w-full h-[180px] md:h-[220px] overflow-hidden">
            <img src={bannerUrl} alt="사이트 배너" className="w-full h-full object-cover" />
            {canManage && (
              <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <label className={`px-3 py-1.5 rounded-full bg-white/90 text-xs font-semibold text-foreground-700 cursor-pointer hover:bg-white transition-colors whitespace-nowrap ${uploading ? 'opacity-50' : ''}`}>
                  <i className="ri-image-edit-line mr-1"></i>
                  {uploading ? '업로드 중...' : '사진 변경'}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} disabled={uploading} className="hidden" />
                </label>
                <button
                  onClick={handleRemove}
                  disabled={removing}
                  className="px-3 py-1.5 rounded-full bg-white/90 text-xs font-semibold text-rose-600 cursor-pointer hover:bg-white transition-colors whitespace-nowrap"
                >
                  <i className="ri-delete-bin-line mr-1"></i>
                  {removing ? '삭제 중...' : '삭제'}
                </button>
              </div>
            )}
          </div>
        ) : canManage ? (
          <div className="w-full h-[60px] bg-background-100 border-b border-background-200 flex items-center justify-center">
            <label className={`flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 text-primary-700 text-sm font-medium cursor-pointer hover:bg-primary-200 transition-colors whitespace-nowrap ${uploading ? 'opacity-50' : ''}`}>
              <i className="ri-image-add-line"></i>
              {uploading ? '업로드 중...' : '배너 이미지 추가하기'}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} disabled={uploading} className="hidden" />
            </label>
          </div>
        ) : null}

        {error && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-rose-500 text-white text-xs">
            {error}
          </div>
        )}
      </div>

      <ImageCropModal
        open={cropOpen}
        imageFile={cropFile}
        aspectRatio={2}
        outputWidth={1600}
        outputHeight={800}
        title="배너 이미지 편집 (2:1)"
        onApply={handleCroppedUpload}
        onCancel={() => { setCropOpen(false); setCropFile(null); }}
      />
    </>
  );
}
import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import ImageCropModal from '@/components/feature/ImageCropModal';

interface ClubBannerData {
  id?: string;
  club: string;
  hero_image_url: string | null;
  card_image_url: string | null;
}

interface ClubBannerManagerProps {
  club: string;
  onBannerChange?: () => void;
}

// Each slot's crop config
const SLOT_CONFIG = {
  hero: { aspectRatio: 2, outputWidth: 1600, outputHeight: 800, label: '배너 이미지', hint: '동아리 페이지 상단에 크게 보여요' },
  card: { aspectRatio: 1.6, outputWidth: 800, outputHeight: 500, label: '카드 이미지', hint: '동아리 목록에서 미리보기로 보여요' },
};

export function useClubBanner(clubId: string) {
  const [banner, setBanner] = useState<ClubBannerData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBanner = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('club_banners')
        .select('*')
        .eq('club', clubId)
        .maybeSingle();
      setBanner(data ? (data as ClubBannerData) : null);
    } catch (err) {
      console.warn('Failed to load club banner:', err);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    loadBanner();
  }, [loadBanner]);

  return { banner, loading, refresh: loadBanner };
}

export default function ClubBannerManager({ club, onBannerChange }: ClubBannerManagerProps) {
  const { user, hasRole } = useAuth();
  const canManage = user && hasRole('assistant_zone_leader');
  const { banner, loading, refresh } = useClubBanner(club);

  const [panelOpen, setPanelOpen] = useState(false);
  const [cropSlot, setCropSlot] = useState<'hero' | 'card' | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<'hero' | 'card' | null>(null);
  const [removing, setRemoving] = useState<'hero' | 'card' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const cardInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 패널 바깥을 클릭하면 닫히도록 처리
  useEffect(() => {
    if (!panelOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen]);

  if (!canManage) return null;
  if (loading) return null;

  const handleFileSelect = (type: 'hero' | 'card', file: File) => {
    setCropFile(file);
    setCropSlot(type);
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!user || !cropSlot) return;
    const type = cropSlot;
    setCropSlot(null);
    setCropFile(null);
    setUploading(type);
    setError(null);

    try {
      // Delete old file if exists
      const oldUrl = type === 'hero' ? banner?.hero_image_url : banner?.card_image_url;
      if (oldUrl) {
        try {
          const urlObj = new URL(oldUrl);
          const pathParts = urlObj.pathname.split('/');
          const bucketIndex = pathParts.findIndex(p => p === 'Public');
          if (bucketIndex !== -1) {
            const oldPath = pathParts.slice(bucketIndex + 1).join('/');
            await supabase.storage.from('Public').remove([oldPath]);
          }
        } catch { /* ignore */ }
      }

      const path = `club-banners/${club}-${type}-${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
      const newUrl = urlData.publicUrl;

      const upsertData: Record<string, unknown> = {
        club,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };
      upsertData[type === 'hero' ? 'hero_image_url' : 'card_image_url'] = newUrl;

      const { error: dbErr } = await supabase
        .from('club_banners')
        .upsert(upsertData, { onConflict: 'club' });
      if (dbErr) throw dbErr;

      refresh();
      onBannerChange?.();
    } catch (err: any) {
      setError(err?.message || '이미지 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(null);
    }
  };

  const handleRemove = async (type: 'hero' | 'card') => {
    if (!user) return;
    const url = type === 'hero' ? banner?.hero_image_url : banner?.card_image_url;
    if (!url) return;

    setRemoving(type);
    setError(null);
    try {
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        const bucketIndex = pathParts.findIndex(p => p === 'Public');
        if (bucketIndex !== -1) {
          const oldPath = pathParts.slice(bucketIndex + 1).join('/');
          await supabase.storage.from('Public').remove([oldPath]);
        }
      } catch { /* ignore */ }

      const updateData: Record<string, unknown> = {
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };
      updateData[type === 'hero' ? 'hero_image_url' : 'card_image_url'] = null;

      const { error: dbErr } = await supabase
        .from('club_banners')
        .update(updateData)
        .eq('club', club);
      if (dbErr) throw dbErr;

      refresh();
      onBannerChange?.();
    } catch (err: any) {
      setError(err?.message || '이미지 삭제 중 오류가 발생했습니다.');
    } finally {
      setRemoving(null);
    }
  };

  const activeCropConfig = cropSlot ? SLOT_CONFIG[cropSlot] : null;
  const hasAnyImage = !!banner?.hero_image_url || !!banner?.card_image_url;

  return (
    <>
      <div className="relative" ref={panelRef}>
        <button
          onClick={() => setPanelOpen(o => !o)}
          className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center backdrop-blur transition-colors cursor-pointer ${panelOpen ? 'bg-background-100 text-foreground-950' : 'bg-black/30 text-white hover:bg-black/45'}`}
          title="배너/카드 이미지 관리"
        >
          <i className="ri-image-edit-line text-base md:text-lg"></i>
        </button>

        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-72 bg-background-100 rounded-2xl shadow-xl border border-background-200 p-4 z-30 text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground-950">동아리 이미지 관리</h3>
                <button onClick={() => setPanelOpen(false)} className="w-6 h-6 rounded-full flex items-center justify-center text-foreground-400 hover:bg-background-100 hover:text-foreground-700 cursor-pointer">
                  <i className="ri-close-line text-sm"></i>
                </button>
              </div>

              <div className="space-y-3">
                <ImageSlotRow
                  config={SLOT_CONFIG.hero}
                  imageUrl={banner?.hero_image_url || null}
                  uploading={uploading === 'hero'}
                  removing={removing === 'hero'}
                  inputRef={heroInputRef}
                  onFileSelect={(f) => handleFileSelect('hero', f)}
                  onRemove={() => handleRemove('hero')}
                />
                <ImageSlotRow
                  config={SLOT_CONFIG.card}
                  imageUrl={banner?.card_image_url || null}
                  uploading={uploading === 'card'}
                  removing={removing === 'card'}
                  inputRef={cardInputRef}
                  onFileSelect={(f) => handleFileSelect('card', f)}
                  onRemove={() => handleRemove('card')}
                />
              </div>

              {error && (
                <p className="text-xs text-rose-500 mt-3 flex items-start gap-1">
                  <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>{error}
                </p>
              )}
              {!hasAnyImage && !error && (
                <p className="text-xs text-foreground-400 mt-3">이미지를 올리지 않으면 기본 색상 배경이 보여요</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {activeCropConfig && cropFile && (
        <ImageCropModal
          open={!!cropSlot}
          imageFile={cropFile}
          aspectRatio={activeCropConfig.aspectRatio}
          outputWidth={activeCropConfig.outputWidth}
          outputHeight={activeCropConfig.outputHeight}
          title={`${activeCropConfig.label} 편집`}
          onApply={handleCroppedUpload}
          onCancel={() => { setCropSlot(null); setCropFile(null); }}
        />
      )}
    </>
  );
}

function ImageSlotRow({
  config,
  imageUrl,
  uploading,
  removing,
  inputRef,
  onFileSelect,
  onRemove,
}: {
  config: { label: string; hint: string };
  imageUrl: string | null;
  uploading: boolean;
  removing: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (f: File) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl border border-background-200 bg-background-50">
      <div className="w-14 h-11 rounded-lg overflow-hidden bg-background-200 flex-shrink-0 flex items-center justify-center">
        {imageUrl ? (
          <img src={imageUrl} alt={config.label} className="w-full h-full object-cover" />
        ) : (
          <i className="ri-image-line text-foreground-300 text-lg"></i>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground-900">{config.label}</p>
        <p className="text-[11px] text-foreground-400 leading-tight">{config.hint}</p>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <label className="px-2.5 py-1.5 rounded-full bg-background-100 border border-background-200 text-[11px] font-medium text-foreground-600 cursor-pointer hover:bg-background-100 transition-colors whitespace-nowrap">
          {uploading ? '업로드 중' : imageUrl ? '변경' : '업로드'}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); if (e.target) e.target.value = ''; }}
            disabled={uploading}
            className="hidden"
          />
        </label>
        {imageUrl && (
          <button
            onClick={onRemove}
            disabled={removing}
            className="w-7 h-7 rounded-full flex items-center justify-center text-rose-500 hover:bg-rose-50 cursor-pointer flex-shrink-0"
            title="삭제"
          >
            {removing ? <i className="ri-loader-4-line animate-spin text-sm"></i> : <i className="ri-delete-bin-line text-sm"></i>}
          </button>
        )}
      </div>
    </div>
  );
}
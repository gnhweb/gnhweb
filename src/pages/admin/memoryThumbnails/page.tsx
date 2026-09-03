import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { resizeImageFile } from '@/lib/imageResize';

interface PhotoRow {
  id: string;
  author_id: string;
  photo_url: string;
}

interface FailedItem {
  id: string;
  reason: string;
}

/**
 * 추억창(memoryBoard)에 이미 올라와 있는 사진들 중 썸네일(thumb_url)이 없는 것들을
 * 일괄로 리사이즈해서 채워 넣는 관리자 전용 마이그레이션 도구.
 *
 * 원본 이미지를 fetch → canvas로 축소/압축 → Storage에 썸네일로 업로드 → DB의
 * thumb_url 갱신, 순서로 하나씩 처리한다. 실패한 항목은 건너뛰고 목록에 표시하며,
 * 서버(무료 플랜)에 부담을 주지 않도록 항목 사이에 짧은 대기시간을 둔다.
 */
export default function MemoryThumbnailsMigrationPage() {
  const { profile } = useAuth();
  const canAccess = profile && ['chief', 'teacher', 'president'].includes(profile.role);

  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<PhotoRow[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [error, setError] = useState('');
  const cancelRef = useRef(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { count: total } = await supabase
        .from('memory_photos')
        .select('id', { count: 'exact', head: true });
      setTotalPhotos(total || 0);

      const { data, error: fetchErr } = await supabase
        .from('memory_photos')
        .select('id, author_id, photo_url')
        .is('thumb_url', null)
        .order('created_at', { ascending: true });
      if (fetchErr) throw fetchErr;
      setPending(data || []);
    } catch {
      setError('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const processOne = async (row: PhotoRow): Promise<{ ok: true } | { ok: false; reason: string }> => {
    try {
      const res = await fetch(row.photo_url);
      if (!res.ok) return { ok: false, reason: `원본 다운로드 실패 (${res.status})` };
      const originalBlob = await res.blob();

      const thumbBlob = await resizeImageFile(originalBlob, { maxDimension: 480, quality: 0.72 });
      const thumbPath = `memories/${row.author_id}/thumb_${row.id}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('Public')
        .upload(thumbPath, thumbBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) return { ok: false, reason: `업로드 실패: ${uploadErr.message}` };

      const { data: urlData } = supabase.storage.from('Public').getPublicUrl(thumbPath);

      const { error: updateErr } = await supabase
        .from('memory_photos')
        .update({ thumb_url: urlData.publicUrl })
        .eq('id', row.id);
      if (updateErr) return { ok: false, reason: `DB 갱신 실패: ${updateErr.message}` };

      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : '알 수 없는 오류' };
    }
  };

  const startMigration = async () => {
    if (running || pending.length === 0) return;
    setRunning(true);
    setDone(0);
    setFailed([]);
    cancelRef.current = false;

    for (const row of pending) {
      if (cancelRef.current) break;
      const result = await processOne(row);
      if (!result.ok) {
        setFailed(prev => [...prev, { id: row.id, reason: result.reason }]);
      }
      setDone(prev => prev + 1);
      // 무료 플랜 API에 부담을 주지 않도록 항목 사이 약간의 대기
      await new Promise(r => setTimeout(r, 150));
    }

    setRunning(false);
  };

  const stopMigration = () => { cancelRef.current = true; };

  if (!canAccess) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-shield-flash-line text-2xl text-accent-600"></i>
        </div>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">접근 권한이 없습니다</h1>
        <p className="text-foreground-600 text-sm">이 페이지는 부장, 교사, 회장만 접근할 수 있습니다</p>
      </div>
    );
  }

  const progressPct = pending.length ? Math.round((done / pending.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">추억창 썸네일 일괄 생성</h1>
          <p className="text-sm text-foreground-500">
            원본 이미지를 그대로 그리드에 서빙하던 기존 사진들에 작은 썸네일을 만들어 붙입니다.
            원본 파일은 건드리지 않고, 그리드/필름스트립에서 쓸 축소본만 새로 추가합니다.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700">
            <i className="ri-error-warning-line mr-2"></i>{error}
          </div>
        )}

        {loading ? (
          <div className="bg-background-100 border border-background-200 rounded-[20px] p-16 text-center">
            <div className="w-12 h-12 rounded-full border-3 border-primary-200 border-t-primary-500 animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-foreground-600">목록을 불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                <p className="text-xs text-foreground-500 mb-1">전체 사진</p>
                <p className="text-2xl font-bold text-foreground-950">{totalPhotos}개</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-5">
                <p className="text-xs text-amber-600 mb-1">썸네일 없음</p>
                <p className="text-2xl font-bold text-amber-700">{pending.length}개</p>
              </div>
            </div>

            {pending.length === 0 ? (
              <div className="text-center py-12">
                <i className="ri-checkbox-circle-line text-3xl text-green-500 mb-2 block"></i>
                <p className="text-sm text-foreground-600">모든 사진에 썸네일이 있습니다.</p>
                <button onClick={loadPending} className="mt-3 text-xs text-primary-600 underline cursor-pointer">다시 확인</button>
              </div>
            ) : (
              <>
                {(running || done > 0) && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between text-xs text-foreground-600 mb-1.5">
                      <span>{done} / {pending.length} 처리됨</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-background-200 overflow-hidden">
                      <div className="h-full bg-primary-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
                    </div>
                    {failed.length > 0 && (
                      <p className="text-xs text-accent-600 mt-1.5">실패 {failed.length}건</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mb-6">
                  {!running ? (
                    <button
                      onClick={startMigration}
                      className="flex-1 py-3 rounded-full bg-primary-500 text-background-50 text-sm font-bold hover:bg-primary-600 transition-colors cursor-pointer"
                    >
                      <i className="ri-play-line mr-1"></i>
                      {done > 0 ? '이어서 실행' : `일괄 썸네일 생성 시작 (${pending.length}개)`}
                    </button>
                  ) : (
                    <button
                      onClick={stopMigration}
                      className="flex-1 py-3 rounded-full bg-accent-500 text-white text-sm font-bold hover:bg-accent-600 transition-colors cursor-pointer"
                    >
                      <i className="ri-stop-line mr-1"></i> 중단
                    </button>
                  )}
                </div>

                {!running && done > 0 && done >= pending.length && (
                  <button onClick={loadPending} className="w-full py-2.5 rounded-full border border-background-200 text-sm text-foreground-600 mb-6 cursor-pointer">
                    <i className="ri-refresh-line mr-1"></i> 목록 새로고침
                  </button>
                )}

                {failed.length > 0 && (
                  <div className="bg-background-100 border border-background-200 rounded-[20px] p-4">
                    <p className="text-sm font-semibold text-foreground-800 mb-2">실패한 항목</p>
                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                      {failed.map(f => (
                        <div key={f.id} className="text-xs text-foreground-600 flex items-start gap-2">
                          <i className="ri-close-circle-line text-accent-500 mt-0.5"></i>
                          <span className="break-all">{f.id}: {f.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

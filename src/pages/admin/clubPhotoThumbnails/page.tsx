import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { resizeImageFile, thumbFileNameFor } from '@/lib/imageResize';
import { clubs } from '@/mocks/clubs';

interface ClubPhoto {
  url: string;
  thumbUrl?: string | null;
}

interface ClubRow {
  club: string;
  content: Record<string, unknown>;
  photos: ClubPhoto[];
}

interface PendingItem {
  club: string;
  index: number;
  url: string;
}

interface FailedItem {
  key: string;
  reason: string;
}

function normalizePhotos(raw: unknown): ClubPhoto[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item): ClubPhoto | null => {
    if (typeof item === 'string') return { url: item, thumbUrl: null };
    if (item && typeof item === 'object' && typeof (item as { url?: unknown }).url === 'string') {
      const obj = item as { url: string; thumbUrl?: unknown };
      return { url: obj.url, thumbUrl: typeof obj.thumbUrl === 'string' ? obj.thumbUrl : null };
    }
    return null;
  }).filter((p): p is ClubPhoto => p !== null);
}

/**
 * 동아리 상세 페이지 사진첩(club-photos/)에 이미 올라와 있는 사진들 중
 * 썸네일(thumbUrl)이 없는 것들을 일괄로 리사이즈해서 채워 넣는 관리자 전용 마이그레이션 도구.
 *
 * 추억창의 memoryThumbnails 도구와 동일한 방식(원본 fetch → canvas 축소/압축 →
 * Storage에 썸네일 업로드)이지만, 사진 목록이 club_posts.content.photos라는
 * JSON 배열 하나에 통째로 들어 있어서 항목 단위가 아니라 동아리(club) 단위로 저장한다.
 * 즉 한 동아리의 사진을 모두 처리한 뒤 그 동아리의 content를 한 번에 갱신한다.
 */
export default function ClubPhotoThumbnailsMigrationPage() {
  const { profile } = useAuth();
  const canAccess = profile && ['chief', 'teacher', 'president'].includes(profile.role);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ClubRow[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<FailedItem[]>([]);
  const [error, setError] = useState('');
  const cancelRef = useRef(false);
  const rowsRef = useRef<ClubRow[]>([]);

  const clubName = (id: string) => clubs.find(c => c.id === id)?.name || id;

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchErr } = await supabase
        .from('club_posts')
        .select('club, content')
        .eq('type', 'detail');
      if (fetchErr) throw fetchErr;

      const parsedRows: ClubRow[] = (data || []).map((row: { club: string; content: unknown }) => {
        let rawContent = row.content;
        if (typeof rawContent === 'string') {
          try { rawContent = JSON.parse(rawContent); } catch { rawContent = {}; }
        }
        const content = (rawContent as Record<string, unknown>) || {};
        return { club: row.club, content, photos: normalizePhotos(content.photos) };
      });

      rowsRef.current = parsedRows;
      setRows(parsedRows);
      setTotalPhotos(parsedRows.reduce((sum, r) => sum + r.photos.length, 0));

      const pendingItems: PendingItem[] = [];
      parsedRows.forEach(row => {
        row.photos.forEach((photo, index) => {
          if (!photo.thumbUrl) pendingItems.push({ club: row.club, index, url: photo.url });
        });
      });
      setPending(pendingItems);
    } catch {
      setError('목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const processOne = async (item: PendingItem): Promise<{ ok: true } | { ok: false; reason: string }> => {
    try {
      const res = await fetch(item.url);
      if (!res.ok) return { ok: false, reason: `원본 다운로드 실패 (${res.status})` };
      const originalBlob = await res.blob();

      const thumbBlob = await resizeImageFile(originalBlob, { maxDimension: 480, quality: 0.72 });
      const safeName = item.url.split('/').pop() || `${item.club}-${item.index}.jpg`;
      const thumbPath = `club-photos/${thumbFileNameFor(safeName)}`;

      const { error: uploadErr } = await supabase.storage
        .from('Public')
        .upload(thumbPath, thumbBlob, { upsert: true, contentType: 'image/jpeg' });
      if (uploadErr) return { ok: false, reason: `업로드 실패: ${uploadErr.message}` };

      const { data: urlData } = supabase.storage.from('Public').getPublicUrl(thumbPath);

      // 메모리 상의 해당 동아리 사진 배열에 썸네일 URL을 채워 넣는다.
      const row = rowsRef.current.find(r => r.club === item.club);
      if (!row) return { ok: false, reason: '동아리 데이터를 찾을 수 없습니다.' };
      const photo = row.photos[item.index];
      if (!photo || photo.url !== item.url) return { ok: false, reason: '사진 목록이 변경되었습니다.' };
      photo.thumbUrl = urlData.publicUrl;

      // 이 동아리의 content를 통째로 갱신 (다른 필드는 그대로 두고 photos만 교체)
      const updatedContent = { ...row.content, photos: row.photos };
      const { error: updateErr } = await supabase
        .from('club_posts')
        .update({ content: updatedContent })
        .eq('club', item.club)
        .eq('type', 'detail');
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

    for (const item of pending) {
      if (cancelRef.current) break;
      const result = await processOne(item);
      if (!result.ok) {
        const reason = (result as { ok: false; reason: string }).reason;
        setFailed(prev => [...prev, { key: `${item.club}-${item.index}`, reason }]);
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
          <h1 className="text-2xl font-bold text-foreground-950 mb-1">동아리 사진첩 썸네일 일괄 생성</h1>
          <p className="text-sm text-foreground-500">
            원본 이미지를 그대로 그리드에 서빙하던 동아리 사진첩(club-photos)에 작은 썸네일을 만들어 붙입니다.
            원본 파일은 건드리지 않고, 그리드/필름스트립에서 쓸 축소본만 새로 추가합니다. ({rows.length}개 동아리, {totalPhotos}장)
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
                        <div key={f.key} className="text-xs text-foreground-600 flex items-start gap-2">
                          <i className="ri-close-circle-line text-accent-500 mt-0.5"></i>
                          <span className="break-all">{f.key}: {f.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 text-xs text-foreground-500">
                  {Array.from(new Set(pending.map(p => p.club))).map(c => (
                    <span key={c} className="inline-block mr-3 mb-1">{clubName(c)}: {pending.filter(p => p.club === c).length}장 대기</span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}

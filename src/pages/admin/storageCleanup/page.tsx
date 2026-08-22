import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface StorageFile {
  name: string;
  id: string | null;
  metadata: { size: number; mimetype?: string; lastModified?: string };
  created_at?: string;
  url?: string;
}

export default function StorageCleanupPage() {
  const { profile } = useAuth();
  const [allFiles, setAllFiles] = useState<StorageFile[]>([]);
  const [orphanFiles, setOrphanFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const scanStorage = useCallback(async () => {
    setScanning(true);
    setError('');
    setAllFiles([]);
    setOrphanFiles([]);
    setSelectedFiles(new Set());

    try {
      // 1. List all files in public bucket
      const { data: fileList, error: listError } = await supabase
        .storage
        .from('public')
        .list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });

      if (listError) throw listError;

      // Recursively get all files
      const allStorageFiles: StorageFile[] = [];

      const processFiles = async (files: any[], prefix: string = '') => {
        for (const file of files) {
          if (file.id === null || file.metadata) {
            allStorageFiles.push({
              name: prefix + file.name,
              id: file.id,
              metadata: file.metadata || { size: 0 },
              created_at: file.created_at,
            });
          } else {
            // It's a folder - recursively list
            const { data: subFiles } = await supabase
              .storage
              .from('public')
              .list(prefix + file.name, { limit: 1000 });
            if (subFiles && subFiles.length > 0) {
              await processFiles(subFiles, prefix + file.name + '/');
            }
          }
        }
      };

      await processFiles(fileList || []);

      // 2. Get all referenced URLs from DB
      const referencedUrls = new Set<string>();

      // club_banners
      const { data: banners } = await supabase.from('club_banners').select('hero_image_url, card_image_url');
      banners?.forEach((b: any) => {
        if (b.hero_image_url) referencedUrls.add(b.hero_image_url);
        if (b.card_image_url) referencedUrls.add(b.card_image_url);
      });

      // site_banners
      const { data: siteBanners } = await supabase.from('site_banners').select('image_url');
      siteBanners?.forEach((b: any) => { if (b.image_url) referencedUrls.add(b.image_url); });

      // user_roles (profile_image)
      const { data: users } = await supabase.from('user_roles').select('profile_image');
      users?.forEach((u: any) => { if (u.profile_image) referencedUrls.add(u.profile_image); });

      // ganghak_news (image_url)
      const { data: news } = await supabase.from('ganghak_news').select('image_url');
      news?.forEach((n: any) => { if (n.image_url) referencedUrls.add(n.image_url); });

      // club_posts (content JSON may contain photos array, or images column)
      const { data: posts } = await supabase.from('club_posts').select('content, images');
      posts?.forEach((p: any) => {
        // Check images column (new format)
        if (p.images && Array.isArray(p.images)) {
          p.images.forEach((url: string) => { if (url) referencedUrls.add(url); });
        }
        // Check content JSON for photos array (old format)
        if (p.content) {
          try {
            const content = typeof p.content === 'string' ? JSON.parse(p.content) : p.content;
            if (content.photos && Array.isArray(content.photos)) {
              content.photos.forEach((url: string) => { if (url) referencedUrls.add(url); });
            }
          } catch { /* ignore parse errors */ }
        }
      });

      // 3. Identify orphan files
      const orphans = allStorageFiles.filter(file => {
        const { data } = supabase.storage.from('public').getPublicUrl(file.name);
        return !referencedUrls.has(data.publicUrl);
      });

      // Add URLs to files
      const withUrls = orphans.map(f => {
        const { data } = supabase.storage.from('public').getPublicUrl(f.name);
        return { ...f, url: data.publicUrl };
      });

      setAllFiles(allStorageFiles);
      setOrphanFiles(withUrls);
    } catch (err) {
      console.error('Storage scan failed:', err);
      setError('저장소 스캔 중 오류가 발생했습니다.');
    } finally {
      setScanning(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scanStorage();
  }, [scanStorage]);

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    const toDelete = Array.from(selectedFiles);
    setDeleting(toDelete);

    try {
      const { error: delError } = await supabase
        .storage
        .from('public')
        .remove(toDelete);

      if (delError) throw delError;

      setOrphanFiles(prev => prev.filter(f => !selectedFiles.has(f.name)));
      setSelectedFiles(new Set());
      showToast(`${toDelete.length}개 파일을 삭제했습니다`, 'success');
    } catch {
      showToast('파일 삭제 중 오류가 발생했습니다', 'error');
    } finally {
      setDeleting([]);
    }
  };

  const handleDeleteSingle = async (fileName: string) => {
    setDeleting([fileName]);
    try {
      const { error: delError } = await supabase.storage.from('public').remove([fileName]);
      if (delError) throw delError;
      setOrphanFiles(prev => prev.filter(f => f.name !== fileName));
      setSelectedFiles(prev => { const next = new Set(prev); next.delete(fileName); return next; });
      showToast('파일을 삭제했습니다', 'success');
    } catch {
      showToast('파일 삭제 중 오류가 발생했습니다', 'error');
    } finally {
      setDeleting([]);
    }
  };

  const toggleSelect = (fileName: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName); else next.add(fileName);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === orphanFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(orphanFiles.map(f => f.name)));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const totalOrphanSize = orphanFiles.reduce((sum, f) => sum + (f.metadata?.size || 0), 0);

  if (!profile || (profile.role !== 'chief' && profile.role !== 'teacher')) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-shield-flash-line text-2xl text-accent-600"></i>
        </div>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">접근 권한이 없습니다</h1>
        <p className="text-foreground-600 text-sm">이 페이지는 부장과 교사만 접근할 수 있습니다</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">저장소 정리</h1>
            <p className="text-sm text-foreground-500">
              DB에 연결되지 않은 미사용 파일을 찾아 정리합니다
            </p>
          </div>
          <button
            onClick={scanStorage}
            disabled={scanning}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-bold hover:bg-primary-600 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className={`text-lg ${scanning ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'}`}></i>
            {scanning ? '스캔 중...' : '다시 스캔'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700">
            <i className="ri-error-warning-line mr-2"></i>{error}
          </div>
        )}

        {loading || scanning ? (
          <div className="bg-background-100 border border-background-200 rounded-[20px] p-16 text-center">
            <div className="w-12 h-12 rounded-full border-3 border-primary-200 border-t-primary-500 animate-spin mx-auto mb-4"></div>
            <p className="text-sm text-foreground-600">저장소를 스캔하는 중...</p>
            <p className="text-xs text-foreground-500 mt-1">파일 수에 따라 시간이 걸릴 수 있어요</p>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-5">
                <p className="text-xs text-foreground-500 mb-1">전체 파일</p>
                <p className="text-2xl font-bold text-foreground-950">{allFiles.length}개</p>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-5">
                <p className="text-xs text-amber-600 mb-1">미사용 파일</p>
                <p className="text-2xl font-bold text-amber-700">{orphanFiles.length}개</p>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-[20px] p-5">
                <p className="text-xs text-rose-600 mb-1">절약 가능 용량</p>
                <p className="text-2xl font-bold text-rose-700">{formatSize(totalOrphanSize)}</p>
              </div>
            </div>

            {/* Orphan Files List */}
            <div className="bg-background-100 border border-background-200 rounded-[20px] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-background-200">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-foreground-700 cursor-pointer">
                    <input type="checkbox" checked={orphanFiles.length > 0 && selectedFiles.size === orphanFiles.length} onChange={selectAll} className="rounded" />
                    전체 선택
                  </label>
                  <span className="text-xs text-foreground-500">{selectedFiles.size}개 선택됨</span>
                </div>
                {selectedFiles.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting.length > 0}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500 text-white text-sm font-bold hover:bg-rose-600 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {deleting.length > 0 ? (
                      <><i className="ri-loader-4-line animate-spin"></i> 삭제 중...</>
                    ) : (
                      <><i className="ri-delete-bin-line"></i> 선택 삭제</>
                    )}
                  </button>
                )}
              </div>

              {orphanFiles.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                    <i className="ri-check-double-line text-3xl text-emerald-600"></i>
                  </div>
                  <p className="text-base font-bold text-foreground-800 mb-1">미사용 파일이 없어요!</p>
                  <p className="text-sm text-foreground-600">저장소가 깔끔하게 관리되고 있어요</p>
                </div>
              ) : (
                <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
                  {orphanFiles.map((file, idx) => (
                    <div
                      key={file.name}
                      className={`flex items-center gap-3 px-5 py-3 border-b border-background-100 hover:bg-background-50 transition-colors ${
                        selectedFiles.has(file.name) ? 'bg-rose-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.name)}
                        onChange={() => toggleSelect(file.name)}
                        className="rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground-800 truncate">{file.name}</p>
                        <p className="text-xs text-foreground-500">
                          {formatSize(file.metadata?.size || 0)}
                          {file.created_at && ` · ${formatKoreanDate(file.created_at)}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSingle(file.name)}
                        disabled={deleting.includes(file.name)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer flex-shrink-0"
                      >
                        {deleting.includes(file.name) ? (
                          <i className="ri-loader-4-line animate-spin text-sm"></i>
                        ) : (
                          <i className="ri-delete-bin-line text-sm"></i>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mt-5 bg-secondary-100 rounded-[20px] p-5 border border-secondary-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary-200 flex items-center justify-center shrink-0">
                  <i className="ri-information-line text-secondary-700"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-secondary-800 mb-1">저장소 정리 안내</p>
                  <ul className="text-xs text-secondary-700 space-y-0.5">
                    <li>&bull; 미사용 파일은 DB의 어떤 레코드에서도 참조되지 않는 파일입니다</li>
                    <li>&bull; 삭제된 파일은 복구할 수 없으니 신중하게 선택하세요</li>
                    <li>&bull; 새 파일 업로드 시 자동 정리 로직으로 orphan 파일이 최소화됩니다</li>
                    <li>&bull; 주기적으로 정리하면 저장 공간을 효율적으로 관리할 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className={`fixed bottom-6 left-1/2 z-50 px-5 py-3 rounded-full text-sm font-medium ${
              toast.type === 'success'
                ? 'bg-secondary-600 text-background-50'
                : 'bg-accent-600 text-background-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <i className={`${toast.type === 'success' ? 'ri-check-line' : 'ri-close-line'}`}></i>
              {toast.message}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
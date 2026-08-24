import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clubs, clubIcons, ClubData } from '@/mocks/clubs';
import { CLUB_LABELS } from '@/types/auth';
import type { ClubType } from '@/types/auth';
import ClubBannerManager, { useClubBanner } from '@/components/feature/ClubBannerManager';
import { notifyUser } from '@/lib/mobileFeedback';

interface ClubPost {
  id: string;
  club: string;
  author_id: string;
  author_name: string;
  content: string;
  images?: string[];
  created_at: string;
  updated_at: string;
}

// 사진 여러 장이 달린 글의 모바일 표시 — 좌우 스와이프 캐러셀 + 하단 점 인디케이터
function PostImageCarousel({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  return (
    <div className="mt-3">
      <div
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-xl"
      >
        {images.map((imgUrl, i) => (
          <div key={i} className="relative w-full flex-shrink-0 snap-start aspect-square bg-background-200">
            <img src={imgUrl} alt={`게시글 이미지 ${i + 1}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {images.map((_, i) => (
            <span
              key={i}
              className={`rounded-full transition-all ${i === active ? 'w-4 h-1.5 bg-primary-500' : 'w-1.5 h-1.5 bg-background-300'}`}
            ></span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClubCommunity() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, secondaryClubs } = useAuth();
  const clubId = id as ClubType;
  const { banner: clubBanner, refresh: refreshBanner } = useClubBanner(clubId || '');

  const club: ClubData | undefined = clubs.find(c => c.id === id);
  const [posts, setPosts] = useState<ClubPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [postImages, setPostImages] = useState<File[]>([]);
  const [postImagePreviews, setPostImagePreviews] = useState<string[]>([]);

  const revokePostImagePreviews = useCallback((urls: string[]) => {
    for (const url of urls) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  }, []);

  useEffect(() => {
    return () => {
      setPostImagePreviews((current) => {
        revokePostImagePreviews(current);
        return [];
      });
    };
  }, [revokePostImagePreviews]);

  const isPrimaryMember = profile?.club === clubId;
  const isSecondaryMember = secondaryClubs.includes(clubId);
  const isClubMember = isPrimaryMember || isSecondaryMember;
  const isChiefOrTeacher = profile?.role === 'chief' || profile?.role === 'teacher';
  const canAccess = !!user && (isClubMember || isChiefOrTeacher);
  const canPost = !!user && (isClubMember || isChiefOrTeacher);

  const fetchPosts = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('club_posts')
        .select('*')
        .eq('club', clubId)
        .eq('type', 'post')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setPosts((data as ClubPost[]) || []);
    } catch (e) {
      console.error('Failed to fetch club posts:', e);
      setError('게시글을 불러오지 못했습니다.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newPost.trim() && postImages.length === 0) || !user || !profile || !clubId) return;

    setSubmitting(true);
    setError('');

    try {
      let imageUrls: string[] = [];
      const uploadedPaths: string[] = [];

      // Upload images first
      if (postImages.length > 0) {
        setUploadingImages(true);
        for (const file of postImages) {
          const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
          const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg';
          const path = `club-posts/${clubId}-${Date.now()}-${crypto.randomUUID()}.${safeExt}`;
          const { error: uploadErr } = await supabase.storage.from('Public').upload(path, file, {
            upsert: false,
            cacheControl: '3600',
            contentType: file.type || 'application/octet-stream',
          });
          if (uploadErr) throw new Error(`사진 업로드 실패: ${uploadErr.message}`);
          uploadedPaths.push(path);
          const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
          imageUrls.push(urlData.publicUrl);
        }
        setUploadingImages(false);
      }

      const { error: insertError } = await supabase
        .from('club_posts')
        .insert({
          club: clubId,
          type: 'post',
          author_id: user.id,
          author_name: profile.name,
          content: newPost.trim(),
          images: imageUrls.length > 0 ? imageUrls : null,
        });

      if (insertError) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('Public').remove(uploadedPaths);
        }
        throw new Error(`게시글 저장 실패: ${insertError.message}`);
      }

      setNewPost('');
      setPostImages([]);
      setPostImagePreviews((current) => {
        revokePostImagePreviews(current);
        return [];
      });
      await fetchPosts();
    } catch (e) {
      console.error('Failed to submit post:', e);
      setError(e instanceof Error ? e.message : '게시글 등록 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
      setUploadingImages(false);
    }
  };

  const handleDelete = async (postId: string) => {
    setDeletingId(postId);
    try {
      const { error: deleteError } = await supabase
        .from('club_posts')
        .delete()
        .eq('id', postId);

      if (deleteError) throw deleteError;
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      console.error('Failed to delete post:', e);
      setError('게시글 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!club) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-foreground-600 mb-4">동아리를 찾을 수 없습니다</p>
          <Link to="/clubs" className="text-primary-600 hover:text-primary-700 font-medium">동아리 목록으로</Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-primary-100 border border-primary-200 mb-5">
            <i className="ri-lock-line text-3xl text-primary-600"></i>
          </div>
          <h1 className="text-xl font-bold text-foreground-950 mb-3">로그인이 필요합니다</h1>
          <p className="text-sm text-foreground-600 mb-6">
            동아리 소통 공간은 회원 전용입니다. 로그인 후 이용해주세요.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[20px] bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
          >
            <i className="ri-login-box-line"></i>
            로그인하기
          </Link>
        </motion.div>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 mb-5">
            <i className="ri-forbid-line text-3xl text-accent-600"></i>
          </div>
          <h1 className="text-xl font-bold text-foreground-950 mb-3">접근할 수 없습니다</h1>
          <p className="text-sm text-foreground-600 mb-6">
            {club.name} 소통 공간은 {club.name} 동아리원만 접근할 수 있습니다.
            {profile?.club && <><br />현재 소속: {CLUB_LABELS[profile.club as ClubType] || '미정'}</>}
          </p>
          <Link
            to={`/clubs/${clubId}`}
            className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            <i className="ri-arrow-left-line"></i>
            {club.name} 소개 페이지로
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      {/* Club Header */}
      <div className="relative aspect-[16/10] md:aspect-[21/7] overflow-hidden">
        {clubBanner?.hero_image_url ? (
          <img
            src={clubBanner.hero_image_url}
            alt={club.name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <img
            src={club.heroImage}
            alt={club.name}
            className="w-full h-full object-cover object-top"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60"></div>

        {/* 이미지 관리 버튼 — 제목과 겹치지 않도록 우상단에 따로 배치 */}
        <div className="absolute top-3 right-3 md:top-5 md:right-5 z-20">
          <ClubBannerManager club={club.id} onBannerChange={refreshBanner} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => navigate(`/clubs/${clubId}`)}
              className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-3 text-sm group cursor-pointer"
            >
              <i className="ri-arrow-left-line group-hover:-translate-x-1 transition-transform duration-200"></i>
              동아리 소개
            </button>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl ${club.iconBg} flex items-center justify-center`}>
                <i className={`${clubIcons[club.id]} text-xl md:text-2xl ${club.iconText}`}></i>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold text-white">{club.name} 소통 공간</h1>
                <p className="text-white/70 text-[11px] md:text-sm">동아리원들과 자유롭게 소통하는 공간입니다</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Post Input */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-background-100 border border-background-200 rounded-[20px] p-4 md:p-5 mb-6"
        >
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-700">
                  {profile?.name?.charAt(0) || '?'}
                </span>
              </div>
              <div className="flex-1">
                <textarea
                  value={newPost}
                  onChange={e => setNewPost(e.target.value)}
                  placeholder={`${club.name} 동아리원들과 공유할 이야기를 적어주세요...`}
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-3 rounded-[13px] border border-background-200 text-sm bg-background-50 resize-none focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                />
                {/* Image previews */}
                {postImagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {postImagePreviews.map((preview, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-background-200">
                        <img src={preview} alt={`업로드 ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          aria-label={`사진 ${i + 1} 삭제`}
                          onClick={() => {
                            setPostImages(prev => prev.filter((_, idx) => idx !== i));
                            setPostImagePreviews(prev => {
                              const removed = prev[i];
                              if (removed?.startsWith('blob:')) URL.revokeObjectURL(removed);
                              return prev.filter((_, idx) => idx !== i);
                            });
                          }}
                          className="absolute top-0 right-0 min-w-[44px] min-h-[44px] rounded-full bg-black/60 text-white flex items-center justify-center"
                        >
                          <i className="ri-close-line text-[10px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 min-h-[44px] px-3 rounded-full bg-background-200 text-xs text-foreground-600 hover:bg-background-300/60 cursor-pointer whitespace-nowrap">
                      <i className="ri-image-add-line"></i>
                      사진 {postImages.length > 0 ? `(${postImages.length}/10)` : ''}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length + postImages.length > 10) {
                            notifyUser('최대 10장까지 업로드할 수 있어요');
                            return;
                          }
                          const newPreviews = files.map(f => URL.createObjectURL(f));
                          setPostImages(prev => [...prev, ...files]);
                          setPostImagePreviews(prev => [...prev, ...newPreviews]);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <span className="text-xs text-foreground-600">{newPost.length}/500</span>
                  <button
                    type="submit"
                    disabled={(!newPost.trim() && postImages.length === 0) || submitting}
                    className="px-5 py-2 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        올리는 중
                      </span>
                    ) : (
                      '올리기'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
          {error && (
            <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-accent-100 text-accent-600 text-sm">
              <i className="ri-error-warning-line flex-shrink-0"></i>
              {error}
            </div>
          )}
        </motion.div>

        {/* Posts List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
          </div>
        ) : posts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-[20px] bg-primary-100 mb-4">
              <i className="ri-chat-3-line text-2xl text-primary-400"></i>
            </div>
            <h3 className="text-base font-medium text-foreground-700 mb-2">아직 올라온 글이 없어요</h3>
            <p className="text-sm text-foreground-600">첫 번째 글을 올려 동아리원들과 소통을 시작해보세요!</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.5) }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  className="bg-background-100 border border-background-200 rounded-[20px] p-4 md:p-5 group"
                >
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary-700">
                        {post.author_name.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground-950">{post.author_name}</span>
                        <span className="text-xs text-foreground-600">{formatTime(post.created_at)}</span>
                        {(user?.id === post.author_id || profile?.role === 'chief' || profile?.role === 'teacher' || profile?.role === 'zone_leader' || profile?.role === 'assistant_zone_leader') && (
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={deletingId === post.id}
                            className="ml-auto md:opacity-0 md:group-hover:opacity-100 transition-opacity text-gray-300 hover:text-rose-500 cursor-pointer disabled:opacity-50"
                            title="삭제"
                          >
                            {deletingId === post.id ? (
                              <span className="w-3.5 h-3.5 border-2 border-rose-300 border-t-rose-500 rounded-full animate-spin inline-block"></span>
                            ) : (
                              <i className="ri-delete-bin-line text-sm"></i>
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap break-words">
                        {post.content}
                      </p>
                      {/* Post images — 모바일: 스와이프 캐러셀, PC: 기존 그리드 유지 */}
                      {post.images && post.images.length > 0 && (
                        <>
                          <div className="md:hidden">
                            <PostImageCarousel images={post.images} />
                          </div>
                          <div className={`hidden md:grid gap-2 mt-3 ${post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                            {post.images.map((imgUrl, i) => (
                              <div key={i} className={`relative rounded-xl overflow-hidden bg-background-200 ${post.images!.length === 1 ? 'aspect-video' : 'aspect-square'}`}>
                                <img src={imgUrl} alt={`게시글 이미지 ${i + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, type ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clubs, clubIcons, type ClubData } from '@/mocks/clubs';
import ClubBannerManager, { useClubBanner } from '@/components/feature/ClubBannerManager';
import PhotoLightbox from '@/components/feature/PhotoLightbox';
import { CategoryChipRow, CategoryChip } from '@/components/base/CategoryChip';
import { resizeImageFile, thumbFileNameFor } from '@/lib/imageResize';

interface ClubMember {
  name: string;
  role: string;
  roleLabel: string;
  birthday: string;
  avatarColor: string;
  profileImage?: string;
  isBirthdayThisMonth?: boolean;
}

interface ClubPhoto {
  url: string;
  /** 그리드용 축소 썸네일. 기존에 올라온 사진은 없을 수 있어 optional — 없으면 원본(url)로 폴백 */
  thumbUrl?: string | null;
}

interface ClubDetailData {
  description: string;
  schedule: string;
  leaderQuote: string;
  leaderName: string;
  goal: string;
  monthlyVerseText: string;
  monthlyVerseReference: string;
  monthlyVerseDescription: string;
  activities: string[];
  photos: ClubPhoto[];
}

interface ClubQnA {
  id: string;
  question: string;
  questioner: string;
  authorId: string | null;
  answer?: string;
  answerer?: string;
  createdAt: string;
  isAnonymous: boolean;
}

const DEFAULT_GOAL = '예배와 경연에서 하나님의 영광을 나타내며, 단원 모두가 한마음으로 성장하는 동아리';
const DEFAULT_VERSE = '마음을 다하고 목숨을 다하고 힘을 다하여 네 하나님 여호와를 사랑하라';
const DEFAULT_REFERENCE = '신명기 6:5';
const DEFAULT_VERSE_DESC = '모든 것을 다해 하나님을 사랑하는 마음으로 이번 달도 예배와 연습에 임합시다!';

/**
 * content.photos를 ClubPhoto[]로 정규화한다.
 * 이 필드는 예전엔 원본 URL 문자열 배열이었다가 썸네일 지원을 위해 { url, thumbUrl } 객체
 * 배열로 바뀌었다 — 이미 저장된 예전 데이터(문자열)도 그대로 읽을 수 있도록 둘 다 지원한다.
 */
function normalizeClubPhotos(raw: unknown): ClubPhoto[] {
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

function InfoSection({
  icon,
  iconColor = 'text-foreground-600',
  title,
  titleClass = 'text-foreground-950',
  defaultOpen = true,
  forceOpen = false,
  saving = false,
  containerClass = 'bg-background-100 border-background-200',
  wrapperClassName = '',
  headerAction,
  children,
}: {
  icon: string;
  iconColor?: string;
  title: string;
  titleClass?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  saving?: boolean;
  containerClass?: string;
  wrapperClassName?: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <div className={`border rounded-[20px] min-w-0 ${containerClass} ${wrapperClassName}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        className="w-full flex items-center justify-between gap-2 px-5 md:px-6 py-4 md:py-5 cursor-pointer select-none"
      >
        <span className={`flex items-center gap-2 min-w-0 ${titleClass}`}>
          <i className={`${icon} ${iconColor} flex-shrink-0`}></i>
          <span className="text-sm md:text-base font-bold truncate">{title}</span>
        </span>
        <span className={`flex items-center gap-2 flex-shrink-0 ${titleClass}`} onClick={e => e.stopPropagation()}>
          {saving && <span className="text-xs opacity-70 font-normal whitespace-nowrap">저장 중...</span>}
          {headerAction}
          <i className={`ri-arrow-down-s-line text-lg transition-transform duration-200 ${open ? 'rotate-180' : ''}`}></i>
        </span>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 md:px-6 pb-5 md:pb-6 min-w-0 break-words">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ClubDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, secondaryClubs } = useAuth();
  const club: ClubData | undefined = clubs.find(c => c.id === id);
  const { banner: clubBanner, refresh: refreshBanner } = useClubBanner(id || '');

  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'photos' | 'qna'>('info');
  const [loading, setLoading] = useState(true);

  const [members, setMembers] = useState<ClubMember[]>([]);
  const [clubDetail, setClubDetail] = useState<ClubDetailData>({
    description: '',
    schedule: '',
    leaderQuote: '',
    leaderName: '',
    goal: DEFAULT_GOAL,
    monthlyVerseText: DEFAULT_VERSE,
    monthlyVerseReference: DEFAULT_REFERENCE,
    monthlyVerseDescription: DEFAULT_VERSE_DESC,
    activities: [],
    photos: [],
  });

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [editingVerse, setEditingVerse] = useState(false);
  const [verseForm, setVerseForm] = useState({ text: '', reference: '', description: '' });
  const [editingIntro, setEditingIntro] = useState(false);
  const [introInput, setIntroInput] = useState('');
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [scheduleInput, setScheduleInput] = useState('');
  const [editingQuote, setEditingQuote] = useState(false);
  const [quoteInput, setQuoteInput] = useState('');
  const [editingLeaderName, setEditingLeaderName] = useState(false);
  const [leaderNameInput, setLeaderNameInput] = useState('');

  const [editingActivities, setEditingActivities] = useState(false);
  const [activitiesInput, setActivitiesInput] = useState<string[]>([]);
  const [newActivityItem, setNewActivityItem] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [qnaItems, setQnaItems] = useState<ClubQnA[]>([]);
  const [qnaQuestion, setQnaQuestion] = useState('');
  const [qnaAnon, setQnaAnon] = useState(false);
  const [answeringQnaId, setAnsweringQnaId] = useState<string | null>(null);
  const [qnaAnswer, setQnaAnswer] = useState('');
  const [qnaSubmitting, setQnaSubmitting] = useState(false);
  const [editingQnaId, setEditingQnaId] = useState<string | null>(null);
  const [editQnaText, setEditQnaText] = useState('');
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerText, setEditAnswerText] = useState('');
  const [qnaActionLoading, setQnaActionLoading] = useState(false);

  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!club) return;
    loadAllData();
    loadQnA();
  }, [club?.id]);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: detailData, error: detailError } = await supabase
        .from('club_posts')
        .select('content')
        .eq('club', id)
        .eq('type', 'detail')
        .maybeSingle();

      if (detailError) throw detailError;

      if (detailData) {
        let rawContent = detailData.content;
        if (typeof rawContent === 'string') {
          try { rawContent = JSON.parse(rawContent); } catch { rawContent = {}; }
        }
        const content = (rawContent as Record<string, unknown>) || {};
        setClubDetail({
          description: (content.description as string) || club?.longDescription || '',
          schedule: (content.schedule as string) || club?.schedule || '',
          leaderQuote: (content.leaderQuote as string) || club?.leaderQuote || '',
          leaderName: (content.leaderName as string) || club?.leaderName || '',
          goal: (content.goal as string) || DEFAULT_GOAL,
          monthlyVerseText: (content.monthlyVerseText as string) || DEFAULT_VERSE,
          monthlyVerseReference: (content.monthlyVerseReference as string) || DEFAULT_REFERENCE,
          monthlyVerseDescription: (content.monthlyVerseDescription as string) || DEFAULT_VERSE_DESC,
          activities: Array.isArray(content.activities) ? content.activities as string[] : [],
          photos: normalizeClubPhotos(content.photos),
        });
      } else {
        setClubDetail(prev => ({
          ...prev,
          description: club?.longDescription || '',
          schedule: club?.schedule || '',
          leaderQuote: club?.leaderQuote || '',
        }));
      }

      await loadMembers();
    } catch (e) {
      console.error('Failed to load club data:', e);
      setError('동아리 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    const { data: memberData } = await supabase
      .from('user_roles')
      .select('user_id, name, role, club, birth_year, birth_month, birth_day, gender, profile_image, is_expelled')
      .eq('club', id)
      .order('role', { ascending: true });

    let allMemberRows = memberData ? [...memberData].filter((m: any) => !m.is_expelled) : [];

    if (id === 'cheonhwarae_cheongmyeong') {
      const { data: assignmentRows } = await supabase
        .from('user_club_assignments')
        .select('user_id')
        .eq('club', id);

      const existingIds = new Set(allMemberRows.map((m: any) => m.user_id));
      const secondaryIds = (assignmentRows || [])
        .map((r: any) => r.user_id as string)
        .filter(uid => !existingIds.has(uid));

      if (secondaryIds.length > 0) {
        const { data: secondaryProfiles } = await supabase
          .from('user_roles')
          .select('user_id, name, role, club, birth_year, birth_month, birth_day, gender, profile_image, is_expelled')
          .in('user_id', secondaryIds);
        if (secondaryProfiles) {
          allMemberRows = [...allMemberRows, ...secondaryProfiles.filter((m: any) => !m.is_expelled)];
        }
      }
    }

    const { data: assignedTeacherRows } = await supabase
      .from('club_teachers')
      .select('teacher_id')
      .eq('club', id);
    const assignedTeacherIds = new Set((assignedTeacherRows || []).map((r: any) => r.teacher_id as string));
    allMemberRows = allMemberRows.filter((m: any) => m.role !== 'teacher' || assignedTeacherIds.has(m.user_id));

    if (allMemberRows.length > 0) {
      const colors = ['bg-amber-200', 'bg-amber-300', 'bg-amber-100', 'bg-sky-200', 'bg-sky-300', 'bg-sky-100', 'bg-rose-200', 'bg-rose-300', 'bg-rose-100', 'bg-violet-200', 'bg-violet-300', 'bg-violet-100'];
      const mapped: ClubMember[] = allMemberRows.map((m: any, i: number) => {
        const isAssignedTeacher = m.role === 'teacher' && assignedTeacherIds.has(m.user_id);
        const roleLabel = m.role === 'zone_leader' ? '구역장'
          : m.role === 'assistant_zone_leader' ? '부구역장'
          : m.role === 'chief' ? '부장'
          : isAssignedTeacher ? '교사'
          : '단원';
        const displayRole = roleLabel;
        const thisMonth = new Date().getMonth() + 1;
        const isBirthdayThisMonth = m.birth_month === thisMonth;
        const birthdayStr = m.birth_month && m.birth_day
          ? `${m.birth_month}월 ${m.birth_day}일${isBirthdayThisMonth ? '  이번 달 생일!' : ''}`
          : m.birth_year ? `${String(m.birth_year).slice(-2)}년생` : '';
        return {
          name: m.name || '이름없음',
          role: displayRole,
          roleLabel,
          birthday: birthdayStr,
          isBirthdayThisMonth,
          avatarColor: colors[i % colors.length],
          profileImage: typeof m.profile_image === 'string' ? m.profile_image : '',
        };
      });
      setMembers(mapped);
    } else {
      setMembers([]);
    }
  };

  useEffect(() => {
    if (!id) return;

    const channel = supabase.channel(`club_roster_${id}`);

    if (id === 'cheonhwarae_cheongmyeong') {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'user_club_assignments', filter: `club=eq.${id}` }, () => {
        loadMembers();
      });
    }

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'club_teachers', filter: `club=eq.${id}` }, () => {
        loadMembers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles', filter: `club=eq.${id}` }, () => {
        loadMembers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const canEditClubDetail = profile?.role === 'chief' || profile?.role === 'teacher' ||
    ((profile?.club === id || secondaryClubs.includes(id || '')) &&
      (profile?.role === 'zone_leader' || profile?.role === 'assistant_zone_leader'));

  const isClubLeader = profile?.role === 'chief' || profile?.role === 'teacher' ||
    ((profile?.club === id || secondaryClubs.includes(id || '')) &&
      (profile?.role === 'zone_leader' || profile?.role === 'assistant_zone_leader'));

  const saveClubDetail = async (updates: Partial<ClubDetailData>): Promise<{ success: true } | { success: false; error: string }> => {
    if (!canEditClubDetail) {
      const message = '이 동아리의 정보를 수정할 권한이 없습니다.';
      setError(message);
      return { success: false, error: message };
    }

    const newDetail = { ...clubDetail, ...updates };
    setSaving(true);
    try {
      const content = {
        description: newDetail.description,
        schedule: newDetail.schedule,
        leaderQuote: newDetail.leaderQuote,
        leaderName: newDetail.leaderName,
        goal: newDetail.goal,
        monthlyVerseText: newDetail.monthlyVerseText,
        monthlyVerseReference: newDetail.monthlyVerseReference,
        monthlyVerseDescription: newDetail.monthlyVerseDescription,
        activities: newDetail.activities,
        photos: newDetail.photos,
      };

      const payload = {
        club: id,
        type: 'detail',
        author_id: user?.id || '',
        author_name: profile?.name || '',
        title: `${club?.name || id} 상세 정보`,
        content: JSON.stringify(content),
      };

      // production의 club_posts에는 (club,type)을 대상으로 하는 unique constraint가 없다.
      // 따라서 onConflict: 'club,type' upsert는 사용하지 않고 기존 detail 행을 직접 UPDATE,
      // 없을 때만 INSERT한다.
      const { data: existingDetail, error: existingError } = await supabase
        .from('club_posts')
        .select('id')
        .eq('club', id)
        .eq('type', 'detail')
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingDetail?.id) {
        const { data: updatedDetail, error: updateError } = await supabase
          .from('club_posts')
          .update(payload)
          .eq('id', existingDetail.id)
          .select('id')
          .maybeSingle();
        if (updateError) throw updateError;
        if (!updatedDetail?.id) {
          throw new Error('동아리 정보가 저장되지 않았습니다. 저장 권한을 확인해주세요.');
        }
      } else {
        const { data: insertedDetail, error: insertError } = await supabase
          .from('club_posts')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (insertError) throw insertError;
        if (!insertedDetail?.id) {
          throw new Error('동아리 정보를 저장하지 못했습니다. 저장 권한을 확인해주세요.');
        }
      }

      setClubDetail(newDetail);
      return { success: true };
    } catch (e) {
      console.error('Failed to save club detail:', e);
      const message = e instanceof Error && e.message ? e.message : '저장 중 오류가 발생했습니다.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    setError(null);

    const uploadedPaths: string[] = [];
    const removeUploadedFiles = async () => {
      if (uploadedPaths.length === 0) return;
      try {
        const { error: removeError } = await supabase.storage.from('Public').remove(uploadedPaths);
        if (removeError) console.error('Failed to rollback uploaded club photos:', removeError);
      } catch (removeError) {
        console.error('Failed to rollback uploaded club photos:', removeError);
      }
    };

    try {
      const uploadOne = async (file: File): Promise<{ photo: ClubPhoto; paths: string[] }> => {
        const safeName = `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const path = `club-photos/${safeName}`;
        const thumbPath = `club-photos/${thumbFileNameFor(safeName)}`;
        const uploadedForFile: string[] = [];

        try {
          const [displayBlob, thumbBlob] = await Promise.all([
            resizeImageFile(file, { maxDimension: 1280, quality: 0.78, mimeType: 'image/jpeg' }),
            resizeImageFile(file, { maxDimension: 480, quality: 0.68, mimeType: 'image/jpeg' }),
          ]);

          const { error: displayErr } = await supabase.storage
            .from('Public')
            .upload(path, displayBlob, {
              upsert: true,
              contentType: 'image/jpeg',
              cacheControl: '31536000',
            });
          if (displayErr) throw displayErr;
          uploadedForFile.push(path);

          const { error: thumbErr } = await supabase.storage
            .from('Public')
            .upload(thumbPath, thumbBlob, {
              upsert: true,
              contentType: 'image/jpeg',
              cacheControl: '31536000',
            });
          if (thumbErr) throw thumbErr;
          uploadedForFile.push(thumbPath);

          const url = supabase.storage.from('Public').getPublicUrl(path).data.publicUrl;
          const thumbUrl = supabase.storage.from('Public').getPublicUrl(thumbPath).data.publicUrl;
          return { photo: { url, thumbUrl }, paths: uploadedForFile };
        } catch (uploadError) {
          if (uploadedForFile.length > 0) {
            try {
              const { error: removeError } = await supabase.storage.from('Public').remove(uploadedForFile);
              if (removeError) console.error('Failed to rollback club photo upload:', removeError);
            } catch (removeError) {
              console.error('Failed to rollback club photo upload:', removeError);
            }
          }
          throw uploadError;
        }
      };

      const results = await Promise.allSettled(Array.from(files, uploadOne));
      const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (rejected) {
        for (const result of results) {
          if (result.status === 'fulfilled') uploadedPaths.push(...result.value.paths);
        }
        await removeUploadedFiles();
        throw rejected.reason;
      }

      const successfulUploads = results
        .filter((result): result is PromiseFulfilledResult<{ photo: ClubPhoto; paths: string[] }> => result.status === 'fulfilled');
      const newPhotos = successfulUploads.map(result => {
        uploadedPaths.push(...result.value.paths);
        return result.value.photo;
      });
      const updatedPhotos = [...clubDetail.photos, ...newPhotos];
      const saveResult = await saveClubDetail({ photos: updatedPhotos });

      if (!saveResult.success) {
        await removeUploadedFiles();
        return;
      }
    } catch (uploadError) {
      await removeUploadedFiles();
      console.error('Failed to upload club photos:', uploadError);
      const message = uploadError instanceof Error && uploadError.message
        ? uploadError.message
        : '사진 업로드 중 오류가 발생했습니다.';
      setError(message);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const storagePathFromUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const idx = pathParts.indexOf('public');
      if (idx === -1) return null;
      return pathParts.slice(idx + 1).join('/');
    } catch {
      return null;
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    const target = clubDetail.photos.find(p => p.url === photoUrl);
    const updatedPhotos = clubDetail.photos.filter(p => p.url !== photoUrl);
    try {
      const paths = [photoUrl, target?.thumbUrl].filter((u): u is string => !!u).map(storagePathFromUrl).filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from('Public').remove(paths);
    } catch { /* ignore */ }
    setSelectedPhotos(prev => { const next = new Set(prev); next.delete(photoUrl); return next; });
    await saveClubDetail({ photos: updatedPhotos });
  };

  const handleBatchDeletePhotos = async () => {
    if (selectedPhotos.size === 0) return;
    const targets = clubDetail.photos.filter(p => selectedPhotos.has(p.url));
    const updatedPhotos = clubDetail.photos.filter(p => !selectedPhotos.has(p.url));
    try {
      const pathsToRemove = targets
        .flatMap(p => [p.url, p.thumbUrl].filter((u): u is string => !!u))
        .map(storagePathFromUrl)
        .filter((p): p is string => !!p);
      if (pathsToRemove.length > 0) {
        await supabase.storage.from('Public').remove(pathsToRemove);
      }
    } catch { /* ignore */ }
    setSelectedPhotos(new Set());
    await saveClubDetail({ photos: updatedPhotos });
  };

  const togglePhotoSelect = (url: string) => {
    setSelectedPhotos(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const handleSubmitQuestion = async () => {
    if (!qnaQuestion.trim() || !profile || !user || qnaSubmitting) return;
    setQnaSubmitting(true);
    try {
      const { data, error: insertError } = await supabase
        .from('club_qna')
        .insert({
          club: id,
          author_id: user.id,
          question: qnaQuestion.trim(),
          is_anonymous: qnaAnon,
        })
        .select('id, question, author_id, is_anonymous, created_at')
        .single();

      if (insertError) throw insertError;

      if (data) {
        setQnaItems(prev => [{
          id: data.id,
          question: data.question,
          questioner: qnaAnon ? '익명' : profile.name,
          authorId: user.id,
          isAnonymous: qnaAnon,
          createdAt: data.created_at,
        }, ...prev]);
      }
      setQnaQuestion('');
      setQnaAnon(false);
    } catch (e) {
      console.error('Failed to submit question:', e);
      setError('질문 등록 중 오류가 발생했습니다.');
    } finally {
      setQnaSubmitting(false);
    }
  };

  const handleSubmitAnswer = async (qnaId: string) => {
    if (!qnaAnswer.trim() || !profile) return;
    try {
      const { error: updateError } = await supabase
        .from('club_qna')
        .update({
          answer: qnaAnswer.trim(),
          answerer_name: profile.name,
          answered_at: new Date().toISOString(),
        })
        .eq('id', qnaId);

      if (updateError) throw updateError;

      setQnaItems(prev => prev.map(q =>
        q.id === qnaId ? { ...q, answer: qnaAnswer.trim(), answerer: profile.name } : q
      ));
      setAnsweringQnaId(null);
      setQnaAnswer('');
    } catch (e) {
      console.error('Failed to submit answer:', e);
      setError('답변 등록 중 오류가 발생했습니다.');
    }
  };

  const canManageQnaQuestion = (item: ClubQnA) =>
    isClubLeader || (!!user && !!item.authorId && item.authorId === user.id);

  const handleStartEditQuestion = (item: ClubQnA) => {
    setEditingQnaId(item.id);
    setEditQnaText(item.question);
  };

  const handleCancelEditQuestion = () => {
    setEditingQnaId(null);
    setEditQnaText('');
  };

  const handleSaveEditQuestion = async (qnaId: string) => {
    if (!editQnaText.trim() || qnaActionLoading) return;
    setQnaActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('club_qna')
        .update({ question: editQnaText.trim() })
        .eq('id', qnaId);
      if (updateError) throw updateError;
      setQnaItems(prev => prev.map(q => q.id === qnaId ? { ...q, question: editQnaText.trim() } : q));
      handleCancelEditQuestion();
    } catch (e) {
      console.error('Failed to edit question:', e);
      setError('질문 수정 중 오류가 발생했습니다.');
    } finally {
      setQnaActionLoading(false);
    }
  };

  const handleDeleteQuestion = async (qnaId: string) => {
    if (qnaActionLoading) return;
    setQnaActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('club_qna')
        .delete()
        .eq('id', qnaId);
      if (deleteError) throw deleteError;
      setQnaItems(prev => prev.filter(q => q.id !== qnaId));
    } catch (e) {
      console.error('Failed to delete question:', e);
      setError('질문 삭제 중 오류가 발생했습니다.');
    } finally {
      setQnaActionLoading(false);
    }
  };

  const handleStartEditAnswer = (item: ClubQnA) => {
    setEditingAnswerId(item.id);
    setEditAnswerText(item.answer || '');
  };

  const handleCancelEditAnswer = () => {
    setEditingAnswerId(null);
    setEditAnswerText('');
  };

  const handleSaveEditAnswer = async (qnaId: string) => {
    if (!editAnswerText.trim() || qnaActionLoading) return;
    setQnaActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('club_qna')
        .update({ answer: editAnswerText.trim() })
        .eq('id', qnaId);
      if (updateError) throw updateError;
      setQnaItems(prev => prev.map(q => q.id === qnaId ? { ...q, answer: editAnswerText.trim() } : q));
      handleCancelEditAnswer();
    } catch (e) {
      console.error('Failed to edit answer:', e);
      setError('답변 수정 중 오류가 발생했습니다.');
    } finally {
      setQnaActionLoading(false);
    }
  };

  const handleDeleteAnswer = async (qnaId: string) => {
    if (qnaActionLoading) return;
    setQnaActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('club_qna')
        .update({ answer: null, answerer_name: null, answered_at: null })
        .eq('id', qnaId);
      if (updateError) throw updateError;
      setQnaItems(prev => prev.map(q => q.id === qnaId ? { ...q, answer: undefined, answerer: undefined } : q));
    } catch (e) {
      console.error('Failed to delete answer:', e);
      setError('답변 삭제 중 오류가 발생했습니다.');
    } finally {
      setQnaActionLoading(false);
    }
  };

  const loadQnA = async () => {
    if (!id) return;
    try {
      const { data, error: qnaError } = await supabase
        .from('club_qna')
        .select('id, question, author_id, is_anonymous, answer, answerer_name, created_at, answered_at')
        .eq('club', id)
        .order('created_at', { ascending: false });
      if (qnaError) throw qnaError;
      const mapped: ClubQnA[] = (data || []).map((item: any) => ({
        id: item.id,
        question: item.question,
        questioner: item.is_anonymous ? '익명' : '회원',
        authorId: item.author_id,
        answer: item.answer || undefined,
        answerer: item.answerer_name || undefined,
        createdAt: item.created_at,
        isAnonymous: !!item.is_anonymous,
      }));
      setQnaItems(mapped);
    } catch (e) {
      console.error('Failed to load Q&A:', e);
    }
  };

  const handleGoalSave = async () => {
    const result = await saveClubDetail({ goal: goalInput.trim() || DEFAULT_GOAL });
    if (result.success) {
      setEditingGoal(false);
    }
  };

  const handleVerseSave = async () => {
    const result = await saveClubDetail({
      monthlyVerseText: verseForm.text.trim() || DEFAULT_VERSE,
      monthlyVerseReference: verseForm.reference.trim() || DEFAULT_REFERENCE,
      monthlyVerseDescription: verseForm.description.trim() || DEFAULT_VERSE_DESC,
    });
    if (result.success) {
      setEditingVerse(false);
    }
  };

  const handleIntroSave = async () => {
    const result = await saveClubDetail({ description: introInput.trim() });
    if (result.success) setEditingIntro(false);
  };

  const handleScheduleSave = async () => {
    const result = await saveClubDetail({ schedule: scheduleInput.trim() });
    if (result.success) setEditingSchedule(false);
  };

  const handleQuoteSave = async () => {
    const result = await saveClubDetail({ leaderQuote: quoteInput.trim() });
    if (result.success) setEditingQuote(false);
  };

  const handleLeaderNameSave = async () => {
    const result = await saveClubDetail({ leaderName: leaderNameInput.trim() });
    if (result.success) setEditingLeaderName(false);
  };

  const handleActivitiesSave = async () => {
    const result = await saveClubDetail({ activities: activitiesInput.map(v => v.trim()).filter(Boolean) });
    if (result.success) setEditingActivities(false);
  };

  if (!club) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-foreground-700 mb-4">동아리를 찾을 수 없습니다.</p>
          <Link to="/clubs" className="text-primary-700 font-bold hover:underline">동아리 목록으로</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-foreground-600">
          <i className="ri-loader-4-line text-3xl animate-spin"></i>
          <p>동아리 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50 text-foreground-900">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="mb-6">
          <Link to="/clubs" className="inline-flex items-center gap-1 text-sm text-foreground-600 hover:text-foreground-900 mb-4">
            <i className="ri-arrow-left-line"></i>
            동아리 목록
          </Link>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="w-11 h-11 rounded-card bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                  <i className={`${clubIcons[club.id] || 'ri-group-line'} text-xl`}></i>
                </span>
                <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground-950 truncate">{club.name}</h1>
              </div>
              <p className="text-foreground-600 text-sm md:text-base">{club.shortDescription}</p>
            </div>
            {canEditClubDetail && (
              <div className="flex items-center gap-2 text-xs text-foreground-500">
                <i className="ri-edit-line"></i>
                동아리 정보 수정 권한이 있습니다.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-card border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800 flex items-start gap-2">
            <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
            <span className="break-words">{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-auto flex-shrink-0 p-1" aria-label="오류 닫기">
              <i className="ri-close-line"></i>
            </button>
          </div>
        )}

        <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
          {([
            ['info', '소개', 'ri-information-line'],
            ['members', '단원', 'ri-group-line'],
            ['photos', '사진', 'ri-image-line'],
            ['qna', '질문', 'ri-question-answer-line'],
          ] as const).map(([tab, label, icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-chip whitespace-nowrap text-sm font-bold border transition-colors ${
                activeTab === tab
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-background-100 text-foreground-700 border-background-200 hover:bg-background-200'
              }`}
            >
              <i className={icon}></i>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'info' && (
          <div className="space-y-5">
            <InfoSection icon="ri-book-open-line" title="동아리 소개" saving={saving}>
              {editingIntro ? (
                <div className="space-y-3">
                  <textarea value={introInput} onChange={e => setIntroInput(e.target.value)} rows={5} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingIntro(false)} className="px-3 py-2 rounded-input text-sm bg-background-200 text-foreground-700">취소</button>
                    <button type="button" onClick={handleIntroSave} disabled={saving} className="px-3 py-2 rounded-input text-sm bg-primary-600 text-white disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm md:text-base leading-7 text-foreground-700">{clubDetail.description || '소개가 등록되지 않았습니다.'}</p>
                  {canEditClubDetail && <button type="button" onClick={() => { setIntroInput(clubDetail.description); setEditingIntro(true); }} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="소개 수정"><i className="ri-edit-line"></i></button>}
                </div>
              )}
            </InfoSection>

            <InfoSection icon="ri-calendar-line" title="연습 일정" saving={saving}>
              {editingSchedule ? (
                <div className="space-y-3">
                  <textarea value={scheduleInput} onChange={e => setScheduleInput(e.target.value)} rows={4} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingSchedule(false)} className="px-3 py-2 rounded-input text-sm bg-background-200 text-foreground-700">취소</button>
                    <button type="button" onClick={handleScheduleSave} disabled={saving} className="px-3 py-2 rounded-input text-sm bg-primary-600 text-white disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm md:text-base leading-7 text-foreground-700">{clubDetail.schedule || '연습 일정이 등록되지 않았습니다.'}</p>
                  {canEditClubDetail && <button type="button" onClick={() => { setScheduleInput(clubDetail.schedule); setEditingSchedule(true); }} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="일정 수정"><i className="ri-edit-line"></i></button>}
                </div>
              )}
            </InfoSection>

            <InfoSection icon="ri-double-quotes-l" title="동아리장 한마디" saving={saving}>
              {editingQuote ? (
                <div className="space-y-3">
                  <textarea value={quoteInput} onChange={e => setQuoteInput(e.target.value)} rows={4} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingQuote(false)} className="px-3 py-2 rounded-input text-sm bg-background-200 text-foreground-700">취소</button>
                    <button type="button" onClick={handleQuoteSave} disabled={saving} className="px-3 py-2 rounded-input text-sm bg-primary-600 text-white disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="font-quote whitespace-pre-wrap text-base md:text-lg leading-8 text-foreground-800">{clubDetail.leaderQuote || '동아리장의 한마디가 아직 등록되지 않았습니다.'}</p>
                  {canEditClubDetail && <button type="button" onClick={() => { setQuoteInput(clubDetail.leaderQuote); setEditingQuote(true); }} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="한마디 수정"><i className="ri-edit-line"></i></button>}
                </div>
              )}
            </InfoSection>

            <InfoSection icon="ri-user-star-line" title="동아리장" saving={saving}>
              {editingLeaderName ? (
                <div className="space-y-3">
                  <input value={leaderNameInput} onChange={e => setLeaderNameInput(e.target.value)} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingLeaderName(false)} className="px-3 py-2 rounded-input text-sm bg-background-200 text-foreground-700">취소</button>
                    <button type="button" onClick={handleLeaderNameSave} disabled={saving} className="px-3 py-2 rounded-input text-sm bg-primary-600 text-white disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm md:text-base font-bold text-foreground-800">{clubDetail.leaderName || club.leaderName || '미정'}</span>
                  {canEditClubDetail && <button type="button" onClick={() => { setLeaderNameInput(clubDetail.leaderName); setEditingLeaderName(true); }} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="동아리장 수정"><i className="ri-edit-line"></i></button>}
                </div>
              )}
            </InfoSection>

            <InfoSection icon="ri-target-line" title="이번 달 목표" saving={saving}>
              {editingGoal ? (
                <div className="space-y-3">
                  <textarea value={goalInput} onChange={e => setGoalInput(e.target.value)} rows={4} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingGoal(false)} className="px-3 py-2 rounded-input text-sm bg-background-200 text-foreground-700">취소</button>
                    <button type="button" onClick={handleGoalSave} disabled={saving} className="px-3 py-2 rounded-input text-sm bg-primary-600 text-white disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <p className="whitespace-pre-wrap text-sm md:text-base leading-7 text-foreground-700">{clubDetail.goal}</p>
                  {canEditClubDetail && <button type="button" onClick={() => { setGoalInput(clubDetail.goal); setEditingGoal(true); }} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="목표 수정"><i className="ri-edit-line"></i></button>}
                </div>
              )}
            </InfoSection>

            <InfoSection icon="ri-book-2-line" title="이번 달 말씀" saving={saving}>
              {editingVerse ? (
                <div className="space-y-3">
                  <textarea value={verseForm.text} onChange={e => setVerseForm(prev => ({ ...prev, text: e.target.value }))} rows={4} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" placeholder="말씀" />
                  <input value={verseForm.reference} onChange={e => setVerseForm(prev => ({ ...prev, reference: e.target.value }))} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" placeholder="성경 구절" />
                  <textarea value={verseForm.description} onChange={e => setVerseForm(prev => ({ ...prev, description: e.target.value }))} rows={3} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" placeholder="설명" />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingVerse(false)} className="px-3 py-2 rounded-input text-sm bg-background-200 text-foreground-700">취소</button>
                    <button type="button" onClick={handleVerseSave} disabled={saving} className="px-3 py-2 rounded-input text-sm bg-primary-600 text-white disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-quote text-lg md:text-xl leading-8 text-foreground-900">“{clubDetail.monthlyVerseText}”</p>
                    <p className="mt-2 text-sm font-bold text-primary-700">{clubDetail.monthlyVerseReference}</p>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground-700">{clubDetail.monthlyVerseDescription}</p>
                  </div>
                  {canEditClubDetail && <button type="button" onClick={() => { setVerseForm({ text: clubDetail.monthlyVerseText, reference: clubDetail.monthlyVerseReference, description: clubDetail.monthlyVerseDescription }); setEditingVerse(true); }} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="말씀 수정"><i className="ri-edit-line"></i></button>}
                </div>
              )}
            </InfoSection>

            <InfoSection icon="ri-list-check-2" title="주요 활동" saving={saving}>
              {editingActivities ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {activitiesInput.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex gap-2">
                        <input value={item} onChange={e => setActivitiesInput(prev => prev.map((v, i) => i === index ? e.target.value : v))} className="flex-1 rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                        <button type="button" onClick={() => setActivitiesInput(prev => prev.filter((_, i) => i !== index))} className="p-2 rounded-input text-accent-700 hover:bg-accent-50" aria-label="활동 삭제"><i className="ri-delete-bin-line"></i></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={newActivityItem} onChange={e => setNewActivityItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newActivityItem.trim()) { e.preventDefault(); setActivitiesInput(prev => [...prev, newActivityItem.trim()]); setNewActivityItem(''); } }} className="flex-1 rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" placeholder="활동 추가" />
                    <button type="button" onClick={() => { if (!newActivityItem.trim()) return; setActivitiesInput(prev => [...prev, newActivityItem.trim()]); setNewActivityItem(''); }} className="px-3 py-2 rounded-input bg-background-200 text-foreground-700 text-sm font-bold">추가</button>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditingActivities(false)} className="px-3 py-2 rounded-input text-sm bg-background-200 text-foreground-700">취소</button>
                    <button type="button" onClick={handleActivitiesSave} disabled={saving} className="px-3 py-2 rounded-input text-sm bg-primary-600 text-white disabled:opacity-50">저장</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  {clubDetail.activities.length > 0 ? (
                    <ul className="space-y-2 text-sm md:text-base text-foreground-700 list-disc pl-5">
                      {clubDetail.activities.map((activity, index) => <li key={`${activity}-${index}`}>{activity}</li>)}
                    </ul>
                  ) : <p className="text-sm text-foreground-500">등록된 활동이 없습니다.</p>}
                  {canEditClubDetail && <button type="button" onClick={() => { setActivitiesInput([...clubDetail.activities]); setEditingActivities(true); }} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="활동 수정"><i className="ri-edit-line"></i></button>}
                </div>
              )}
            </InfoSection>
          </div>
        )}

        {activeTab === 'members' && (
          <InfoSection icon="ri-group-line" title={`단원 ${members.length}명`} defaultOpen>
            {members.length === 0 ? (
              <p className="text-sm text-foreground-500">등록된 단원이 없습니다.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {members.map((member, index) => (
                  <div key={`${member.name}-${index}`} className="rounded-card border border-background-200 bg-background-50 p-4 min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                      {member.profileImage ? (
                        <img src={member.profileImage} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className={`w-11 h-11 rounded-full ${member.avatarColor} flex items-center justify-center text-foreground-800 font-bold flex-shrink-0`}>{member.name.slice(0, 1)}</div>
                      )}
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground-900 truncate">{member.name}</p>
                        <p className="text-xs text-foreground-500 mt-1">{member.role}</p>
                      </div>
                    </div>
                    {member.birthday && <p className="mt-3 text-xs text-foreground-600">{member.birthday}</p>}
                  </div>
                ))}
              </div>
            )}
          </InfoSection>
        )}

        {activeTab === 'photos' && (
          <InfoSection
            icon="ri-image-line"
            title={`사진 ${clubDetail.photos.length}장`}
            headerAction={canEditClubDetail ? (
              <label className={`inline-flex items-center gap-1 px-3 py-2 rounded-chip text-xs font-bold cursor-pointer ${uploading ? 'bg-background-200 text-foreground-400 pointer-events-none' : 'bg-primary-600 text-white'}`}>
                <i className={uploading ? 'ri-loader-4-line animate-spin' : 'ri-upload-2-line'}></i>
                {uploading ? '업로드 중' : '사진 추가'}
                <input type="file" accept="image/*" multiple className="hidden" disabled={uploading} onChange={handlePhotoUpload} />
              </label>
            ) : undefined}
          >
            {clubDetail.photos.length === 0 ? (
              <div className="py-12 text-center text-foreground-500">
                <i className="ri-image-line text-4xl opacity-40"></i>
                <p className="mt-3 text-sm">등록된 사진이 없습니다.</p>
                {canEditClubDetail && <p className="mt-1 text-xs text-foreground-400">사진 추가 버튼으로 사진을 올려주세요.</p>}
              </div>
            ) : (
              <div className="space-y-4">
                {canEditClubDetail && selectedPhotos.size > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-input bg-background-100 px-3 py-2">
                    <span className="text-sm font-bold text-foreground-700">{selectedPhotos.size}장 선택</span>
                    <button type="button" onClick={handleBatchDeletePhotos} className="px-3 py-2 rounded-chip bg-accent-600 text-white text-xs font-bold">선택 삭제</button>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                  {clubDetail.photos.map((photo, index) => {
                    const src = photo.thumbUrl || photo.url;
                    const selected = selectedPhotos.has(photo.url);
                    return (
                      <div key={photo.url} className="relative aspect-square rounded-input overflow-hidden bg-background-200 group">
                        <button type="button" onClick={() => setLightboxIndex(index)} className="absolute inset-0 z-0" aria-label={`사진 ${index + 1} 보기`}>
                          <img src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
                        </button>
                        {canEditClubDetail && (
                          <>
                            <button type="button" onClick={() => togglePhotoSelect(photo.url)} className={`absolute top-2 left-2 z-10 w-8 h-8 rounded-full flex items-center justify-center ${selected ? 'bg-primary-600 text-white' : 'bg-background-50/90 text-foreground-700'}`} aria-label={selected ? '선택 해제' : '사진 선택'}>
                              <i className={selected ? 'ri-check-line' : 'ri-checkbox-blank-circle-line'}></i>
                            </button>
                            <button type="button" onClick={() => handleDeletePhoto(photo.url)} className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-background-50/90 text-accent-700 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100" aria-label="사진 삭제">
                              <i className="ri-delete-bin-line"></i>
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </InfoSection>
        )}

        {activeTab === 'qna' && (
          <InfoSection icon="ri-question-answer-line" title="질문과 답변">
            <div className="space-y-5">
              {user && (
                <div className="rounded-card border border-background-200 bg-background-50 p-4">
                  <textarea value={qnaQuestion} onChange={e => setQnaQuestion(e.target.value)} rows={4} placeholder="동아리에 궁금한 점을 남겨주세요." className="w-full resize-none rounded-input border border-background-300 bg-background-100 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-foreground-700">
                      <input type="checkbox" checked={qnaAnon} onChange={e => setQnaAnon(e.target.checked)} />
                      익명으로 질문하기
                    </label>
                    <button type="button" onClick={handleSubmitQuestion} disabled={!qnaQuestion.trim() || qnaSubmitting} className="px-4 py-2.5 rounded-chip bg-primary-600 text-white text-sm font-bold disabled:opacity-50">
                      {qnaSubmitting ? '등록 중...' : '질문 등록'}
                    </button>
                  </div>
                </div>
              )}

              {qnaItems.length === 0 ? (
                <div className="py-12 text-center text-foreground-500">
                  <i className="ri-question-answer-line text-4xl opacity-40"></i>
                  <p className="mt-3 text-sm">아직 질문이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {qnaItems.map(item => (
                    <div key={item.id} className="rounded-card border border-background-200 bg-background-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground-500">{item.questioner} · {new Date(item.createdAt).toLocaleDateString('ko-KR')}</p>
                          {editingQnaId === item.id ? (
                            <div className="mt-2 space-y-2">
                              <textarea value={editQnaText} onChange={e => setEditQnaText(e.target.value)} rows={3} className="w-full rounded-input border border-background-300 bg-background-100 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                              <div className="flex gap-2 justify-end">
                                <button type="button" onClick={handleCancelEditQuestion} className="px-3 py-2 rounded-input text-xs bg-background-200 text-foreground-700">취소</button>
                                <button type="button" onClick={() => handleSaveEditQuestion(item.id)} disabled={qnaActionLoading || !editQnaText.trim()} className="px-3 py-2 rounded-input text-xs bg-primary-600 text-white disabled:opacity-50">저장</button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 whitespace-pre-wrap text-sm md:text-base leading-7 text-foreground-800">{item.question}</p>
                          )}
                        </div>
                        {canManageQnaQuestion(item) && editingQnaId !== item.id && (
                          <div className="flex gap-1 flex-shrink-0">
                            <button type="button" onClick={() => handleStartEditQuestion(item)} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="질문 수정"><i className="ri-edit-line"></i></button>
                            <button type="button" onClick={() => handleDeleteQuestion(item.id)} className="p-2 rounded-input text-accent-700 hover:bg-accent-50" aria-label="질문 삭제"><i className="ri-delete-bin-line"></i></button>
                          </div>
                        )}
                      </div>

                      {item.answer ? (
                        <div className="mt-4 rounded-input bg-background-100 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-primary-700">답변 · {item.answerer || '운영진'}</p>
                              {editingAnswerId === item.id ? (
                                <div className="mt-2 space-y-2">
                                  <textarea value={editAnswerText} onChange={e => setEditAnswerText(e.target.value)} rows={3} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" />
                                  <div className="flex gap-2 justify-end">
                                    <button type="button" onClick={handleCancelEditAnswer} className="px-3 py-2 rounded-input text-xs bg-background-200 text-foreground-700">취소</button>
                                    <button type="button" onClick={() => handleSaveEditAnswer(item.id)} disabled={qnaActionLoading || !editAnswerText.trim()} className="px-3 py-2 rounded-input text-xs bg-primary-600 text-white disabled:opacity-50">저장</button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground-700">{item.answer}</p>
                              )}
                            </div>
                            {isClubLeader && editingAnswerId !== item.id && (
                              <div className="flex gap-1 flex-shrink-0">
                                <button type="button" onClick={() => handleStartEditAnswer(item)} className="p-2 rounded-input text-foreground-500 hover:bg-background-200" aria-label="답변 수정"><i className="ri-edit-line"></i></button>
                                <button type="button" onClick={() => handleDeleteAnswer(item.id)} className="p-2 rounded-input text-accent-700 hover:bg-accent-50" aria-label="답변 삭제"><i className="ri-delete-bin-line"></i></button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : isClubLeader && (
                        answeringQnaId === item.id ? (
                          <div className="mt-4 space-y-2">
                            <textarea value={qnaAnswer} onChange={e => setQnaAnswer(e.target.value)} rows={3} className="w-full rounded-input border border-background-300 bg-background-50 p-3 text-sm text-foreground-900 outline-none focus:border-primary-500" placeholder="답변을 입력하세요." />
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => { setAnsweringQnaId(null); setQnaAnswer(''); }} className="px-3 py-2 rounded-input text-xs bg-background-200 text-foreground-700">취소</button>
                              <button type="button" onClick={() => handleSubmitAnswer(item.id)} disabled={!qnaAnswer.trim()} className="px-3 py-2 rounded-input text-xs bg-primary-600 text-white disabled:opacity-50">답변 저장</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setAnsweringQnaId(item.id)} className="mt-4 inline-flex items-center gap-1 px-3 py-2 rounded-chip bg-background-200 text-foreground-700 text-xs font-bold">
                            <i className="ri-reply-line"></i>
                            답변하기
                          </button>
                        )
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </InfoSection>
        )}
      </div>

      <ClubBannerManager clubId={id || ''} banner={clubBanner} canEdit={canEditClubDetail} onSaved={refreshBanner} />

      <AnimatePresence>
        {lightboxIndex !== null && clubDetail.photos[lightboxIndex] && (
          <PhotoLightbox
            photos={clubDetail.photos}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>

      <button type="button" onClick={() => navigate('/clubs')} className="fixed bottom-5 right-5 w-12 h-12 rounded-full bg-primary-600 text-white shadow-card-lg flex items-center justify-center md:hidden" aria-label="동아리 목록으로">
        <i className="ri-arrow-left-line text-xl"></i>
      </button>
    </div>
  );
}

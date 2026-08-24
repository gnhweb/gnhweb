import { useState, useEffect, type ReactNode } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { clubs, clubIcons, type ClubData } from '@/mocks/clubs';
import ClubBannerManager, { useClubBanner } from '@/components/feature/ClubBannerManager';
import PhotoLightbox from '@/components/feature/PhotoLightbox';
import { CategoryChipRow, CategoryChip } from '@/components/base/CategoryChip';

interface ClubMember {
  name: string;
  role: string;
  roleLabel: string;
  birthday: string;
  avatarColor: string;
  profileImage?: string;
  isBirthdayThisMonth?: boolean;
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
  photos: string[];
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

// 소개 탭의 각 항목을 인스타그램 프로필처럼 "한눈에" 볼 수 있는 카드로 보여준다.
// 예전에는 항목마다 접혀 있어 하나씩 펼쳐봐야 했지만, 지금은 기본적으로 모두 펼쳐진 채
// 2열 그리드(모바일은 1열)로 배치해 스크롤 한 번으로 전체 내용이 훑어지도록 한다.
// 카드 헤더를 눌러 접었다 펼 수 있는 기능 자체는 남겨둔다(원하면 정리해서 볼 수 있게).
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

  // 수정 버튼을 눌러 편집 모드로 들어가면(forceOpen) 접혀 있던 항목도 자동으로 펼친다.
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

  // ───── 데이터 로드 ─────
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
        .select('*')
        .eq('club', id)
        .eq('type', 'detail')
        .maybeSingle();

      if (detailError) throw detailError;

      if (detailData) {
        let rawContent = detailData.content;
        // content is stored as JSON string in a text column — parse it back
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
          photos: Array.isArray(content.photos) ? content.photos as string[] : [],
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

  // 동아리 명단 로드. 천화래와 청명(CA)은 4대 동아리와 겸직 가능한 특수 동아리라,
  // user_roles.club(주 소속)만 봐서는 부 소속(user_club_assignments)으로 CA에
  // 등록된 사람들이 명단에 안 보이는 문제가 있었다 — 두 출처를 합쳐서 보여준다.
  //
  // '교사' 표시는 그 사람의 전체 권한(user_roles.role === 'teacher')이 아니라,
  // 권한관리 탭의 "동아리별 담당 교사 지정"(club_teachers, N:M)에서 실제로
  // 이 동아리의 담당 교사로 지정되어 있는지를 기준으로 판단한다. 그렇지 않으면
  // 주 소속만 이 동아리인 교사가 담당 지정 여부와 무관하게 항상 '교사'로 보이는
  // 문제가 생긴다.
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

    // 이 동아리에 실제로 "담당 교사"로 지정된 사람 목록 (club_teachers)
    const { data: assignedTeacherRows } = await supabase
      .from('club_teachers')
      .select('teacher_id')
      .eq('club', id);
    const assignedTeacherIds = new Set((assignedTeacherRows || []).map((r: any) => r.teacher_id as string));

    // 교사는 이 동아리의 "담당 교사"로 지정된 경우에만 명단에 포함한다.
    // 담당 지정이 안 된 교사는(주 소속/부 소속이 이 동아리여도) 명단에서 제외 —
    // 동아리 명단에는 담당 교사와 학생들만 있어야 하기 때문이다.
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

  // 부장님이 관리 화면에서 CA(천화래와 청명) 겸직을 추가/해제하거나, 관리자가
  // 권한관리 탭에서 이 동아리의 담당 교사를 지정/해제하면, 이 페이지를
  // 새로고침하지 않아도 명단이 실시간으로 반영되도록 구독한다.
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

  const loadQnA = async () => {
    try {
      const { data } = await supabase
        .from('club_qna')
        .select('*')
        .eq('club', id)
        .order('created_at', { ascending: false });

      if (data) {
        const mapped: ClubQnA[] = data.map((q: any) => ({
          id: q.id,
          question: q.question,
          questioner: q.is_anonymous ? '익명' : (q.author_id ? '' : '익명'),
          authorId: q.author_id ?? null,
          isAnonymous: q.is_anonymous || false,
          answer: q.answer || undefined,
          answerer: q.answerer_name || undefined,
          createdAt: q.created_at,
        }));
        setQnaItems(mapped);
      }
    } catch (e) {
      console.error('Failed to load QnA:', e);
    }
  };

  const saveClubDetail = async (updates: Partial<ClubDetailData>) => {
    if (!canEditClubDetail) {
      setError('이 동아리의 정보를 수정할 권한이 없습니다.');
      return;
    }
    const newDetail = { ...clubDetail, ...updates };
    setClubDetail(newDetail);
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

      const { error: upsertError } = await supabase
        .from('club_posts')
        .upsert({
          club: id,
          type: 'detail',
          author_id: user?.id || '',
          author_name: profile?.name || '',
          title: `${club?.name || id} 상세 정보`,
          content,
        }, { onConflict: 'club,type' });

      if (upsertError) throw upsertError;
    } catch (e) {
      console.error('Failed to save club detail:', e);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    setError(null);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const ext = file.name.split('.').pop();
        const path = `club-photos/${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        await supabase.storage.from('Public').upload(path, file, { upsert: true });
        const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
        return urlData.publicUrl;
      });
      const newUrls = await Promise.all(uploadPromises);
      const updatedPhotos = [...clubDetail.photos, ...newUrls];
      await saveClubDetail({ photos: updatedPhotos });
    } catch {
      setError('사진 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
      // Reset the file input
      if (e.target) e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    const updatedPhotos = clubDetail.photos.filter(p => p !== photoUrl);
    try {
      const urlObj = new URL(photoUrl);
      const pathParts = urlObj.pathname.split('/');
      const storagePath = pathParts.slice(pathParts.indexOf('public') + 1).join('/');
      await supabase.storage.from('Public').remove([storagePath]);
    } catch { /* ignore */ }
    setSelectedPhotos(prev => { const next = new Set(prev); next.delete(photoUrl); return next; });
    await saveClubDetail({ photos: updatedPhotos });
  };

  const handleBatchDeletePhotos = async () => {
    if (selectedPhotos.size === 0) return;
    const urlsToDelete = Array.from(selectedPhotos);
    const updatedPhotos = clubDetail.photos.filter(p => !selectedPhotos.has(p));
    try {
      const pathsToRemove = urlsToDelete.map(url => {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        return pathParts.slice(pathParts.indexOf('public') + 1).join('/');
      }).filter(Boolean);
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
        .select('*')
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

  // 질문 작성자 본인 또는 동아리 사명자만 질문을 수정/삭제할 수 있어요.
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

      setQnaItems(prev => prev.map(q =>
        q.id === qnaId ? { ...q, question: editQnaText.trim() } : q
      ));
      setEditingQnaId(null);
      setEditQnaText('');
    } catch (e) {
      console.error('Failed to edit question:', e);
      setError('질문 수정 중 오류가 발생했습니다.');
    } finally {
      setQnaActionLoading(false);
    }
  };

  const handleDeleteQuestion = async (qnaId: string) => {
    if (qnaActionLoading) return;
    if (!window.confirm('이 질문을 삭제할까요? 답변도 함께 삭제됩니다.')) return;
    setQnaActionLoading(true);
    try {
      const { error: deleteError } = await supabase
        .from('club_qna')
        .delete()
        .eq('id', qnaId);

      if (deleteError) throw deleteError;

      setQnaItems(prev => prev.filter(q => q.id !== qnaId));
      if (editingQnaId === qnaId) handleCancelEditQuestion();
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

      setQnaItems(prev => prev.map(q =>
        q.id === qnaId ? { ...q, answer: editAnswerText.trim() } : q
      ));
      setEditingAnswerId(null);
      setEditAnswerText('');
    } catch (e) {
      console.error('Failed to edit answer:', e);
      setError('답변 수정 중 오류가 발생했습니다.');
    } finally {
      setQnaActionLoading(false);
    }
  };

  const handleDeleteAnswer = async (qnaId: string) => {
    if (qnaActionLoading) return;
    if (!window.confirm('이 답변을 삭제할까요?')) return;
    setQnaActionLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('club_qna')
        .update({ answer: null, answerer_name: null, answered_at: null })
        .eq('id', qnaId);

      if (updateError) throw updateError;

      setQnaItems(prev => prev.map(q =>
        q.id === qnaId ? { ...q, answer: undefined, answerer: undefined } : q
      ));
      if (editingAnswerId === qnaId) handleCancelEditAnswer();
    } catch (e) {
      console.error('Failed to delete answer:', e);
      setError('답변 삭제 중 오류가 발생했습니다.');
    } finally {
      setQnaActionLoading(false);
    }
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

  const isClubLeader = profile?.role === 'chief' || profile?.role === 'teacher' ||
    ((profile?.club === id || secondaryClubs.includes(id || '')) &&
     (profile?.role === 'zone_leader' || profile?.role === 'assistant_zone_leader' || profile?.name === club.leaderName));
  const isTeacherOrChief = profile?.role === 'teacher' || profile?.role === 'chief';
  // Club access: all approved users can view club detail pages.
  // Non-members need to enter the club password (if set) to access.
  const isClubMember = profile?.club === id || secondaryClubs.includes(id || '') || isTeacherOrChief;
  // The previous restrictive access check was intentionally removed to allow
  // any logged-in student to browse club information. Sensitive/private data
  // is protected at RLS level. Club community page has its own access control.

  // Check if user can actually edit this club (club membership + leadership OR teacher/chief)
  const canEditClubDetail = profile?.role === 'chief' || profile?.role === 'teacher' ||
    ((profile?.club === id || secondaryClubs.includes(id || '')) &&
     (profile?.role === 'zone_leader' || profile?.role === 'assistant_zone_leader' || profile?.name === club.leaderName));

  const handleSaveGoal = () => {
    saveClubDetail({ goal: goalInput });
    setEditingGoal(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      {/* Hero */}
      <div className="relative aspect-[16/10] md:aspect-[21/7] overflow-hidden">
        {clubBanner?.hero_image_url ? (
          <img src={clubBanner.hero_image_url} alt={club.name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${club.color}`}></div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/50"></div>

        {/* 이미지 관리 버튼 — 제목과 겹치지 않도록 우상단에 따로 배치 */}
        <div className="absolute top-3 right-3 md:top-6 md:right-6 z-20">
          <ClubBannerManager club={club.id} onBannerChange={refreshBanner} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-10">
          <div className="max-w-5xl mx-auto">
            <button onClick={() => navigate('/clubs')} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-2 md:mb-4 text-xs md:text-sm group cursor-pointer">
              <i className="ri-arrow-left-line group-hover:-translate-x-1 transition-transform duration-200"></i>
              동아리 목록
            </button>
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-2xl ${club.iconBg} flex items-center justify-center backdrop-blur`}>
                <i className={`${clubIcons[club.id]} text-xl md:text-3xl ${club.iconText}`}></i>
              </div>
              <div>
                <h1 className="text-lg md:text-4xl font-bold text-white leading-tight">{club.name}</h1>
                <p className="text-white/80 text-xs md:text-base">{club.subtitle}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-10 relative z-10 -mt-6 md:mt-0 rounded-t-[28px] md:rounded-none bg-background-50">
        {error && (
          <div className="bg-accent-100 border border-accent-200 rounded-[20px] p-4 mb-6">
            <p className="text-sm text-accent-700 flex items-center gap-2"><i className="ri-error-warning-line"></i>{error}</p>
            <button onClick={() => { setError(null); loadAllData(); }} className="mt-2 text-xs text-accent-600 underline cursor-pointer">다시 시도</button>
          </div>
        )}

        {/* Tabs — 모바일: 공용 카테고리 칩 재사용 */}
        <div className="md:hidden mb-4">
          <CategoryChipRow>
            {(['info', 'members', 'photos', 'qna'] as const).map(tab => (
              <CategoryChip key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
                <i className={`${tab === 'info' ? 'ri-information-line' : tab === 'members' ? 'ri-group-line' : tab === 'photos' ? 'ri-camera-line' : 'ri-question-answer-line'} mr-1`}></i>
                {tab === 'info' ? '소개' : tab === 'members' ? `명단 (${members.length})` : tab === 'photos' ? `사진 (${clubDetail.photos.length})` : 'QnA'}
              </CategoryChip>
            ))}
          </CategoryChipRow>
        </div>

        {/* Tabs — PC: 기존 필 스타일 유지 */}
        <div className="hidden md:flex items-center gap-1 mb-4 md:mb-6 bg-background-100 rounded-full p-1 overflow-x-auto">
          {(['info', 'members', 'photos', 'qna'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${activeTab === tab ? 'bg-background-100 text-foreground-950 shadow-sm' : 'text-foreground-600 hover:text-foreground-950'}`}>
              <i className={`${tab === 'info' ? 'ri-information-line' : tab === 'members' ? 'ri-group-line' : tab === 'photos' ? 'ri-camera-line' : 'ri-question-answer-line'} mr-1`}></i>
              {tab === 'info' ? '소개' : tab === 'members' ? `명단 (${members.length})` : tab === 'photos' ? `사진 (${clubDetail.photos.length})` : 'QnA'}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'info' && (
            <motion.div key="info" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 items-start">
                {/* 동아리 소개 — 인스타 프로필 소개글처럼 전체 폭으로 항상 펼쳐둔다 */}
                <InfoSection
                  icon="ri-file-text-line"
                  iconColor="text-primary-600"
                  title="동아리 소개"
                  wrapperClassName="md:col-span-2"
                  forceOpen={editingIntro}
                  headerAction={isClubLeader && !editingIntro && (
                    <button onClick={() => { setIntroInput(clubDetail.description); setEditingIntro(true); }} className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer whitespace-nowrap">
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                  )}
                >
                  {editingIntro ? (
                    <div>
                      <textarea value={introInput} onChange={e => setIntroInput(e.target.value)} rows={4} maxLength={500} className="w-full px-4 py-3 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none resize-none" />
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => setEditingIntro(false)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                        <button onClick={() => { saveClubDetail({ description: introInput }); setEditingIntro(false); }} className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap">저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{clubDetail.description}</p>
                  )}
                  <div className="mt-5 pt-4 border-t border-background-200">
                    <Link to={`/clubs/${club.id}/community`} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-medium hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
                      <i className="ri-chat-smile-2-line"></i>소통 공간
                    </Link>
                  </div>
                </InfoSection>

                {/* 연습 일정 */}
                <InfoSection
                  icon="ri-time-line"
                  title="연습 일정"
                  forceOpen={editingSchedule}
                  headerAction={isClubLeader && !editingSchedule && (
                    <button onClick={() => { setScheduleInput(clubDetail.schedule); setEditingSchedule(true); }} className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer whitespace-nowrap">
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                  )}
                >
                  {editingSchedule ? (
                    <div>
                      <textarea value={scheduleInput} onChange={e => setScheduleInput(e.target.value)} rows={3} maxLength={200} className="w-full px-4 py-3 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none resize-none" />
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => setEditingSchedule(false)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                        <button onClick={() => { saveClubDetail({ schedule: scheduleInput }); setEditingSchedule(false); }} className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap">저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{clubDetail.schedule}</p>
                  )}
                </InfoSection>

                {/* 주요 활동 — 목록이 길어질 수 있어 전체 폭으로 배치 */}
                <InfoSection
                  icon="ri-checkbox-multiple-line"
                  iconColor="text-primary-600"
                  title="주요 활동"
                  wrapperClassName="md:col-span-2"
                  forceOpen={editingActivities}
                  saving={saving}
                  headerAction={isClubLeader && !editingActivities && (
                    <button onClick={() => { setActivitiesInput([...clubDetail.activities]); setEditingActivities(true); }} className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer whitespace-nowrap">
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                  )}
                >
                  {editingActivities ? (
                    <div>
                      <div className="space-y-2 mb-3">
                        {activitiesInput.map((act, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <textarea
                              value={act}
                              onChange={e => {
                                const next = [...activitiesInput];
                                next[i] = e.target.value;
                                setActivitiesInput(next);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                }
                              }}
                              rows={1}
                              maxLength={200}
                              className="flex-1 px-3 py-2 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none resize-none"
                            />
                            <button onClick={() => setActivitiesInput(prev => prev.filter((_, idx) => idx !== i))} className="w-10 h-10 md:w-7 md:h-7 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center hover:bg-rose-200 cursor-pointer flex-shrink-0 self-start mt-1">
                              <i className="ri-close-line text-sm"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <textarea
                          value={newActivityItem}
                          onChange={e => setNewActivityItem(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              if (newActivityItem.trim()) {
                                setActivitiesInput(prev => [...prev, newActivityItem.trim()]);
                                setNewActivityItem('');
                              }
                            }
                          }}
                          placeholder="새 활동 추가... (Shift+Enter로 줄바꿈, Enter로 추가)"
                          rows={2}
                          maxLength={200}
                          className="flex-1 px-3 py-2 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none resize-none"
                        />
                        <button onClick={() => { if (newActivityItem.trim()) { setActivitiesInput(prev => [...prev, newActivityItem.trim()]); setNewActivityItem(''); }}} disabled={!newActivityItem.trim()} className="px-3 py-2 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">추가</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setEditingActivities(false); setNewActivityItem(''); }} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                        <button onClick={() => { saveClubDetail({ activities: activitiesInput }); setEditingActivities(false); setNewActivityItem(''); }} className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 cursor-pointer whitespace-nowrap">저장</button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(clubDetail.activities.length > 0 ? clubDetail.activities : club.activities).map((a, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className={`w-7 h-7 rounded-lg ${club.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <i className={`ri-check-line text-sm ${club.iconText}`}></i>
                          </div>
                          <span className="text-sm text-foreground-700">{a}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </InfoSection>

                {/* 동아리장 한마디 */}
                <InfoSection
                  icon="ri-chat-quote-line"
                  title="동아리장 한마디"
                  forceOpen={editingQuote || editingLeaderName}
                  containerClass={`bg-gradient-to-br ${club.color} border-transparent`}
                  titleClass="text-white"
                  headerAction={isClubLeader && !editingQuote && !editingLeaderName && (
                    <button onClick={() => { setQuoteInput(clubDetail.leaderQuote); setEditingQuote(true); }} className="text-xs text-white/80 hover:text-white cursor-pointer whitespace-nowrap">
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                  )}
                >
                  {editingQuote ? (
                    <div>
                      <textarea value={quoteInput} onChange={e => setQuoteInput(e.target.value)} rows={3} maxLength={200} className="w-full px-4 py-3 text-sm rounded-xl border border-white/30 bg-background-100/10 text-white placeholder-white/50 focus:border-white/50 outline-none resize-none" />
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => setEditingQuote(false)} className="text-xs text-white/70 hover:text-white cursor-pointer">취소</button>
                        <button onClick={() => { saveClubDetail({ leaderQuote: quoteInput }); setEditingQuote(false); }} className="px-3 py-1.5 rounded-full bg-background-100/20 text-white text-xs font-semibold hover:bg-background-100/30 cursor-pointer whitespace-nowrap">저장</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-white">
                      <p className="text-sm leading-relaxed mb-4 italic">{clubDetail.leaderQuote}</p>
                      <div className="flex items-center gap-2 pt-3 border-t border-white/20">
                        <div className="w-8 h-8 rounded-full bg-background-100/20 flex items-center justify-center">
                          <i className="ri-user-line text-white text-sm"></i>
                        </div>
                        {editingLeaderName ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={leaderNameInput}
                              onChange={e => setLeaderNameInput(e.target.value)}
                              maxLength={20}
                              placeholder="동아리장 이름"
                              className="px-3 py-1 text-sm rounded-lg border border-white/30 bg-background-100/10 text-white placeholder-white/50 focus:border-white/50 outline-none w-32"
                            />
                            <button onClick={() => { saveClubDetail({ leaderName: leaderNameInput }); setEditingLeaderName(false); }} className="text-xs text-white/80 hover:text-white cursor-pointer whitespace-nowrap">
                              <i className="ri-check-line"></i>
                            </button>
                            <button onClick={() => setEditingLeaderName(false)} className="text-xs text-white/60 hover:text-white cursor-pointer">
                              <i className="ri-close-line"></i>
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-sm font-medium">{clubDetail.leaderName || club.leaderName} (동아리장)</span>
                            {isClubLeader && (
                              <button onClick={() => { setLeaderNameInput(clubDetail.leaderName || club.leaderName); setEditingLeaderName(true); }} className="text-white/60 hover:text-white cursor-pointer">
                                <i className="ri-pencil-line text-xs"></i>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </InfoSection>

                {/* 이번 시즌 목표 */}
                <InfoSection
                  icon="ri-flag-line"
                  iconColor="text-amber-600"
                  title="이번 시즌 목표"
                  forceOpen={editingGoal}
                  saving={saving}
                  headerAction={isClubLeader && !editingGoal && (
                    <button onClick={() => { setGoalInput(clubDetail.goal); setEditingGoal(true); }} className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer whitespace-nowrap">
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                  )}
                >
                  {editingGoal ? (
                    <div>
                      <textarea value={goalInput} onChange={e => setGoalInput(e.target.value)} rows={2} maxLength={200} className="w-full px-4 py-2.5 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none resize-none" />
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => setEditingGoal(false)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                        <button onClick={handleSaveGoal} className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 cursor-pointer whitespace-nowrap">저장</button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-700 leading-relaxed">{clubDetail.goal}</p>
                  )}
                </InfoSection>

                {/* 이번 달 주제 말씀 */}
                <InfoSection
                  icon="ri-book-open-line"
                  iconColor="text-amber-600"
                  title="이번 달 주제 말씀"
                  containerClass="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200"
                  forceOpen={editingVerse}
                  headerAction={isClubLeader && !editingVerse && (
                    <button onClick={() => { setVerseForm({ text: clubDetail.monthlyVerseText, reference: clubDetail.monthlyVerseReference, description: clubDetail.monthlyVerseDescription }); setEditingVerse(true); }} className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer whitespace-nowrap">
                      <i className="ri-edit-line mr-1"></i>수정
                    </button>
                  )}
                >
                  {editingVerse ? (
                    <div className="space-y-3">
                      <input type="text" value={verseForm.text} onChange={e => setVerseForm(p => ({ ...p, text: e.target.value }))} placeholder="말씀 구절" maxLength={100} className="w-full px-4 py-2.5 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none" />
                      <input type="text" value={verseForm.reference} onChange={e => setVerseForm(p => ({ ...p, reference: e.target.value }))} placeholder="출처 (예: 신명기 6:5)" maxLength={50} className="w-full px-4 py-2.5 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none" />
                      <textarea value={verseForm.description} onChange={e => setVerseForm(p => ({ ...p, description: e.target.value }))} placeholder="짧은 설명" rows={2} maxLength={200} className="w-full px-4 py-3 text-sm rounded-xl border border-amber-200 bg-amber-50 focus:border-amber-400 outline-none resize-none" />
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditingVerse(false)} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                        <button onClick={() => {
                          saveClubDetail({ monthlyVerseText: verseForm.text, monthlyVerseReference: verseForm.reference, monthlyVerseDescription: verseForm.description });
                          setEditingVerse(false);
                        }} className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap">저장</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-base font-bold text-amber-800 italic mb-1">"{clubDetail.monthlyVerseText}"</p>
                      <p className="text-xs text-amber-600 mb-2">— {clubDetail.monthlyVerseReference}</p>
                      {clubDetail.monthlyVerseDescription && (
                        <p className="text-sm text-foreground-700 leading-relaxed">{clubDetail.monthlyVerseDescription}</p>
                      )}
                    </div>
                  )}
                </InfoSection>
              </div>
            </motion.div>
          )}

          {activeTab === 'members' && (
            <motion.div key="members" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-6">
                {members.filter(m => m.isBirthdayThisMonth).length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <i className="ri-cake-line text-rose-500 text-lg"></i>
                      <h3 className="text-sm font-bold text-rose-700">이번 달 생일자</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {members.filter(m => m.isBirthdayThisMonth).map((m, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-full bg-rose-100 border border-rose-200">
                          <div className={`w-6 h-6 rounded-full ${m.avatarColor} overflow-hidden flex items-center justify-center flex-shrink-0`}>
                            {m.profileImage ? (
                              <img
                                src={m.profileImage}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <span className={`${m.profileImage ? 'hidden' : ''} text-gray-600 flex items-center justify-center w-full h-full`}>
                              <i className="ri-user-3-line text-[12px]"></i>
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-rose-800">{m.name}</span>
                          <span className="text-xs text-rose-600">{m.birthday}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {members.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm text-foreground-600">아직 동아리원이 없어요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {members.map((m, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-background-50 transition-colors">
                        <div className={`w-10 h-10 rounded-full ${m.avatarColor} overflow-hidden flex items-center justify-center flex-shrink-0`}>
                          {m.profileImage ? (
                            <img
                              src={m.profileImage}
                              alt={`${m.name} 프로필`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <span className={`${m.profileImage ? 'hidden' : ''} text-gray-600 flex items-center justify-center w-full h-full`}>
                            <i className="ri-user-3-line text-base"></i>
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground-950">
                            {m.name}
                            {m.isBirthdayThisMonth && <i className="ri-cake-line text-rose-500 ml-1"></i>}
                          </p>
                          <p className="text-xs text-foreground-600">
                            {m.role}{m.birthday ? ` · ${m.birthday}` : ''}
                            {m.roleLabel && m.roleLabel !== m.role && (
                              <span className="text-foreground-400 ml-1">({m.roleLabel})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'photos' && (
            <motion.div key="photos" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-foreground-950 flex items-center gap-2">
                    <i className="ri-camera-line text-rose-600"></i> 동아리 사진
                    <span className="text-xs text-foreground-500 font-normal">({clubDetail.photos.length}장)</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    {isClubLeader && selectedPhotos.size > 0 && (
                      <button
                        onClick={handleBatchDeletePhotos}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <i className="ri-delete-bin-line"></i> 선택 삭제 ({selectedPhotos.size})
                      </button>
                    )}
                    {isClubLeader && (
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-upload-line"></i> 사진 올리기
                        <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                      </label>
                    )}
                  </div>
                </div>
                {uploading && <p className="text-xs text-foreground-600 mb-3">업로드 중...</p>}
                {clubDetail.photos.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-image-line text-2xl text-rose-300"></i>
                    </div>
                    <p className="text-sm text-foreground-600">아직 올린 사진이 없어요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {clubDetail.photos.map((url, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          if (isClubLeader && selectedPhotos.size > 0) togglePhotoSelect(url);
                          else setLightboxIndex(i);
                        }}
                        className={`group relative overflow-hidden rounded-xl bg-background-200 aspect-[4/3] cursor-pointer active:scale-[0.98] transition-transform ${selectedPhotos.has(url) ? 'ring-2 ring-rose-500 ring-offset-2 ring-offset-background-100' : ''}`}
                      >
                        <img src={url} alt={`동아리 사진 ${i + 1}`} className="w-full h-full object-cover" />
                        {isClubLeader && (
                          <>
                            <div className={`absolute inset-0 transition-colors ${selectedPhotos.has(url) ? 'bg-rose-500/20' : 'bg-transparent group-hover:bg-black/10'}`}></div>
                            <button
                              onClick={(e) => { e.stopPropagation(); togglePhotoSelect(url); }}
                              aria-label="선택"
                              className={`absolute top-2 left-2 w-10 h-10 md:w-7 md:h-7 rounded border-2 flex items-center justify-center transition-colors cursor-pointer ${selectedPhotos.has(url) ? 'bg-rose-500 border-rose-500' : 'border-white bg-black/30 md:opacity-0 md:group-hover:opacity-100'}`}
                            >
                              {selectedPhotos.has(url) && <i className="ri-check-line text-white text-[10px]"></i>}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(url); }}
                              aria-label="삭제"
                              className="absolute top-2 right-2 w-10 h-10 md:w-7 md:h-7 rounded-full bg-black/50 text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-rose-500"
                            >
                              <i className="ri-close-line text-sm"></i>
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'qna' && (
            <motion.div key="qna" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {user && (
                <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-6">
                  <h3 className="text-sm font-bold text-foreground-950 mb-3 flex items-center gap-2">
                    <i className="ri-question-line text-accent-600"></i> 질문하기
                  </h3>
                  <textarea value={qnaQuestion} onChange={e => setQnaQuestion(e.target.value)} placeholder={`${club.name}에 대해 궁금한 점을 물어보세요...`} rows={3} maxLength={300} className="w-full px-4 py-3 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-accent-400 outline-none resize-none" />
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-1.5 text-xs text-foreground-600 cursor-pointer">
                      <input type="checkbox" checked={qnaAnon} onChange={e => setQnaAnon(e.target.checked)} className="rounded" />
                      익명으로 질문하기
                    </label>
                    <button
                      onClick={handleSubmitQuestion}
                      disabled={!qnaQuestion.trim() || qnaSubmitting}
                      className="px-4 py-2 rounded-full bg-accent-500 text-background-50 text-sm font-semibold hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    >
                      {qnaSubmitting ? '등록 중...' : '질문 등록'}
                    </button>
                  </div>
                </div>
              )}
              <div className="space-y-4">
                {qnaItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 rounded-full bg-accent-50 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-question-answer-line text-2xl text-accent-300"></i>
                    </div>
                    <p className="text-sm text-foreground-600">아직 질문이 없어요</p>
                  </div>
                ) : (
                  qnaItems.map((item, idx) => (
                    <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.05, 0.3) }} className={`bg-background-100 border rounded-[20px] p-5 ${item.answer ? 'border-emerald-200' : 'border-background-200'}`}>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="w-10 h-10 md:w-7 md:h-7 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
                          <i className="ri-question-mark text-accent-600 text-xs"></i>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-accent-600">{item.isAnonymous ? '익명' : item.questioner}</span>
                            <span className="text-xs text-foreground-500">{item.createdAt}</span>
                            {!item.answer && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">답변 대기</span>}
                          </div>
                          {editingQnaId === item.id ? (
                            <div>
                              <textarea value={editQnaText} onChange={e => setEditQnaText(e.target.value)} rows={2} maxLength={300} className="w-full px-3 py-2 text-sm rounded-xl border border-accent-300 bg-background-50 focus:border-accent-400 outline-none resize-none" />
                              <div className="flex items-center gap-2 mt-1.5">
                                <button onClick={handleCancelEditQuestion} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                                <button onClick={() => handleSaveEditQuestion(item.id)} disabled={!editQnaText.trim() || qnaActionLoading} className="px-3 py-1 rounded-full bg-accent-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap">저장</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-foreground-800 font-medium leading-relaxed">{item.question}</p>
                              {canManageQnaQuestion(item) && (
                                <div className="flex items-center gap-3 mt-1.5">
                                  <button onClick={() => handleStartEditQuestion(item)} className="text-xs text-foreground-500 hover:text-accent-600 cursor-pointer">수정</button>
                                  <button onClick={() => handleDeleteQuestion(item.id)} disabled={qnaActionLoading} className="text-xs text-foreground-500 hover:text-red-600 cursor-pointer disabled:opacity-40">삭제</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {item.answer ? (
                        <div className="ml-10 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-5 h-5 rounded-full bg-emerald-200 flex items-center justify-center">
                              <i className="ri-user-star-line text-emerald-700 text-[10px]"></i>
                            </div>
                            <span className="text-xs font-bold text-emerald-700">{item.answerer}</span>
                          </div>
                          {editingAnswerId === item.id ? (
                            <div>
                              <textarea value={editAnswerText} onChange={e => setEditAnswerText(e.target.value)} rows={2} maxLength={500} className="w-full px-3 py-2 text-sm rounded-xl border border-emerald-300 bg-background-50 focus:border-emerald-400 outline-none resize-none" />
                              <div className="flex items-center gap-2 mt-1.5">
                                <button onClick={handleCancelEditAnswer} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                                <button onClick={() => handleSaveEditAnswer(item.id)} disabled={!editAnswerText.trim() || qnaActionLoading} className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap">저장</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-emerald-800 leading-relaxed">{item.answer}</p>
                              {isClubLeader && (
                                <div className="flex items-center gap-3 mt-1.5">
                                  <button onClick={() => handleStartEditAnswer(item)} className="text-xs text-emerald-700/70 hover:text-emerald-700 cursor-pointer">수정</button>
                                  <button onClick={() => handleDeleteAnswer(item.id)} disabled={qnaActionLoading} className="text-xs text-emerald-700/70 hover:text-red-600 cursor-pointer disabled:opacity-40">삭제</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        isClubLeader && (
                          <div className="ml-10 mt-2">
                            {answeringQnaId === item.id ? (
                              <div>
                                <textarea value={qnaAnswer} onChange={e => setQnaAnswer(e.target.value)} placeholder="답변을 작성해주세요..." rows={2} maxLength={500} className="w-full px-4 py-2.5 text-sm rounded-xl border border-emerald-200 bg-emerald-50 focus:border-emerald-400 outline-none resize-none" />
                                <div className="flex items-center gap-2 mt-1.5">
                                  <button onClick={() => { setAnsweringQnaId(null); setQnaAnswer(''); }} className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer">취소</button>
                                  <button onClick={() => handleSubmitAnswer(item.id)} disabled={!qnaAnswer.trim()} className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap">답변 등록</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setAnsweringQnaId(item.id)} className="text-xs text-emerald-600 hover:text-emerald-700 cursor-pointer font-medium">
                                <i className="ri-reply-line mr-1"></i> 답변하기
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={clubDetail.photos}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

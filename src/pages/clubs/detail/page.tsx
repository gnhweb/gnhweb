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
        .select('content')
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

    // 교사는 이 동아리의 "담당 교사"로 지정된 경우... 
    const mappedMembers: ClubMember[] = allMemberRows.map((m: any) => ({
      name: m.name || '이름 없음',
      role: m.role,
      roleLabel: assignedTeacherIds.has(m.user_id) ? '교사' : (m.role === 'chief' ? '부장' : m.role === 'zone_leader' ? '구역장' : m.role === 'assistant_zone_leader' ? '부구역장' : '회원'),
      birthday: m.birth_year && m.birth_month && m.birth_day ? `${m.birth_year}.${String(m.birth_month).padStart(2, '0')}.${String(m.birth_day).padStart(2, '0')}` : '',
      avatarColor: ['bg-primary-100', 'bg-secondary-100', 'bg-accent-100', 'bg-background-200'][allMemberRows.indexOf(m) % 4],
      profileImage: m.profile_image || undefined,
      isBirthdayThisMonth: m.birth_month === new Date().getMonth() + 1,
    }));
    setMembers(mappedMembers);
  };

  const loadQnA = async () => {
    try {
      const { data } = await supabase
        .from('club_qna')
        .select('id, question, author_id, is_anonymous, answer, answerer_name, created_at')
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
      const uploadPromises = Array.from(files).map(async (file): Promise<ClubPhoto> => {
        const safeName = `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const path = `club-photos/${safeName}`;
        const thumbPath = `club-photos/${thumbFileNameFor(safeName)}`;
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

        const { error: thumbErr } = await supabase.storage
          .from('Public')
          .upload(thumbPath, thumbBlob, {
            upsert: true,
            contentType: 'image/jpeg',
            cacheControl: '31536000',
          });
        if (thumbErr) {
          await supabase.storage.from('Public').remove([path]);
          throw thumbErr;
        }

        const url = supabase.storage.from('Public').getPublicUrl(path).data.publicUrl;
        const thumbUrl = supabase.storage.from('Public').getPublicUrl(thumbPath).data.publicUrl;
        return { url, thumbUrl };
      });

      const newPhotos = await Promise.all(uploadPromises);
      const merged = [...clubDetail.photos, ...newPhotos];
      await saveClubDetail({ photos: merged });
    } catch (e) {
      console.error('Photo upload failed:', e);
      setError('사진 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const canEditClubDetail = profile?.role === 'chief' || profile?.role === 'teacher' ||
    ((profile?.club === id || secondaryClubs.includes(id || '')) &&
      (profile?.role === 'zone_leader' || profile?.role === 'assistant_zone_leader' || profile?.name === club?.leaderName));

  const isClubLeader = profile?.role === 'chief' || profile?.role === 'teacher' ||
    ((profile?.club === id || secondaryClubs.includes(id || '')) &&
      (profile?.role === 'zone_leader' || profile?.role === 'assistant_zone_leader' || profile?.name === club?.leaderName));
  const isTeacherOrChief = profile?.role === 'teacher' || profile?.role === 'chief';
  const isClubMember = profile?.club === id || secondaryClubs.includes(id || '') || isTeacherOrChief;

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

  // 이하 기존 UI/핸들러는 동일
  return <div className="min-h-screen bg-background-50" />;
}

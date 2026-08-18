import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { BADGE_DEFINITIONS } from '@/constants/missionBadges';
import { notifyAutoLogoutMinutesChanged } from '@/lib/simplePin';

const INTERESTS_LIST = ['악기', '운동', '독서', '그림', '코딩', '사진', '춤', '노래', '영화', '게임', '요리', '여행', '봉사', '글쓰기'];

// 모바일 "인스타 프로필형" 헤더 아래 노출할 비공개 기능들 — 3열 아이콘 그리드
// (기존에 데스크톱 네비게이션 드롭다운에서만 보이던 항목들을 모바일 프로필 화면에서도 동일하게 노출)
const PRIVATE_FEATURE_ITEMS: { path: string; label: string; icon: string }[] = [
  { path: '/faith-storybook', label: '신앙 스토리북', icon: 'ri-bookmark-line' },
  { path: '/faith-journal', label: '신앙 일지', icon: 'ri-edit-line' },
  { path: '/repentance-journal', label: '회개 저널', icon: 'ri-hand-heart-line' },
  { path: '/bucket-list', label: '버킷리스트', icon: 'ri-todo-line' },
  { path: '/personal-schedule', label: '개인 일정', icon: 'ri-calendar-check-line' },
  { path: '/year-end-summary', label: '월별 결산', icon: 'ri-calendar-check-line' },
];

export default function ProfilePage() {
  const { user, profile, loading: authLoading, profileError, retryProfile, profileRetrying, hasRole, updateEmail, hasPin, setupPin, changePin, removePin } = useAuth();
  const isChief = hasRole('chief');

  // 이메일 변경
  const [newEmail, setNewEmail] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 간편 비밀번호(PIN)
  const [pinMode, setPinMode] = useState<'idle' | 'setup' | 'change' | 'remove-confirm'>('idle');
  const [pinCurrent, setPinCurrent] = useState('');
  const [pinNew, setPinNew] = useState('');
  const [pinNewConfirm, setPinNewConfirm] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [gender, setGender] = useState('');
  const [grade, setGrade] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState('');
  const [graduationExpected, setGraduationExpected] = useState(false);
  const [autoLogoutMinutes, setAutoLogoutMinutes] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Badge system
  const [completedMissions, setCompletedMissions] = useState<{ title: string; category: string; completed_at: string }[]>([]);
  const [badgesLoading, setBadgesLoading] = useState(true);
  const [badgesError, setBadgesError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    loadProfile();
    loadBadges();
  }, [user, profile]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (data) {
        setName(data.name || '');
        setBirthYear(data.birth_year ? String(data.birth_year) : '');
        setBirthMonth(data.birth_month ? String(data.birth_month) : '');
        setBirthDay(data.birth_day ? String(data.birth_day) : '');
        setGender(data.gender || '');
        setGrade(data.grade || '');
        setBio(data.bio || '');
        setInterests(data.interests ? data.interests.split(',').filter(Boolean) : []);
        setProfileImage(data.profile_image || '');
        setGraduationExpected(data.graduation_expected === true);
        setAutoLogoutMinutes(data.auto_logout_minutes ?? 30);
      }
    } catch { /* */ }
    setLoading(false);
  };

  const loadBadges = async () => {
    setBadgesLoading(true);
    try {
      const { data: aData } = await supabase
        .from('mission_assignments')
        .select('mission_id, status, completed_at')
        .eq('student_id', user!.id)
        .eq('status', 'completed');

      if (aData && aData.length > 0) {
        const missionIds = [...new Set(aData.map(a => a.mission_id))];
        const { data: mData } = await supabase
          .from('missions')
          .select('id, title, category')
          .in('id', missionIds);

        const titleMap = new Map((mData || []).map(m => [m.id, { title: m.title, category: m.category }]));
        setCompletedMissions(aData.map(a => ({
          title: titleMap.get(a.mission_id)?.title || '삭제된 미션',
          category: titleMap.get(a.mission_id)?.category || 'general',
          completed_at: a.completed_at,
        })));
      }
    } catch {
      setBadgesError('배지 정보를 불러오는 중 문제가 발생했어요');
    }
    setBadgesLoading(false);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    setMessage(null);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('Public').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('Public').getPublicUrl(path);
      const newUrl = urlData.publicUrl;
      setProfileImage(newUrl);
      const { error: updateErr } = await supabase
        .from('user_roles')
        .update({ profile_image: newUrl })
        .eq('user_id', user.id);
      if (updateErr) throw updateErr;
      setMessage({ type: 'success', text: '프로필 사진이 저장되었습니다!' });
    } catch {
      setMessage({ type: 'error', text: '사진 업로드에 실패했습니다.' });
    }
    setUploading(false);
  };

  const handleDeletePhoto = async () => {
    if (!user || !profileImage) return;
    try {
      const urlObj = new URL(profileImage);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.findIndex(p => p === 'Public');
      if (bucketIndex !== -1) {
        const storagePath = pathParts.slice(bucketIndex + 1).join('/');
        await supabase.storage.from('Public').remove([storagePath]);
      }
    } catch { /* ignore storage delete errors */ }
    setProfileImage('');
    await supabase.from('user_roles').update({ profile_image: null }).eq('user_id', user.id);
    setMessage({ type: 'success', text: '프로필 사진이 삭제되었습니다.' });
  };

  const handleAutoLogoutChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value);
    setAutoLogoutMinutes(val);
    if (!user) return;
    try {
      await supabase.from('user_roles').update({ auto_logout_minutes: val }).eq('user_id', user.id);
    } catch { /* ignore */ }
    localStorage.setItem(`auto_logout_timeout_minutes_${user.id}`, String(val));
    // 저장만 하면 이미 실행 중인 자동 로그아웃 타이머는 이 변경을 몰라서 예전
    // 시간 기준으로 계속 돌아가는 문제가 있었다. 지금 즉시 새 시간으로
    // 타이머를 다시 세팅하도록 알려준다.
    notifyAutoLogoutMinutesChanged(user.id, val);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      const updates: Record<string, unknown> = {
        name: name.trim(),
        birth_year: birthYear ? parseInt(birthYear) : null,
        birth_month: birthMonth ? parseInt(birthMonth) : null,
        birth_day: birthDay ? parseInt(birthDay) : null,
        gender: gender || null,
        grade: grade || null,
        bio: bio.trim() || null,
        interests: interests.length > 0 ? interests.join(',') : null,
        profile_image: profileImage || null,
        graduation_expected: graduationExpected,
      };
      const { error: updateErr } = await supabase
        .from('user_roles')
        .update(updates)
        .eq('user_id', user.id);
      if (updateErr) throw updateErr;
      setMessage({ type: 'success', text: '프로필이 저장되었습니다!' });
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
    }
    setSaving(false);
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev => prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]);
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim()) return;
    setEmailSaving(true);
    setEmailMessage(null);
    const { error } = await updateEmail(newEmail.trim());
    if (error) {
      setEmailMessage({ type: 'error', text: error });
    } else {
      setEmailMessage({ type: 'success', text: '변경 확인 메일을 새 이메일로 보냈어요. 메일함에서 링크를 눌러 인증을 완료해주세요.' });
      setNewEmail('');
    }
    setEmailSaving(false);
  };

  const resetPinForm = () => {
    setPinMode('idle');
    setPinCurrent('');
    setPinNew('');
    setPinNewConfirm('');
  };

  const handleSetupPin = async () => {
    setPinMessage(null);
    if (pinNew !== pinNewConfirm) {
      setPinMessage({ type: 'error', text: '입력한 비밀번호가 서로 달라요.' });
      return;
    }
    setPinSaving(true);
    const { error } = await setupPin(pinNew);
    setPinSaving(false);
    if (error) {
      setPinMessage({ type: 'error', text: error });
    } else {
      setPinMessage({ type: 'success', text: '간편 비밀번호가 설정되었습니다. 다음부턴 이 기기에서 PIN으로 바로 들어올 수 있어요.' });
      resetPinForm();
    }
  };

  const handleChangePin = async () => {
    setPinMessage(null);
    if (pinNew !== pinNewConfirm) {
      setPinMessage({ type: 'error', text: '입력한 비밀번호가 서로 달라요.' });
      return;
    }
    setPinSaving(true);
    const { error } = await changePin(pinCurrent, pinNew);
    setPinSaving(false);
    if (error) {
      setPinMessage({ type: 'error', text: error });
    } else {
      setPinMessage({ type: 'success', text: '간편 비밀번호가 변경되었습니다.' });
      resetPinForm();
    }
  };

  const handleRemovePin = () => {
    removePin();
    setPinMessage({ type: 'success', text: '간편 비밀번호가 해제되었습니다. 다음부턴 이메일로 로그인해주세요.' });
    resetPinForm();
  };

  // ───── Three distinct states ─────

  // 1. Not logged in at all
  if (!user && !authLoading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-lock-line text-3xl text-rose-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">로그인이 필요합니다</p>
          <p className="text-sm text-foreground-600 mb-4">프로필을 보려면 먼저 로그인해주세요</p>
          <a href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
            <i className="ri-login-box-line"></i> 로그인하기
          </a>
        </div>
      </div>
    );
  }

  // 2. Logged in but profile is still loading
  if (authLoading || (user && !profile && !profileError)) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-[20px] bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">프로필을 불러오는 중...</p>
          <p className="text-sm text-foreground-600">잠시만 기다려주세요</p>
        </div>
      </div>
    );
  }

  // 3. Logged in but profile fetch failed
  if (user && !profile && profileError) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-[20px] bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <i className="ri-error-warning-line text-3xl text-amber-600"></i>
          </div>
          <p className="text-lg font-bold text-foreground-950 mb-2">프로필을 불러올 수 없어요</p>
          <p className="text-sm text-foreground-600 mb-4">{profileError}</p>
          <button
            onClick={retryProfile}
            disabled={profileRetrying}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {profileRetrying ? (
              <>
                <i className="ri-loader-4-line animate-spin"></i> 재시도 중...
              </>
            ) : (
              <>
                <i className="ri-refresh-line"></i> 다시 시도
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // 모바일 인스타 프로필형 헤더용 통계 3개 — 이미 불러온 completedMissions/배지 데이터에서만 계산 (신규 fetch 없음)
  const missionsCompletedCount = completedMissions.length;
  const missionsCompletedThisMonth = completedMissions.filter(m => {
    if (!m.completed_at) return false;
    const d = new Date(m.completed_at);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const earnedBadgesCount = (() => {
    const total = completedMissions.length;
    const cleaningCount = completedMissions.filter(m => m.category === 'cleaning').length;
    const serviceCount = completedMissions.filter(m => m.category === 'service').length;
    const mediaCount = completedMissions.filter(m => m.category === 'media').length;
    const welcomeCount = completedMissions.filter(m => m.category === 'welcome').length;
    const equipmentCount = completedMissions.filter(m => m.category === 'equipment').length;
    const prayerCount = completedMissions.filter(m => m.category === 'prayer').length;
    const praiseCount = completedMissions.filter(m => m.category === 'praise').length;
    const educationCount = completedMissions.filter(m => m.category === 'education').length;
    return BADGE_DEFINITIONS.filter(b => {
      if (typeof b.condition !== 'function') return false;
      try {
        return b.condition(total, cleaningCount, serviceCount, mediaCount, welcomeCount, equipmentCount, prayerCount, praiseCount, educationCount);
      } catch {
        return b.condition(total);
      }
    }).length;
  })();

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-lg mx-auto px-4 md:px-6 py-6 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6 md:mb-10 md:block hidden">
            <h1 className="text-xl md:text-3xl font-bold text-foreground-950 mb-2">내 프로필</h1>
            <p className="text-sm text-foreground-600">프로필을 꾸미고 관리하세요</p>
          </div>

          {/* ── 모바일 전용 "인스타 프로필형" 헤더 ── */}
          <div className="md:hidden mb-6">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-background-200 border-4 border-white shadow-card mx-auto flex items-center justify-center">
                {profileImage ? (
                  <img src={profileImage} alt="프로필" className="w-full h-full object-cover" />
                ) : (
                  <i className="ri-user-line text-4xl text-foreground-400"></i>
                )}
              </div>
              <p className="mt-3 text-lg font-bold text-foreground-950">{name || '이름 미입력'}</p>
              {bio ? (
                <p className="text-xs text-foreground-500 mt-0.5 px-6 line-clamp-1">{bio}</p>
              ) : (
                <p className="text-xs text-foreground-400 mt-0.5">아래에서 소개글을 채워보세요</p>
              )}
            </div>

            {/* 통계 3개 — 인스타 팔로워/팔로잉/게시물 구조 참고 */}
            <div className="flex items-center justify-around mt-5 py-4 rounded-[20px] bg-background-100 shadow-card">
              <div className="text-center flex-1">
                <p className="text-xl font-black bg-gradient-to-br from-primary-600 to-accent-600 bg-clip-text text-transparent">{earnedBadgesCount}</p>
                <p className="text-[11px] text-foreground-500 mt-0.5">획득 배지</p>
              </div>
              <div className="w-px h-8 bg-background-200"></div>
              <div className="text-center flex-1">
                <p className="text-xl font-black bg-gradient-to-br from-primary-600 to-accent-600 bg-clip-text text-transparent">{missionsCompletedCount}</p>
                <p className="text-[11px] text-foreground-500 mt-0.5">완료 사명</p>
              </div>
              <div className="w-px h-8 bg-background-200"></div>
              <div className="text-center flex-1">
                <p className="text-xl font-black bg-gradient-to-br from-primary-600 to-accent-600 bg-clip-text text-transparent">{missionsCompletedThisMonth}</p>
                <p className="text-[11px] text-foreground-500 mt-0.5">이달의 활동</p>
              </div>
            </div>

            {/* 나만 보이는 비공개 기능 — 3열 아이콘 그리드 */}
            <div className="mt-4">
              <p className="text-xs font-semibold text-foreground-500 mb-2 px-1">나의 신앙 기록</p>
              <div className="grid grid-cols-3 gap-2">
                {PRIVATE_FEATURE_ITEMS.map(item => (
                  <motion.div key={item.path} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 500, damping: 25 }}>
                    <Link
                      to={item.path}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-[16px] bg-background-100 shadow-card cursor-pointer"
                    >
                      <span className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
                        <i className={`${item.icon} text-sm`}></i>
                      </span>
                      <span className="text-[11px] font-medium text-foreground-700 text-center leading-tight px-1">{item.label}</span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {message && (
            <div className={`rounded-[20px] p-4 mb-6 ${message.type === 'success' ? 'bg-emerald-100 border border-emerald-200' : 'bg-accent-100 border border-accent-200'}`}>
              <p className={`text-sm flex items-center gap-2 ${message.type === 'success' ? 'text-emerald-700' : 'text-accent-700'}`}>
                <i className={message.type === 'success' ? 'ri-check-line' : 'ri-error-warning-line'}></i>
                {message.text}
              </p>
            </div>
          )}

          <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 space-y-6">
            {/* Profile photo */}
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-background-200 border-4 border-background-50 flex items-center justify-center">
                  {profileImage ? (
                    <img src={profileImage} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <i className="ri-user-line text-4xl text-foreground-400"></i>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center cursor-pointer hover:bg-primary-600 transition-colors">
                  <i className="ri-camera-line text-sm"></i>
                  <input type="file" accept="image/*" onChange={handleUploadPhoto} className="hidden" disabled={uploading} />
                </label>
              </div>
              {profileImage && (
                <button onClick={handleDeletePhoto} className="mt-2 text-xs text-rose-600 hover:text-rose-700 cursor-pointer underline">
                  <i className="ri-delete-bin-line mr-0.5"></i>사진 삭제
                </button>
              )}
              {uploading && <p className="text-xs text-foreground-600 mt-2">업로드 중...</p>}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">이름</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={20} className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none" />
            </div>

            {/* 생년월일 & 성별 */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">생년월일</label>
              <div className="flex items-center gap-2">
                <input type="number" value={birthYear} onChange={e => setBirthYear(e.target.value)} placeholder="년도" min="1950" max="2020" className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none" />
                <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer">
                  <option value="">월</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <select value={birthDay} onChange={e => setBirthDay(e.target.value)} className="w-full px-3 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer">
                  <option value="">일</option>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}일</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 성별 & 학년 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-2">성별</label>
                <div className="flex gap-2">
                  <button onClick={() => setGender('남')} className={`flex-1 py-2.5 rounded-[13px] text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${gender === '남' ? 'bg-sky-100 text-sky-700 border border-sky-300' : 'bg-background-200 text-foreground-600 border border-background-200'}`}>남</button>
                  <button onClick={() => setGender('여')} className={`flex-1 py-2.5 rounded-[13px] text-sm font-medium cursor-pointer whitespace-nowrap transition-colors ${gender === '여' ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-background-200 text-foreground-600 border border-background-200'}`}>여</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground-950 mb-2">학년</label>
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none appearance-none cursor-pointer"
                >
                  <option value="">선택하세요</option>
                  <option value="중1">중1</option>
                  <option value="중2">중2</option>
                  <option value="중3">중3</option>
                  <option value="고1">고1</option>
                  <option value="고2">고2</option>
                  <option value="고3">고3</option>
                </select>
              </div>
            </div>

            {/* Role (read-only, chief can change) */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">
                권한 (직급)
                {!isChief && <span className="text-xs text-foreground-500 ml-1">· 부장님만 수정 가능</span>}
              </label>
              <div className="px-4 py-2.5 rounded-[13px] border border-background-200 bg-background-100 text-sm text-foreground-700 font-medium">
                {profile.role === 'chief' ? '부장' : profile.role === 'teacher' ? '교사' : profile.role === 'zone_leader' ? '부구역장' : profile.role === 'deputy' ? '차장' : '학생회원'}
              </div>
            </div>

            {/* Email change */}
            <div className="bg-background-50 border border-background-200 rounded-[16px] p-4">
              <label className="text-sm font-medium text-foreground-950">이메일</label>
              <p className="text-xs text-foreground-600 mt-0.5 mb-3">현재 이메일: {user?.email}</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setEmailMessage(null); }}
                  placeholder="새 이메일 주소"
                  className="flex-1 px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-100 focus:border-primary-400 outline-none"
                />
                <button
                  onClick={handleChangeEmail}
                  disabled={!newEmail.trim() || emailSaving}
                  className="px-4 py-2.5 rounded-[13px] bg-background-800 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {emailSaving ? '처리 중...' : '변경'}
                </button>
              </div>
              {emailMessage && (
                <p className={`text-xs mt-2 ${emailMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {emailMessage.text}
                </p>
              )}
            </div>

            {/* 간편 비밀번호(PIN) */}
            <div className="bg-background-50 border border-background-200 rounded-[16px] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground-950">간편 비밀번호</label>
                  <p className="text-xs text-foreground-600 mt-0.5">
                    {hasPin ? '이 기기에서 PIN으로 빠르게 로그인할 수 있어요' : '설정하면 다음부턴 이메일 없이 숫자 비밀번호만으로 들어올 수 있어요'}
                  </p>
                </div>
                {pinMode === 'idle' && (
                  hasPin ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">사용 중</span>
                  ) : (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-background-200 text-foreground-600 font-medium whitespace-nowrap">미설정</span>
                  )
                )}
              </div>

              {pinMode === 'idle' && (
                <div className="flex gap-2 mt-3">
                  {hasPin ? (
                    <>
                      <button onClick={() => { resetPinForm(); setPinMode('change'); }} className="flex-1 py-2 rounded-full border border-background-300 text-xs font-medium text-foreground-700 cursor-pointer whitespace-nowrap">
                        비밀번호 변경
                      </button>
                      <button onClick={() => setPinMode('remove-confirm')} className="flex-1 py-2 rounded-full border border-rose-200 text-xs font-medium text-rose-600 cursor-pointer whitespace-nowrap">
                        해제하기
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { resetPinForm(); setPinMode('setup'); }} className="w-full py-2 rounded-full bg-amber-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap">
                      간편 비밀번호 설정하기
                    </button>
                  )}
                </div>
              )}

              {pinMode === 'setup' && (
                <div className="mt-3 space-y-2">
                  <input type="password" inputMode="numeric" maxLength={6} value={pinNew} onChange={e => setPinNew(e.target.value.replace(/\D/g, ''))} placeholder="숫자 4~6자리" className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-100 text-center tracking-[0.3em] outline-none focus:border-amber-400" />
                  <input type="password" inputMode="numeric" maxLength={6} value={pinNewConfirm} onChange={e => setPinNewConfirm(e.target.value.replace(/\D/g, ''))} placeholder="비밀번호 확인" className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-100 text-center tracking-[0.3em] outline-none focus:border-amber-400" />
                  <div className="flex gap-2">
                    <button onClick={resetPinForm} className="flex-1 py-2 rounded-full border border-background-300 text-xs text-foreground-600 cursor-pointer whitespace-nowrap">취소</button>
                    <button onClick={handleSetupPin} disabled={!pinNew || !pinNewConfirm || pinSaving} className="flex-1 py-2 rounded-full bg-amber-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap">
                      {pinSaving ? '저장 중...' : '설정하기'}
                    </button>
                  </div>
                </div>
              )}

              {pinMode === 'change' && (
                <div className="mt-3 space-y-2">
                  <input type="password" inputMode="numeric" maxLength={6} value={pinCurrent} onChange={e => setPinCurrent(e.target.value.replace(/\D/g, ''))} placeholder="현재 비밀번호" className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-100 text-center tracking-[0.3em] outline-none focus:border-amber-400" />
                  <input type="password" inputMode="numeric" maxLength={6} value={pinNew} onChange={e => setPinNew(e.target.value.replace(/\D/g, ''))} placeholder="새 비밀번호" className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-100 text-center tracking-[0.3em] outline-none focus:border-amber-400" />
                  <input type="password" inputMode="numeric" maxLength={6} value={pinNewConfirm} onChange={e => setPinNewConfirm(e.target.value.replace(/\D/g, ''))} placeholder="새 비밀번호 확인" className="w-full px-4 py-2.5 text-sm rounded-[13px] border border-background-200 bg-background-100 text-center tracking-[0.3em] outline-none focus:border-amber-400" />
                  <div className="flex gap-2">
                    <button onClick={resetPinForm} className="flex-1 py-2 rounded-full border border-background-300 text-xs text-foreground-600 cursor-pointer whitespace-nowrap">취소</button>
                    <button onClick={handleChangePin} disabled={!pinCurrent || !pinNew || !pinNewConfirm || pinSaving} className="flex-1 py-2 rounded-full bg-amber-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer whitespace-nowrap">
                      {pinSaving ? '저장 중...' : '변경하기'}
                    </button>
                  </div>
                </div>
              )}

              {pinMode === 'remove-confirm' && (
                <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
                  <p className="text-xs text-rose-700 mb-2">간편 비밀번호를 해제할까요? 다음부턴 이메일로 로그인해야 해요.</p>
                  <div className="flex gap-2">
                    <button onClick={resetPinForm} className="flex-1 py-2 rounded-full border border-background-300 text-xs text-foreground-600 cursor-pointer whitespace-nowrap">취소</button>
                    <button onClick={handleRemovePin} className="flex-1 py-2 rounded-full bg-rose-500 text-white text-xs font-semibold cursor-pointer whitespace-nowrap">해제하기</button>
                  </div>
                </div>
              )}

              {pinMessage && (
                <p className={`text-xs mt-2 ${pinMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {pinMessage.text}
                </p>
              )}
            </div>

            {/* Auto logout timeout setting */}
            <div className="bg-background-50 border border-background-200 rounded-[16px] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-foreground-950">자동 로그아웃 시간</label>
                  <p className="text-xs text-foreground-600 mt-0.5">
                    {hasPin
                      ? '일정 시간 활동이 없으면 자동으로 잠기며, 간편 비밀번호로 다시 열 수 있어요'
                      : '일정 시간 동안 활동이 없으면 자동으로 로그아웃됩니다'}
                  </p>
                </div>
                <select
                  value={autoLogoutMinutes ?? 30}
                  onChange={handleAutoLogoutChange}
                  className="px-3 py-2 rounded-xl border border-background-200 bg-background-100 text-sm focus:outline-none focus:border-primary-400 cursor-pointer appearance-none"
                >
                  <option value={1}>1분</option>
                  <option value={5}>5분</option>
                  <option value={10}>10분</option>
                  <option value={15}>15분</option>
                  <option value={30}>30분</option>
                  <option value={60}>1시간</option>
                  <option value={120}>2시간</option>
                  <option value={0}>안 함</option>
                </select>
              </div>
            </div>

            {/* Graduation Expected — teacher/chief only */}
            {(hasRole('teacher') || hasRole('chief')) && (
              <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-foreground-950">졸업 예정 여부</label>
                    <p className="text-xs text-foreground-600 mt-0.5">
                      체크하면 한국 나이와 관계없이 졸업 로드맵이 활성화됩니다
                    </p>
                  </div>
                  <button
                    onClick={() => setGraduationExpected(!graduationExpected)}
                    className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer ${
                      graduationExpected ? 'bg-amber-500' : 'bg-background-300'
                    }`}
                  >
                    <motion.div
                      animate={{ left: graduationExpected ? 'calc(100% - 1.625rem)' : '0.125rem' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 w-6 h-6 rounded-full bg-background-100 shadow-sm"
                    ></motion.div>
                  </button>
                </div>
              </div>
            )}

            {/* Bio */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">소개글</label>
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="자기소개를 간단히 적어보세요..." rows={3} maxLength={200} className="w-full px-4 py-3 text-sm rounded-[13px] border border-background-200 bg-background-50 focus:border-primary-400 outline-none resize-none" />
              <p className="text-xs text-foreground-500 mt-1">{bio.length}/200</p>
            </div>

            {/* Interests */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-2">관심사</label>
              <div className="flex flex-wrap gap-1.5">
                {INTERESTS_LIST.map(i => (
                  <button key={i} onClick={() => toggleInterest(i)} className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${interests.includes(i) ? 'bg-primary-500 text-white' : 'bg-background-200 text-foreground-600 hover:bg-background-300/60'}`}>
                    {i}
                  </button>
                ))}
              </div>
            </div>

            {/* Badge section */}
            <div>
              <label className="block text-sm font-medium text-foreground-950 mb-3">내 배지</label>
              {badgesLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 rounded-full border-2 border-amber-400 border-t-transparent animate-spin"></div>
                  <span className="ml-2 text-xs text-foreground-500">배지 불러오는 중...</span>
                </div>
              ) : badgesError ? (
                <div className="bg-background-50 rounded-xl border border-background-200 p-4 text-center">
                  <i className="ri-error-warning-line text-2xl text-accent-400 block mb-2"></i>
                  <p className="text-xs text-accent-600">{badgesError}</p>
                </div>
              ) : (
                <>
                  {(() => {
                    const total = completedMissions.length;
                    const cleaningCount = completedMissions.filter(m => m.category === 'cleaning').length;
                    const serviceCount = completedMissions.filter(m => m.category === 'service').length;
                    const mediaCount = completedMissions.filter(m => m.category === 'media').length;
                    const welcomeCount = completedMissions.filter(m => m.category === 'welcome').length;
                    const equipmentCount = completedMissions.filter(m => m.category === 'equipment').length;
                    const prayerCount = completedMissions.filter(m => m.category === 'prayer').length;
                    const praiseCount = completedMissions.filter(m => m.category === 'praise').length;
                    const educationCount = completedMissions.filter(m => m.category === 'education').length;

                    const earnedBadges = BADGE_DEFINITIONS.filter(b => {
                      if (typeof b.condition !== 'function') return false;
                      try {
                        return b.condition(total, cleaningCount, serviceCount, mediaCount, welcomeCount, equipmentCount, prayerCount, praiseCount, educationCount);
                      } catch {
                        return b.condition(total);
                      }
                    });

                    // Find next badge to earn
                    const nextBadge = BADGE_DEFINITIONS.find(b => !earnedBadges.includes(b));
                    const nextBadgeProgress = nextBadge ? (() => {
                      if (nextBadge.id === 'first_step') return { current: total, target: 1, label: '첫 발걸음' };
                      if (nextBadge.id === 'faithful_hand') return { current: total, target: 5, label: '성실한 손' };
                      if (nextBadge.id === 'cleaning_guardian') return { current: cleaningCount, target: 3, label: '학관 지킴이' };
                      if (nextBadge.id === 'servant_heart') return { current: serviceCount, target: 3, label: '섬김의 마음' };
                      if (nextBadge.id === 'ten_missions') return { current: total, target: 10, label: '열 걸음' };
                      if (nextBadge.id === 'media_star') return { current: mediaCount, target: 2, label: '미디어 스타' };
                      if (nextBadge.id === 'welcome_angel') return { current: welcomeCount, target: 2, label: '환영 천사' };
                      return null;
                    })() : null;

                    return (
                      <div className="space-y-3">
                        {/* Earned badges */}
                        {earnedBadges.length === 0 ? (
                          <div className="bg-background-50 rounded-xl border border-background-200 p-4 text-center">
                            <i className="ri-medal-line text-2xl text-foreground-300 block mb-2"></i>
                            <p className="text-xs text-foreground-500">아직 획득한 배지가 없어요</p>
                            <p className="text-xs text-foreground-400 mt-1">작은 사명을 완료하고 배지를 모아보세요!</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {earnedBadges.map(badge => (
                              <div
                                key={badge.id}
                                className={`rounded-xl border p-3 text-center ${badge.color}`}
                              >
                                <i className={`${badge.icon} text-lg block mb-1`}></i>
                                <p className="text-[10px] font-bold whitespace-nowrap">{badge.title}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Next badge progress */}
                        {nextBadgeProgress && (
                          <div className="bg-background-50 rounded-xl border border-background-200 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <i className="ri-medal-line text-foreground-400"></i>
                                <span className="text-xs font-medium text-foreground-700">
                                  다음 배지: <strong>{nextBadgeProgress.label}</strong>
                                </span>
                              </div>
                              <span className="text-xs text-foreground-500">
                                {nextBadgeProgress.current}/{nextBadgeProgress.target}
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-background-200 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-amber-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (nextBadgeProgress.current / nextBadgeProgress.target) * 100)}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                              ></motion.div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Save button */}
            <button onClick={handleSave} disabled={saving || !name.trim()} className="w-full py-3 rounded-full bg-primary-500 text-background-50 text-sm font-semibold hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">
              {saving ? '저장 중...' : '프로필 저장하기'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
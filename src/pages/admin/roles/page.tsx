import { formatKoreanDate, formatKoreanDateTime } from '@/lib/date';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, CLUB_LABELS } from '@/types/auth';
import type { UserRole, ClubType, AuditLogEntry } from '@/types/auth';
import type { AdminUserData } from '@/mocks/adminUsers';

const ALL_ROLES: UserRole[] = [
  'chief',
  'teacher',
  'president',
  'secretary',
  'treasurer',
  'service_manager',
  'recreation_manager',
  'education_manager',
  'sports_manager',
  'praise_manager',
  'planning_manager',
  'zone_leader',
  'assistant_zone_leader',
  'member',
];

const ALL_CLUBS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu', 'cheonhwarae_cheongmyeong'];

// 4대 동아리만 주 소속(Primary) 가능. 천화래/청명은 부 소속(Secondary) 전용
const PRIMARY_CLUBS: ClubType[] = ['saeullim', 'cheonjipoong', 'cheonjihu', 'munhwabu'];

const ROLE_COLORS: Record<UserRole, string> = {
  chief: 'bg-rose-100 text-rose-700',
  teacher: 'bg-indigo-100 text-indigo-700',
  president: 'bg-amber-100 text-amber-700',
  secretary: 'bg-emerald-100 text-emerald-700',
  treasurer: 'bg-emerald-100 text-emerald-700',
  service_manager: 'bg-sky-100 text-sky-700',
  recreation_manager: 'bg-orange-100 text-orange-700',
  education_manager: 'bg-teal-100 text-teal-700',
  sports_manager: 'bg-lime-100 text-lime-700',
  praise_manager: 'bg-pink-100 text-pink-700',
  planning_manager: 'bg-purple-100 text-purple-700',
  zone_leader: 'bg-cyan-100 text-cyan-700',
  assistant_zone_leader: 'bg-blue-100 text-blue-700',
  member: 'bg-gray-100 text-gray-600',
};

const ROLE_FILTERS: { key: string; label: string; roles: UserRole[] }[] = [
  { key: 'all', label: '전체', roles: ALL_ROLES },
  { key: 'executive', label: '회장단', roles: ['president', 'secretary', 'treasurer'] },
  { key: 'teacher', label: '교사', roles: ['teacher'] },
  { key: 'chief', label: '부장', roles: ['chief'] },
  { key: 'manager', label: '과장', roles: ['service_manager', 'recreation_manager', 'education_manager', 'sports_manager', 'praise_manager', 'planning_manager'] },
  { key: 'zone_leader', label: '구역장', roles: ['zone_leader'] },
  { key: 'assistant_zone_leader', label: '부구역장', roles: ['assistant_zone_leader'] },
  { key: 'member', label: '일반', roles: ['member'] },
];

const ROLE_GROUPS: { label: string; roles: UserRole[] }[] = [
  { label: '최고 관리자', roles: ['chief'] },
  { label: '지도 교사', roles: ['teacher'] },
  { label: '회장단', roles: ['president', 'secretary', 'treasurer'] },
  { label: '과장', roles: ['service_manager', 'recreation_manager', 'education_manager', 'sports_manager', 'praise_manager', 'planning_manager'] },
  { label: '구역장', roles: ['zone_leader'] },
  { label: '부구역장', roles: ['assistant_zone_leader'] },
  { label: '일반', roles: ['member'] },
];

export default function AdminRolesPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AdminUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [clubFilter, setClubFilter] = useState<ClubType | 'all'>('all');
  const [expelTarget, setExpelTarget] = useState<AdminUserData | null>(null);
  const [expelling, setExpelling] = useState(false);
  const [viewMode, setViewMode] = useState<'roles' | 'audit'>('roles');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [extraClubs, setExtraClubs] = useState<Record<string, string[]>>({});
  const [loadingExtraClubs, setLoadingExtraClubs] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setUsers((data as AdminUserData[]) || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to fetch users:', message);
      showToast('사용자 목록을 불러오지 못했습니다. 다시 시도해 주세요.', 'error');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const insertAuditLog = useCallback(async (targetUserId: string, targetUserName: string, action: 'expel' | 'restore') => {
    if (!profile) return;
    try {
      await supabase.from('audit_log').insert({
        target_user_id: targetUserId,
        target_user_name: targetUserName,
        action,
        performed_by: profile.user_id,
        performed_by_name: profile.name,
      });
    } catch (err: unknown) {
      console.error('Failed to insert audit log:', err);
    }
  }, [profile]);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAuditLogs((data as AuditLogEntry[]) || []);
    } catch (err: unknown) {
      console.error('Failed to fetch audit logs:', err);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'audit') {
      fetchAuditLogs();
    }
  }, [viewMode, fetchAuditLogs]);

  const updateUser = useCallback(async (userId: string, updates: Partial<AdminUserData>) => {
    setSaving(userId);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;

      setUsers(prev =>
        prev.map(u =>
          u.user_id === userId ? { ...u, ...updates, updated_at: new Date().toISOString() } : u
        )
      );
      showToast('변경사항이 저장되었습니다', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to update user:', err);
      showToast(`저장 실패: ${message}`, 'error');
    } finally {
      setSaving(null);
    }
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleExpel = async () => {
    if (!expelTarget) return;
    setExpelling(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_expelled: true, is_active: false, updated_at: new Date().toISOString() })
        .eq('user_id', expelTarget.user_id);

      if (error) throw error;

      await insertAuditLog(expelTarget.user_id, expelTarget.name, 'expel');

      setUsers(prev =>
        prev.map(u =>
          u.user_id === expelTarget.user_id
            ? { ...u, is_expelled: true, is_active: false, updated_at: new Date().toISOString() }
            : u
        )
      );
      showToast(`${expelTarget.name}님을 추방했습니다`, 'success');
      setExpelTarget(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to expel user:', err);
      showToast(`추방 실패: ${message}`, 'error');
    } finally {
      setExpelling(false);
    }
  };

  const handleRestore = async (targetUser: AdminUserData) => {
    setSaving(targetUser.user_id);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ is_expelled: false, is_active: true, updated_at: new Date().toISOString() })
        .eq('user_id', targetUser.user_id);

      if (error) throw error;

      await insertAuditLog(targetUser.user_id, targetUser.name, 'restore');

      setUsers(prev =>
        prev.map(u =>
          u.user_id === targetUser.user_id
            ? { ...u, is_expelled: false, is_active: true, updated_at: new Date().toISOString() }
            : u
        )
      );
      showToast(`${targetUser.name}님을 복원했습니다`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to restore user:', err);
      showToast(`복원 실패: ${message}`, 'error');
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter === 'expelled') return u.is_expelled;
    if (u.is_expelled) return false;
    if (roleFilter !== 'all') {
      const filter = ROLE_FILTERS.find(f => f.key === roleFilter);
      if (filter && !filter.roles.includes(u.role)) return false;
    }
    if (clubFilter !== 'all' && u.club !== clubFilter) return false;
    return true;
  });

  const getRoleFilterCount = (key: string) => {
    if (key === 'all') return users.filter(u => !u.is_expelled).length;
    if (key === 'expelled') return users.filter(u => u.is_expelled).length;
    const filter = ROLE_FILTERS.find(f => f.key === key);
    if (!filter) return 0;
    return users.filter(u => !u.is_expelled && filter.roles.includes(u.role)).length;
  };

  const formatDate = (dateStr: string) => {
    return formatKoreanDate(dateStr, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/ /g, '.');
  };

  const formatAuditDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const loadExtraClubs = useCallback(async () => {
    setLoadingExtraClubs(true);
    try {
      const { data } = await supabase.from('user_club_assignments').select('user_id, club');
      if (data) {
        const map: Record<string, string[]> = {};
        for (const entry of data) {
          if (!map[entry.user_id]) map[entry.user_id] = [];
          map[entry.user_id].push(entry.club);
        }
        setExtraClubs(map);
      }
    } catch { /* ignore */ }
    setLoadingExtraClubs(false);
  }, []);

  useEffect(() => {
    loadExtraClubs();
  }, [loadExtraClubs]);

  const addExtraClub = async (userId: string, club: string) => {
    try {
      await supabase.from('user_club_assignments').insert({ user_id: userId, club });
      setExtraClubs(prev => ({ ...prev, [userId]: [...(prev[userId] || []), club] }));
      showToast(`${CLUB_LABELS[club as ClubType] || club} 겸직이 추가되었습니다`, 'success');
    } catch {
      showToast('겸직 추가에 실패했습니다 (이미 지정되었을 수 있습니다)', 'error');
    }
  };

  const removeExtraClub = async (userId: string, club: string) => {
    try {
      await supabase.from('user_club_assignments').delete().eq('user_id', userId).eq('club', club);
      setExtraClubs(prev => ({ ...prev, [userId]: (prev[userId] || []).filter(c => c !== club) }));
      showToast('겸직이 해제되었습니다', 'success');
    } catch {
      showToast('겸직 해제에 실패했습니다', 'error');
    }
  };

  if (!profile || profile.role !== 'chief') {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-[20px] bg-accent-100 border border-accent-200 flex items-center justify-center mx-auto mb-4">
          <i className="ri-shield-flash-line text-2xl text-accent-600"></i>
        </div>
        <h1 className="text-xl font-bold text-foreground-950 mb-2">접근 권한이 없습니다</h1>
        <p className="text-foreground-600 text-sm">이 페이지는 부장만 접근할 수 있습니다</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 md:py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* 헤더 & 탭 전환 */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground-950 mb-1">
              {viewMode === 'roles' ? '권한 관리' : '추방 기록'}
            </h1>
            <p className="text-sm text-gray-500">
              {viewMode === 'roles' ? '사용자 역할과 소속을 관리합니다' : '추방 및 복원 작업 내역을 확인합니다'}
            </p>
          </div>
          <div className="flex items-center gap-1 bg-background-100 border border-background-200 rounded-full p-1">
            <button
              onClick={() => setViewMode('roles')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'roles' ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950'
              }`}
            >
              <i className="ri-shield-user-line mr-1.5"></i>
              권한 관리
            </button>
            <button
              onClick={() => setViewMode('audit')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                viewMode === 'audit' ? 'bg-secondary-100 text-secondary-700' : 'text-foreground-600 hover:text-foreground-950'
              }`}
            >
              <i className="ri-history-line mr-1.5"></i>
              추방 기록
            </button>
          </div>
        </div>

        {/* 권한 관리 뷰 */}
        {viewMode === 'roles' && (
          <>
            {/* 필터 영역 */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5 flex-wrap">
              <div className="flex items-center gap-1 bg-background-100 border border-background-200 rounded-full p-1 flex-wrap">
                {ROLE_FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setRoleFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                      roleFilter === f.key ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950'
                    }`}
                  >
                    {f.label} ({getRoleFilterCount(f.key)})
                  </button>
                ))}
                <span className="w-px h-5 bg-background-300/60 mx-0.5"></span>
                <button
                  onClick={() => setRoleFilter('expelled')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                    roleFilter === 'expelled' ? 'bg-accent-100 text-accent-700' : 'text-accent-600 hover:text-accent-700'
                  }`}
                >
                  추방됨 ({getRoleFilterCount('expelled')})
                </button>
              </div>

              <div className="flex items-center gap-1 bg-background-100 border border-background-200 rounded-full p-1">
                <button
                  onClick={() => setClubFilter('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                    clubFilter === 'all' ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950'
                  }`}
                >
                  전체 동아리
                </button>
                {ALL_CLUBS.map(c => (
                  <button
                    key={c}
                    onClick={() => setClubFilter(c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                      clubFilter === c ? 'bg-primary-100 text-primary-700' : 'text-foreground-600 hover:text-foreground-950'
                    }`}
                  >
                    {CLUB_LABELS[c].split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* 사용자 테이블 */}
            {loading ? (
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-12 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-primary-200 border-t-primary-500 animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-foreground-600">사용자 목록을 불러오는 중...</p>
              </div>
            ) : (
              <div className="bg-background-100 border border-background-200 rounded-[20px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-background-200 bg-background-200/70">
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">사용자</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">역할</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">동아리</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">구역</th>
                        <th className="text-center px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">활성</th>
                        <th className="text-right px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">수정일</th>
                        <th className="text-center px-3 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">
                          {roleFilter === 'expelled' ? '복원' : '추방'}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-16 text-center">
                            <div className="w-12 h-12 rounded-xl bg-background-200 flex items-center justify-center mx-auto mb-3">
                              <i className="ri-user-search-line text-foreground-500 text-xl"></i>
                            </div>
                            <p className="text-sm text-foreground-600">조건에 맞는 사용자가 없습니다</p>
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, i) => (
                          <UserRow
                            key={user.user_id}
                            user={user}
                            index={i}
                            isSaving={saving === user.user_id}
                            onUpdate={updateUser}
                            onExpel={(u) => setExpelTarget(u)}
                            onRestore={handleRestore}
                            isExpelledView={roleFilter === 'expelled'}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 권한 관리 안내 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="mt-5 bg-primary-100 rounded-[20px] p-5 border border-primary-200"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary-200 flex items-center justify-center shrink-0">
                  <i className="ri-information-line text-primary-700"></i>
                </div>
                <div>
                  <p className="text-sm font-medium text-primary-800 mb-1">권한 변경 시 주의사항</p>
                  <ul className="text-xs text-primary-700 space-y-0.5">
                    <li>&bull; 역할을 변경하면 해당 사용자의 대시보드와 접근 가능한 기능이 즉시 변경됩니다</li>
                    <li>&bull; 부장(chief) 역할은 최대 1명으로 유지하는 것을 권장합니다</li>
                    <li>&bull; 권한을 지정하지 않으면 자동으로 '일반 학생회원'으로 분류됩니다</li>
                    <li>&bull; 비활성화된 사용자는 로그인 후에도 제한된 기능만 이용할 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </motion.div>

            {/* 겸직 동아리 관리 — 천화래·청명(CA)만 4대 동아리와 겸직 가능한 특수 동아리이며,
                4대 동아리끼리는 서로 겸직할 수 없다(한 사람당 주 동아리는 하나) */}
            {viewMode === 'roles' && !loading && (
              <CAManager
                users={users}
                extraClubs={extraClubs}
                loadingExtraClubs={loadingExtraClubs}
                addExtraClub={addExtraClub}
                removeExtraClub={removeExtraClub}
                showToast={showToast}
              />
            )}

            {/* 동아리별 담당 교사 지정 (N:M - club_teachers) */}
            {viewMode === 'roles' && !loading && (
              <ClubTeacherManager
                users={users}
                showToast={showToast}
                fetchUsers={fetchUsers}
              />
            )}
          </>
        )}

        {/* 추방 기록 뷰 */}
        {viewMode === 'audit' && (
          <>
            {auditLoading ? (
              <div className="bg-background-100 border border-background-200 rounded-[20px] p-12 text-center">
                <div className="w-10 h-10 rounded-full border-2 border-secondary-200 border-t-secondary-500 animate-spin mx-auto mb-4"></div>
                <p className="text-sm text-foreground-600">추방 기록을 불러오는 중...</p>
              </div>
            ) : (
              <div className="bg-background-100 border border-background-200 rounded-[20px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-background-200 bg-background-200/70">
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">대상 사용자</th>
                        <th className="text-center px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">작업</th>
                        <th className="text-left px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">수행자</th>
                        <th className="text-right px-5 py-3.5 text-xs font-semibold text-foreground-600 uppercase tracking-wider">일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-5 py-16 text-center">
                            <div className="w-12 h-12 rounded-xl bg-background-200 flex items-center justify-center mx-auto mb-3">
                              <i className="ri-history-line text-foreground-500 text-xl"></i>
                            </div>
                            <p className="text-sm text-foreground-600">추방 기록이 없습니다</p>
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log, i) => (
                          <motion.tr
                            key={log.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.03 }}
                            className="border-b border-background-200 hover:bg-background-200/30 transition-colors"
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                  log.action === 'expel' ? 'bg-rose-100' : 'bg-emerald-100'
                                }`}>
                                  <span className={`text-xs font-bold ${
                                    log.action === 'expel' ? 'text-rose-600' : 'text-emerald-600'
                                  }`}>{log.target_user_name.charAt(0)}</span>
                                </div>
                                <span className="text-sm font-semibold text-foreground-950">{log.target_user_name}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                log.action === 'expel'
                                  ? 'bg-accent-100 text-accent-700'
                                  : 'bg-secondary-100 text-secondary-700'
                              }`}>
                                <i className={`${log.action === 'expel' ? 'ri-user-unfollow-line' : 'ri-arrow-go-back-line'}`}></i>
                                {log.action === 'expel' ? '추방' : '복원'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-sm text-foreground-700">{log.performed_by_name}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <span className="text-xs text-foreground-600">{formatAuditDate(log.created_at)}</span>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 추방 기록 안내 */}
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
                  <p className="text-sm font-medium text-secondary-800 mb-1">추방 기록 안내</p>
                  <ul className="text-xs text-secondary-700 space-y-0.5">
                    <li>&bull; 추방 및 복원 작업은 모두 이곳에 기록됩니다</li>
                    <li>&bull; 기록은 삭제할 수 없으며, 영구 보존됩니다</li>
                    <li>&bull; 추방된 사용자는 &apos;권한 관리&apos; 탭의 &apos;추방됨&apos; 필터에서 복원할 수 있습니다</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>

      {/* 추방 확인 모달 */}
      <AnimatePresence>
        {expelTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => { if (!expelling) setExpelTarget(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background-100 border border-background-200 rounded-[20px] w-full max-w-sm mx-4"
            >
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-[20px] bg-accent-100 flex items-center justify-center mx-auto mb-3">
                  <i className="ri-alert-line text-2xl text-accent-600"></i>
                </div>
                <h3 className="text-lg font-bold text-foreground-950 mb-1">정말 추방하시겠습니까?</h3>
                <p className="text-sm text-foreground-600">
                  <span className="font-semibold text-gray-700">{expelTarget.name}</span>님을 추방 처리합니다. 추방된 사용자는 &apos;추방됨&apos; 탭에서 복원할 수 있습니다.
                </p>
              </div>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setExpelTarget(null)}
                  disabled={expelling}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-background-200 text-sm font-medium text-foreground-700 hover:bg-background-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  취소
                </button>
                <button
                  onClick={handleExpel}
                  disabled={expelling}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-accent-500 text-sm font-medium text-background-50 hover:bg-accent-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                >
                  {expelling ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                      추방 중...
                    </>
                  ) : (
                    <>
                      <i className="ri-user-unfollow-line"></i>
                      추방하기
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

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

function CAManager({ users, extraClubs, loadingExtraClubs, addExtraClub, removeExtraClub, showToast }: {
  users: AdminUserData[];
  extraClubs: Record<string, string[]>;
  loadingExtraClubs: boolean;
  addExtraClub: (userId: string, club: string) => void;
  removeExtraClub: (userId: string, club: string) => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}) {
  const CA_CLUB = 'cheonhwarae_cheongmyeong' as ClubType;
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // CA 소속 단원들의 user_id 목록
  const caMemberIds = Object.entries(extraClubs)
    .filter(([_, clubs]) => clubs.includes(CA_CLUB))
    .map(([userId]) => userId);

  // CA 단원 객체 배열 (이름 태그 표시용, 교사 제외)
  const caMembers = users.filter(u =>
    caMemberIds.includes(u.user_id) && u.role !== 'teacher' && !u.is_expelled
  );

  // 추가 가능한 사용자 (교사 제외, 이미 CA 소속 제외, 추방 제외)
  const eligibleForCA = users.filter(u =>
    u.role !== 'teacher' && !u.is_expelled && !caMemberIds.includes(u.user_id)
  );

  const filteredSearch = eligibleForCA.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCA = (userId: string) => {
    addExtraClub(userId, CA_CLUB);
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleRemoveCA = (userId: string) => {
    removeExtraClub(userId, CA_CLUB);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.22 }}
      className="mt-5 bg-accent-50 rounded-[20px] p-5 border border-accent-100"
    >
      <div className="flex items-center gap-2 mb-3">
        <i className="ri-music-2-line text-accent-600"></i>
        <h3 className="text-sm font-bold text-accent-800">천화래와 청명 (CA) 겸직 관리</h3>
      </div>
      <p className="text-xs text-accent-600 mb-4">
        천화래·청명(찬양·밴드) 동아리는 전용 겸직 관리입니다. 교사는 CA 단원에 포함될 수 없습니다.
      </p>

      {loadingExtraClubs ? (
        <div className="text-center py-4"><span className="text-xs text-foreground-500">불러오는 중...</span></div>
      ) : (
        <>
          {/* 현재 CA 단원 칩 목록 */}
          <div className="mb-4">
            <p className="text-xs font-medium text-accent-700 mb-2">
              현재 CA 단원 ({caMembers.length}명)
            </p>
            {caMembers.length === 0 ? (
              <p className="text-xs text-foreground-400 bg-background-50 border border-dashed border-accent-200 rounded-xl px-3 py-2.5">
                아직 등록된 CA 단원이 없습니다
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {caMembers.map(m => (
                  <span
                    key={m.user_id}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full bg-background-50 border border-accent-200 text-accent-800 font-medium"
                  >
                    {m.name}
                    <button
                      onClick={() => handleRemoveCA(m.user_id)}
                      className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-rose-100 text-accent-400 hover:text-rose-600 cursor-pointer transition-colors"
                      title="CA에서 제거"
                    >
                      <i className="ri-close-line text-[10px]"></i>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* CA 단원 추가 검색 */}
          <div className="relative">
            <p className="text-xs font-medium text-accent-700 mb-2">CA 단원 추가</p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                  placeholder="이름으로 검색..."
                  className="w-full px-3 py-2 text-sm rounded-xl border border-accent-200 bg-background-50 focus:border-accent-400 outline-none text-foreground-800 placeholder:text-foreground-400"
                />
                {showDropdown && searchQuery && filteredSearch.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background-50 border border-accent-200 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                    {filteredSearch.map(u => (
                      <button
                        key={u.user_id}
                        onMouseDown={() => handleAddCA(u.user_id)}
                        className="w-full text-left px-3 py-2 text-sm text-foreground-700 hover:bg-accent-50 transition-colors cursor-pointer flex items-center gap-2"
                      >
                        <span className="w-6 h-6 rounded-full bg-accent-100 flex items-center justify-center text-[10px] font-bold text-accent-600 flex-shrink-0">
                          {u.name.charAt(0)}
                        </span>
                        <span>{u.name}</span>
                        <span className="text-xs text-foreground-400 ml-auto">{ROLE_LABELS[u.role]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && searchQuery && filteredSearch.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background-50 border border-accent-200 rounded-xl shadow-lg z-20 p-3">
                    <p className="text-xs text-foreground-400">검색 결과가 없습니다</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function ClubTeacherManager({ users, showToast, fetchUsers }: {
  users: AdminUserData[];
  showToast: (msg: string, type: 'success' | 'error') => void;
  fetchUsers: () => void | Promise<void>;
}) {
  const [clubTeacherMap, setClubTeacherMap] = useState<Record<string, { user_id: string; name: string }[]>>({});
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  const teachers = users.filter(u => u.role === 'teacher');

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const { data } = await supabase
        .from('club_teachers')
        .select('club, teacher_id');
      if (data) {
        const map: Record<string, { user_id: string; name: string }[]> = {};
        for (const entry of data) {
          const teacher = users.find(u => u.user_id === entry.teacher_id);
          if (!map[entry.club]) map[entry.club] = [];
          map[entry.club].push({ user_id: entry.teacher_id, name: teacher?.name || '알 수 없음' });
        }
        setClubTeacherMap(map);
      }
    } catch { /* ignore */ }
    setLoadingAssignments(false);
  };

  const addTeacher = async (club: ClubType, teacherId: string) => {
    if (!teacherId) return;
    const teacher = teachers.find(t => t.user_id === teacherId);
    if (!teacher) return;
    try {
      await supabase.from('club_teachers').insert({ club, teacher_id: teacherId });
      showToast(`${teacher.name} 선생님이 ${CLUB_LABELS[club]} 담당 교사로 지정되었습니다`, 'success');
      loadAssignments();
      fetchUsers();
    } catch {
      showToast('담당 교사 지정에 실패했습니다 (이미 지정되었을 수 있습니다)', 'error');
    }
  };

  const removeTeacher = async (club: ClubType, teacherId: string) => {
    const teacher = users.find(u => u.user_id === teacherId);
    try {
      await supabase.from('club_teachers').delete().eq('club', club).eq('teacher_id', teacherId);
      showToast(`${teacher?.name || ''} 선생님이 ${CLUB_LABELS[club]} 담당에서 해제되었습니다`, 'success');
      loadAssignments();
      fetchUsers();
    } catch {
      showToast('담당 교사 해제에 실패했습니다', 'error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.3 }}
      className="mt-5 bg-secondary-100 rounded-[20px] p-5 border border-secondary-200"
    >
      <div className="flex items-center gap-2 mb-4">
        <i className="ri-user-star-line text-secondary-600"></i>
        <h3 className="text-sm font-bold text-secondary-800">동아리별 담당 교사 지정 (다중 지정 가능)</h3>
      </div>
      <p className="text-xs text-secondary-600 mb-4">각 동아리에 여러 명의 담당 교사를 지정할 수 있습니다. 지정된 교사는 해당 동아리의 보고서와 출석을 확인할 수 있습니다.</p>

      {loadingAssignments ? (
        <div className="text-center py-4"><span className="text-xs text-foreground-500">불러오는 중...</span></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {ALL_CLUBS.map(club => {
            const assigned = clubTeacherMap[club] || [];
            return (
              <div key={club} className="bg-background-50 rounded-xl p-4 border border-secondary-200">
                <p className="text-sm font-bold text-foreground-800 mb-3">{CLUB_LABELS[club]}</p>

                {/* Assigned teachers */}
                {assigned.length > 0 ? (
                  <div className="space-y-1.5 mb-3">
                    {assigned.map(t => (
                      <div key={t.user_id} className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-medium text-emerald-700 truncate">{t.name}</span>
                        <button
                          onClick={() => removeTeacher(club, t.user_id)}
                          className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-rose-100 cursor-pointer text-rose-400 hover:text-rose-600 flex-shrink-0 ml-1"
                        >
                          <i className="ri-close-line text-xs"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-foreground-400 mb-2">지정된 교사 없음</p>
                )}

                {/* Add teacher dropdown - exclude teachers already assigned to other clubs */}
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) addTeacher(club, e.target.value); }}
                  className="w-full px-3 py-2 text-xs bg-background-50 border border-secondary-200 rounded-lg outline-none text-foreground-700 cursor-pointer"
                >
                  <option value="">+ 교사 추가</option>
                  {teachers
                    .filter(t => !assigned.some(a => a.user_id === t.user_id))
                    .filter(t => {
                      // 이미 다른 동아리에 배정된 교사는 제외
                      const otherClubAssignments = Object.entries(clubTeacherMap)
                        .filter(([c]) => c !== club)
                        .flatMap(([, assignedTeachers]) => assignedTeachers.map(at => at.user_id));
                      return !otherClubAssignments.includes(t.user_id);
                    })
                    .map(t => (
                      <option key={t.user_id} value={t.user_id}>{t.name}</option>
                    ))}
                </select>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function UserRow({
  user,
  index,
  isSaving,
  onUpdate,
  onExpel,
  onRestore,
  isExpelledView,
}: {
  user: AdminUserData;
  index: number;
  isSaving: boolean;
  onUpdate: (userId: string, updates: Partial<AdminUserData>) => void;
  onExpel: (user: AdminUserData) => void;
  onRestore: (user: AdminUserData) => void;
  isExpelledView: boolean;
}) {
  const [editing, setEditing] = useState<'role' | 'club' | 'zone' | null>(null);
  const [tempRole, setTempRole] = useState<UserRole>(user.role);
  const [tempClub, setTempClub] = useState<ClubType | undefined>(user.club);
  const [tempZone, setTempZone] = useState(user.zone || '');
  const [extraRoles, setExtraRoles] = useState<UserRole[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(false);

  useEffect(() => {
    async function loadExtra() {
      setLoadingExtra(true);
      try {
        const { data } = await supabase
          .from('user_role_assignments')
          .select('role')
          .eq('user_id', user.user_id);
        if (data) setExtraRoles(data.map((r: any) => r.role as UserRole));
      } catch { /* ignore */ }
      setLoadingExtra(false);
    }
    loadExtra();
  }, [user.user_id]);

  const handleRoleChange = (newRole: UserRole) => {
    setTempRole(newRole);
    setEditing(null);
    onUpdate(user.user_id, { role: newRole });
  };

  const handleClubChange = (newClub: ClubType) => {
    setTempClub(newClub);
    setEditing(null);
    onUpdate(user.user_id, { club: newClub });
  };

  const handleZoneSave = () => {
    setEditing(null);
    onUpdate(user.user_id, { zone: tempZone || undefined });
  };

  const handleActiveToggle = () => {
    onUpdate(user.user_id, { is_active: !user.is_active });
  };

  const addExtraRole = async (newRole: UserRole) => {
    if (!newRole || extraRoles.includes(newRole) || newRole === user.role) return;
    try {
      await supabase.from('user_role_assignments').insert({ user_id: user.user_id, role: newRole });
      setExtraRoles(prev => [...prev, newRole]);
    } catch (err) {
      console.error('Failed to add extra role:', err);
    }
  };

  const removeExtraRole = async (roleToRemove: UserRole) => {
    try {
      await supabase.from('user_role_assignments').delete().eq('user_id', user.user_id).eq('role', roleToRemove);
      setExtraRoles(prev => prev.filter(r => r !== roleToRemove));
    } catch (err) {
      console.error('Failed to remove extra role:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatKoreanDate(dateStr, { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/ /g, '.');
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={`border-b border-gray-50 hover:bg-gray-50/30 transition-colors ${
        !user.is_active ? 'opacity-50' : ''
      }`}
    >
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${ROLE_COLORS[user.role]} flex items-center justify-center shrink-0`}>
            <span className="text-xs font-bold">{user.name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">{user.name}</p>
            {!user.is_active && (
              <span className="text-xs text-rose-500">비활성</span>
            )}
          </div>
        </div>
      </td>

      <td className="px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-1">
          <div className="relative inline-block">
            {editing === 'role' ? (
              <select
                value={tempRole}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                onBlur={() => setEditing(null)}
                autoFocus
                disabled={isSaving}
                className="text-sm font-medium px-2.5 py-1.5 rounded-lg border border-rose-200 bg-background-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 cursor-pointer"
              >
                {ROLE_GROUPS.map((group, gi) => (
                  <optgroup key={gi} label={group.label}>
                    {group.roles.map(r => (
                      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            ) : (
              <button
                onClick={() => {
                  setTempRole(user.role);
                  setEditing('role');
                }}
                disabled={isSaving}
                className={`text-sm font-medium px-2.5 py-1.5 rounded-full ${ROLE_COLORS[user.role]} cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap`}
              >
                {ROLE_LABELS[user.role]}
                {isSaving ? (
                  <span className="ml-1.5 inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin align-middle"></span>
                ) : (
                  <i className="ri-arrow-down-s-line ml-1 text-xs opacity-60"></i>
                )}
              </button>
            )}
          </div>
          {/* Extra roles tags */}
          {!loadingExtra && extraRoles.map(r => (
            <span key={r} className={`inline-flex items-center gap-0.5 text-xs font-medium px-2 py-1 rounded-full ${ROLE_COLORS[r]} whitespace-nowrap`}>
              {ROLE_LABELS[r]}
              <button onClick={() => removeExtraRole(r)} className="hover:opacity-70 cursor-pointer ml-0.5">
                <i className="ri-close-line text-[10px]"></i>
              </button>
            </span>
          ))}
          {/* Add extra role dropdown */}
          <div className="relative inline-block">
            <select
              value=""
              onChange={(e) => { if (e.target.value) addExtraRole(e.target.value as UserRole); }}
              className="text-xs px-1.5 py-1 rounded-full border border-dashed border-gray-300 bg-transparent text-gray-400 hover:text-gray-600 hover:border-gray-400 cursor-pointer appearance-none w-7 h-7 text-center"
              title="겸직 추가"
            >
              <option value="">+</option>
              {ALL_ROLES.filter(r => r !== user.role && !extraRoles.includes(r)).map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
        </div>
      </td>

      <td className="px-5 py-3.5">
        {editing === 'club' ? (
          <select
            value={tempClub || ''}
            onChange={(e) => handleClubChange(e.target.value as ClubType)}
            onBlur={() => setEditing(null)}
            autoFocus
            disabled={isSaving}
            className="text-sm px-2.5 py-1.5 rounded-lg border border-rose-200 bg-background-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200 cursor-pointer"
          >
            {PRIMARY_CLUBS.map(c => (
              <option key={c} value={c}>{CLUB_LABELS[c]}</option>
            ))}
          </select>
        ) : user.club ? (
          <button
            onClick={() => {
              setTempClub(user.club);
              setEditing('club');
            }}
            disabled={isSaving}
            className="text-sm text-gray-600 hover:text-gray-800 cursor-pointer transition-colors flex items-center gap-1 group"
          >
            {CLUB_LABELS[user.club as ClubType]}
            <i className="ri-arrow-down-s-line text-xs text-gray-300 group-hover:text-gray-400"></i>
          </button>
        ) : (
          <button
            onClick={() => {
              setTempClub(undefined);
              setEditing('club');
            }}
            disabled={isSaving}
            className="text-sm text-gray-300 hover:text-gray-500 cursor-pointer transition-colors"
          >
            지정 안됨 <i className="ri-arrow-down-s-line text-xs"></i>
          </button>
        )}
      </td>

      <td className="px-5 py-3.5">
        {editing === 'zone' ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={tempZone}
              onChange={(e) => setTempZone(e.target.value)}
              onBlur={handleZoneSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleZoneSave(); }}
              autoFocus
              disabled={isSaving}
              placeholder="구역 입력"
              maxLength={20}
              className="text-sm w-24 px-2 py-1 rounded-lg border border-rose-200 bg-background-100 text-gray-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
            />
          </div>
        ) : (
          <button
            onClick={() => {
              setTempZone(user.zone || '');
              setEditing('zone');
            }}
            disabled={isSaving}
            className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors group flex items-center gap-1"
          >
            {user.zone || <span className="text-gray-300">미지정</span>}
            <i className="ri-pencil-line text-xs text-gray-300 group-hover:text-gray-400"></i>
          </button>
        )}
      </td>

      <td className="px-5 py-3.5 text-center">
        <button
          onClick={handleActiveToggle}
          disabled={isSaving}
          className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
            user.is_active ? 'bg-emerald-400' : 'bg-gray-200'
          }`}
        >
          <motion.div
            animate={{ x: user.is_active ? 18 : 2 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="w-4 h-4 rounded-full bg-background-100 shadow-sm absolute top-0.5"
          ></motion.div>
        </button>
      </td>

      <td className="px-5 py-3.5 text-right">
        <span className="text-xs text-gray-400">{formatDate(user.updated_at)}</span>
      </td>

      <td className="px-3 py-3.5 text-center">
        {isExpelledView ? (
          <button
            onClick={() => onRestore(user)}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
          >
            {isSaving ? (
              <span className="w-3 h-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></span>
            ) : (
              <i className="ri-arrow-go-back-line"></i>
            )}
            복원
          </button>
        ) : user.role !== 'chief' ? (
          <button
            onClick={() => onExpel(user)}
            disabled={isSaving}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
            title="추방"
          >
            <i className="ri-user-unfollow-line"></i>
          </button>
        ) : null}
      </td>
    </motion.tr>
  );
}
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { CategoryChipRow, CategoryChip } from '@/components/base/CategoryChip';

interface ConnectionInfo {
  id: string;
  section: string;
  title: string;
  content: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
}

const SECTIONS = [
  { key: 'youth_group', label: '청년부 안내', icon: 'ri-group-line', color: 'sky' },
  { key: 'college_ministry', label: '대학부 안내', icon: 'ri-building-line', color: 'violet' },
  { key: 'procedure', label: '연계 절차', icon: 'ri-guide-line', color: 'amber' },
  { key: 'contacts', label: '연락처', icon: 'ri-phone-line', color: 'emerald' },
];

export default function SeniorConnection() {
  const { user, hasRole } = useAuth();
  const isTeacherOrChief = hasRole('teacher') || hasRole('chief');

  const [infoItems, setInfoItems] = useState<ConnectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('youth_group');

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSection, setEditSection] = useState('youth_group');
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await supabase.from('senior_connection_info').select('*').order('sort_order');
      setInfoItems((data || []) as ConnectionInfo[]);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const filteredItems = infoItems.filter(i => i.section === activeTab);

  const openEditor = (item?: ConnectionInfo) => {
    if (item) {
      setEditingId(item.id);
      setEditSection(item.section);
      setEditTitle(item.title);
      setEditContent(item.content);
      setEditImageUrl(item.image_url || '');
      setEditLinkUrl(item.link_url || '');
    } else {
      setEditingId(null);
      setEditSection(activeTab);
      setEditTitle('');
      setEditContent('');
      setEditImageUrl('');
      setEditLinkUrl('');
    }
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('senior_connection_info').update({
          section: editSection,
          title: editTitle.trim(),
          content: editContent.trim(),
          image_url: editImageUrl.trim() || null,
          link_url: editLinkUrl.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        }).eq('id', editingId);
      } else {
        await supabase.from('senior_connection_info').insert({
          section: editSection,
          title: editTitle.trim(),
          content: editContent.trim(),
          image_url: editImageUrl.trim() || null,
          link_url: editLinkUrl.trim() || null,
          sort_order: infoItems.length,
          updated_by: user?.id,
        });
      }
      loadData();
      setShowEditor(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('senior_connection_info').delete().eq('id', id);
    loadData();
  };

  const sectionColors: Record<string, { active: string; tab: string }> = {
    sky: { active: 'bg-sky-100 text-sky-700', tab: 'text-foreground-600' },
    violet: { active: 'bg-violet-100 text-violet-700', tab: 'text-foreground-600' },
    amber: { active: 'bg-amber-100 text-amber-700', tab: 'text-foreground-600' },
    emerald: { active: 'bg-emerald-100 text-emerald-700', tab: 'text-foreground-600' },
  };

  const activeSection = SECTIONS.find(s => s.key === activeTab);

  if (loading) {
    return (
      <div className="min-h-screen bg-background-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-6">
            <Link to="/senior" className="inline-flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground-700 cursor-pointer mb-4">
              <i className="ri-arrow-left-line"></i> 고3구역
            </Link>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-gradient-to-br from-sky-100 to-violet-100 border border-sky-200 mb-5">
              <i className="ri-link text-3xl text-sky-600"></i>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">졸업 후 연계 안내</h1>
            <p className="text-sm text-foreground-600">청년부·대학부 연계 절차와 정보를 확인하세요</p>
          </div>

          {/* ===== PC (md 이상) — 기존 탭 그대로 ===== */}
          <div className="hidden md:flex items-center gap-2 mb-6 overflow-x-auto pb-1 flex-wrap">
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveTab(s.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${activeTab === s.key ? 'bg-sky-500 text-white' : 'bg-background-100 text-foreground-600 border border-background-200 hover:border-sky-300'}`}
              >
                <i className={`${s.icon} mr-1`}></i>{s.label}
              </button>
            ))}
          </div>

          {/* ===== 모바일 (md 미만) — 가로 스크롤 칩 ===== */}
          <div className="md:hidden mb-5">
            <CategoryChipRow>
              {SECTIONS.map((s) => (
                <CategoryChip key={s.key} active={activeTab === s.key} onClick={() => setActiveTab(s.key)}>
                  <i className={`${s.icon} mr-1`}></i>{s.label}
                </CategoryChip>
              ))}
            </CategoryChipRow>
          </div>

          {isTeacherOrChief && (
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => openEditor()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 transition-colors cursor-pointer whitespace-nowrap">
                <i className="ri-add-line"></i> 내용 추가
              </button>
            </div>
          )}

          {/* Content */}
          <div className="space-y-4">
            {filteredItems.length === 0 ? (
              <div className="text-center py-16 bg-background-100 border border-background-200 rounded-2xl">
                <div className="w-14 h-14 rounded-xl bg-sky-100 flex items-center justify-center mx-auto mb-4">
                  <i className={`${activeSection?.icon || 'ri-information-line'} text-2xl text-sky-500`}></i>
                </div>
                <p className="text-sm text-foreground-600">아직 등록된 내용이 없어요</p>
                {isTeacherOrChief && (
                  <button onClick={() => openEditor()} className="mt-3 text-sm text-sky-600 font-medium cursor-pointer">내용 추가하기</button>
                )}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="bg-background-100 border-0 md:border md:border-background-200 rounded-[20px] md:rounded-2xl shadow-card md:shadow-none overflow-hidden group">
                  <div className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-base font-bold text-foreground-950 mb-2">{item.title}</h3>
                        <p className="text-sm text-foreground-700 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                      </div>
                      {isTeacherOrChief && (
                        <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-3">
                          <button onClick={() => openEditor(item)} className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-400 hover:text-foreground-700 hover:bg-background-100 cursor-pointer">
                            <i className="ri-edit-line text-sm"></i>
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-foreground-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                            <i className="ri-delete-bin-line text-sm"></i>
                          </button>
                        </div>
                      )}
                    </div>
                    {item.link_url && (
                      <a href={item.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-sm text-sky-600 hover:text-sky-700 font-medium cursor-pointer">
                        <i className="ri-external-link-line"></i> 자세히 보기
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowEditor(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-background-100 border border-background-200 rounded-2xl p-6 max-w-md w-full max-h-[85dvh] max-h-[85vh] overflow-y-auto mobile-safe-modal" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-foreground-950 mb-4">{editingId ? '내용 수정' : '새 내용 추가'}</h3>
              <div className="space-y-3">
                <select value={editSection} onChange={e => setEditSection(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none cursor-pointer">
                  {SECTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="제목" maxLength={100} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-sky-400" />
                <textarea value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="내용" rows={5} maxLength={2000} className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none focus:border-sky-400 resize-none" />
                <input type="text" value={editImageUrl} onChange={e => setEditImageUrl(e.target.value)} placeholder="이미지 URL (선택)" className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none" />
                <input type="text" value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)} placeholder="링크 URL (선택)" className="w-full px-4 py-2.5 text-sm rounded-xl border border-background-200 outline-none" />
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button onClick={handleSave} disabled={!editTitle.trim() || !editContent.trim() || saving} className="px-5 py-2.5 rounded-full bg-sky-500 text-white text-sm font-semibold hover:bg-sky-600 disabled:opacity-40 cursor-pointer whitespace-nowrap">
                  {saving ? '저장 중...' : editingId ? '수정하기' : '추가하기'}
                </button>
                <button onClick={() => setShowEditor(false)} className="text-sm text-foreground-500 cursor-pointer">취소</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
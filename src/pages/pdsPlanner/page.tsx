import { useState } from 'react';
import { motion } from 'framer-motion';
import { generatePlan } from '@/lib/nvidiaNim';
import type { PDSChecklist, PDSItem } from '@/lib/nvidiaNim';
import { notifyUser } from '@/lib/mobileFeedback';

type TabKey = 'plan' | 'do' | 'see';

const TAB_CONFIG: { key: TabKey; label: string; icon: string; desc: string; deadlinePrefix: string }[] = [
  { key: 'plan', label: 'Plan', icon: 'ri-file-list-3-line', desc: '준비 단계', deadlinePrefix: 'D-' },
  { key: 'do', label: 'Do', icon: 'ri-rocket-line', desc: '실행 단계', deadlinePrefix: 'D-Day' },
  { key: 'see', label: 'See', icon: 'ri-bar-chart-line', desc: '평가 단계', deadlinePrefix: 'D+' },
];

const PRIORITY_CONFIG = {
  high: { label: '필수', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  medium: { label: '중요', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: '보통', color: 'bg-background-200 text-foreground-600 border-background-300' },
};

export default function PdsPlanner() {
  const [purpose, setPurpose] = useState('');
  const [checklist, setChecklist] = useState<PDSChecklist | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('plan');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [celebrateItem, setCelebrateItem] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!purpose.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const result = await generatePlan(purpose.trim());
      setChecklist(result);
      setActiveTab('plan');
      setCheckedItems({});
    } catch (err) {
      setError(err instanceof Error ? err.message : '체크리스트 생성에 실패했어요');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (section: TabKey, idx: number) => {
    const key = `${section}-${idx}`;
    const nextChecked = !checkedItems[key];
    setCheckedItems(prev => ({ ...prev, [key]: nextChecked }));
    if (nextChecked) {
      setCelebrateItem(key);
      setTimeout(() => setCelebrateItem(null), 800);
    }
  };

  const currentList = checklist ? checklist[activeTab] : [];
  const checkedCount = currentList.filter((_, idx) => checkedItems[`${activeTab}-${idx}`]).length;

  const allItems = checklist ? [...checklist.plan, ...checklist.do, ...checklist.see] : [];
  const allChecked = allItems.filter((_, idx) => {
    const planLen = checklist?.plan.length || 0;
    const doLen = checklist?.do.length || 0;
    if (idx < planLen) return checkedItems[`plan-${idx}`];
    if (idx < planLen + doLen) return checkedItems[`do-${idx - planLen}`];
    return checkedItems[`see-${idx - planLen - doLen}`];
  }).length;

  const totalProgress = allItems.length > 0 ? Math.round((allChecked / allItems.length) * 100) : 0;

  const getTabProgress = (tab: TabKey) => {
    const list = checklist ? checklist[tab] : [];
    const checked = list.filter((_, idx) => checkedItems[`${tab}-${idx}`]).length;
    return list.length > 0 ? Math.round((checked / list.length) * 100) : 0;
  };

  const exportToText = async () => {
    if (!checklist) return;
    let text = `${purpose} - 행사 기획 체크리스트\n\n`;
    TAB_CONFIG.forEach(tab => {
      text += `[${tab.label} - ${tab.desc}]\n`;
      checklist[tab.key].forEach((item, i) => {
        const check = checkedItems[`${tab.key}-${i}`] ? '[완료]' : '[  ]';
        text += `${check} ${item.text} (${item.priority}, ${item.assignee || '미정'}, ${item.deadline || '-'})\n`;
      });
      text += '\n';
    });

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      notifyUser('체크리스트가 복사되었어요!');
    } catch {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        textarea.setSelectionRange(0, text.length);
        const copied = document.execCommand('copy');
        textarea.remove();
        if (copied) {
          notifyUser('체크리스트가 복사되었어요!');
          return;
        }
      } catch {
        // fallback도 실패하면 안내 메시지로 종료
      }
      notifyUser('복사에 실패했어요. 텍스트를 길게 눌러 직접 복사해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-background-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] bg-primary-100 border border-primary-200 mb-5">
            <i className="ri-todo-line text-3xl text-primary-600"></i>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground-950 mb-2">행사 기획 마법사</h1>
          <p className="text-sm text-foreground-600">
            Plan-Do-See 프레임워크로 행사 기획을 체계적으로 준비하세요
          </p>
        </motion.div>

        {/* Input */}
        {!checklist && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8"
          >
            <label className="block text-sm font-semibold text-foreground-700 mb-3">
              어떤 행사를 기획하고 있나요?
            </label>
            <textarea
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="예) 교사 초청 감사 예배, 동아리 발표회, 여름 수련회, 성탄절 특별예배..."
              maxLength={1000}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-background-200 bg-background-50 focus:border-primary-400 outline-none transition-all resize-none text-sm text-foreground-950 mb-3"
            />
            <p className="text-xs text-foreground-500 mb-4">{purpose.length}/1000</p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-accent-100 border border-accent-200 text-sm text-accent-700 flex items-start gap-2">
                <i className="ri-error-warning-line mt-0.5 flex-shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!purpose.trim() || isLoading}
              className="w-full py-3.5 rounded-[20px] bg-primary-500 text-background-50 font-semibold text-base hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <i className={`${isLoading ? 'ri-loader-4-line animate-spin' : 'ri-magic-line'} text-lg`}></i>
              {isLoading ? 'AI가 체크리스트를 만들고 있어요...' : '체크리스트 생성하기'}
            </button>
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-10 md:p-14 text-center max-w-sm w-full mx-4">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full border-4 border-primary-200 animate-ping"></div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-400 animate-spin border-t-transparent"></div>
                <div className="absolute inset-2 rounded-full bg-primary-100 flex items-center justify-center">
                  <i className="ri-file-list-3-line text-3xl text-primary-600"></i>
                </div>
              </div>
              <p className="text-lg font-semibold text-foreground-950 mb-2">체크리스트 생성 중</p>
              <p className="text-sm text-foreground-600">AI가 꼼꼼하게 기획서를 작성하고 있어요</p>
            </div>
          </div>
        )}

        {/* Result with Tab */}
        {checklist && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Progress */}
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-5 mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-foreground-700">전체 진행률</span>
                <span className="text-sm font-bold text-primary-600">{totalProgress}%</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-background-200 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${totalProgress}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                ></motion.div>
              </div>
              {totalProgress === 100 && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center"
                >
                  <p className="text-sm font-bold text-emerald-700 flex items-center justify-center gap-1">
                    <i className="ri-check-double-line"></i> 모든 체크리스트를 완료했어요! 훌륭한 기획이에요!
                  </p>
                </motion.div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-5">
              {TAB_CONFIG.map(tab => {
                const isActive = activeTab === tab.key;
                const list = checklist[tab.key];
                const checked = list.filter((_, idx) => checkedItems[`${tab.key}-${idx}`]).length;
                const tabProgress = getTabProgress(tab.key);
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-2xl font-semibold text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-500 text-background-50 dark:text-foreground-950'
                        : 'bg-background-100 border border-background-200 text-foreground-600 hover:bg-background-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <i className={`${tab.icon} text-base`}></i>
                      <span>{tab.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1 rounded-full bg-background-200 overflow-hidden">
                        <div className="h-full rounded-full bg-current opacity-40" style={{ width: `${tabProgress}%` }}></div>
                      </div>
                      <span className={`text-[10px] px-1 py-0.5 rounded-full ${isActive ? 'bg-background-50/20' : 'bg-background-200'}`}>
                        {checked}/{list.length}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Timeline header */}
            <div className="bg-background-100 border border-background-200 rounded-[20px] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <i className={`${TAB_CONFIG.find(t => t.key === activeTab)?.icon} text-xl text-primary-600`}></i>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground-950">{TAB_CONFIG.find(t => t.key === activeTab)?.label}</p>
                  <p className="text-xs text-foreground-500">{TAB_CONFIG.find(t => t.key === activeTab)?.desc} · {checkedCount}/{currentList.length} 완료</p>
                </div>
              </div>

              {/* Timeline items */}
              <div className="relative">
                <div className="absolute left-3 top-2 bottom-2 w-px bg-background-200"></div>
                <div className="space-y-3">
                  {currentList.map((item: PDSItem, idx: number) => {
                    const isChecked = checkedItems[`${activeTab}-${idx}`] || false;
                    const isCelebrating = celebrateItem === `${activeTab}-${idx}`;
                    const priority = item.priority || 'medium';
                    const config = PRIORITY_CONFIG[priority];
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0, scale: isCelebrating ? [1, 1.03, 1] : 1 }}
                        transition={{ duration: 0.2, delay: idx * 0.04 }}
                        className={`relative pl-8 ${isChecked ? 'opacity-70' : ''}`}
                      >
                        <div className={`absolute left-0 top-3 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 cursor-pointer transition-colors ${
                          isChecked ? 'border-emerald-400 bg-emerald-500' : 'border-background-300 bg-background-50 hover:border-primary-300'
                        }`}
                          onClick={() => toggleItem(activeTab, idx)}
                        >
                          {isChecked && <i className="ri-check-line text-white text-xs"></i>}
                        </div>
                        <button
                          onClick={() => toggleItem(activeTab, idx)}
                          className={`w-full text-left flex flex-col gap-1.5 p-3.5 rounded-xl transition-all duration-200 cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-50/50 border border-emerald-100'
                              : 'bg-background-50 border border-background-200 hover:border-primary-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-sm leading-relaxed ${isChecked ? 'text-foreground-500 line-through' : 'text-foreground-800'}`}>
                              {item.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-medium ${config.color}`}>
                              {config.label}
                            </span>
                            {item.assignee && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-background-200 text-foreground-600 font-medium">
                                <i className="ri-user-line mr-0.5"></i>{item.assignee}
                              </span>
                            )}
                            {item.deadline && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary-50 text-primary-700 font-medium">
                                <i className="ri-time-line mr-0.5"></i>{item.deadline}
                              </span>
                            )}
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <button
                onClick={() => { setChecklist(null); setPurpose(''); setCheckedItems({}); }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-background-200 text-foreground-600 font-semibold text-sm hover:bg-background-100 transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-arrow-left-line"></i>
                새로 만들기
              </button>
              <button
                onClick={() => handleGenerate()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary-500 text-background-50 font-semibold text-sm hover:bg-primary-600 disabled:opacity-40 transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-refresh-line"></i>
                다시 생성
              </button>
              <button
                onClick={exportToText}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-primary-200 text-primary-700 font-semibold text-sm hover:bg-primary-50 transition-all cursor-pointer whitespace-nowrap"
              >
                <i className="ri-file-copy-line"></i>
                복사하기
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

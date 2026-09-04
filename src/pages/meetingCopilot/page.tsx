import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// ── 타입 ──

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

interface SavedIdea {
  id: string;
  content: string;
  created_at: string;
}

interface MeetingListItem {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  summary: string;
  decisions: string[];
  issues: string[];
  unresolvedItems: string[];
  tags: string[];
}

// ── 퀵 액션 (소스가 1개 이상 선택됐을 때) ──

const SOURCE_QUICK_ACTIONS = [
  { label: '전체 요약', icon: 'ri-file-list-3-line', prompt: '선택한 소스(회의록)들의 내용을 종합해서 핵심만 요약해줘.' },
  { label: 'Action Item 추출', icon: 'ri-list-check-3', prompt: '선택한 소스들을 바탕으로 구체적인 Action Item을 담당자와 기한 포함해서 도출해줘. 어느 소스에서 나온 항목인지도 표시해줘.' },
  { label: '논의 궤도 확인', icon: 'ri-compass-line', prompt: '지금까지의 대화가 선택한 소스의 원래 안건에서 벗어나지 않았는지 점검해줘.' },
  { label: '리스크 검토', icon: 'ri-error-warning-line', prompt: '선택한 소스에 담긴 결정/이슈의 잠재적 리스크를 검토해줘.' },
];

const NO_SOURCE_QUICK_ACTIONS = [
  { label: '예산안 작성', prompt: '이 상황에 맞는 예산안 초안을 작성해줘. 항목별 예상 비용도 포함해줘.' },
  { label: '아이디어 발굴', prompt: '이 상황을 해결할 수 있는 아이디어를 2-3가지 방향으로 제안해줘.' },
];

// ── 메시지 버블 ──

function MessageBubble({
  message,
  formatTime,
  isStreaming,
  onSaveIdea,
  profileName,
}: {
  message: ChatMessage;
  formatTime: (d: string) => string;
  isStreaming?: boolean;
  onSaveIdea: (content: string) => void;
  profileName: string;
}) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-amber-100' : 'bg-gradient-to-br from-primary-500 to-violet-500'
      }`}>
        {isUser ? (
          <span className="text-xs font-bold text-amber-700">{profileName.charAt(0)}</span>
        ) : (
          <i className="ri-robot-2-fill text-white text-sm"></i>
        )}
      </div>

      <div className={`group max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-primary-500 text-white rounded-tr-md'
            : 'bg-background-100 text-foreground-800 rounded-tl-md border border-background-200 shadow-sm'
        }`}>
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary-500 ml-0.5 animate-pulse rounded-sm align-middle"></span>
          )}
        </div>

        {!isUser && !isStreaming && message.id !== 'welcome' && (
          <div className="flex items-center gap-1 mt-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onSaveIdea(message.content.slice(0, 300))}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              <i className="ri-pushpin-line"></i>
              아이디어 저장
            </button>
          </div>
        )}

        <p className={`text-[10px] text-foreground-400 mt-0.5 ${isUser ? 'text-right' : ''}`}>
          {formatTime(message.created_at)}
        </p>
      </div>
    </motion.div>
  );
}

// ── 메인 페이지 ──
// 노트북LM 스타일: 왼쪽에서 "소스"(회의록)를 여러 개 골라 담고,
// 그 소스 안에서만 근거를 찾아 답하는 채팅. 소스를 하나도 안 고르면
// "자유 상담" 모드로 자동 전환된다 — 별도 모드 토글 없이 자연스럽게.

export default function MeetingCopilotPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 소스(회의록) 목록 + 선택
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [meetingsError, setMeetingsError] = useState('');
  const [meetingSearch, setMeetingSearch] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>(() => {
    const fromUrl = searchParams.get('meetingId');
    return fromUrl ? [fromUrl] : [];
  });
  const [mobileSourcesOpen, setMobileSourcesOpen] = useState(false);

  // 대화 (소스 조합이 바뀌면 새 대화로 리셋 — 세션 내 로컬 상태)
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [situationContext, setSituationContext] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState('');
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  const [showIdeas, setShowIdeas] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const selectedSources = useMemo(
    () => meetings.filter(m => selectedSourceIds.includes(m.id)),
    [meetings, selectedSourceIds]
  );
  const hasSources = selectedSourceIds.length > 0;

  // ── 회의(소스) 목록 로드 ──
  useEffect(() => {
    const load = async () => {
      setMeetingsLoading(true);
      setMeetingsError('');
      try {
        const { data, error: fetchErr } = await supabase
          .from('meeting_minutes')
          .select('*')
          .order('date', { ascending: false });

        if (fetchErr) throw fetchErr;

        const list: MeetingListItem[] = (data || []).map((m: Record<string, unknown>) => ({
          id: m.id as string,
          title: m.title as string,
          date: m.date as string,
          attendees: (m.attendees as string[]) || [],
          summary: (m.summary as string) || '',
          decisions: (m.decisions as string[]) || [],
          issues: (m.issues as string[]) || [],
          unresolvedItems: (m.unresolved_items as string[]) || [],
          tags: (m.tags as string[]) || [],
        }));

        setMeetings(list);
      } catch {
        setMeetingsError('회의 목록을 불러오지 못했어요.');
      } finally {
        setMeetingsLoading(false);
      }
    };
    load();
  }, []);

  // ── 선택한 소스를 URL에 동기화 (뒤로가기/새로고침 대비, 1개일 때만 단순 반영) ──
  useEffect(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (selectedSourceIds.length === 1) {
        next.set('meetingId', selectedSourceIds[0]);
      } else {
        next.delete('meetingId');
      }
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceIds]);

  // ── 소스 조합이 바뀌면 대화를 새로 시작 (환영 메시지) ──
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      role: 'assistant',
      content:
        selectedSources.length === 0
          ? '안녕하세요! 왼쪽에서 소스로 쓸 회의록을 골라주세요. 여러 개를 골라도 돼요 — 고른 소스 안에 있는 내용만 근거로 답해드릴게요. 소스 없이 "현재 상황"만 적고 자유롭게 물어봐도 괜찮아요.'
          : `안녕하세요! 지금 소스로 "${selectedSources.map(s => s.title).join('", "')}" ${selectedSources.length > 1 ? `외 ${selectedSources.length}건` : ''}을 골라주셨네요. 이 안에서만 근거를 찾아 답할게요. 무엇이 궁금하세요?`,
      created_at: new Date().toISOString(),
    };
    setMessages([welcomeMsg]);
    setError('');
    setShowIdeas(false);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    setStreaming(false);
    setStreamingContent('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceIds.join(',')]);

  // ── 저장된 아이디어 로드 (선택된 소스 조합과 무관하게 사용자 전체 아이디어 보드) ──
  const loadSavedIdeas = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setSavedIdeas([]);
      return;
    }
    try {
      const { data } = await supabase
        .from('meeting_saved_ideas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) setSavedIdeas(data as SavedIdea[]);
    } catch {
      // 조용히 실패
    }
  }, [user?.id]);

  useEffect(() => {
    loadSavedIdeas();
  }, [loadSavedIdeas]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  const toggleSource = (id: string) => {
    setSelectedSourceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const clearSources = () => setSelectedSourceIds([]);

  // ── 스트리밍 전송 ──
  const handleSend = async (customPrompt?: string) => {
    const text = (customPrompt || input).trim();
    if (!text || streaming) return;

    let apiContent = text;
    if (!hasSources && situationContext.trim() && messages.length <= 1) {
      apiContent = `[현재 상황]\n${situationContext.trim()}\n\n[질문]\n${text}`;
    }

    const tempId = `temp-${Date.now()}`;
    const tempUserMsg: ChatMessage = {
      id: tempId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    const apiMessages = [...messages, { role: 'user', content: apiContent } as ChatMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    setMessages(prev => [...prev, tempUserMsg]);
    setInput('');
    setStreaming(true);
    setStreamingContent('');
    setError('');

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const authSession = await supabase.auth.getSession();
      const accessToken = authSession.data?.session?.access_token;

      const body: Record<string, unknown> = {
        messages: apiMessages,
        sourceIds: selectedSourceIds,
      };
      if (!hasSources) {
        body.situationContext = situationContext.trim() || undefined;
      }

      const response = await fetch(
        import.meta.env.VITE_PUBLIC_SUPABASE_URL + '/functions/v1/meeting-copilot',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (accessToken || ''),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        let errMsg = 'AI 응답을 받지 못했어요.';
        try {
          const errData = await response.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch { /* JSON 파싱 실패 무시 */ }
        throw new Error(errMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('스트림을 읽을 수 없습니다.');

      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              throw new Error(parsed.error);
            }
            if (parsed.content) {
              fullContent += parsed.content;
              setStreamingContent(fullContent);
            }
          } catch (e) {
            if (e instanceof Error && !e.message.includes('JSON')) throw e;
          }
        }
      }

      if (fullContent) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message || 'AI 응답 중 오류가 발생했어요.');
        if (streamingContent) {
          setMessages(prev => [...prev, {
            id: `partial-${Date.now()}`,
            role: 'assistant',
            content: streamingContent,
            created_at: new Date().toISOString(),
          }]);
        }
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      streamAbortRef.current = null;
    }
  };

  // ── 아이디어 저장 ──
  const handleSaveIdea = async (content: string) => {
    const userId = user?.id;
    if (!userId) return;
    try {
      const { data, error: insertErr } = await supabase
        .from('meeting_saved_ideas')
        .insert({
          user_id: userId,
          content,
          meeting_id: selectedSourceIds.length === 1 ? selectedSourceIds[0] : null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;
      if (data) {
        setSavedIdeas(prev => [data as SavedIdea, ...prev]);
      }
    } catch {
      setError('아이디어 저장에 실패했어요.');
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    try {
      await supabase.from('meeting_saved_ideas').delete().eq('id', ideaId);
      setSavedIdeas(prev => prev.filter(i => i.id !== ideaId));
    } catch {
      setError('아이디어 삭제에 실패했어요.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStopStreaming = () => {
    streamAbortRef.current?.abort();
    setStreaming(false);
  };

  const handleToolAction = (action: 'notice' | 'schedule' | 'report') => {
    const title = selectedSources[0]?.title || '회의';
    const summary = selectedSources[0]?.summary || '';
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    const aiContent = lastAiMsg?.content || '';

    switch (action) {
      case 'notice':
        navigate('/notices/write', {
          state: { prefilledTitle: '[회의결과] ' + title, prefilledContent: aiContent ? aiContent.slice(0, 2000) : summary },
        });
        break;
      case 'schedule':
        navigate('/personal-schedule', {
          state: { prefilledTitle: title + ' 후속 일정', prefilledDescription: aiContent ? aiContent.slice(0, 500) : summary },
        });
        break;
      case 'report':
        navigate('/reports/weekly/write', {
          state: {
            prefilledContent: aiContent
              ? aiContent.slice(0, 2000)
              : '회의: ' + title + '\n\n' + summary,
          },
        });
        break;
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const filteredMeetings = useMemo(() => {
    if (!meetingSearch.trim()) return meetings;
    return meetings.filter(
      m => m.title.includes(meetingSearch) || m.attendees.some(a => a.includes(meetingSearch))
    );
  }, [meetings, meetingSearch]);

  // 소스 체크박스 리스트 (데스크톱/모바일 공용)
  const SourceList = () => (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {meetingsLoading ? (
        <div className="flex items-center justify-center py-10">
          <span className="w-5 h-5 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin"></span>
        </div>
      ) : meetingsError ? (
        <p className="text-xs text-rose-600 text-center py-6 px-2">{meetingsError}</p>
      ) : filteredMeetings.length === 0 ? (
        <div className="text-center py-10 px-3">
          <p className="text-xs text-foreground-500 mb-2">회의록이 없어요</p>
          <Link to="/meetings/write" className="text-xs text-primary-600 font-medium hover:underline">
            회의록 작성하러 가기
          </Link>
        </div>
      ) : (
        filteredMeetings.map(m => {
          const checked = selectedSourceIds.includes(m.id);
          return (
            <button
              key={m.id}
              onClick={() => toggleSource(m.id)}
              className={`w-full flex items-start gap-2.5 text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                checked ? 'bg-primary-50 border border-primary-200' : 'hover:bg-background-50 border border-transparent'
              }`}
            >
              <span className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border ${
                checked ? 'bg-primary-500 border-primary-500' : 'border-background-300'
              }`}>
                {checked && <i className="ri-check-line text-white text-[10px]"></i>}
              </span>
              <span className="min-w-0">
                <p className={`text-xs font-semibold truncate ${checked ? 'text-primary-700' : 'text-foreground-800'}`}>
                  {m.title}
                </p>
                <p className="text-[10px] text-foreground-400 mt-0.5">{m.date}</p>
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background-50">
      {/* ── 브랜드 헤더 ── */}
      <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-violet-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_60%,white,transparent_35%)]"></div>
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 relative">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate('/meetings')}
              className="flex items-center gap-1 text-xs text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <i className="ri-arrow-left-line"></i>
              회의록 목록
            </button>
          </div>
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-background-100/15 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0">
              <i className="ri-robot-2-fill text-white text-2xl"></i>
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">AI 회의 코파일럿</h1>
              <p className="text-xs md:text-sm text-white/75 mt-1">
                왼쪽에서 소스(회의록)를 고르면, 그 안에서만 근거를 찾아 답해드려요
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 본문: 소스 패널 + 채팅 패널 ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-6">
        <div className="grid gap-5 h-[78dvh] min-h-0 max-h-[calc(100dvh-6rem)] grid-cols-1 lg:grid-cols-[280px_1fr]">

          {/* 소스 사이드바 (데스크톱) */}
          <div className="hidden lg:flex flex-col bg-background-100 border border-background-200 rounded-2xl overflow-hidden">
            <div className="flex-shrink-0 p-3.5 border-b border-background-200 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground-800 flex items-center gap-1.5">
                  <i className="ri-file-list-3-line"></i>
                  소스 {selectedSourceIds.length > 0 && <span className="text-primary-600">({selectedSourceIds.length})</span>}
                </h3>
                {selectedSourceIds.length > 0 && (
                  <button onClick={clearSources} className="text-[10px] text-foreground-400 hover:text-rose-500 cursor-pointer">
                    전체 해제
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="회의록 검색..."
                  value={meetingSearch}
                  onChange={e => setMeetingSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-background-50 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
                />
                <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-xs"></i>
              </div>
            </div>
            <SourceList />
          </div>

          {/* 모바일 소스 드로어 */}
          <AnimatePresence>
            {mobileSourcesOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
                  onClick={() => setMobileSourcesOpen(false)}
                />
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '-100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  className="fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-background-100 z-50 flex flex-col shadow-2xl lg:hidden"
                >
                  <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-background-200">
                    <h3 className="text-sm font-bold text-foreground-950">소스 선택</h3>
                    <button onClick={() => setMobileSourcesOpen(false)} className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center cursor-pointer">
                      <i className="ri-close-line text-foreground-500"></i>
                    </button>
                  </div>
                  <div className="flex-shrink-0 p-3 border-b border-background-200">
                    <input
                      type="text"
                      placeholder="회의록 검색..."
                      value={meetingSearch}
                      onChange={e => setMeetingSearch(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-background-50 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
                    />
                  </div>
                  <SourceList />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* 채팅 패널 */}
          <div className="flex flex-col bg-background-100 border border-background-200 rounded-2xl overflow-hidden shadow-sm">
            {/* 헤더 */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-background-200">
              <div className="min-w-0 flex-1">
                {hasSources ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSources.map(s => (
                      <span key={s.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700 border border-primary-200 whitespace-nowrap">
                        <i className="ri-file-text-line"></i>
                        {s.title}
                        <button onClick={() => toggleSource(s.id)} className="ml-0.5 hover:text-rose-500 cursor-pointer">
                          <i className="ri-close-line"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-bold text-foreground-950">자유 상담 <span className="text-[11px] font-normal text-foreground-500">· 소스 없이 대화 중</span></p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setMobileSourcesOpen(true)}
                  className="lg:hidden w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center transition-colors cursor-pointer"
                  title="소스 선택"
                >
                  <i className="ri-file-list-3-line text-foreground-500 text-sm"></i>
                </button>
                <button
                  onClick={() => setShowIdeas(!showIdeas)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${showIdeas ? 'bg-amber-100 text-amber-700' : 'hover:bg-background-100 text-foreground-500'}`}
                  title="저장된 아이디어"
                >
                  <i className={`text-sm ${showIdeas ? 'ri-pushpin-fill' : 'ri-pushpin-line'}`}></i>
                </button>
                {selectedSources.length === 1 && (
                  <Link
                    to={`/meetings/${selectedSources[0].id}`}
                    className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center transition-colors cursor-pointer"
                    title="회의록 원문 보기"
                  >
                    <i className="ri-file-text-line text-foreground-500 text-sm"></i>
                  </Link>
                )}
              </div>
            </div>

            {/* 소스 없을 때: 상황 입력 */}
            {!hasSources && messages.length <= 1 && !streaming && (
              <div className="flex-shrink-0 px-4 pt-3 pb-2">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <label className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                    <i className="ri-edit-line"></i>
                    현재 상황과 필요한 것 (선택)
                  </label>
                  <textarea
                    value={situationContext}
                    onChange={e => setSituationContext(e.target.value)}
                    placeholder="예: 청소년 수련회를 준비 중인데, 예산과 프로그램 구성에 대한 조언이 필요해요..."
                    maxLength={500}
                    rows={2}
                    className="w-full px-3 py-2 text-sm bg-background-100 border border-emerald-200 rounded-lg outline-none focus:border-emerald-400 resize-none"
                  />
                </div>
              </div>
            )}

            {/* 아이디어 보드 */}
            <AnimatePresence>
              {showIdeas && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex-shrink-0 border-b border-amber-200 bg-amber-50/50 overflow-hidden"
                >
                  <div className="px-4 py-3 max-h-[200px] overflow-y-auto">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                        <i className="ri-pushpin-fill"></i>
                        아이디어 보드
                      </h4>
                      <span className="text-[10px] text-amber-600">{savedIdeas.length}개 저장됨</span>
                    </div>
                    {savedIdeas.length === 0 ? (
                      <p className="text-xs text-amber-600/70 py-2">
                        대화 중 마음에 드는 답변의 <span className="font-semibold">[아이디어 저장]</span> 버튼을 눌러보세요!
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {savedIdeas.map(idea => (
                          <div key={idea.id} className="flex items-start gap-2 p-2.5 bg-background-100 rounded-lg border border-amber-100 text-xs">
                            <i className="ri-pushpin-fill text-amber-400 mt-0.5 flex-shrink-0"></i>
                            <p className="text-foreground-700 flex-1 leading-relaxed">{idea.content}</p>
                            <button
                              onClick={() => handleDeleteIdea(idea.id)}
                              className="text-foreground-400 hover:text-rose-500 flex-shrink-0 cursor-pointer"
                            >
                              <i className="ri-close-line"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-4 bg-background-50/40">
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  formatTime={formatTime}
                  onSaveIdea={handleSaveIdea}
                  profileName={profile?.name || '나'}
                />
              ))}

              {streaming && streamingContent && (
                <MessageBubble
                  message={{ id: 'streaming', role: 'assistant', content: streamingContent, created_at: new Date().toISOString() }}
                  formatTime={formatTime}
                  isStreaming
                  onSaveIdea={handleSaveIdea}
                  profileName={profile?.name || '나'}
                />
              )}

              {streaming && !streamingContent && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <i className="ri-robot-2-fill text-white text-sm"></i>
                  </div>
                  <div className="flex items-center gap-1 px-4 py-3 bg-background-100 border border-background-200 rounded-2xl rounded-tl-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 에러 */}
            {error && (
              <div className="flex-shrink-0 mx-4 mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <i className="ri-error-warning-line"></i>
                <span className="flex-1">{error}</span>
                <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-600 cursor-pointer">
                  <i className="ri-close-line"></i>
                </button>
              </div>
            )}

            {/* 퀵 액션 */}
            {messages.length <= 1 && !streaming && (
              <div className="flex-shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
                {(hasSources ? SOURCE_QUICK_ACTIONS : NO_SOURCE_QUICK_ACTIONS).map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => handleSend(chip.prompt)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-background-100 text-foreground-600 border border-background-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-all whitespace-nowrap cursor-pointer"
                  >
                    {'icon' in chip && <i className={`${chip.icon} mr-1`}></i>}
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {/* 실행 버튼 (소스 1개 선택 + 대화 진행됐을 때) */}
            {hasSources && messages.length > 1 && !streaming && (
              <div className="flex-shrink-0 px-4 pb-2">
                <div className="flex items-center gap-1.5 p-2 bg-background-50 rounded-xl border border-background-200">
                  <span className="text-[10px] text-foreground-400 flex-shrink-0">실행:</span>
                  <button
                    onClick={() => handleToolAction('notice')}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-background-100 text-foreground-600 border border-background-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-300 transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                  >
                    <i className="ri-megaphone-line"></i>공지 등록
                  </button>
                  <button
                    onClick={() => handleToolAction('schedule')}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-background-100 text-foreground-600 border border-background-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                  >
                    <i className="ri-calendar-event-line"></i>일정 등록
                  </button>
                  <button
                    onClick={() => handleToolAction('report')}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium bg-background-100 text-foreground-600 border border-background-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 transition-all whitespace-nowrap cursor-pointer flex items-center justify-center gap-1"
                  >
                    <i className="ri-file-text-line"></i>보고서 생성
                  </button>
                </div>
              </div>
            )}

            {/* 입력 영역 */}
            <div className="flex-shrink-0 p-4 border-t border-background-200 bg-background-100">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={streaming ? 'AI가 응답 중...' : hasSources ? '선택한 소스에 대해 물어보세요...' : '상황에 대해 물어보세요...'}
                  disabled={streaming}
                  className="flex-1 px-4 py-2.5 bg-background-50 border border-background-200 rounded-xl text-sm outline-none focus:border-primary-400 transition-colors disabled:opacity-50"
                />
                {streaming ? (
                  <button
                    onClick={handleStopStreaming}
                    className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200 transition-colors cursor-pointer flex-shrink-0"
                  >
                    <i className="ri-stop-fill text-lg"></i>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                      input.trim() ? 'bg-primary-500 text-white hover:bg-primary-600' : 'bg-background-100 text-foreground-400 cursor-not-allowed'
                    }`}
                  >
                    <i className="ri-send-plane-fill text-lg"></i>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

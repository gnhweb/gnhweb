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

// ── 퀵칩 ──

const QUICK_CHIPS = [
  { label: '예산안 작성', prompt: '이 회의 주제에 맞는 예산안 초안을 작성해줘. 항목별 예상 비용도 포함해줘.' },
  { label: '실행 순서 구성', prompt: '결정된 사항들의 실행 순서와 타임라인을 구성해줘.' },
  { label: '청소년 맞춤 변형', prompt: '이 내용을 청소년 눈높이에 맞게 더 쉽고 재미있게 변형해줘.' },
  { label: '리스크 검토', prompt: '이 아이디어의 잠재적 리스크와 문제점을 검토해줘.' },
  { label: 'Action Item 도출', prompt: '이 회의 내용을 바탕으로 구체적인 Action Item을 담당자와 기한 포함해서 도출해줘.' },
];

const PRE_MEETING_PROMPT = '우리 회의 주제와 안건을 바탕으로 효율적인 40분 회의 타임라인을 구성해줘. 각 안건별 시간 배분과 진행 팁을 포함해줘.';

const CHECK_TRACK_PROMPT = '지금까지의 논의 내용을 우리 회의의 원래 안건과 비교해서, 논의가 벗어난 부분이 있는지 분석해줘. 벗어났다면 다시 돌아오기 위한 질문 예시도 2-3개 제안해줘.';

const EXTRACT_ACTIONS_PROMPT = '지금까지의 전체 대화 내용을 분석해서 구체적인 Action Item을 추출해줘. 각 항목마다 [담당자], [기한], [할 일] 형식으로 정리해줘. 우선순위도 표시해줘.';

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

export default function MeetingCopilotPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 모드
  const [mode, setMode] = useState<'free' | 'meeting'>('meeting');
  const [situationContext, setSituationContext] = useState('');

  // 회의 목록
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [meetingsError, setMeetingsError] = useState('');
  const [meetingSearch, setMeetingSearch] = useState('');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(searchParams.get('meetingId'));
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // 대화
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedIdeas, setSavedIdeas] = useState<SavedIdea[]>([]);
  const [showIdeas, setShowIdeas] = useState(false);
  const [personaMode, setPersonaMode] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const selectedMeeting = useMemo(
    () => meetings.find(m => m.id === selectedMeetingId) || null,
    [meetings, selectedMeetingId]
  );

  // URL에 meetingId가 있으면 회의 연결 모드로
  useEffect(() => {
    const m = searchParams.get('meetingId');
    if (m) {
      setMode('meeting');
      setSelectedMeetingId(m);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 회의 목록 로드 ──
  useEffect(() => {
    if (mode !== 'meeting') {
      setMeetingsLoading(false);
      return;
    }
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
        setSelectedMeetingId(prev => {
          if (prev && list.some(m => m.id === prev)) return prev;
          return list[0]?.id || null;
        });
      } catch {
        setMeetingsError('회의 목록을 불러오지 못했어요.');
      } finally {
        setMeetingsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── 선택한 회의를 URL에 동기화 ──
  useEffect(() => {
    if (!selectedMeetingId || mode !== 'meeting') return;
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set('meetingId', selectedMeetingId);
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMeetingId, mode]);

  // ── 대화 기록 불러오기 ──
  const loadConversation = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('meeting_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (mode === 'meeting' && selectedMeetingId) {
        query = query.eq('meeting_id', selectedMeetingId);
      } else if (mode === 'free') {
        query = query.is('meeting_id', null);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      if (data && data.length > 0) {
        setMessages(data as ChatMessage[]);
      } else {
        const welcomeMsg: ChatMessage = {
          id: 'welcome',
          role: 'assistant',
          content:
            mode === 'free'
              ? '안녕하세요! 강릉학생회 AI 회의 코파일럿입니다. 왼쪽에 현재 상황과 필요한 것을 입력하신 후, 무엇이든 물어보세요. 아이디어 발굴, 안건 구조화, 리스크 분석, Action Item 도출까지 도와드릴게요!'
              : '안녕하세요! 강릉학생회 AI 회의 코파일럿입니다. ' +
                (selectedMeeting?.title ? `"${selectedMeeting.title}"` : '선택하신 회의') +
                '에 대해 무엇이든 물어보세요. 아이디어 발굴, 안건 구조화, 리스크 분석, Action Item 도출까지 도와드릴게요!',
          created_at: new Date().toISOString(),
        };
        setMessages([welcomeMsg]);
      }
    } catch {
      setError('대화 기록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedMeetingId, user?.id, selectedMeeting?.title]);

  const loadSavedIdeas = useCallback(async () => {
    const userId = user?.id;
    if (!userId) {
      setSavedIdeas([]);
      return;
    }
    try {
      let query = supabase
        .from('meeting_saved_ideas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (mode === 'meeting' && selectedMeetingId) {
        query = query.eq('meeting_id', selectedMeetingId);
      } else if (mode === 'free') {
        query = query.is('meeting_id', null);
      }

      const { data } = await query;
      if (data) setSavedIdeas(data as SavedIdea[]);
    } catch {
      // 조용히 실패
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedMeetingId, user?.id]);

  useEffect(() => {
    loadConversation();
    loadSavedIdeas();
    setShowIdeas(false);
  }, [loadConversation, loadSavedIdeas]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
    };
  }, []);

  // ── 모드 전환 시 상태 초기화 ──
  const handleModeChange = (newMode: 'free' | 'meeting') => {
    if (newMode === mode) return;
    setMode(newMode);
    setMessages([]);
    setSavedIdeas([]);
    setShowIdeas(false);
    setError('');
    setStreaming(false);
    setStreamingContent('');
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    if (newMode === 'meeting') {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        if (selectedMeetingId) next.set('meetingId', selectedMeetingId);
        return next;
      }, { replace: true });
    } else {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('meetingId');
        return next;
      }, { replace: true });
    }
  };

  // ── 메시지 저장 ──
  const saveMessage = async (role: 'user' | 'assistant', content: string) => {
    const userId = user?.id;
    if (!userId) return null;
    try {
      const insertData: Record<string, unknown> = {
        user_id: userId,
        role,
        content,
      };
      if (mode === 'meeting' && selectedMeetingId) {
        insertData.meeting_id = selectedMeetingId;
      } else {
        insertData.meeting_id = null;
      }

      const { data, error: insertErr } = await supabase
        .from('meeting_conversations')
        .insert(insertData)
        .select()
        .single();

      if (insertErr) throw insertErr;
      return data as ChatMessage;
    } catch {
      return null;
    }
  };

  // ── 스트리밍 전송 ──
  const handleSend = async (customPrompt?: string) => {
    const text = (customPrompt || input).trim();
    const userId = user?.id;
    if (!text || streaming || !userId) return;

    // 자유 상담 모드: 첫 대화에 상황 설명 포함
    let apiContent = text;
    if (mode === 'free' && situationContext.trim() && messages.length <= 1) {
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

    const saveUserMsgPromise = saveMessage('user', text);

    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const authSession = await supabase.auth.getSession();
      const accessToken = authSession.data?.session?.access_token;

      const body: Record<string, unknown> = {
        messages: apiMessages,
        personaMode: personaMode || undefined,
      };
      if (mode === 'meeting' && selectedMeetingId) {
        body.meetingId = selectedMeetingId;
      } else if (mode === 'free') {
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
        const aiMsg = await saveMessage('assistant', fullContent);
        if (aiMsg) {
          setMessages(prev => [...prev, aiMsg]);
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setError(e.message || 'AI 응답 중 오류가 발생했어요.');
        if (streamingContent) {
          const partialMsg = await saveMessage('assistant', streamingContent);
          if (partialMsg) {
            setMessages(prev => [...prev, partialMsg]);
          }
        }
      }
    } finally {
      setStreaming(false);
      setStreamingContent('');
      streamAbortRef.current = null;

      const savedUserMsg = await saveUserMsgPromise;
      if (savedUserMsg) {
        setMessages(prev => prev.map(m => (m.id === tempId ? savedUserMsg : m)));
      } else {
        setError(prev => prev || '메시지 저장에 실패했어요.');
      }
    }
  };

  // ── 아이디어 저장 ──
  const handleSaveIdea = async (content: string) => {
    const userId = user?.id;
    if (!userId) return;
    try {
      const insertData: Record<string, unknown> = {
        user_id: userId,
        content,
      };
      if (mode === 'meeting' && selectedMeetingId) {
        insertData.meeting_id = selectedMeetingId;
      } else {
        insertData.meeting_id = null;
      }

      const { data, error: insertErr } = await supabase
        .from('meeting_saved_ideas')
        .insert(insertData)
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
    const title = selectedMeeting?.title || '회의';
    const summary = selectedMeeting?.summary || '';
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
              : '회의: ' + title + '\n날짜: ' + (selectedMeeting?.date || '') + '\n\n' + summary,
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

  const handleSelectMeeting = (id: string) => {
    setSelectedMeetingId(id);
    setMobileSidebarOpen(false);
  };

  const hasMeetingSelected = mode === 'meeting' ? !!selectedMeeting : true;

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
          <div className="flex items-center gap-4 flex-wrap justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-background-100/15 backdrop-blur-sm border border-white/20 flex items-center justify-center flex-shrink-0">
                <i className="ri-robot-2-fill text-white text-2xl"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold text-white">AI 회의 코파일럿</h1>
                  <span className="px-2 py-0.5 rounded-full bg-background-100/15 text-white text-[10px] font-semibold border border-white/20">
                    강릉학생회 전용
                  </span>
                </div>
                <p className="text-xs md:text-sm text-white/75 mt-1">
                  안건 구조화, 리스크 검토, Action Item 도출까지 — 회의를 위한 우리만의 AI 도우미
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleModeChange('free')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  mode === 'free'
                    ? 'bg-background-100 text-primary-700 shadow-sm'
                    : 'bg-background-100/15 text-white hover:bg-background-100/25'
                }`}
              >
                <i className="ri-chat-smile-2-line mr-1"></i>
                자유 상담
              </button>
              <button
                onClick={() => handleModeChange('meeting')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  mode === 'meeting'
                    ? 'bg-background-100 text-primary-700 shadow-sm'
                    : 'bg-background-100/15 text-white hover:bg-background-100/25'
                }`}
              >
                <i className="ri-link mr-1"></i>
                회의 연결
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 본문 ── */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-6">
        <div className={`grid gap-5 h-[78dvh] min-h-0 max-h-[calc(100dvh-6rem)] ${
          mode === 'meeting' ? 'grid-cols-1 lg:grid-cols-[280px_1fr]' : 'grid-cols-1 max-w-3xl mx-auto'
        }`}>

          {/* 사이드바 (회의 연결 모드만) */}
          {mode === 'meeting' && (
            <>
              <div className="hidden lg:flex flex-col bg-background-100 border border-background-200 rounded-2xl overflow-hidden">
                <div className="flex-shrink-0 p-3.5 border-b border-background-200">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="회의 검색..."
                      value={meetingSearch}
                      onChange={e => setMeetingSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-background-50 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
                    />
                    <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-400 text-xs"></i>
                  </div>
                </div>
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
                    filteredMeetings.map(m => (
                      <button
                        key={m.id}
                        onClick={() => handleSelectMeeting(m.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                          m.id === selectedMeetingId
                            ? 'bg-primary-50 border border-primary-200'
                            : 'hover:bg-background-50 border border-transparent'
                        }`}
                      >
                        <p className={`text-xs font-semibold truncate ${m.id === selectedMeetingId ? 'text-primary-700' : 'text-foreground-800'}`}>
                          {m.title}
                        </p>
                        <p className="text-[10px] text-foreground-400 mt-0.5">{m.date}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* 모바일 사이드바 (드로어) */}
              <AnimatePresence>
                {mobileSidebarOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
                      onClick={() => setMobileSidebarOpen(false)}
                    />
                    <motion.div
                      initial={{ x: '-100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '-100%' }}
                      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                      className="fixed top-0 left-0 h-full w-[85%] max-w-[320px] bg-background-100 z-50 flex flex-col shadow-2xl lg:hidden"
                    >
                      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-background-200">
                        <h3 className="text-sm font-bold text-foreground-950">회의 선택</h3>
                        <button onClick={() => setMobileSidebarOpen(false)} className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center cursor-pointer">
                          <i className="ri-close-line text-foreground-500"></i>
                        </button>
                      </div>
                      <div className="flex-shrink-0 p-3 border-b border-background-200">
                        <input
                          type="text"
                          placeholder="회의 검색..."
                          value={meetingSearch}
                          onChange={e => setMeetingSearch(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-background-50 border border-background-200 rounded-lg outline-none focus:border-primary-400 transition-colors"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {filteredMeetings.map(m => (
                          <button
                            key={m.id}
                            onClick={() => handleSelectMeeting(m.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                              m.id === selectedMeetingId ? 'bg-primary-50 border border-primary-200' : 'hover:bg-background-50 border border-transparent'
                            }`}
                          >
                            <p className={`text-xs font-semibold truncate ${m.id === selectedMeetingId ? 'text-primary-700' : 'text-foreground-800'}`}>{m.title}</p>
                            <p className="text-[10px] text-foreground-400 mt-0.5">{m.date}</p>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </>
          )}

          {/* 채팅 패널 */}
          <div className="flex flex-col bg-background-100 border border-background-200 rounded-2xl overflow-hidden shadow-sm">
            {!hasMeetingSelected ? (
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                {meetingsLoading ? (
                  <span className="w-6 h-6 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin"></span>
                ) : (
                  <div>
                    <div className="w-14 h-14 rounded-2xl bg-background-100 flex items-center justify-center mx-auto mb-3">
                      <i className="ri-chat-check-line text-2xl text-foreground-400"></i>
                    </div>
                    <p className="text-sm text-foreground-600 mb-3">먼저 대화할 회의를 선택해주세요</p>
                    <Link to="/meetings/write" className="text-sm text-primary-600 font-medium hover:underline">
                      새 회의록 작성하기
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* 헤더 */}
                <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-background-200">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground-950 truncate">
                      {mode === 'free' ? '자유 상담' : selectedMeeting?.title}
                    </p>
                    <p className="text-[11px] text-foreground-500">
                      {mode === 'free'
                        ? '회의록 없이 AI와 상담'
                        : `${selectedMeeting?.date} · ${selectedMeeting?.attendees.length}명 참석`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {mode === 'meeting' && (
                      <button
                        onClick={() => setMobileSidebarOpen(true)}
                        className="lg:hidden w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center transition-colors cursor-pointer"
                        title="회의 선택"
                      >
                        <i className="ri-list-check-2 text-foreground-500 text-sm"></i>
                      </button>
                    )}
                    <button
                      onClick={() => setShowIdeas(!showIdeas)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${showIdeas ? 'bg-amber-100 text-amber-700' : 'hover:bg-background-100 text-foreground-500'}`}
                      title="저장된 아이디어"
                    >
                      <i className={`text-sm ${showIdeas ? 'ri-pushpin-fill' : 'ri-pushpin-line'}`}></i>
                    </button>
                    {mode === 'meeting' && selectedMeeting && (
                      <Link
                        to={`/meetings/${selectedMeeting.id}`}
                        className="w-8 h-8 rounded-lg hover:bg-background-100 flex items-center justify-center transition-colors cursor-pointer"
                        title="회의록 원문 보기"
                      >
                        <i className="ri-file-text-line text-foreground-500 text-sm"></i>
                      </Link>
                    )}
                  </div>
                </div>

                {/* 자유 상담: 상황 입력 영역 (대화 시작 전) */}
                {mode === 'free' && messages.length <= 1 && !streaming && (
                  <div className="flex-shrink-0 px-4 pt-3 pb-2">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <label className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1">
                        <i className="ri-edit-line"></i>
                        현재 상황과 필요한 것
                      </label>
                      <textarea
                        value={situationContext}
                        onChange={e => setSituationContext(e.target.value)}
                        placeholder="예: 청소년 수련회를 준비 중인데, 예산과 프로그램 구성에 대한 조언이 필요해요..."
                        maxLength={500}
                        rows={3}
                        className="w-full px-3 py-2 text-sm bg-background-100 border border-emerald-200 rounded-lg outline-none focus:border-emerald-400 resize-none"
                      />
                      <p className="text-[10px] text-emerald-600 mt-1 text-right">{situationContext.length}/500</p>
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
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex items-center gap-2 text-sm text-foreground-500">
                        <span className="w-4 h-4 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin"></span>
                        대화 불러오는 중...
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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

                {/* 페르소나 선택 */}
                <div className="flex-shrink-0 px-4 pb-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-foreground-400 flex-shrink-0">페르소나:</span>
                  <button
                    onClick={() => setPersonaMode(personaMode === 'teen' ? null : 'teen')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap cursor-pointer ${personaMode === 'teen' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300' : 'bg-background-100 text-foreground-500 border border-background-200 hover:border-emerald-300 hover:text-emerald-600'}`}
                  >
                    <i className="ri-user-smile-line mr-0.5"></i>청소년 관점
                  </button>
                  <button
                    onClick={() => setPersonaMode(personaMode === 'budget' ? null : 'budget')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all whitespace-nowrap cursor-pointer ${personaMode === 'budget' ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' : 'bg-background-100 text-foreground-500 border border-background-200 hover:border-amber-300 hover:text-amber-600'}`}
                  >
                    <i className="ri-money-dollar-circle-line mr-0.5"></i>예산 담당자
                  </button>
                </div>

                {/* 퀵칩 / 라이프사이클 칩 */}
                {messages.length <= 1 && !streaming && (
                  <div className="flex-shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
                    {QUICK_CHIPS.map(chip => (
                      <button
                        key={chip.label}
                        onClick={() => handleSend(chip.prompt)}
                        className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-background-100 text-foreground-600 border border-background-200 hover:bg-primary-50 hover:text-primary-700 hover:border-primary-200 transition-all whitespace-nowrap cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}

                {messages.length > 1 && !streaming && (
                  <div className="flex-shrink-0 px-4 pb-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleSend(CHECK_TRACK_PROMPT)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-all whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-compass-line mr-0.5"></i>논의 궤도 확인
                    </button>
                    <button
                      onClick={() => handleSend(EXTRACT_ACTIONS_PROMPT)}
                      className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-all whitespace-nowrap cursor-pointer"
                    >
                      <i className="ri-list-check-3 mr-0.5"></i>Action Item 추출
                    </button>
                  </div>
                )}

                {/* 실행 버튼 (회의 연결 모드만) */}
                {mode === 'meeting' && messages.length > 1 && !streaming && (
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

                {mode === 'meeting' && messages.length <= 1 && !streaming && (
                  <div className="flex-shrink-0 px-4 pb-2">
                    <button
                      onClick={() => handleSend(PRE_MEETING_PROMPT)}
                      className="w-full px-3 py-2 rounded-xl text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <i className="ri-timer-line"></i>
                      효율적인 40분 회의 타임라인 + 안건 자동 생성
                    </button>
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
                      placeholder={streaming ? 'AI가 응답 중...' : mode === 'free' ? '상황에 대해 물어보세요...' : '회의에 대해 물어보세요...'}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
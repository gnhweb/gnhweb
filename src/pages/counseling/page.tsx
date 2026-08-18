import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const STORAGE_KEY = 'counseling_chat_history';

function loadHistory(): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveHistory(msgs: ChatMessage[]) {
  const trimmed = msgs.slice(-40);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content: '안녕하세요! 저는 아리예요 😊 지금 마음에 있는 어떤 이야기든 편하게 들려주세요. 고민, 기도제목, 궁금한 점... 무엇이든 괜찮아요. 함께 이야기 나누면서 주님의 마음을 조금씩 알아가요!',
};

export default function Counseling() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadHistory();
    return saved.length > 0 ? saved : [WELCOME_MESSAGE];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCrisis, setIsCrisis] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    saveHistory(newMessages);

    try {
      const { data, error } = await supabase.functions.invoke('nim-counseling', {
        body: {
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          userName: profile?.name || '익명',
          profile: profile || {},
        },
      });

      if (error) throw error;

      const reply = data?.reply || '잠시 생각이 정리가 안 됐어요. 다시 말씀해주실래요?';
      const aiMsg: ChatMessage = { role: 'assistant', content: reply };
      const updated = [...newMessages, aiMsg];
      setMessages(updated);
      saveHistory(updated);
      setIsCrisis(data?.isCrisis || false);
    } catch {
      const fallback: ChatMessage = { role: 'assistant', content: '앗, 죄송해요. 지금 연결이 원활하지 않네요. 잠시 후에 다시 대화 나눠요!' };
      const updated = [...newMessages, fallback];
      setMessages(updated);
      saveHistory(updated);
    }
    setLoading(false);
  };

  const handleClear = () => {
    setMessages([WELCOME_MESSAGE]);
    localStorage.removeItem(STORAGE_KEY);
    setIsCrisis(false);
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col">
      {/* Header — 모바일: 그라디언트 아바타 + 살짝 떠 있는 느낌으로 톤 통일, PC는 기존 그대로 */}
      <div className="bg-background-100/95 md:bg-background-100 backdrop-blur md:backdrop-blur-none border-b border-background-200 px-4 md:px-6 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 bg-gradient-to-br from-primary-400 to-accent-400 border-transparent md:bg-primary-100 md:bg-none md:border-primary-200">
              <i className="ri-mental-health-line text-xl text-white md:text-primary-600"></i>
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground-950">아리 상담실</h1>
              <p className="text-xs text-foreground-500">성경적 관점의 1:1 대화</p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-xs text-foreground-500 hover:text-accent-600 cursor-pointer whitespace-nowrap"
          >
            대화 초기화
          </button>
        </div>
      </div>

      {/* Crisis banner */}
      {isCrisis && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-center">
          <p className="text-xs text-amber-700">
            <i className="ri-heart-pulse-line mr-1"></i>
            지금 많이 힘드시다면, 혼자 견디지 마세요. <strong>생명의 전화 1393</strong> · <strong>청소년 상담 1388</strong>
          </p>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <i className="ri-mental-health-line text-sm text-primary-600"></i>
                </div>
              )}
              <div
                className={`max-w-[80%] px-4 py-3 rounded-[16px] text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary-500 text-background-50 rounded-br-md'
                    : 'bg-background-100 border border-background-200 text-foreground-800 rounded-bl-md'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0 ml-2 mt-1">
                  <i className="ri-user-line text-sm text-secondary-600"></i>
                </div>
              )}
            </motion.div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mr-2">
                <i className="ri-mental-health-line text-sm text-primary-600"></i>
              </div>
              <div className="bg-background-100 border border-background-200 rounded-[16px] rounded-bl-md px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef}></div>
        </div>
      </div>

      {/* Input area */}
      <div className="bg-background-100 border-t border-background-200 px-4 md:px-6 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="마음에 있는 이야기를 들려주세요..."
              maxLength={500}
              className="flex-1 px-4 py-3 text-sm bg-background-50 border border-background-200 rounded-full outline-none focus:border-primary-400 transition-colors"
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-full bg-primary-500 text-background-50 flex items-center justify-center hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex-shrink-0"
            >
              <i className={`text-lg ${loading ? 'ri-loader-4-line animate-spin' : 'ri-send-plane-line'}`}></i>
            </button>
          </div>
          <p className="text-xs text-foreground-500 text-center mt-2">
            이 대화는 익명으로 처리되며 저장되지 않아요. 편하게 이야기해주세요 🤲
          </p>
        </div>
      </div>
    </div>
  );
}
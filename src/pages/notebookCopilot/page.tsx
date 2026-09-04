import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

// ── 타입 ──

type SourceType = "meeting" | "notice" | "report" | "file";

interface PickableSource {
  id: string; // `${type}:${dbId}`
  type: SourceType;
  title: string;
  date?: string;
  content: string;
  selected: boolean;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  citedSources?: { n: number; title: string; type: string }[];
  isError?: boolean;
}

const TYPE_LABEL: Record<SourceType, string> = {
  meeting: "회의록",
  notice: "공지사항",
  report: "주간보고",
  file: "업로드 파일",
};

const TYPE_ICON: Record<SourceType, string> = {
  meeting: "ri-file-list-3-line",
  notice: "ri-megaphone-line",
  report: "ri-bar-chart-2-line",
  file: "ri-file-text-line",
};

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notebook-copilot`;
const STORAGE_KEY = "gnh-notebook-session-v1";

export default function NotebookCopilotPage() {
  const { user } = useAuth();
  const [sources, setSources] = useState<PickableSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(true);
  const [activeTab, setActiveTab] = useState<SourceType>("meeting");
  const [search, setSearch] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mobilePanel, setMobilePanel] = useState<"sources" | "chat">("sources");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── 이전 세션(선택 소스 id / 대화) 복원 ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.messages)) setMessages(parsed.messages);
        if (Array.isArray(parsed.selectedIds)) setSelectedIds(new Set(parsed.selectedIds));
      }
    } catch { /* 무시 */ }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, selectedIds: Array.from(selectedIds) }));
    } catch { /* 저장 실패는 무시 (용량 초과 등) */ }
  }, [messages, selectedIds]);

  // ── 소스 불러오기 (회의록 / 공지 / 주간보고 최근 항목 + 업로드된 파일) ──
  const loadSources = useCallback(async () => {
    setLoadingSources(true);
    setErrorBanner(null);
    try {
      const [meetingsRes, noticesRes, reportsRes, filesRes] = await Promise.all([
        supabase.from("meeting_minutes").select("id, title, date, summary, decisions, issues, unresolved_items").order("date", { ascending: false }).limit(40),
        supabase.from("notices").select("id, title, content, created_at").order("created_at", { ascending: false }).limit(40),
        supabase.from("weekly_reports").select("*").order("created_at", { ascending: false }).limit(40),
        supabase.from("notebook_files").select("id, file_name, extracted_text, extraction_status, created_at").order("created_at", { ascending: false }).limit(40),
      ]);

      const firstError = meetingsRes.error || noticesRes.error || reportsRes.error || filesRes.error;
      if (firstError) throw firstError;

      const built: PickableSource[] = [];

      (meetingsRes.data || []).forEach((m: any) => {
        const parts = [
          m.summary ? `요약: ${m.summary}` : "",
          Array.isArray(m.decisions) && m.decisions.length ? `결정사항: ${m.decisions.join("; ")}` : "",
          Array.isArray(m.issues) && m.issues.length ? `논의 이슈: ${m.issues.join("; ")}` : "",
          Array.isArray(m.unresolved_items) && m.unresolved_items.length ? `미결사항: ${m.unresolved_items.join("; ")}` : "",
        ].filter(Boolean).join("\n");
        if (!parts.trim()) return;
        built.push({ id: `meeting:${m.id}`, type: "meeting", title: m.title || "회의록", date: m.date, content: parts, selected: false });
      });

      (noticesRes.data || []).forEach((n: any) => {
        if (!n.content?.trim()) return;
        built.push({ id: `notice:${n.id}`, type: "notice", title: n.title || "공지", date: n.created_at?.slice(0, 10), content: n.content, selected: false });
      });

      (reportsRes.data || []).forEach((r: any) => {
        const parts = Object.entries(r)
          .filter(([k]) => !["id", "author_id", "created_at", "updated_at", "title"].includes(k))
          .filter(([, v]) => typeof v === "string" && v.trim())
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n");
        if (!parts.trim()) return;
        built.push({ id: `report:${r.id}`, type: "report", title: r.title || "주간보고", date: r.created_at?.slice(0, 10), content: parts, selected: false });
      });

      (filesRes.data || []).forEach((f: any) => {
        if (f.extraction_status !== "done" || !f.extracted_text) return;
        built.push({ id: `file:${f.id}`, type: "file", title: f.file_name, date: f.created_at?.slice(0, 10), content: f.extracted_text, selected: false });
      });

      setSources(built);
    } catch (e: any) {
      console.error(e);
      setErrorBanner("자료를 불러오지 못했어요. 새로고침을 눌러 다시 시도해 주세요.");
    } finally {
      setLoadingSources(false);
    }
  }, []);

  useEffect(() => { loadSources(); }, [loadSources]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const toggleSource = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedSources = useMemo(
    () => sources.filter((s) => selectedIds.has(s.id)),
    [sources, selectedIds]
  );

  const tabTypes: SourceType[] = ["meeting", "notice", "report", "file"];
  const tabSources = useMemo(() => {
    const list = sources.filter((s) => s.type === activeTab);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q));
  }, [sources, activeTab, search]);

  const selectAllInTab = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      tabSources.forEach((s) => next.add(s.id));
      return next;
    });
  };
  const clearAllInTab = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      tabSources.forEach((s) => next.delete(s.id));
      return next;
    });
  };

  // ── 파일 업로드 + 텍스트 추출 (txt/md 직접, pdf는 pdfjs, 그 외는 미지원 안내) ──
  const handleFileUpload = useCallback(async (file: File) => {
    if (!user) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("파일이 너무 커요 (15MB 이하만 가능해요).");
      return;
    }
    setUploading(true);
    setErrorBanner(null);
    try {
      const safeName = file.name.replace(/[^\w.\-가-힣 ]/g, "_");
      const path = `${user.id}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage.from("notebook-files").upload(path, file);
      if (uploadErr) throw uploadErr;

      let extractedText = "";
      let status: "done" | "unsupported" | "failed" = "done";
      const lower = file.name.toLowerCase();

      try {
        if (lower.endsWith(".txt") || lower.endsWith(".md")) {
          extractedText = await file.text();
        } else if (lower.endsWith(".pdf")) {
          const pdfjs: any = await import(/* @vite-ignore */ "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs");
          pdfjs.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.mjs";
          const buf = await file.arrayBuffer();
          const doc = await pdfjs.getDocument({ data: buf }).promise;
          const pageTexts: string[] = [];
          for (let i = 1; i <= Math.min(doc.numPages, 60); i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            pageTexts.push(content.items.map((it: any) => it.str).join(" "));
          }
          extractedText = pageTexts.join("\n\n");
        } else {
          status = "unsupported";
        }
      } catch {
        status = "failed";
      }

      if (status === "done" && !extractedText.trim()) status = "failed";

      const { data: row, error: insertErr } = await supabase
        .from("notebook_files")
        .insert({
          uploaded_by: user.id,
          uploaded_by_name: (user as any).user_metadata?.name || user.email,
          file_name: file.name,
          file_path: path,
          mime_type: file.type,
          file_size: file.size,
          extracted_text: extractedText || null,
          extraction_status: status,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      if (status === "done") {
        const newSource: PickableSource = { id: `file:${row.id}`, type: "file", title: file.name, date: new Date().toISOString().slice(0, 10), content: extractedText, selected: false };
        setSources((prev) => [newSource, ...prev]);
        setSelectedIds((prev) => new Set(prev).add(newSource.id));
        setActiveTab("file");
        setMobilePanel("sources");
      } else if (status === "unsupported") {
        alert("이 파일 형식(예: hwp)은 자동 텍스트 추출이 지원되지 않아요. hwp는 '다른 이름으로 저장 → 텍스트 파일(.txt)'로 저장한 뒤 다시 올려 주세요.");
      } else {
        alert("파일에서 텍스트를 추출하지 못했어요. 다른 파일로 시도해 주세요.");
      }
    } catch (e) {
      console.error(e);
      setErrorBanner("파일 업로드 중 오류가 발생했어요.");
    } finally {
      setUploading(false);
    }
  }, [user]);

  const deleteFileSource = async (source: PickableSource) => {
    if (source.type !== "file") return;
    const dbId = source.id.split(":")[1];
    if (!confirm(`"${source.title}" 파일을 삭제할까요?`)) return;
    const { error } = await supabase.from("notebook_files").delete().eq("id", dbId);
    if (error) { alert("삭제하지 못했어요."); return; }
    setSources((prev) => prev.filter((s) => s.id !== source.id));
    setSelectedIds((prev) => { const n = new Set(prev); n.delete(source.id); return n; });
  };

  // ── 채팅 전송 ──
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setErrorBanner(null);
    const nextMessages: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setSending(true);
    setMobilePanel("chat");
    try {
      const res = await callNotebookCopilot(nextMessages, selectedSources);
      const cited = extractCitedSources(res.content, selectedSources);
      setMessages((prev) => [...prev, { role: "assistant", content: res.content, citedSources: cited }]);
    } catch (e: any) {
      console.error(e);
      const debugMsg = e?.message ? String(e.message) : String(e);
      setMessages((prev) => [...prev, { role: "assistant", content: `죄송해요, 답변을 가져오지 못했어요.\n[디버그] ${debugMsg}`, isError: true }]);
    } finally {
      setSending(false);
    }
  };

  // ── 브리핑(노트북 개요) 생성 ──
  const generateOverview = async () => {
    if (selectedSources.length === 0) {
      alert("먼저 왼쪽에서 참고할 소스를 1개 이상 선택해 주세요.");
      return;
    }
    setOverviewLoading(true);
    setErrorBanner(null);
    setMobilePanel("chat");
    try {
      const res = await callNotebookCopilot([], selectedSources, "overview");
      const cited = extractCitedSources(res.content, selectedSources);
      setMessages((prev) => [...prev, { role: "assistant", content: res.content, citedSources: cited }]);
    } catch (e: any) {
      console.error(e);
      const debugMsg = e?.message ? String(e.message) : String(e);
      setErrorBanner(`브리핑 생성에 실패했어요. [디버그] ${debugMsg}`);
    } finally {
      setOverviewLoading(false);
    }
  };

  const clearChat = () => {
    if (messages.length > 0 && !confirm("대화 내용을 모두 지울까요?")) return;
    setMessages([]);
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row bg-background overflow-hidden">
      {/* 모바일 탭 전환 */}
      <div className="flex md:hidden border-b border-border shrink-0">
        <button onClick={() => setMobilePanel("sources")} className={`flex-1 py-2.5 text-sm font-medium ${mobilePanel === "sources" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
          소스 {selectedSources.length > 0 && `(${selectedSources.length})`}
        </button>
        <button onClick={() => setMobilePanel("chat")} className={`flex-1 py-2.5 text-sm font-medium ${mobilePanel === "chat" ? "border-b-2 border-primary text-primary" : "text-muted-foreground"}`}>
          대화
        </button>
      </div>

      {/* 좌측: 소스 패널 */}
      <aside className={`w-full md:w-96 border-b md:border-b-0 md:border-r border-border flex-col shrink-0 ${mobilePanel === "sources" ? "flex" : "hidden md:flex"} min-h-0`}>
        <div className="p-4 border-b border-border">
          <h1 className="hidden md:block text-lg font-bold text-foreground">📓 학생회 노트북</h1>
          <p className="hidden md:block text-sm text-muted-foreground mt-1">참고할 자료를 골라주세요 — 고른 자료에만 근거해서 답해요.</p>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-3 w-full rounded-input bg-primary text-primary-foreground py-2.5 text-sm font-medium disabled:opacity-60 flex items-center justify-center gap-1.5"
          >
            <i className={uploading ? "ri-loader-4-line animate-spin" : "ri-upload-2-line"} />
            {uploading ? "업로드 및 텍스트 추출 중..." : "파일 업로드 (txt / md / pdf)"}
          </button>
        </div>

        <div className="flex border-b border-border overflow-x-auto shrink-0">
          {tabTypes.map((t) => {
            const count = sources.filter((s) => s.type === t).length;
            const selCount = sources.filter((s) => s.type === t && selectedIds.has(s.id)).length;
            return (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-3 py-2 text-sm whitespace-nowrap flex items-center gap-1 ${activeTab === t ? "border-b-2 border-primary text-primary font-medium" : "text-muted-foreground"}`}
              >
                <i className={TYPE_ICON[t]} />
                {TYPE_LABEL[t]} ({count}{selCount > 0 ? `·${selCount}` : ""})
              </button>
            );
          })}
        </div>

        <div className="p-2 border-b border-border flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${TYPE_LABEL[activeTab]} 검색`}
              className="w-full rounded-input border border-border pl-8 pr-2 py-1.5 text-sm bg-background"
            />
          </div>
          <button onClick={selectAllInTab} className="text-xs text-primary whitespace-nowrap px-1.5 hover:underline">전체선택</button>
          <button onClick={clearAllInTab} className="text-xs text-muted-foreground whitespace-nowrap px-1.5 hover:underline">해제</button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 min-h-0">
          {errorBanner && (
            <div className="m-1 mb-2 rounded-chip bg-destructive/10 text-destructive text-xs p-2 flex items-center justify-between">
              <span>{errorBanner}</span>
              <button onClick={loadSources} className="underline shrink-0 ml-2">재시도</button>
            </div>
          )}
          {loadingSources ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 rounded-chip bg-muted animate-pulse" />)}
            </div>
          ) : tabSources.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3">
              {search ? "검색 결과가 없어요." : `아직 등록된 ${TYPE_LABEL[activeTab]}가 없어요.`}
            </p>
          ) : (
            tabSources.map((s) => {
              const checked = selectedIds.has(s.id);
              return (
                <div key={s.id} className={`rounded-chip mb-1 ${checked ? "bg-primary/10" : "hover:bg-muted"}`}>
                  <label className="flex items-start gap-2 p-2 cursor-pointer">
                    <input type="checkbox" checked={checked} onChange={() => toggleSource(s.id)} className="mt-1 shrink-0" />
                    <span className="text-sm min-w-0 flex-1">
                      <span className="block font-medium text-foreground truncate">{s.title}</span>
                      {s.date && <span className="block text-xs text-muted-foreground">{s.date}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setPreviewId(previewId === s.id ? null : s.id); }}
                      className="text-muted-foreground shrink-0 p-1"
                      aria-label="미리보기"
                    >
                      <i className={`ri-arrow-${previewId === s.id ? "up" : "down"}-s-line`} />
                    </button>
                    {s.type === "file" && (
                      <button type="button" onClick={(e) => { e.preventDefault(); deleteFileSource(s); }} className="text-muted-foreground hover:text-destructive shrink-0 p-1" aria-label="삭제">
                        <i className="ri-delete-bin-line" />
                      </button>
                    )}
                  </label>
                  {previewId === s.id && (
                    <div className="px-2 pb-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto border-t border-border/60 pt-2 mx-2">
                      {s.content.slice(0, 800)}{s.content.length > 800 ? "…" : ""}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-border text-xs text-muted-foreground shrink-0 flex items-center justify-between">
          <span>선택된 소스 {selectedSources.length}개</span>
          {selectedSources.length > 0 && (
            <button onClick={() => setSelectedIds(new Set())} className="text-primary hover:underline">전체 해제</button>
          )}
        </div>
      </aside>

      {/* 우측: 채팅 / 브리핑 */}
      <main className={`flex-1 flex-col min-w-0 min-h-0 ${mobilePanel === "chat" ? "flex" : "hidden md:flex"}`}>
        <div className="p-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
          <span className="text-sm text-muted-foreground truncate">
            {selectedSources.length > 0
              ? `${selectedSources.length}개 소스 참고 중`
              : "소스를 선택하지 않으면 답변할 수 없어요"}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {messages.length > 0 && (
              <button onClick={clearChat} className="text-muted-foreground hover:text-destructive p-1.5" aria-label="대화 지우기">
                <i className="ri-delete-bin-line" />
              </button>
            )}
            <button
              onClick={generateOverview}
              disabled={overviewLoading}
              className="rounded-input border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60 whitespace-nowrap flex items-center gap-1"
            >
              <i className={overviewLoading ? "ri-loader-4-line animate-spin" : "ri-sparkling-2-line"} />
              {overviewLoading ? "생성 중..." : "노트 브리핑"}
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm mt-10 px-6">
              <i className="ri-book-open-line text-3xl mb-2 block" />
              왼쪽에서 소스를 고르고, <b>노트 브리핑</b>을 눌러 요약을 받아보거나<br />바로 질문을 입력해 보세요.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[90%] md:max-w-[75%] rounded-card px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : m.isError ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
                <RenderedMessage text={m.content} />
                {m.citedSources && m.citedSources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50 text-xs opacity-80 space-y-1">
                    {m.citedSources.map((cs) => (
                      <div key={cs.n} className="flex items-center gap-1">
                        <i className={TYPE_ICON[cs.type as SourceType] || "ri-file-line"} />
                        <span>소스 {cs.n} · {TYPE_LABEL[cs.type as SourceType] || cs.type} · {cs.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {(sending || overviewLoading) && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-card px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin" /> 소스를 살펴보는 중...
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex gap-2 items-end shrink-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoGrow(e.target); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="선택한 소스에 대해 물어보세요... (Shift+Enter로 줄바꿈)"
            rows={1}
            className="flex-1 rounded-input border border-border px-3 py-2 text-sm bg-background resize-none max-h-40"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !input.trim()}
            className="rounded-input bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium disabled:opacity-60 shrink-0 flex items-center gap-1"
          >
            <i className="ri-send-plane-2-line" />
          </button>
        </div>
      </main>
    </div>
  );
}

// ── 응답 텍스트를 **굵게** 정도만 가볍게 렌더링 (외부 마크다운 라이브러리 없이) ──
function RenderedMessage({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <p className="whitespace-pre-wrap leading-relaxed">
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </p>
  );
}

// ── AI 응답 텍스트에서 실제로 언급된 (소스 n) 인용만 추출해 사이드바에 표시 ──
function extractCitedSources(text: string, sources: PickableSource[]): { n: number; title: string; type: string }[] {
  const found = new Set<number>();
  const regex = /소스\s*(\d+(?:\s*,\s*\d+)*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    match[1].split(",").forEach((numStr) => {
      const n = parseInt(numStr.trim(), 10);
      if (!Number.isNaN(n)) found.add(n);
    });
  }
  return Array.from(found)
    .sort((a, b) => a - b)
    .map((n) => sources[n - 1])
    .filter((s): s is PickableSource => !!s)
    .map((s) => ({ n: sources.indexOf(s) + 1, title: s.title, type: s.type }));
}

// ── API 호출 헬퍼 ──
async function callNotebookCopilot(
  messages: ChatMsg[],
  sources: PickableSource[],
  mode: "chat" | "overview" = "chat"
): Promise<{ content: string }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const res = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      mode,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      sources: sources.map((s) => ({ id: s.id, type: s.type, title: s.title, date: s.date, content: s.content })),
    }),
  });

  if (!res.ok) throw new Error(`notebook-copilot 호출 실패: ${res.status}`);

  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
  if (!line) throw new Error("빈 응답");
  const parsed = JSON.parse(line.slice(6));
  if (parsed.error) throw new Error(parsed.error);
  return { content: parsed.content };
}

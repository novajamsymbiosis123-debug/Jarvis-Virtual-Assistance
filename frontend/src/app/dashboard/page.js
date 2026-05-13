"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { useTheme } from "../layout";
import {
  apiListConversations,
  apiGetMessages,
  apiSendMessage,
  apiCreateConversation,
  apiDeleteConversation,
  apiTranscribeAudio,
  apiSynthesizeSpeech,
  apiLogout,
  getTokens,
} from "../../lib/api";
import { JarvisWebSocket } from "../../lib/websocket";
import {
  Mic, MicOff, Send, Plus, Trash2, Sun, Moon, LogOut,
  Loader2, Zap, Volume2, VolumeX, Menu, X, Settings, BarChart3,
} from "lucide-react";

export default function Dashboard() {
  const { user, loading: authLoading, logout: authLogout } = useAuth();
  const { dark, setDark } = useTheme();
  const router = useRouter();

  // Chat state
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streaming, setStreaming] = useState("");

  // Voice state
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // WebSocket ref
  const wsRef = useRef(null);

  // ── Auth guard ────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // ── Load conversations ────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      const data = await apiListConversations();
      setConversations(data);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  useEffect(() => {
    if (user) loadConversations();
  }, [user, loadConversations]);

  // ── Load messages for active conversation ─────────────
  useEffect(() => {
    if (!activeConvo) {
      setMessages([]);
      return;
    }
    (async () => {
      try {
        const data = await apiGetMessages(activeConvo);
        setMessages(data);
      } catch (err) {
        console.error("Failed to load messages:", err);
      }
    })();
  }, [activeConvo]);

  // ── Auto-scroll ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // ── WebSocket setup ───────────────────────────────────
  useEffect(() => {
    const ws = new JarvisWebSocket({
      onToken: (token) => setStreaming((prev) => prev + token),
      onDone: (data) => {
        setStreaming((prev) => {
          const finalText = prev;
          setMessages((msgs) => [
            ...msgs,
            {
              id: Date.now().toString(),
              role: "assistant",
              content: finalText,
              action_result: data?.action_result,
              created_at: new Date().toISOString(),
            },
          ]);

          // Auto-speak response
          if (autoSpeak && finalText) {
            speakText(finalText);
          }
          return "";
        });
        setSending(false);
        if (data?.conversation_id && !activeConvo) {
          setActiveConvo(data.conversation_id);
        }
        loadConversations();
      },
      onError: (err) => {
        console.error("WS error:", err);
        setSending(false);
        setStreaming("");
      },
    });
    ws.connect();
    wsRef.current = ws;
    return () => ws.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send message via WebSocket ────────────────────────
  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      },
    ]);
    setInput("");
    setSending(true);
    setStreaming("");

    const { access } = getTokens();
    if (wsRef.current) {
      wsRef.current.send(access, trimmed, activeConvo);
    } else {
      // Fallback to REST
      try {
        const res = await apiSendMessage(trimmed, activeConvo);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: res.response,
            action_result: res.action_result,
            created_at: new Date().toISOString(),
          },
        ]);
        if (!activeConvo && res.conversation_id) {
          setActiveConvo(res.conversation_id);
        }
        if (autoSpeak && res.response) speakText(res.response);
        loadConversations();
      } catch (err) {
        console.error("Send failed:", err);
      } finally {
        setSending(false);
      }
    }
  };

  // ── Voice recording ───────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setTranscribing(true);
        try {
          const { text } = await apiTranscribeAudio(blob);
          if (text) {
            setInput(text);
            // Auto-send voice input
            sendMessage(text);
          }
        } catch (err) {
          console.error("Transcription failed:", err);
        } finally {
          setTranscribing(false);
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.error("Mic access denied:", err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // ── TTS ───────────────────────────────────────────────
  const speakText = async (text) => {
    try {
      // Strip action markers and markdown
      const clean = text.replace(/🌐 OPEN_URL:\S+/g, "").replace(/[*_`#]/g, "").trim();
      if (!clean) return;
      const blob = await apiSynthesizeSpeech(clean.slice(0, 500));
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play();
    } catch (err) {
      console.error("TTS error:", err);
    }
  };

  // ── Handle URL actions in messages ────────────────────
  const handleActionResult = (result) => {
    if (!result) return null;
    const urlMatch = result.match(/OPEN_URL:(\S+)/);
    if (urlMatch) {
      const url = urlMatch[1].startsWith("http") ? urlMatch[1] : `https://${urlMatch[1]}`;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 px-4 py-2 bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 rounded-lg text-sm font-medium hover:bg-jarvis-200 transition"
        >
          Open Link →
        </a>
      );
    }
    return <p className="text-sm text-surface-700 mt-1 italic">{result}</p>;
  };

  // ── New conversation ──────────────────────────────────
  const newConversation = () => {
    setActiveConvo(null);
    setMessages([]);
    setStreaming("");
    inputRef.current?.focus();
  };

  // ── Delete conversation ───────────────────────────────
  const deleteConvo = async (id, e) => {
    e.stopPropagation();
    try {
      await apiDeleteConversation(id);
      if (activeConvo === id) newConversation();
      loadConversations();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ── Logout ────────────────────────────────────────────
  const handleLogout = () => {
    apiLogout();
    authLogout();
    router.push("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-jarvis-600" size={32} />
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Sidebar header */}
      <div className="p-4 border-b border-surface-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-jarvis-600 flex items-center justify-center">
              <Zap size={14} className="text-white" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight">JARVIS</span>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className="p-1.5 rounded-lg hover:bg-surface-200 transition"
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
        <button
          onClick={newConversation}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-surface-300 rounded-lg text-sm font-medium hover:bg-surface-100 transition"
        >
          <Plus size={16} /> New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => { setActiveConvo(c.id); setMobileSidebar(false); }}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate group flex items-center justify-between transition ${
              activeConvo === c.id
                ? "bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 font-medium"
                : "hover:bg-surface-100 text-surface-700"
            }`}
          >
            <span className="truncate flex-1">{c.title}</span>
            <button
              onClick={(e) => deleteConvo(c.id, e)}
              className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition"
            >
              <Trash2 size={13} />
            </button>
          </button>
        ))}
      </div>

      {/* Sidebar footer */}
      <div className="p-4 border-t border-surface-200 space-y-2">
        {user?.is_admin && (
          <button
            onClick={() => router.push("/admin")}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-surface-100 transition text-surface-700"
          >
            <BarChart3 size={15} /> Admin Panel
          </button>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-jarvis-200 dark:bg-jarvis-900 flex items-center justify-center text-xs font-bold text-jarvis-700 dark:text-jarvis-300 flex-shrink-0">
              {user?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <span className="text-sm truncate">{user?.username}</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:text-red-500 transition">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-white dark:bg-surface-100 border-r border-surface-200 transition-all ${
          sidebarOpen ? "w-72" : "w-0 overflow-hidden"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebar(false)} />
          <aside className="relative w-72 flex flex-col bg-white dark:bg-surface-100 z-10">
            <button
              onClick={() => setMobileSidebar(false)}
              className="absolute top-4 right-4 p-1"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-surface-200 bg-white dark:bg-surface-100">
          <button onClick={() => setMobileSidebar(true)} className="md:hidden p-1">
            <Menu size={20} />
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:block p-1 hover:bg-surface-200 rounded-lg transition"
          >
            <Menu size={18} />
          </button>
          <h1 className="font-display font-semibold text-sm flex-1 truncate">
            {activeConvo
              ? conversations.find((c) => c.id === activeConvo)?.title || "Chat"
              : "New Conversation"}
          </h1>
          <button
            onClick={() => setAutoSpeak(!autoSpeak)}
            className={`p-2 rounded-lg transition ${
              autoSpeak ? "text-jarvis-600 bg-jarvis-100 dark:bg-jarvis-950" : "text-surface-700 hover:bg-surface-100"
            }`}
            title={autoSpeak ? "Auto-speak on" : "Auto-speak off"}
          >
            {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
          {messages.length === 0 && !streaming && (
            <div className="flex-1 flex flex-col items-center justify-center text-center pt-20 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jarvis-500 to-jarvis-700 flex items-center justify-center mb-4 shadow-lg shadow-jarvis-500/20">
                <Zap size={28} className="text-white" />
              </div>
              <h2 className="font-display font-bold text-2xl mb-2">Hello{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}!</h2>
              <p className="text-surface-700 max-w-md text-sm leading-relaxed">
                I&apos;m Jarvis, your AI assistant. Type a message or press the microphone
                button to talk. I can search Wikipedia, open websites, send emails, and much more.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] md:max-w-[65%] rounded-2xl px-5 py-3 ${
                  msg.role === "user"
                    ? "bg-jarvis-600 text-white rounded-br-md"
                    : "bg-surface-100 dark:bg-surface-200 rounded-bl-md"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "assistant" && handleActionResult(msg.action_result)}
              </div>
            </div>
          ))}

          {/* Streaming response */}
          {streaming && (
            <div className="flex justify-start animate-slide-up">
              <div className="max-w-[80%] md:max-w-[65%] rounded-2xl rounded-bl-md px-5 py-3 bg-surface-100 dark:bg-surface-200">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{streaming}</p>
              </div>
            </div>
          )}

          {/* Typing indicator */}
          {sending && !streaming && (
            <div className="flex justify-start">
              <div className="bg-surface-100 dark:bg-surface-200 rounded-2xl rounded-bl-md px-5 py-3 flex items-center gap-1">
                <div className="typing-dot w-2 h-2 rounded-full bg-surface-700" />
                <div className="typing-dot w-2 h-2 rounded-full bg-surface-700" />
                <div className="typing-dot w-2 h-2 rounded-full bg-surface-700" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-4 md:px-8 py-4 border-t border-surface-200 bg-white dark:bg-surface-100">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            {/* Voice button */}
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={transcribing}
              className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                recording
                  ? "bg-red-500 text-white voice-recording"
                  : transcribing
                  ? "bg-surface-200 text-surface-700"
                  : "bg-surface-100 dark:bg-surface-200 text-surface-700 hover:bg-jarvis-100 hover:text-jarvis-600"
              }`}
            >
              {transcribing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : recording ? (
                <MicOff size={18} />
              ) : (
                <Mic size={18} />
              )}
            </button>

            {/* Text input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder={recording ? "Listening..." : "Type a message or use your voice..."}
                disabled={recording || transcribing}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-surface-300 bg-surface-50 focus:outline-none focus:ring-2 focus:ring-jarvis-500 focus:border-transparent text-sm transition disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || sending}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-jarvis-600 text-white disabled:opacity-30 hover:bg-jarvis-700 transition"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

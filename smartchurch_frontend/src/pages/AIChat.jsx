// ============================================================
//  AIAssistantPage.jsx
//  Full-page AI chat interface — responsive for desktop & mobile.
//  Removed floating widget wrapper; this is now a standalone page.
// ============================================================

import { useState, useEffect, useRef, memo } from 'react';
import axios from 'axios';
import { BotMessageSquare, Send, User, Sparkles, RotateCcw, LogOut, Maximize2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import BubbleMessage from '../components/BubbleMessage';
import MarkdownRenderer from '../components/MarkdownRenderer';

// ── Constants ────────────────────────────────────────────────
const THREAD_ID_STORAGE_KEY = 'smartchurch_ai_thread_id';

const readThreadIdFromSession = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(THREAD_ID_STORAGE_KEY);
};

// ── Helpers ──────────────────────────────────────────────────
const mapBackendMessagesToWidget = (rawMessages) => {
  if (!Array.isArray(rawMessages)) return [];
  return rawMessages
    .filter(msg => msg && typeof msg.content === 'string')
    .filter(msg => msg.role === 'user' || msg.role === 'assistant')
    .map(msg => ({
      sender: msg.role === 'user' ? 'user' : 'ai',
      text: msg.content,
    }));
};

const parseSseBuffer = (incomingBuffer, onChunk, onMeta, onDone) => {
  let buffer = incomingBuffer;
  let boundary = buffer.indexOf('\n\n');

  while (boundary !== -1) {
    const rawEvent = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);
    boundary = buffer.indexOf('\n\n');

    const dataLine = rawEvent.split('\n').find(line => line.startsWith('data: '));
    if (!dataLine) continue;

    try {
      const payload = JSON.parse(dataLine.replace('data: ', ''));
      if (payload.type === 'meta' && payload.thread_id) onMeta?.(payload);
      else if (payload.type === 'status' && payload.text) onMeta?.({ statusText: payload.text });
      else if (payload.type === 'chunk' && payload.text) onChunk?.(payload.text);
      else if (payload.type === 'done') onDone?.();
    } catch (err) {
      console.error('Bad SSE payload', err);
    }
  }

  return buffer;
};

// ── Suggested prompts ────────────────────────────────────────
const SUGGESTIONS = [
  'Tren kehadiran bulan ini?',
  'Jemaat paling aktif minggu ini?',
  'Perbandingan kehadiran bulan lalu?',
  'Ringkasan statistik ibadah?',
];

// ── Main Component ───────────────────────────────────────────
export default function AIChat() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [threadId, setThreadId] = useState(() => readThreadIdFromSession());
  const [messages, setMessages] = useState([]);
  const hasLoadedHistoryRef = useRef(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persist thread id
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!threadId) {
      sessionStorage.removeItem(THREAD_ID_STORAGE_KEY);
      setMessages([]);
      hasLoadedHistoryRef.current = false;
      return;
    }
    sessionStorage.setItem(THREAD_ID_STORAGE_KEY, threadId);
  }, [threadId]);

  // Load history
  useEffect(() => {
    if (!threadId || hasLoadedHistoryRef.current) return;
    if (messages.length > 0) {
      hasLoadedHistoryRef.current = true;
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/chat/${threadId}/`, {
          headers: { Accept: 'application/json' },
        });
        setMessages(mapBackendMessagesToWidget(response.data.messages));
      } catch (err) {
        console.error(err);
        setMessages([]);
      } finally {
        hasLoadedHistoryRef.current = true;
      }
    };

    loadHistory();
  }, [threadId, messages.length]);

  // Stream AI response
  const streamAIResponse = async (message, onChunk, onMeta, onDone) => {
    const URL = 'http://localhost:8000/api/chat/' + (threadId ? threadId + '/' : '');
    let parsedLength = 0;
    let buffer = '';

    await axios.post(URL, { message }, {
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      responseType: 'text',
      onDownloadProgress: progressEvent => {
        const xhr = progressEvent.event?.target;
        const responseText = xhr?.responseText;
        if (typeof responseText !== 'string' || responseText.length <= parsedLength) return;
        const nextChunk = responseText.slice(parsedLength);
        parsedLength = responseText.length;
        buffer += nextChunk;
        buffer = parseSseBuffer(buffer, onChunk, onMeta, onDone);
      },
    });

    if (buffer.trim()) parseSseBuffer(`${buffer}\n\n`, onChunk, onMeta, onDone);
  };

  const handleRestart = () => {
    setThreadId(null);
    setMessages([]);
    setInput('');
    setIsTyping(false);
    inputRef.current?.focus();
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem(THREAD_ID_STORAGE_KEY);
    setThreadId(null);
    setMessages([]);
    navigate('/login');
    window.location.reload();
  };

  const handleSend = async (e, overrideText) => {
    e?.preventDefault();
    const userMessage = (overrideText ?? input).trim();
    if (!userMessage || isTyping) return;

    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setIsTyping(true);
    setInput('');
    setMessages(prev => [...prev, { sender: 'ai', text: '', streaming: true }]);

    try {
      await streamAIResponse(
        userMessage,
        chunk => {
          setMessages(prev => {
            if (!prev.length) return prev;
            const next = [...prev];
            const lastIndex = next.length - 1;
            if (next[lastIndex]?.sender !== 'ai') return prev;
            const wasStatus = Boolean(next[lastIndex].isStatus);
            next[lastIndex] = {
              ...next[lastIndex],
              isStatus: false,
              text: wasStatus ? chunk : (next[lastIndex].text || '') + chunk,
            };
            return next;
          });
          setIsTyping(false);
        },
        payload => {
          if (payload.thread_id) setThreadId(payload.thread_id);
          if (payload.statusText) {
            setMessages(prev => {
              if (!prev.length) return prev;
              const next = [...prev];
              const lastIndex = next.length - 1;
              if (next[lastIndex]?.sender !== 'ai') return prev;
              next[lastIndex] = { ...next[lastIndex], text: payload.statusText, isStatus: true };
              return next;
            });
          }
        },
        () => {
          setMessages(prev => {
            if (!prev.length) return prev;
            const next = [...prev];
            const lastIndex = next.length - 1;
            if (next[lastIndex]?.sender !== 'ai') return prev;
            next[lastIndex] = { ...next[lastIndex], streaming: false };
            return next;
          });
        }
      );
    } catch (err) {
      console.error(err);
      setMessages(prev => {
        if (!prev.length) return prev;
        const next = [...prev];
        const lastIndex = next.length - 1;
        if (next[lastIndex]?.sender !== 'ai') return prev;
        next[lastIndex] = {
          ...next[lastIndex],
          text: 'Maaf, terjadi kesalahan saat memproses pesan.',
          streaming: false,
        };
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col bg-slate-50 w-full h-screen overflow-hidden">

      {/* ── Header ── */}
      <header className="flex justify-between items-center bg-linear-to-r from-indigo-600 to-violet-600 shadow-lg px-4 sm:px-8 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex justify-center items-center bg-white/20 rounded-2xl w-10 h-10 shrink-0">
            <BotMessageSquare size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white text-base sm:text-lg leading-tight">SmartChurch AI</h1>
            <p className="flex items-center gap-1 mt-0.5 text-indigo-200 text-xs">
              <Sparkles size={10} />
              Powered by Langchain
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRestart}
            title="Mulai ulang percakapan"
            aria-label="Mulai ulang percakapan"
            className="flex items-center gap-2 hover:bg-white/15 px-3 py-2 rounded-xl text-white/70 hover:text-white text-sm transition-all"
          >
            <RotateCcw size={15} />
            <span className="hidden sm:inline">Mulai Ulang</span>
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
            className="flex items-center gap-2 hover:bg-white/15 px-3 py-2 rounded-xl text-white/70 hover:text-white text-sm transition-all"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* ── Message Area ── */}
      <div className="flex flex-col flex-1 overflow-y-auto">

        {/* Empty state — centered, shown only when no messages */}
        {isEmpty && (
          <div className="flex flex-col flex-1 justify-center items-center gap-8 px-4 py-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex justify-center items-center bg-linear-to-br from-indigo-500 to-violet-600 shadow-indigo-200 shadow-lg rounded-3xl w-16 h-16">
                <BotMessageSquare size={30} className="text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-800 text-xl sm:text-2xl">Shalom! 👋</h2>
                <p className="mt-1 max-w-sm text-slate-500 text-sm sm:text-base">
                  Tanya saya soal kehadiran jemaat, tren ibadah, atau insight statistik gereja.
                </p>
              </div>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(null, s)}
                  className="bg-white hover:bg-indigo-50 px-4 py-2 border border-slate-200 hover:border-indigo-200 rounded-xl text-slate-600 hover:text-indigo-700 text-sm transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {!isEmpty && (
          <div className="flex flex-col gap-4 mx-auto px-4 sm:px-6 py-6 w-full max-w-3xl">

            {/* Welcome bubble */}
            <BubbleMessage
              avatar={<BotMessageSquare size={13} />}
              content={
                <MarkdownRenderer>
                  Shalom! Saya AI Assistant SmartChurch. Ada insight kehadiran atau tren jemaat yang ingin Anda ketahui hari ini?
                </MarkdownRenderer>
              }
              alignment="left"
              avatarClass="bg-linear-to-br from-indigo-500 to-violet-600 text-white"
              bubbleClass="bg-white border border-slate-100 text-slate-700 shadow-sm rounded-tl-sm"
            />

            {messages.map((msg, i) => {
              if (msg.text === '') return null;
              return (
                <BubbleMessage
                  key={i}
                  avatar={msg.sender === 'user' ? <User size={13} /> : <BotMessageSquare size={13} />}
                  content={<MarkdownRenderer>{msg.text}</MarkdownRenderer>}
                  alignment={msg.sender === 'user' ? 'right' : 'left'}
                  avatarClass={
                    msg.sender === 'user'
                      ? 'bg-indigo-100 text-indigo-600'
                      : 'bg-linear-to-br from-indigo-500 to-violet-600 text-white'
                  }
                  bubbleClass={
                    msg.sender === 'user'
                      ? 'bg-linear-to-br from-indigo-500 to-violet-600 text-white rounded-tr-sm'
                      : 'bg-white border border-slate-100 text-slate-700 shadow-sm rounded-tl-sm'
                  }
                />
              );
            })}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex self-start gap-2.5">
                <div className="flex justify-center items-center bg-linear-to-br from-indigo-500 to-violet-600 rounded-xl w-8 h-8 text-white shrink-0">
                  <BotMessageSquare size={14} />
                </div>
                <div className="flex items-center gap-1.5 bg-white shadow-sm px-4 py-3 border border-slate-100 rounded-2xl rounded-tl-sm">
                  <span className="inline-block bg-slate-400 rounded-full w-1.5 h-1.5 animate-bounce" />
                  <span className="inline-block bg-slate-400 rounded-full w-1.5 h-1.5 animate-bounce [animation-delay:0.2s]" />
                  <span className="inline-block bg-slate-400 rounded-full w-1.5 h-1.5 animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* ── Input Bar ── */}
      <div className="bg-white shadow-[0_-1px_12px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-4 border-slate-100 border-t shrink-0">
        <form
          onSubmit={handleSend}
          className="flex items-center gap-2 bg-slate-50 mx-auto px-4 py-2 border border-slate-200 focus-within:border-indigo-300 rounded-2xl focus-within:ring-2 focus-within:ring-indigo-100 max-w-3xl transition-all"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Tanya soal data kehadiran..."
            className="flex-1 bg-transparent py-1.5 focus:outline-none text-slate-700 placeholder:text-slate-400 text-sm sm:text-base"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="flex justify-center items-center bg-linear-to-br from-indigo-500 to-violet-600 disabled:opacity-40 rounded-xl w-9 h-9 transition-all shrink-0"
            aria-label="Kirim pesan"
          >
            <Send size={15} className="ml-0.5 text-white" />
          </button>
        </form>
        <p className="mt-2 text-slate-400 text-xs text-center">
          SmartChurch AI dapat membuat kesalahan. Selalu verifikasi data penting.
        </p>
      </div>
    </div>
  );
}
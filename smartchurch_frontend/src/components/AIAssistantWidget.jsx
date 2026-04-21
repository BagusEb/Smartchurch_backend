// ============================================================
//  AIAssistantWidget.jsx
//  Floating AI chat widget — opens/closes a conversation panel
//  where church leaders can ask attendance-related questions.
//  All logic is preserved; visual layer is refined (not overdone).
// ============================================================

// ── React hook
import { useState, useEffect, useRef, memo } from 'react';
import axios from 'axios';

// ── Icons
import { BotMessageSquare, X, Send, User, Sparkles, RotateCcw, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const THREAD_ID_STORAGE_KEY = 'smartchurch_ai_thread_id';

const INITIAL_MESSAGES = [
  {
    sender: 'ai',
    text: 'Shalom! Saya AI Assistant SmartChurch. Ada insight kehadiran atau tren jemaat yang ingin Anda ketahui hari ini?',
  },
];

const readThreadIdFromSession = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(THREAD_ID_STORAGE_KEY);
};

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

    const dataLine = rawEvent
      .split('\n')
      .find(line => line.startsWith('data: '));
    if (!dataLine) continue;

    try {
      const payload = JSON.parse(dataLine.replace('data: ', ''));
      if (payload.type === 'meta' && payload.thread_id) {
        onMeta?.(payload);
      } else if (payload.type === 'status' && payload.text) {
        onMeta?.({ statusText: payload.text });
      } else if (payload.type === 'chunk' && payload.text) {
        onChunk?.(payload.text);
      } else if (payload.type === 'done') {
        onDone?.();
      }
    } catch (err) {
      console.error('Bad SSE payload', err);
    }
  }

  return buffer;
};

const defaultAccent = {
  gradient: 'from-indigo-500 to-violet-600',
  mutedText: 'text-indigo-200',
  focusBorder: 'focus-within:border-indigo-300',
  focusRing: 'focus-within:ring-2 focus-within:ring-indigo-100',
  glow: 'before:bg-indigo-500/20',
  userBubble: 'bg-indigo-100 text-indigo-600',
};

export default function AIAssistantWidget({ accent = defaultAccent }) {

  // ── Controls whether the chat window is open
  const [isOpen, setIsOpen] = useState(false);

  // ── Current value of the text input
  const [input, setInput] = useState('');

  // ── Whether the AI is "typing" (simulated delay)
  const [isTyping, setIsTyping] = useState(false);

  const [threadId, setThreadId] = useState(() => readThreadIdFromSession());

  // ── Messages are fetched from backend when a thread_id exists
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const hasLoadedHistoryRef = useRef(false);
  

  // ── Ref to scroll to the latest message automatically
  const bottomRef = useRef(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!threadId) {
      sessionStorage.removeItem(THREAD_ID_STORAGE_KEY);
      setMessages(INITIAL_MESSAGES);
      hasLoadedHistoryRef.current = false;
      return;
    }

    sessionStorage.setItem(THREAD_ID_STORAGE_KEY, threadId);
  }, [threadId]);

  useEffect(() => {
    if (!threadId || hasLoadedHistoryRef.current) return;

    // If this thread was just created during an active chat, don't overwrite current in-memory state.
    if (messages.length > 0) {
      hasLoadedHistoryRef.current = true;
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/chat/${threadId}/`, {
          headers: {
            Accept: 'application/json',
          },
        });

        const payload = response.data;
        setMessages(mapBackendMessagesToWidget(payload.messages));
      } catch (err) {
        console.error(err);
        setMessages([]);
      } finally {
        hasLoadedHistoryRef.current = true;
      }
    };

    loadHistory();
  }, [threadId, messages.length]);

  const streamAIResponse = async (message, onChunk, onMeta, onDone) => {
    const URL =
      'http://localhost:8000/api/chat/' +
      (threadId ? threadId + '/' : '') +
      '?stream=1';

    let parsedLength = 0;
    let buffer = '';

    await axios.post(URL, { message }, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
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

    if (buffer.trim()) {
      parseSseBuffer(`${buffer}\n\n`, onChunk, onMeta, onDone);
    }
  };

  const handleRestart = () => {
    setThreadId(null);
    setMessages(INITIAL_MESSAGES);
    setInput('');
    setIsTyping(false);
  };
  
  // Handles sending a user message and simulating an AI reply
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    // Append the user's message to the chat
    const userMessage = input.trim();
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
              text: wasStatus
                ? chunk
                : (next[lastIndex].text || '') + chunk,
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
              next[lastIndex] = {
                ...next[lastIndex],
                text: payload.statusText,
                isStatus: true,
              };
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

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <>
      <div className="right-6 bottom-6 z-50 fixed flex flex-col items-end font-sans">

        {/* ============================================================
             CHAT WINDOW — rendered when isOpen is true
        ============================================================ */}
        {isOpen && (
          <div className="flex flex-col bg-white shadow-2xl border border-slate-200 rounded-2xl w-90 h-130 overflow-hidden transition-all duration-200">

            {/* ── Header ── */}
            <div className={`flex justify-between items-center bg-linear-to-br ${accent.gradient} px-4 py-3.5 shrink-0`}>
              <div className="flex items-center gap-3">
                {/* Bot avatar */}
                <div className="flex justify-center items-center bg-white/20 rounded-xl w-9 h-9 shrink-0">
                  <BotMessageSquare size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-sm leading-tight">SmartChurch AI</p>
                  <p className={`flex items-center gap-1 mt-0.5 ${accent.mutedText} text-xs`}>
                    <Sparkles size={9} />
                    Powered by Langchain
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleRestart}
                  title="Mulai ulang percakapan"
                  aria-label="Mulai ulang percakapan"
                  className="hover:bg-white/10 p-1.5 rounded-xl text-white/60 hover:text-white transition-all"
                >
                  <RotateCcw size={15} />
                </button>

                {/* Close button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-white/10 p-1.5 rounded-xl text-white/60 hover:text-white transition-all"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* ── Message list ── */}
            <div className="flex flex-col flex-1 gap-3 bg-slate-50 px-4 py-4 overflow-x-hidden overflow-y-auto">
              {messages.map((msg, i) => {
                if (msg.text === '') return null;
                return <BubbleMessage
                  key={i}
                  avatar={msg.sender === 'user' ? <User size={11} /> : <BotMessageSquare size={11} />}
                  content={<MarkdownRenderer>{msg.text}</MarkdownRenderer>}
                  alignment={msg.sender === 'user' ? 'right' : 'left'}
                  avatarClass={msg.sender === 'user'
                    ? accent.userBubble
                    : `bg-linear-to-br ${accent.gradient} text-white`}
                  bubbleClass={msg.sender === 'user'
                    ? `rounded-tr-sm bg-linear-to-br ${accent.gradient} text-white`
                    : 'rounded-tl-sm border border-slate-100 bg-white text-slate-700 shadow-sm'}
                />
                  }
              )}

              {/* Typing indicator — three bouncing dots */}
              {isTyping && (
                <div className="flex self-start gap-2.5 max-w-[88%]">
                  <div className={`flex justify-center items-center bg-linear-to-br ${accent.gradient} rounded-lg w-7 h-7 text-white shrink-0`}>
                    <BotMessageSquare size={13} />
                  </div>
                  <div className="flex items-center gap-1.5 bg-white shadow-sm px-4 py-3 border border-slate-100 rounded-2xl rounded-tl-sm">
                    <span className="inline-block bg-slate-400 rounded-full w-1.5 h-1.5 animate-bounce" />
                    <span className="inline-block bg-slate-400 rounded-full w-1.5 h-1.5 animate-bounce [animation-delay:0.2s]" />
                    <span className="inline-block bg-slate-400 rounded-full w-1.5 h-1.5 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}

              {/* Invisible anchor to scroll into view */}
              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ── */}
            <div className="bg-white px-3 py-3 border-slate-100 border-t shrink-0">
              <form
                onSubmit={handleSend}
                className={`flex items-center gap-2 bg-slate-50 px-3 py-1.5 border border-slate-200 ${accent.focusBorder} rounded-xl ${accent.focusRing} transition-all`}
              >
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Tanya soal data kehadiran..."
                  className="flex-1 bg-transparent py-1.5 focus:outline-none text-slate-700 placeholder:text-slate-400 text-sm"
                />
                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className={`group flex justify-center items-center bg-linear-to-br ${accent.gradient} disabled:opacity-40 rounded-lg w-8 h-8 transition-all`}
                >
                  <Send size={14} className="ml-0.5 text-white transition-transform group-hover:translate-x-0.5" />
                </button>
              </form>
            </div>

          </div>
        )}

        {/* ============================================================
             FLOATING ACTION BUTTON (FAB)
             Hidden when chat is open; visible when closed.
        ============================================================ */}
        <button
          onClick={() => setIsOpen(prev => !prev)}
          aria-label="Buka AI Assistant"
          className={`before:absolute relative before:-inset-1 flex justify-center items-center ${accent.glow} bg-linear-to-br ${accent.gradient} before:opacity-70 shadow-lg rounded-full before:rounded-full w-14 h-14 text-white hover:scale-105 active:scale-95 transition-all before:animate-ping duration-200`}
        >
          {/* Toggle between bot icon (closed) and X icon (open) */}
          {isOpen
            ? <X size={22} className="text-white" />
            : <BotMessageSquare size={22} className="text-white" />
          }
        </button>

      </div>
    </>
  );
}

const BubbleMessage = ({ avatar, content, alignment, avatarClass, bubbleClass }) => (
  <div
    className={`flex max-w-[88%] min-w-0 gap-2.5 ${
      alignment === "right" ? "self-end flex-row-reverse" : "self-start"
    }`}
  >
    <div
      className={`mt-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ${avatarClass}`}
    >
      {avatar}
    </div>

    {/* Message bubble */}
    <div
      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed min-w-0 max-w-full ${bubbleClass}`}
    >
      {content}
    </div>
  </div>
);

const MarkdownImage = ({ src, alt }) => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);

  useEffect(() => {
    if (!isOverlayOpen) return;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOverlayOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOverlayOpen]);

  if (!src) return null;

  return (
    <>
      <div className="group inline-block relative my-2 max-w-full">
        <img
          src={src}
          alt={alt || 'Image'}
          loading="lazy"
          className="border border-slate-200 rounded-xl max-w-full max-h-72 object-contain"
        />

        <button
          type="button"
          onClick={() => setIsOverlayOpen(true)}
          aria-label="Perbesar gambar"
          title="Perbesar gambar"
          className="right-2 bottom-2 absolute flex items-center gap-1 bg-slate-900/85 hover:bg-slate-900 px-2.5 py-1.5 rounded-lg text-white text-xs transition-all"
        >
          <Maximize2 size={14} />
          Zoom
        </button>
      </div>

      {isOverlayOpen && (
        <div
          className="z-120 fixed inset-0 flex justify-center items-center bg-slate-950/80 p-4"
          onClick={() => setIsOverlayOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsOverlayOpen(false)}
            aria-label="Tutup gambar"
            title="Tutup"
            className="top-4 right-4 absolute flex items-center gap-1 bg-white/95 hover:bg-white px-3 py-2 rounded-lg text-slate-700 text-sm"
          >
            <X size={16} />
            Tutup
          </button>

          <img
            src={src}
            alt={alt || 'Preview gambar'}
            className="border border-white/20 rounded-xl max-w-[92vw] max-h-[92vh] object-contain"
            onClick={event => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

const MarkdownRenderer = memo(({ children, ...markdownProps }) => (
  <ReactMarkdown
    {...markdownProps}
    className="max-w-full prose lg:prose-xl"
    remarkPlugins={[remarkGfm]}
    components={{
      table: ({ children: tableChildren, ...tableProps }) => (
        <div className="max-w-full overflow-x-auto">
          <table
            {...tableProps}
            className="border border-slate-200 w-full border-collapse"
          >
            {tableChildren}
          </table>
        </div>
      ),
      th: ({ children: thChildren, ...thProps }) => (
        <th {...thProps} className="px-3 py-2 border border-slate-200 text-left">
          {thChildren}
        </th>
      ),
      td: ({ children: tdChildren, ...tdProps }) => (
        <td {...tdProps} className="px-3 py-2 border border-slate-200">
          {tdChildren}
        </td>
      ),
      img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} />,
    }}
  >
    {children}
  </ReactMarkdown>
), (prevProps, nextProps) => prevProps.children === nextProps.children);
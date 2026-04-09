// ============================================================
//  AIAssistantWidget.jsx
//  Floating AI chat widget — opens/closes a conversation panel
//  where church leaders can ask attendance-related questions.
//  All logic is preserved; visual layer is refined (not overdone).
// ============================================================

// ── React hook
import { useState, useEffect, useRef } from 'react';

// ── Icons
import { BotMessageSquare, X, Send, User, Sparkles, Loader2 } from 'lucide-react';

export default function AIAssistantWidget() {

  // ── Controls whether the chat window is open
  const [isOpen, setIsOpen] = useState(false);

  // ── Current value of the text input
  const [input, setInput] = useState('');

  // ── Whether the AI is "typing" (simulated delay)
  const [isTyping, setIsTyping] = useState(false);

  // ── Conversation messages — initial greeting from the AI
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: 'Shalom! Saya AI Assistant SmartChurch. Ada insight kehadiran atau tren jemaat yang ingin Anda ketahui hari ini?',
    },
  ]);

  // ── Ref to scroll to the latest message automatically
  const bottomRef = useRef(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handles sending a user message and simulating an AI reply
  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    // Append the user's message to the chat
    const userMessage = input.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setIsTyping(true);

    // Simulate AI thinking delay — replace with axios call to Django later
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Ini simulasi jawaban AI untuk: "${userMessage}". Nanti disambungkan ke Langfuse/Django ya!`,
        },
      ]);
    }, 1200);
  };

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <>
      {/* ── Component-scoped styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');

        /* Apply font to the widget */
        .ai-widget { font-family: 'Plus Jakarta Sans', sans-serif; }

        /* Chat window slide-up entrance */
        .ai-window {
          animation: aiSlideUp 0.25s cubic-bezier(0.34,1.4,0.64,1);
          transform-origin: bottom right;
        }
        @keyframes aiSlideUp {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }

        /* FAB pulse ring — subtle, not flashy */
        .ai-fab::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          background: rgba(99,102,241,0.2);
          animation: fabRing 2.4s ease-in-out infinite;
        }
        @keyframes fabRing {
          0%, 100% { transform: scale(1);   opacity: 0.6; }
          50%       { transform: scale(1.15); opacity: 0;   }
        }

        /* Typing dots animation */
        .dot { animation: dotBounce 1.2s ease-in-out infinite; }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%           { transform: translateY(-5px); }
        }

        /* Send button — only the icon scales on hover, not the whole button */
        .send-btn svg { transition: transform 0.15s ease; }
        .send-btn:not(:disabled):hover svg { transform: translateX(2px); }

        /* Scrollbar — thin and muted */
        .ai-messages::-webkit-scrollbar { width: 4px; }
        .ai-messages::-webkit-scrollbar-track { background: transparent; }
        .ai-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
      `}</style>

      <div className="ai-widget fixed bottom-6 right-6 z-50 flex flex-col items-end">

        {/* ============================================================
             CHAT WINDOW — rendered when isOpen is true
        ============================================================ */}
        {isOpen && (
          <div className="ai-window bg-white w-[360px] h-[520px] rounded-2xl shadow-2xl mb-4 flex flex-col border border-slate-200 overflow-hidden">

            {/* ── Header ── */}
            <div
              className="px-4 py-3.5 flex items-center justify-between flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
            >
              <div className="flex items-center gap-3">
                {/* Bot avatar */}
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <BotMessageSquare size={18} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">SmartChurch AI</p>
                  <p className="text-indigo-200 text-xs flex items-center gap-1 mt-0.5">
                    <Sparkles size={9} />
                    Powered by Langfuse
                  </p>
                </div>
              </div>
              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={17} />
              </button>
            </div>

            {/* ── Message list ── */}
            <div className="ai-messages flex-1 bg-slate-50 px-4 py-4 overflow-y-auto flex flex-col gap-3">

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 max-w-[88%] ${
                    msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                  }`}
                >
                  {/* Avatar dot */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-auto text-xs ${
                      msg.sender === 'user'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'text-white'
                    }`}
                    style={
                      msg.sender === 'ai'
                        ? { background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }
                        : {}
                    }
                  >
                    {msg.sender === 'user'
                      ? <User size={13} />
                      : <BotMessageSquare size={13} />
                    }
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'text-white rounded-tr-sm'
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-sm shadow-sm'
                    }`}
                    style={
                      msg.sender === 'user'
                        ? { background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }
                        : {}
                    }
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Typing indicator — three bouncing dots */}
              {isTyping && (
                <div className="flex gap-2.5 self-start max-w-[88%]">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}
                  >
                    <BotMessageSquare size={13} />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                    <span className="dot w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                    <span className="dot w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                    <span className="dot w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                  </div>
                </div>
              )}

              {/* Invisible anchor to scroll into view */}
              <div ref={bottomRef} />
            </div>

            {/* ── Input bar ── */}
            <div className="px-3 py-3 bg-white border-t border-slate-100 flex-shrink-0">
              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
              >
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Tanya soal data kehadiran..."
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none py-1.5"
                />
                {/* Send button */}
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="send-btn w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#7c3aed)' }}
                >
                  <Send size={14} className="text-white ml-0.5" />
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
          className="ai-fab relative w-14 h-14 rounded-full text-white flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #6366f1, #7c3aed)' }}
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
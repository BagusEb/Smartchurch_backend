// ============================================================
//  Login.jsx
//  Authentication page — collects username & password,
//  hits the Django JWT endpoint, stores tokens, and calls
//  onLogin() to unlock the app shell in App.jsx.
//  All logic is preserved; only the visual layer is enhanced.
// ============================================================

// ── React state hook
import { useState } from 'react';

// ── Icons
import { Lock, User, ArrowRight, Church, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

// ── HTTP client
import axios from 'axios';

export default function Login({ onLogin }) {

  // ── Form field values
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // ── Error message shown when credentials are rejected
  const [errorMsg, setErrorMsg] = useState('');

  // ── Loading state — disables the button while the request is in flight
  const [isLoading, setIsLoading] = useState(false);

  // Handles form submission — sends credentials to Django JWT endpoint
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(''); // Clear any previous error

    try {
      // POST username & password to the Django JWT token endpoint
      const response = await axios.post('http://127.0.0.1:8000/api/token/', {
        username,
        password,
      });

      // Store both access and refresh tokens in localStorage
      localStorage.setItem('access_token', response.data.access);
      localStorage.setItem('refresh_token', response.data.refresh);

      // Unlock the app — App.jsx will switch to the main layout
      onLogin(response.data.access);

    } catch (error) {
      console.error("Login failed:", error);
      // 401 = wrong credentials; anything else = server/network issue
      if (error.response && error.response.status === 401) {
        setErrorMsg('Username atau password salah! Silakan coba lagi.');
      } else {
        setErrorMsg('Gagal terhubung ke server. Pastikan Django sudah menyala.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ── Global styles: font + background animations ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        /* Apply font to the entire login page */
        .login-root { font-family: 'Plus Jakarta Sans', sans-serif; }

        /* Floating blurred orb animations */
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(30px, -40px) scale(1.08); }
          66%       { transform: translate(-20px, 20px) scale(0.95); }
        }
        .orb { animation: orbFloat 10s ease-in-out infinite; }
        .orb-2 { animation: orbFloat 13s ease-in-out 3s infinite reverse; }
        .orb-3 { animation: orbFloat 9s ease-in-out 6s infinite; }

        /* Card entrance animation */
        .login-card {
          animation: cardIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(32px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        /* Input focus glow */
        .login-input:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(165,180,252,0.35);
        }

        /* Error shake */
        .error-shake { animation: shake 0.4s ease; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }

        /* Submit button gradient */
        .btn-login {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          transition: all 0.2s ease;
        }
        .btn-login:hover:not(:disabled) {
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(99,102,241,0.45);
        }
        .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Spin animation for loader icon */
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Feature badge row entrance */
        .badge { animation: badgeFade 0.5s ease both; }
        .badge:nth-child(1) { animation-delay: 0.3s; }
        .badge:nth-child(2) { animation-delay: 0.4s; }
        .badge:nth-child(3) { animation-delay: 0.5s; }
        @keyframes badgeFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Full-screen background ── */}
      <div
        className="relative flex justify-center items-center min-h-screen overflow-hidden login-root"
        style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1e1b4b 40%, #24243e 100%)' }}
      >

        {/* Decorative blurred orbs for depth */}
        <div className="-top-20 -left-20 absolute opacity-30 rounded-full w-80 h-80 orb"
          style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }} />
        <div className="-right-15 -bottom-15 absolute opacity-25 rounded-full w-96 h-96 orb-2"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />
        <div className="top-[40%] right-[20%] absolute opacity-20 rounded-full w-48 h-48 orb-3"
          style={{ background: 'radial-gradient(circle, #60a5fa 0%, transparent 70%)' }} />

        {/* Subtle dot-grid texture overlay */}
        <div
          aria-hidden
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* ── Login card ── */}
        <div className="z-10 relative mx-4 w-full max-w-md login-card">

          {/* Glass card */}
          <div
            className="p-10 rounded-3xl"
            style={{
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
            }}
          >

            {/* ── Logo / Branding ── */}
            <div className="flex flex-col items-center mb-8">
              {/* Church icon with glow ring */}
              <div
                className="flex justify-center items-center mb-4 rounded-2xl w-16 h-16"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  boxShadow: '0 0 0 8px rgba(99,102,241,0.15), 0 8px 24px rgba(99,102,241,0.4)',
                }}
              >
                <Church size={28} className="text-white" />
              </div>

              <h1 className="font-extrabold text-white text-4xl tracking-tight">
                Smart<span className="text-indigo-300">Church</span>
              </h1>
              <p className="mt-1.5 text-indigo-300/70 text-sm text-center">
                Sistem Manajemen &amp; Akuisisi Data Terpadu
              </p>
            </div>

            {/* ── Feature badges ── */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              {['Realtime Data', 'AI Powered'].map(label => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold text-xs badge"
                  style={{
                    background: 'rgba(99,102,241,0.18)',
                    color: '#a5b4fc',
                    border: '1px solid rgba(165,180,252,0.2)',
                  }}
                >
                  <ShieldCheck size={10} />
                  {label}
                </span>
              ))}
            </div>

            {/* ── Form ── */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Error alert — shown when login fails */}
              {errorMsg && (
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm error-shake"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    border: '1px solid rgba(239,68,68,0.35)',
                    color: '#fca5a5',
                  }}
                >
                  <AlertCircle size={16} className="shrink-0" />
                  {errorMsg}
                </div>
              )}

              {/* Username field */}
              <div>
                <label
                  className="block mb-2 font-semibold text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(165,180,252,0.7)' }}
                >
                  Username
                </label>
                <div className="relative">
                  {/* Left icon */}
                  <div className="left-0 absolute inset-y-0 flex items-center pl-4 pointer-events-none">
                    <User size={16} style={{ color: '#818cf8' }} />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username..."
                    className="py-3 pr-4 pl-11 rounded-xl w-full text-white text-sm transition-all login-input"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(165,180,252,0.25)',
                    }}
                  />
                </div>
              </div>

              {/* Password field */}
              <div>
                <label
                  className="block mb-2 font-semibold text-xs uppercase tracking-widest"
                  style={{ color: 'rgba(165,180,252,0.7)' }}
                >
                  Password
                </label>
                <div className="relative">
                  {/* Left icon */}
                  <div className="left-0 absolute inset-y-0 flex items-center pl-4 pointer-events-none">
                    <Lock size={16} style={{ color: '#818cf8' }} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="py-3 pr-4 pl-11 rounded-xl w-full text-white text-sm transition-all login-input"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(165,180,252,0.25)',
                    }}
                  />
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex justify-center items-center gap-2.5 mt-2 px-4 py-3.5 rounded-xl w-full font-bold text-white btn-login"
              >
                {isLoading ? (
                  <>
                    {/* Spinning loader icon */}
                    <Loader2 size={18} className="spin" />
                    Memeriksa Kunci...
                  </>
                ) : (
                  <>
                    Masuk ke Sistem
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            {/* ── Footer ── */}
            <div
              className="mt-8 pt-6 text-xs text-center"
              style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(165,180,252,0.4)',
              }}
            >
              © 2026 Capstone Project 
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
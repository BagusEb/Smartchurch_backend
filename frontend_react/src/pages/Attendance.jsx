// ============================================================
//  Attendance.jsx
//  Live attendance monitoring page — controls the CCTV session,
//  shows the camera feed, and displays a real-time detection log.
//  All state and handler logic is preserved; only UI is enhanced.
// ============================================================

// ── React hooks
import { useState } from 'react';

// ── Icons
import {
  Camera, Play, Square, Users, CheckCircle,
  AlertCircle, Clock, Radio, ShieldAlert, Eye,
} from 'lucide-react';

export default function Attendance() {

  // ── Controls whether a recording session is currently active
  const [isSessionActive, setIsSessionActive] = useState(false);

  // ── Dummy detection log entries (replace with live Django websocket/polling later)
  const [liveLogs, setLiveLogs] = useState([
    { id: 1, name: 'Bagus Eka',         status: 'recognized', time: '09:15:22', confidence: 95.2 },
    { id: 2, name: 'Yoel Heardly',      status: 'recognized', time: '09:14:05', confidence: 92.8 },
    { id: 3, name: 'Unknown (Guest)',   status: 'ambiguous',  time: '09:10:12', confidence: 60.5 },
  ]);

  // ============================================================
  //  SESSION HANDLERS
  // ============================================================

  // Starts the attendance session — TODO: call Django to activate camera/OpenCV
  const handleStartSession = () => {
    if (window.confirm("Mulai sesi absensi sekarang? Kamera akan diaktifkan.")) {
      setIsSessionActive(true);
    }
  };

  // Ends the attendance session — TODO: call Django to stop camera and generate recap
  const handleEndSession = () => {
    if (window.confirm("Akhiri sesi absensi? Data akan direkap dan kamera dimatikan.")) {
      setIsSessionActive(false);
    }
  };

  // ============================================================
  //  DERIVED STATS
  // ============================================================

  // Count of successfully recognized faces
  const recognizedCount = liveLogs.filter(l => l.status === 'recognized').length;

  // Count of ambiguous / unrecognized detections
  const ambiguousCount = liveLogs.filter(l => l.status === 'ambiguous').length;

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <>
      {/* ── Component-scoped styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        /* Apply font to the whole page */
        .att-root { font-family: 'Plus Jakarta Sans', sans-serif; }

        /* Subtle scan-line animation over the camera feed */
        @keyframes scanLine {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        .scan-line {
          position: absolute;
          inset-x: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(99,240,180,0.35), transparent);
          animation: scanLine 3.5s linear infinite;
          pointer-events: none;
        }

        /* Corner bracket decorators on the camera view */
        .cam-corner {
          position: absolute;
          width: 18px; height: 18px;
          border-color: rgba(99,240,180,0.5);
          border-style: solid;
        }
        .cam-corner.tl { top: 14px; left: 14px; border-width: 2px 0 0 2px; border-radius: 2px 0 0 0; }
        .cam-corner.tr { top: 14px; right: 14px; border-width: 2px 2px 0 0; border-radius: 0 2px 0 0; }
        .cam-corner.bl { bottom: 14px; left: 14px; border-width: 0 0 2px 2px; border-radius: 0 0 0 2px; }
        .cam-corner.br { bottom: 14px; right: 14px; border-width: 0 2px 2px 0; border-radius: 0 0 2px 0; }

        /* REC badge pulse */
        @keyframes recPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .rec-badge { animation: recPulse 1s ease-in-out infinite; }

        /* Log item entrance */
        .log-item { animation: logFade 0.3s ease both; }
        @keyframes logFade {
          from { opacity: 0; transform: translateX(6px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        /* Start button gradient */
        .btn-start {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          transition: all 0.2s ease;
        }
        .btn-start:hover {
          background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
          box-shadow: 0 4px 16px rgba(99,102,241,0.4);
          transform: translateY(-1px);
        }

        /* End button gradient */
        .btn-end {
          background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
          transition: all 0.2s ease;
        }
        .btn-end:hover {
          background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
          box-shadow: 0 4px 16px rgba(244,63,94,0.4);
          transform: translateY(-1px);
        }

        /* Log scrollbar */
        .log-scroll::-webkit-scrollbar { width: 4px; }
        .log-scroll::-webkit-scrollbar-track { background: transparent; }
        .log-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
      `}</style>

      <div className="att-root flex flex-col h-full gap-5">

        {/* ── PAGE HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-4">
            {/* Icon with camera */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: isSessionActive
                  ? 'linear-gradient(135deg,#10b981,#059669)'
                  : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                boxShadow: isSessionActive
                  ? '0 4px 16px rgba(16,185,129,0.35)'
                  : '0 4px 16px rgba(99,102,241,0.35)',
                transition: 'all 0.4s ease',
              }}
            >
              <Camera size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Live Attendance Monitoring</h2>
              <p className="text-slate-500 text-sm mt-0.5">Pantau tangkapan kamera dan deteksi wajah secara real-time</p>
            </div>
          </div>

          {/* Session status badge */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold flex-shrink-0 transition-all ${
              isSessionActive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            {/* Animated dot — pulses when session is active */}
            <span
              className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-emerald-500' : 'bg-slate-400'}`}
              style={isSessionActive ? { animation: 'recPulse 1s ease-in-out infinite' } : {}}
            />
            {isSessionActive ? 'SESI AKTIF — MEREKAM' : 'SESI OFFLINE'}
          </div>
        </div>

        {/* ── STAT MINI-CARDS ── */}
        <div className="grid grid-cols-3 gap-4 flex-shrink-0">

          {/* Total detections */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow:'0 4px 14px rgba(99,102,241,0.25)' }}
          >
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide">Total Deteksi</p>
            <p className="text-3xl font-extrabold mt-1">{liveLogs.length}</p>
            <div className="mt-1.5 flex items-center gap-1">
              <Eye size={12} className="text-indigo-300" />
              <span className="text-indigo-200 text-xs">Orang terdeteksi</span>
            </div>
          </div>

          {/* Recognized faces */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow:'0 4px 14px rgba(16,185,129,0.25)' }}
          >
            <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">Dikenali</p>
            <p className="text-3xl font-extrabold mt-1">{recognizedCount}</p>
            <div className="mt-1.5 w-full bg-emerald-400/30 rounded-full h-1.5">
              <div
                className="bg-white rounded-full h-1.5 transition-all"
                style={{ width: liveLogs.length ? `${(recognizedCount / liveLogs.length) * 100}%` : '0%' }}
              />
            </div>
          </div>

          {/* Ambiguous / guests */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow:'0 4px 14px rgba(245,158,11,0.25)' }}
          >
            <p className="text-amber-200 text-xs font-semibold uppercase tracking-wide">Perlu Validasi</p>
            <p className="text-3xl font-extrabold mt-1">{ambiguousCount}</p>
            <div className="mt-1.5 flex items-center gap-1">
              <ShieldAlert size={12} className="text-amber-200" />
              <span className="text-amber-200 text-xs">Tamu / Ambigu</span>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT: camera (left) + detection log (right) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">

          {/* ── LEFT COLUMN: camera feed + session controls ── */}
          <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">

            {/* Camera feed panel */}
            <div
              className="flex-1 rounded-2xl overflow-hidden relative border border-slate-800 min-h-[360px] flex items-center justify-center"
              style={{ background: '#0a0a12' }}
            >
              {isSessionActive ? (
                <>
                  {/* Active state: scan-line overlay + waiting message */}
                  <div className="scan-line" />
                  <div className="flex flex-col items-center gap-3 text-emerald-400 z-10 relative">
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center"
                      style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)' }}
                    >
                      <Camera size={28} className="text-emerald-400" style={{ animation:'recPulse 1.5s ease-in-out infinite' }} />
                    </div>
                    <p className="font-mono text-xs tracking-widest text-emerald-400/70">
                      AWAITING DJANGO MJPEG STREAM...
                    </p>
                    {/*
                      Uncomment when Django streaming endpoint is ready:
                      <img src="http://127.0.0.1:8000/api/video_feed/" className="absolute inset-0 w-full h-full object-cover" alt="Live CCTV" />
                    */}
                  </div>

                  {/* REC badge */}
                  <div className="rec-badge absolute top-4 right-4 flex items-center gap-1.5 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-lg font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    REC
                  </div>
                </>
              ) : (
                /* Inactive state: camera off message */
                <div className="flex flex-col items-center gap-3 text-slate-600">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}
                  >
                    <Camera size={28} className="text-slate-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-500">Kamera Dimatikan</p>
                    <p className="text-xs text-slate-600 mt-1">Klik "Mulai Sesi" untuk mengaktifkan AI</p>
                  </div>
                </div>
              )}

              {/* Camera ID watermark — always visible */}
              <div
                className="absolute top-4 left-4 text-white text-xs px-2.5 py-1 rounded-lg font-mono"
                style={{ background:'rgba(0,0,0,0.55)', backdropFilter:'blur(4px)' }}
              >
                CAM_01 · MAIN_DOOR
              </div>

              {/* Corner bracket decorators — shown when active */}
              {isSessionActive && (
                <>
                  <div className="cam-corner tl" />
                  <div className="cam-corner tr" />
                  <div className="cam-corner bl" />
                  <div className="cam-corner br" />
                </>
              )}
            </div>

            {/* Session control bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <p className="text-sm font-bold text-slate-800">Kontrol Sesi Kamera</p>
                <p className="text-xs text-slate-400 mt-0.5">Pastikan pencahayaan ruangan cukup sebelum memulai</p>
              </div>
              {!isSessionActive ? (
                <button
                  onClick={handleStartSession}
                  className="btn-start flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md"
                >
                  <Play size={16} fill="currentColor" />
                  Mulai Sesi Absensi
                </button>
              ) : (
                <button
                  onClick={handleEndSession}
                  className="btn-end flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md"
                >
                  <Square size={16} fill="currentColor" />
                  Akhiri Sesi
                </button>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: real-time detection log ── */}
          <div className="bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col overflow-hidden min-h-0">

            {/* Log panel header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                >
                  <Radio size={13} className="text-white" />
                </div>
                <p className="text-sm font-bold text-slate-700">Log Deteksi Live</p>
              </div>
              {/* Total count badge */}
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-lg text-indigo-700"
                style={{ background:'rgba(99,102,241,0.1)' }}
              >
                {liveLogs.length} Orang
              </span>
            </div>

            {/* Scrollable log list */}
            <div className="log-scroll flex-1 overflow-y-auto p-3 space-y-2">
              {liveLogs.length === 0 ? (
                /* Empty state */
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <Clock size={28} className="mb-2 opacity-30" />
                  <p className="text-sm font-medium">Belum ada deteksi</p>
                  <p className="text-xs text-slate-400 mt-1">Mulai sesi untuk merekam</p>
                </div>
              ) : (
                // One card per detection log entry
                liveLogs.map((log, i) => (
                  <div
                    key={log.id}
                    className="log-item p-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all flex items-start gap-3"
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    {/* Status icon — green checkmark or amber warning */}
                    <div className="mt-0.5 flex-shrink-0">
                      {log.status === 'recognized' ? (
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <CheckCircle size={14} className="text-emerald-500" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                          <AlertCircle size={14} className="text-amber-500" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{log.name}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        {/* Timestamp */}
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Clock size={11} />
                          {log.time}
                        </span>
                        {/* Confidence score — colour shifts at 80% threshold */}
                        <span
                          className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            log.confidence >= 80
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {log.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer: "View full history" link */}
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 text-center flex-shrink-0">
              <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                Lihat Riwayat Lengkap →
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
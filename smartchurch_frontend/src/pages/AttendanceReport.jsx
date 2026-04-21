// ============================================================
//  AttendanceReport.jsx
//  Attendance history and summary report page.
//  Shows stat cards, filter controls, and a detailed data table.
//  All state and handler logic is preserved; only UI is enhanced.
// ============================================================

// ── React hook
import { useState } from 'react';

// ── Icons
import {
  FileText, Download, Filter, Calendar,
  Users, TrendingUp, CheckCircle, Clock,
  UserCheck, UserX,
} from 'lucide-react';

export default function AttendanceReport() {

  // ── Dummy attendance history data (replace with axios call later)
  const [reportData] = useState([
    { id: 1, date: '2026-03-28', name: 'Bagus Eka',     type: 'Member', time: '09:15', confidence: 95.2 },
    { id: 2, date: '2026-03-28', name: 'Yoel Heardly',  type: 'Member', time: '09:14', confidence: 92.8 },
    { id: 3, date: '2026-03-28', name: 'Christian',     type: 'Member', time: '09:20', confidence: 88.5 },
    { id: 4, date: '2026-03-28', name: 'Tamu 001',      type: 'Guest',  time: '09:30', confidence: 75.0 },
    { id: 5, date: '2026-03-21', name: 'Bagus Eka',     type: 'Member', time: '09:10', confidence: 96.1 },
  ]);

  // ── Filter state — date and type filters
  const [dateFilter, setDateFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Applies active filters to the full dataset
  const filteredData = reportData.filter(row => {
    const matchDate = dateFilter ? row.date === dateFilter : true;
    const matchType = typeFilter === 'all' ? true : row.type.toLowerCase() === typeFilter;
    return matchDate && matchType;
  });

  // ── Placeholder for export functionality
  const handleExport = () => {
    alert("Fitur download laporan (PDF/Excel) akan segera aktif setelah API tersambung!");
  };

  // ── Formats a date string from YYYY-MM-DD to a readable Indonesian format
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // ── Returns initials from a name string (max 2 characters)
  const getInitials = (name) =>
    name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <>
      {/* ── Component-scoped styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .rep-root { font-family: 'Plus Jakarta Sans', sans-serif; }

        /* Staggered row fade-in */
        .rep-row { animation: repRowFade 0.3s ease both; }
        @keyframes repRowFade {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Subtle row hover */
        .rep-row:hover { background: linear-gradient(90deg,#f5f3ff 0%,#ffffff 100%); }

        /* Export button hover */
        .btn-export:hover { box-shadow: 0 4px 14px rgba(0,0,0,0.08); transform: translateY(-1px); }
        .btn-export { transition: all 0.2s ease; }

        /* Input focus ring */
        .rep-input:focus {
          outline: none;
          border-color: #a5b4fc;
          box-shadow: 0 0 0 3px rgba(165,180,252,0.25);
        }

        /* Confidence bar fill animation */
        .conf-fill { transition: width 0.6s ease; }

        /* Scrollbar */
        .rep-table::-webkit-scrollbar { height: 4px; }
        .rep-table::-webkit-scrollbar-track { background: transparent; }
        .rep-table::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
      `}</style>

      <div className="rep-root flex flex-col gap-5 h-full">

        {/* ── PAGE HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Page icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
            >
              <FileText size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Laporan Kehadiran</h2>
              <p className="text-slate-500 text-sm mt-0.5">Pantau tren partisipasi jemaat dan riwayat absensi mingguan</p>
            </div>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            className="btn-export flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm flex-shrink-0"
          >
            <Download size={15} className="text-indigo-500" />
            Export Laporan
          </button>
        </div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Total attendance this month */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 4px 16px rgba(99,102,241,0.28)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide">Total Hadir</p>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Users size={15} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-extrabold">128</p>
            <p className="text-indigo-200 text-xs mt-1.5">Orang bulan ini</p>
          </div>

          {/* Average attendance per service */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.28)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">Rata-rata</p>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <TrendingUp size={15} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-extrabold">32</p>
            <p className="text-emerald-200 text-xs mt-1.5">Orang per ibadah</p>
          </div>

          {/* New guests registered */}
          <div
            className="rounded-2xl p-5 text-white"
            style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', boxShadow: '0 4px 16px rgba(245,158,11,0.28)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-amber-200 text-xs font-semibold uppercase tracking-wide">Tamu Baru</p>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <CheckCircle size={15} className="text-white" />
              </div>
            </div>
            <p className="text-3xl font-extrabold">5</p>
            <p className="text-amber-200 text-xs mt-1.5">Orang terdaftar</p>
          </div>
        </div>

        {/* ── TABLE CARD ── */}
        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col flex-1 overflow-hidden min-h-[360px]">

          {/* Filter bar */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">

            {/* Left: label */}
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-slate-400" />
              <span className="text-sm font-bold text-slate-600">Filter Data</span>
              {/* Active filter count badge */}
              {(dateFilter || typeFilter !== 'all') && (
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-indigo-700"
                  style={{ background: 'rgba(99,102,241,0.1)' }}
                >
                  {filteredData.length} hasil
                </span>
              )}
            </div>

            {/* Right: filter controls */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Date picker */}
              <div className="relative">
                <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="rep-input pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 transition-all"
                />
              </div>

              {/* Type filter dropdown */}
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="rep-input px-3 py-2 border border-slate-200 rounded-xl text-sm bg-slate-50 transition-all pr-8"
              >
                <option value="all">Semua Status</option>
                <option value="member">Hanya Member</option>
                <option value="guest">Hanya Tamu</option>
              </select>

              {/* Clear filters — only shown when a filter is active */}
              {(dateFilter || typeFilter !== 'all') && (
                <button
                  onClick={() => { setDateFilter(''); setTypeFilter('all'); }}
                  className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Horizontally scrollable table */}
          <div className="rep-table overflow-x-auto flex-1">
            <table className="w-full text-left min-w-[640px]">

              {/* Column headers */}
              <thead>
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3.5">Tanggal Ibadah</th>
                  <th className="px-5 py-3.5">Nama Lengkap</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Jam Masuk</th>
                  <th className="px-5 py-3.5">Akurasi AI</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">

                {/* Empty state — no data matches the active filters */}
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                          <FileText size={20} className="text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">Tidak ada data ditemukan</p>
                        <p className="text-xs text-slate-400">Coba ubah atau reset filter</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  // Data rows — one per attendance record
                  filteredData.map((row, i) => (
                    <tr
                      key={row.id}
                      className="rep-row transition-colors"
                      style={{ animationDelay: `${i * 0.05}s` }}
                    >
                      {/* Date cell */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                            <Calendar size={13} className="text-slate-500" />
                          </div>
                          <span className="text-sm text-slate-600 font-medium">{formatDate(row.date)}</span>
                        </div>
                      </td>

                      {/* Name cell with avatar initials */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{
                              background: row.type === 'Member'
                                ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                                : 'linear-gradient(135deg,#f59e0b,#d97706)',
                            }}
                          >
                            {getInitials(row.name)}
                          </div>
                          <span className="text-sm font-semibold text-slate-800">{row.name}</span>
                        </div>
                      </td>

                      {/* Type badge — indigo for member, amber for guest */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                            row.type === 'Member'
                              ? 'bg-indigo-50 text-indigo-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {row.type === 'Member'
                            ? <UserCheck size={11} />
                            : <UserX size={11} />
                          }
                          {row.type}
                        </span>
                      </td>

                      {/* Check-in time */}
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                          <Clock size={13} className="text-slate-400" />
                          {row.time}
                        </span>
                      </td>

                      {/* AI confidence: mini progress bar + percentage */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          {/* Progress bar — green above 90%, indigo below */}
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`conf-fill h-full rounded-full ${
                                row.confidence >= 90 ? 'bg-emerald-400' : row.confidence >= 80 ? 'bg-indigo-400' : 'bg-amber-400'
                              }`}
                              style={{ width: `${row.confidence}%` }}
                            />
                          </div>
                          {/* Confidence percentage in a small pill */}
                          <span
                            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                              row.confidence >= 90
                                ? 'bg-emerald-50 text-emerald-700'
                                : row.confidence >= 80
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {row.confidence}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer: row count summary */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between flex-shrink-0">
            <p className="text-xs text-slate-400">
              Menampilkan <span className="font-semibold text-slate-600">{filteredData.length}</span> dari{' '}
              <span className="font-semibold text-slate-600">{reportData.length}</span> data
            </p>
            {/* Placeholder for pagination — add later when API is connected */}
            <p className="text-xs text-slate-400">Halaman 1 dari 1</p>
          </div>
        </div>

      </div>
    </>
  );
}
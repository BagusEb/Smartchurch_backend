// ============================================================
//  GuestValidation.jsx  (v2 — with member linking modal)
//  Admin validation queue for ambiguous AI face detections.
//  Features: quick actions, dynamic button layout, and a modal
//  for linking an unknown face to an existing or new member.
//  All API logic, state, and handlers are preserved.
// ============================================================

// ── React hooks
import { useState, useEffect } from 'react';

// ── HTTP client
import axios from 'axios';

// ── Icons
import {
  CheckCircle, XCircle, AlertTriangle, Clock,
  UserSearch, X, Save, Search, PlusCircle,
  UserCheck, ScanFace, ShieldCheck, Users,
} from 'lucide-react';

export default function GuestValidation() {

  // ── Pending CCTV capture items sourced from t_timlinedata_record (status = 'pending')
  const [pendingValidations, setPendingValidations] = useState([
    { id: 101, capture_time: '09:15:22', image_url: 'https://ui-avatars.com/api/?name=Unknown&background=e2e8f0&color=94a3b8&size=150', ai_guess: 'Bagus Eka',       confidence: 75.5, status: 'pending' },
    { id: 102, capture_time: '09:18:05', image_url: 'https://ui-avatars.com/api/?name=Guest&background=e2e8f0&color=94a3b8&size=150',   ai_guess: 'Tidak Dikenali', confidence: 40.2, status: 'pending' },
  ]);

  // ── Full member list fetched from Django (used to populate the dropdown)
  const [allMembers, setAllMembers] = useState([]);

  // Fetch all registered members on mount
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const response = await axios.get('http://127.0.0.1:8000/api/members/');
        setAllMembers(response.data);
      } catch (error) {
        console.error("Failed to fetch members:", error);
      }
    };
    fetchMembers();
  }, []);

  // ── Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFace, setSelectedFace] = useState(null);
  const [activeTab, setActiveTab] = useState('existing');

  // ── New member form fields
  const [formData, setFormData] = useState({
    full_name: '', nickname: '', gender: 'L',
    birth_date: '', phone: '', email: '', address: '',
  });

  // Generic input change handler for new member form
  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ============================================================
  //  QUICK ACTION HANDLER (verify / guest / reject)
  // ============================================================
  const handleQuickAction = (id, actionType) => {
    const labels = { verify: 'Verifikasi', guest: 'Tamu', reject: 'Tolak' };
    if (window.confirm(`Proses data ini sebagai: ${labels[actionType]}?`)) {
      setPendingValidations(prev => prev.filter(item => item.id !== id));
    }
  };

  // ============================================================
  //  MODAL HANDLERS
  // ============================================================

  // Opens the face-linking modal for an unknown detection
  const handleOpenAddModal = (faceItem) => {
    setSelectedFace(faceItem);
    setIsModalOpen(true);
    setActiveTab('existing');
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFace(null);
  };

  // Saves the face — either links to existing member or creates a new one
  const handleSaveFace = async () => {
    try {
      if (activeTab === 'new') {
        // Scenario 1: create a new member record with this face
        const payload = {
          ...formData,
          face_image_url: selectedFace.image_url,
        };
        const response = await axios.post('http://127.0.0.1:8000/api/members/', payload);
        if (response.status === 201 || response.status === 200) {
          alert(`Berhasil! Jemaat baru (${formData.full_name}) telah masuk ke Database!`);
        }
      } else {
        // Scenario 2: link this face to an existing member
        const memberSelect = document.querySelector('select[data-member-select]');
        const selectedMemberId = memberSelect ? memberSelect.value : null;
        if (!selectedMemberId) {
          alert("Tolong pilih nama jemaat terlebih dahulu!");
          return;
        }
        const response = await axios.post(
          `http://127.0.0.1:8000/api/members/${selectedMemberId}/add_face/`,
          { face_image_url: selectedFace.image_url }
        );
        if (response.status === 200) {
          alert(`Berhasil! Wajah telah diikat ke jemaat ID ${selectedMemberId}.`);
        }
      }

      // Clean up: remove from queue, close modal, reset form
      setPendingValidations(prev => prev.filter(item => item.id !== selectedFace.id));
      handleCloseModal();
      setFormData({ full_name: '', nickname: '', gender: 'L', birth_date: '', phone: '', email: '', address: '' });

    } catch (error) {
      console.error("DJANGO ERROR DETAIL:", error.response?.data);
      alert("Gagal menyimpan! Cek Console (F12) untuk detail errornya.");
    }
  };

  // ── Determines if the AI failed to identify a face
  const isUnknown = (item) =>
    item.ai_guess === 'Tidak Dikenali' || item.ai_guess.toLowerCase().includes('guest');

  // ── Returns confidence colour tokens
  const confScheme = (c) => {
    if (c >= 75) return { bar: '#f59e0b', pill: 'bg-amber-50 text-amber-700' };
    if (c >= 50) return { bar: '#f97316', pill: 'bg-orange-50 text-orange-700' };
    return          { bar: '#f43f5e', pill: 'bg-rose-50 text-rose-700' };
  };

  // Shared input style for modal forms
  const inputCls = "w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 focus:outline-none transition-all placeholder:text-slate-400";
  const labelCls = "block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5";

  // ============================================================
  //  RENDER
  // ============================================================
  return (
    <>
      {/* ── Global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .gv-root { font-family: 'Plus Jakarta Sans', sans-serif; }

        /* Card entrance */
        .gv-card { animation: gvCard 0.35s ease both; }
        @keyframes gvCard {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }

        /* Bottom gradient over card image */
        .gv-img::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.65));
          pointer-events: none;
        }

        /* Scan line on image when hovered */
        .gv-card:hover .gv-scan {
          animation: gvScan 2.5s linear infinite;
        }
        .gv-scan {
          position: absolute; inset-x: 0; height: 2px; top: 0;
          background: linear-gradient(90deg, transparent, rgba(99,240,180,0.5), transparent);
          animation: none;
          pointer-events: none; z-index: 5;
        }
        @keyframes gvScan {
          from { transform: translateY(0); }
          to   { transform: translateY(192px); }
        }

        /* Corner brackets — appear on hover */
        .gv-corner { position: absolute; width: 14px; height: 14px; border-color: rgba(99,240,180,0.6); border-style: solid; opacity: 0; transition: opacity 0.25s ease; z-index: 6; }
        .gv-card:hover .gv-corner { opacity: 1; }
        .gv-corner.tl { top: 10px; left: 10px; border-width: 2px 0 0 2px; }
        .gv-corner.tr { top: 10px; right: 10px; border-width: 2px 2px 0 0; }
        .gv-corner.bl { bottom: 10px; left: 10px; border-width: 0 0 2px 2px; }
        .gv-corner.br { bottom: 10px; right: 10px; border-width: 0 2px 2px 0; }

        /* Action button hover glows */
        .act-verify:hover { box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
        .act-add:hover    { box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }
        .act-guest:hover  { box-shadow: 0 0 0 3px rgba(99,102,241,0.2); }
        .act-reject:hover { box-shadow: 0 0 0 3px rgba(244,63,94,0.2);  }

        /* Confidence bar */
        .conf-fill { transition: width 0.7s cubic-bezier(0.4,0,0.2,1); }

        /* Modal backdrop + spring */
        .gv-backdrop { animation: gvBD 0.2s ease; }
        @keyframes gvBD { from { opacity: 0; } to { opacity: 1; } }
        .gv-modal { animation: gvMod 0.28s cubic-bezier(0.34,1.5,0.64,1); }
        @keyframes gvMod {
          from { opacity: 0; transform: scale(0.93) translateY(24px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }

        /* Tab switch fade */
        .tab-panel { animation: tabFade 0.2s ease; }
        @keyframes tabFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

        /* Empty state pulse */
        @keyframes emptyPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        .empty-icon { animation: emptyPulse 2.8s ease-in-out infinite; }

        /* Form scrollbar */
        .modal-form::-webkit-scrollbar { width: 4px; }
        .modal-form::-webkit-scrollbar-track { background: transparent; }
        .modal-form::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
      `}</style>

      <div className="gv-root flex flex-col gap-5">

        {/* ── PAGE HEADER ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: pendingValidations.length > 0
                  ? 'linear-gradient(135deg,#f59e0b,#d97706)'
                  : 'linear-gradient(135deg,#10b981,#059669)',
                boxShadow: pendingValidations.length > 0
                  ? '0 4px 14px rgba(245,158,11,0.38)'
                  : '0 4px 14px rgba(16,185,129,0.38)',
                transition: 'all 0.4s ease',
              }}
            >
              <ScanFace size={22} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Validasi AI & Wajah Baru</h2>
              <p className="text-slate-500 text-sm mt-0.5">Konfirmasi tebakan AI atau tambahkan wajah ke data jemaat</p>
            </div>
          </div>

          {pendingValidations.length > 0 ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold flex-shrink-0">
              <AlertTriangle size={15} />
              {pendingValidations.length} Menunggu Validasi
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-semibold flex-shrink-0">
              <ShieldCheck size={15} />
              Semua Tervalidasi
            </div>
          )}
        </div>

        {/* ── CONTENT: empty or card grid ── */}
        {pendingValidations.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center py-24 gap-4">
            <div
              className="empty-icon w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,#10b981,#059669)', boxShadow:'0 8px 24px rgba(16,185,129,0.3)' }}
            >
              <CheckCircle size={36} className="text-white" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-700">Semua Wajah Sudah Tervalidasi!</h3>
              <p className="text-slate-400 text-sm mt-1">Tidak ada tangkapan yang membutuhkan konfirmasi.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pendingValidations.map((item, i) => {
              const unknown = isUnknown(item);
              const cc = confScheme(item.confidence);
              return (
                <div
                  key={item.id}
                  className="gv-card bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg hover:border-slate-300 transition-all flex flex-col"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  {/* ── CCTV capture image ── */}
                  <div className="gv-img relative h-48 bg-slate-100 overflow-hidden">
                    <div className="gv-scan" />
                    <div className="gv-corner tl" />
                    <div className="gv-corner tr" />
                    <div className="gv-corner bl" />
                    <div className="gv-corner br" />
                    <img src={item.image_url} alt="CCTV Capture" className="w-full h-full object-cover" />

                    {/* Timestamp badge */}
                    <div
                      className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 text-white text-xs font-medium px-2.5 py-1 rounded-lg"
                      style={{ background:'rgba(0,0,0,0.58)', backdropFilter:'blur(6px)' }}
                    >
                      <Clock size={11} />
                      {item.capture_time}
                    </div>

                    {/* Detection ID */}
                    <div
                      className="absolute top-3 right-3 z-10 text-white text-xs font-mono px-2 py-0.5 rounded-md"
                      style={{ background:'rgba(0,0,0,0.45)', backdropFilter:'blur(4px)' }}
                    >
                      #{item.id}
                    </div>

                    {/* Unknown badge — shown when AI could not identify */}
                    {unknown && (
                      <div
                        className="absolute top-3 left-3 z-10 flex items-center gap-1 text-white text-xs font-semibold px-2 py-0.5 rounded-md"
                        style={{ background:'rgba(244,63,94,0.75)', backdropFilter:'blur(4px)' }}
                      >
                        <AlertTriangle size={10} />
                        Tidak Dikenali
                      </div>
                    )}
                  </div>

                  {/* ── AI prediction info ── */}
                  <div className="px-4 pt-4 pb-3 bg-white border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">Tebakan AI</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-slate-800 truncate text-sm">{item.ai_guess}</p>
                      <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${cc.pill}`}>
                        {item.confidence}%
                      </span>
                    </div>
                    {/* Confidence bar */}
                    <div className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="conf-fill h-full rounded-full"
                        style={{ width: `${item.confidence}%`, background: cc.bar }}
                      />
                    </div>
                  </div>

                  {/* ── Action buttons — layout adapts based on isUnknown ── */}
                  <div className={`p-3 grid gap-2 ${unknown ? 'grid-cols-2' : 'grid-cols-3'}`}>

                    {/* Verify — spans full width only when AI recognised someone (no "add" button) */}
                    <button
                      onClick={() => handleQuickAction(item.id, 'verify')}
                      title="Tebakan AI benar, ini jemaat tersebut"
                      className={`act-verify flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all ${!unknown ? 'col-span-1' : ''}`}
                    >
                      <CheckCircle size={14} /> Verifikasi
                    </button>

                    {/* Add to member — only visible when AI could not identify the face */}
                    {unknown && (
                      <button
                        onClick={() => handleOpenAddModal(item)}
                        title="Tambahkan wajah ini ke data jemaat"
                        className="act-add flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all"
                      >
                        <PlusCircle size={14} /> Tambah
                      </button>
                    )}

                    {/* Register as guest */}
                    <button
                      onClick={() => handleQuickAction(item.id, 'guest')}
                      title="Daftarkan sebagai tamu baru"
                      className="act-guest flex items-center justify-center gap-1.5 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all"
                    >
                      <UserCheck size={14} /> Tamu
                    </button>

                    {/* Reject — not a real face or bad capture */}
                    <button
                      onClick={() => handleQuickAction(item.id, 'reject')}
                      title="Bukan wajah orang / tangkapan tidak valid"
                      className={`act-reject flex items-center justify-center gap-1.5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all ${!unknown ? 'col-span-1' : ''}`}
                    >
                      <XCircle size={14} /> Tolak
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============================================================
           FACE-LINKING MODAL
           Opens when admin clicks "Tambah" on an unrecognised face.
           Two tabs: link to existing member, or create a new one.
      ============================================================ */}
      {isModalOpen && (
        <div className="gv-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="gv-modal bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal header */}
            <div
              className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <ScanFace size={17} className="text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Tambah Wajah ke Data Jemaat</h3>
                  <p className="text-indigo-200 text-xs mt-0.5">Pilih jemaat lama atau buat data baru</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal body: face preview (left) + form (right) */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

              {/* Left: captured face preview */}
              <div
                className="md:w-72 flex-shrink-0 flex flex-col items-center justify-center gap-4 p-6 border-r border-slate-100"
                style={{ background: 'linear-gradient(180deg,#f8f7ff 0%,#f1f0fe 100%)' }}
              >
                {/* Face image in a circular frame */}
                <div className="w-36 h-36 rounded-2xl overflow-hidden border-4 border-white shadow-xl">
                  <img src={selectedFace?.image_url} alt="Selected Face" className="w-full h-full object-cover" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-slate-700">Wajah Tangkapan CCTV</p>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed px-2">
                    Sistem AI akan mengekstrak Face Embedding dari gambar ini untuk pengenalan berikutnya.
                  </p>
                </div>

                {/* Confidence info box */}
                <div className="w-full rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs text-slate-400 mb-1">Confidence AI</p>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${selectedFace?.confidence}%`,
                        background: confScheme(selectedFace?.confidence).bar,
                      }}
                    />
                  </div>
                  <p className="text-xs font-mono font-bold text-slate-600 mt-1.5 text-right">
                    {selectedFace?.confidence}%
                  </p>
                </div>
              </div>

              {/* Right: tab content */}
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Tab switcher */}
                <div className="px-6 pt-5 pb-0 flex-shrink-0">
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setActiveTab('existing')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        activeTab === 'existing'
                          ? 'bg-white shadow-sm text-indigo-600'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Pilih Jemaat Lama
                    </button>
                    <button
                      onClick={() => setActiveTab('new')}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        activeTab === 'new'
                          ? 'bg-white shadow-sm text-indigo-600'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Buat Jemaat Baru
                    </button>
                  </div>
                </div>

                {/* Scrollable form area */}
                <div className="modal-form flex-1 overflow-y-auto px-6 py-5">

                  {/* ── TAB 1: Link to existing member ── */}
                  {activeTab === 'existing' && (
                    <div className="tab-panel space-y-4">
                      <p className="text-sm text-slate-500">
                        Pilih jemaat yang sudah terdaftar namun belum memiliki data wajah di sistem.
                      </p>
                      <div>
                        <label className={labelCls}>Cari Nama Jemaat</label>
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          <select
                            data-member-select
                            className={`${inputCls} pl-9`}
                            defaultValue=""
                          >
                            <option value="" disabled>— Pilih nama jemaat —</option>
                            {allMembers.map(member => (
                              <option key={member.id} value={member.id}>{member.full_name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Info callout */}
                      <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3.5">
                        <Users size={16} className="text-indigo-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-600 leading-relaxed">
                          Wajah dari tangkapan CCTV akan diikat ke jemaat yang dipilih. Sistem akan menggunakan data ini untuk pengenalan otomatis di sesi berikutnya.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── TAB 2: Create new member ── */}
                  {activeTab === 'new' && (
                    <div className="tab-panel grid grid-cols-2 gap-4">

                      {/* Full name */}
                      <div className="col-span-2">
                        <label className={labelCls}>Nama Lengkap (Sesuai KTP)</label>
                        <input
                          name="full_name"
                          value={formData.full_name}
                          onChange={handleInputChange}
                          type="text"
                          className={inputCls}
                          placeholder="Bagus Eka Bagaskara"
                        />
                      </div>

                      {/* Nickname */}
                      <div>
                        <label className={labelCls}>Panggilan</label>
                        <input
                          name="nickname"
                          value={formData.nickname}
                          onChange={handleInputChange}
                          type="text"
                          className={inputCls}
                          placeholder="Bagas"
                        />
                      </div>

                      {/* Gender */}
                      <div>
                        <label className={labelCls}>Jenis Kelamin</label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          className={inputCls}
                        >
                          <option value="L">Laki-laki (L)</option>
                          <option value="P">Perempuan (P)</option>
                        </select>
                      </div>

                      {/* Birth date */}
                      <div>
                        <label className={labelCls}>Tanggal Lahir</label>
                        <input
                          name="birth_date"
                          value={formData.birth_date}
                          onChange={handleInputChange}
                          type="date"
                          className={inputCls}
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label className={labelCls}>Nomor WhatsApp</label>
                        <input
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          type="tel"
                          className={inputCls}
                          placeholder="0812xxxx..."
                        />
                      </div>

                      {/* Email */}
                      <div className="col-span-2">
                        <label className={labelCls}>Alamat Email</label>
                        <input
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          type="email"
                          className={inputCls}
                          placeholder="bagas@example.com"
                        />
                      </div>

                      {/* Address */}
                      <div className="col-span-2">
                        <label className={labelCls}>Alamat Domisili</label>
                        <textarea
                          name="address"
                          value={formData.address}
                          onChange={handleInputChange}
                          rows="2"
                          className={`${inputCls} resize-none`}
                          placeholder="Tulis alamat lengkap..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Modal footer */}
                <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex-shrink-0">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveFace}
                    className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all"
                    style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)' }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.45)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
                  >
                    <Save size={15} />
                    Simpan Data & Wajah
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
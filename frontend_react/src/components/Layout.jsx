// ============================================================
//  Layout.jsx
//  Main application shell — contains the sidebar navigation
//  and the top header. Page content is injected via <Outlet />.
//  All routing logic is preserved; only the UI is enhanced.
// ============================================================

import { useState } from 'react';
import AIAssistantWidget from './AIAssistantWidget'; 
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  ChevronRight,
  Bell,
  Settings,
  LogOut,
  Church,
  UserCog,
  UserSearch,
  FileText,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/',            label: 'Dashboard',        icon: LayoutDashboard },
  { to: '/members',     label: 'Data Jemaat',      icon: Users           },
  { to: '/attendance',  label: 'Kehadiran (CCTV)', icon: UserCheck       },
  { to: '/validation',  label: 'Validasi AI',      icon: UserSearch      },
  { to: '/report',      label: 'Laporan',          icon: FileText        },
  { to: '/manage-users',label: 'Kelola Pengguna',  icon: UserCog         },
];

const PAGE_TITLES = {
  '/':             'Dashboard Analitik',
  '/members':      'Data Jemaat',
  '/attendance':   'Kehadiran (CCTV)',
  '/manage-users': 'Manajemen Pengguna',
  '/validation': 'Validasi AI',
  '/report': 'Laporan Kehadiran',
};

// --- UPDATE 1: Menangkap prop 'role' dari App.jsx ---
export default function Layout({ role }) {

  const { pathname } = useLocation();
  const navigate = useNavigate(); 
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const pageTitle = PAGE_TITLES[pathname] ?? 'SmartChurch';

  // --- UPDATE 2: Filter Menu Berdasarkan Role ---
  // Logika sesuai dokumen: Admin pegang data, Leader pegang AI Assistant
  const filteredNavItems = NAV_ITEMS.filter(item => {
    if (item.to === '/') return true; // Semua role bisa lihat Dashboard
    
    if (role === 'admin') {
        return item.to === '/members' || item.to === '/attendance' || item.to === '/validation' || item.to === '/manage-users' || item.to === '/report' ;    }

    if (role === 'leader') {
        return item.to === '/report' ;    }

    return false;
  });

  // --- UPDATE 3: Data Profil Dinamis ---
  const profileData = {
    name: role === 'leader' ? 'Church Leader' : 'Administrator',
    subText: role === 'leader' ? 'Pastor' : 'Committee',
    initial: role === 'leader' ? 'P' : 'A'
  };

  // Fungsi Logout agar tombol LogOut berfungsi
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
    window.location.reload(); // Refresh state aplikasi
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .layout-root * { font-family: 'Plus Jakarta Sans', sans-serif; }
        .nav-active {
          background: rgba(255,255,255,0.12);
          border-left: 3px solid #a5b4fc;
          color: #fff;
        }
        .nav-item:not(.nav-active):hover {
          background: rgba(255,255,255,0.07);
          color: #e0e7ff;
        }
        .sidebar-bg {
          background: linear-gradient(180deg, #1e1b4b 0%, #312e81 40%, #3730a3 100%);
        }
        .logo-glow {
          box-shadow: 0 0 20px rgba(165,180,252,0.35);
        }
        .header-shadow {
          box-shadow: 0 1px 0 0 #e2e8f0, 0 4px 16px rgba(0,0,0,0.04);
        }
        .notif-pulse {
          animation: notifPulse 2s infinite;
        }
        @keyframes notifPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50%       { box-shadow: 0 0 0 5px rgba(239,68,68,0);  }
        }
        .breadcrumb { animation: breadFadeIn 0.3s ease; }
        @keyframes breadFadeIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        .content-area { animation: contentFade 0.25s ease; }
        @keyframes contentFade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      <div className="layout-root flex h-screen overflow-hidden bg-slate-100">

        <aside className="sidebar-bg w-64 flex flex-col flex-shrink-0 relative">
          <div
            aria-hidden
            style={{
              position: 'absolute', top: -40, right: -40,
              width: 160, height: 160, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(129,140,248,0.25) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
            <div className="logo-glow w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
              <Church size={20} className="text-white" />
            </div>
            <div className="leading-tight">
              <p className="text-white font-extrabold text-lg tracking-tight">
                Smart<span className="text-indigo-300">Church</span>
              </p>
              <p className="text-indigo-300/70 text-xs font-medium">Management System</p>
            </div>
          </div>

          <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
            <p className="text-indigo-300/50 text-xs font-bold uppercase tracking-widest px-3 mb-3">
              Menu Utama
            </p>

            {/* --- UPDATE: Mapping dari menu yang sudah di-filter --- */}
            {filteredNavItems.map(({ to, label, icon: Icon }) => {
              const isActive = pathname === to;

              return (
                <Link
                  key={to}
                  to={to}
                  className={`nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 border-l-3 ${
                    isActive
                      ? 'nav-active'
                      : 'text-indigo-200/80 border-l-transparent'
                  }`}
                  style={{ borderLeftWidth: isActive ? 3 : 0 }}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                    isActive
                      ? 'bg-white/20'
                      : 'bg-white/5'
                  }`}>
                    <Icon size={16} className={isActive ? 'text-indigo-200' : 'text-indigo-300/70'} />
                  </div>
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <ChevronRight size={14} className="text-indigo-300/70" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="px-4 py-4 border-t border-white/10 space-y-2">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-all">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {profileData.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{profileData.name}</p>
                <p className="text-indigo-300/60 text-xs truncate">{profileData.subText}</p>
              </div>
              
              {/* --- UPDATE: Tombol Logout berfungsi --- */}
              <button onClick={handleLogout} title="Logout" className="p-1 hover:bg-white/10 rounded">
                <LogOut size={14} className="text-indigo-300 hover:text-red-400 transition-colors flex-shrink-0" />
              </button>
            </div>

            <p className="text-indigo-300/40 text-xs text-center">
              © 2026 Capstone Project
            </p>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="header-shadow h-16 bg-white flex items-center justify-between px-8 flex-shrink-0 z-10">
            <div className="breadcrumb flex items-center gap-2 text-sm">
              <span className="text-slate-400 font-medium">SmartChurch</span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className="text-slate-700 font-semibold">{pageTitle}</span>
            </div>

            <div className="flex items-center gap-2">
              <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all">
                <Bell size={16} />
                <span className="notif-pulse absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
              </button>

              <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all">
                <Settings size={16} />
              </button>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                  {profileData.initial}
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-slate-700 text-sm font-semibold leading-none">{profileData.name}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{profileData.subText}</p>
                </div>
              </div>
            </div>
          </header>

          <div className="content-area flex-1 overflow-auto p-8">
            <Outlet />

            {/* --- WIDGET AI HANYA MUNCUL JIKA ROLE == 'leader' --- */}
            {role === 'leader' && <AIAssistantWidget />}

          </div>
        </main>
      </div>
    </>
  );
}
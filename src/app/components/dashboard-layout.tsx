/**
 * @file dashboard-layout.tsx
 * @description Layout utama untuk halaman dashboard (admin, ormawa, dan pengguna umum).
 *
 * Menangani:
 * - Proteksi route (redirect ke /login jika tidak ada session).
 * - Sidebar navigasi yang disesuaikan berdasarkan peran pengguna (role).
 * - Fitur logout, toggle tema (dark/light), dan navigasi kembali ke beranda publik.
 */
import React, { useState } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "./auth-context";
import { useTheme } from "./theme-context";
import {
  Flame, LogOut, ChevronDown, Sun, Moon, Menu,
  CalendarDays, LayoutDashboard, Building2, History,
  FolderOpen, PlusCircle, Briefcase, Loader2, User, Home, Award, FileDown
} from "lucide-react";

interface SidebarItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

/** 
 * Fungsi pembantu untuk mengambil menu navigasi sidebar 
 * berdasarkan role yang sedang login.
 */
function getSidebarItems(role: string): SidebarItem[] {
  switch (role) {
    case "admin":
      return [
        { label: "Kegiatan", path: "/dashboard/kegiatan", icon: <CalendarDays className="w-5 h-5" /> },
        { label: "Dashboard Analitik", path: "/dashboard/analitik", icon: <LayoutDashboard className="w-5 h-5" /> },
        { label: "Daftar Ormawa", path: "/dashboard/daftar-ormawa", icon: <Building2 className="w-5 h-5" /> },
        { label: "Riwayat Kegiatan", path: "/dashboard/riwayat", icon: <History className="w-5 h-5" /> },
      ];
    case "ormawa":
      return [
        { label: "Kegiatan", path: "/dashboard/kegiatan", icon: <CalendarDays className="w-5 h-5" /> },
        { label: "Kegiatan Kami", path: "/dashboard/kegiatan-kami", icon: <FolderOpen className="w-5 h-5" /> },
        { label: "Tambah Kegiatan", path: "/dashboard/tambah-kegiatan", icon: <PlusCircle className="w-5 h-5" /> },
        { label: "Riwayat Kegiatan", path: "/dashboard/riwayat", icon: <History className="w-5 h-5" /> },
        { label: "Rekap Kegiatan", path: "/dashboard/rekap-kegiatan", icon: <FileDown className="w-5 h-5" /> },
      ];
    default: // mahasiswa & umum
      return [
        { label: "Kegiatan", path: "/dashboard/kegiatan", icon: <CalendarDays className="w-5 h-5" /> },
        { label: "Kegiatan Saya", path: "/dashboard/kegiatan-saya", icon: <Briefcase className="w-5 h-5" /> },
        { label: "Sertifikat Saya", path: "/dashboard/sertifikat", icon: <Award className="w-5 h-5" /> },
        { label: "Riwayat Kegiatan", path: "/dashboard/riwayat", icon: <History className="w-5 h-5" /> },
      ];
  }
}

export function DashboardLayout() {
  const { profile, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // While session is being resolved show a centered spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#ff6900]" />
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  // ── Route Guard: proteksi halaman berdasarkan role ──
  const path = location.pathname;
  const adminOnlyPaths = ["/dashboard/analitik", "/dashboard/daftar-ormawa"];
  const ormawaOnlyPaths = ["/dashboard/kegiatan-kami", "/dashboard/tambah-kegiatan"];

  if (profile.role !== "admin" && adminOnlyPaths.some(p => path.startsWith(p))) {
    return <Navigate to="/dashboard/kegiatan" replace />;
  }
  if (profile.role !== "ormawa" && ormawaOnlyPaths.some(p => path.startsWith(p))) {
    return <Navigate to="/dashboard/kegiatan" replace />;
  }

  const items = getSidebarItems(profile.role);

  const roleName =
    profile.role === "admin" ? "Admin BEM FIK" :
    profile.role === "ormawa" ? "Ormawa" :
    profile.role === "mahasiswa" ? "Mahasiswa UPNVJ" : "Masyarakat Umum";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 flex items-center gap-2.5 border-b border-border">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <span className="text-sm font-bold text-foreground block">OrmawaEvent <span className="text-[#ff6900]">FIK</span></span>
          <span className="text-[10px] text-muted-foreground">{roleName}</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-[#ff6900]/10 text-[#ff6900]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 border-t border-border space-y-2">
        <Link to="/" onClick={() => setSidebarOpen(false)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition">
          <Home className="w-5 h-5" />
          Kembali ke Beranda
        </Link>
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition">
          {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          {theme === "light" ? "Mode Gelap" : "Mode Terang"}
        </button>

        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center text-xs text-white font-bold shrink-0">
              {profile.full_name[0]}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-foreground truncate">{profile.full_name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{profile.email}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl bg-popover border border-border shadow-xl p-2 z-50">
                <button
                  onClick={() => { setProfileOpen(false); navigate("/dashboard/profil"); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition mb-1"
                >
                  <User className="w-4 h-4" /> Profil Saya
                </button>
                <button
                  onClick={() => { signOut(); setProfileOpen(false); navigate("/"); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r border-border bg-background flex-col shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-background border-r border-border shadow-2xl z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 h-14 border-b border-border flex items-center justify-between px-4" style={{ backgroundColor: 'var(--background)' }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center">
              <Flame className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground">OrmawaEvent <span className="text-[#ff6900]">FIK</span></span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="text-foreground">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
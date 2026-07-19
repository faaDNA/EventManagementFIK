/**
 * @file navbar.tsx
 * @description Komponen bilah navigasi (Navbar) untuk halaman publik (beranda, login, dsb).
 *
 * Menampilkan:
 * - Logo dan navigasi ke beranda
 * - Tombol Login/Register jika belum login
 * - Menu dropdown profil jika sudah login (menuju Dashboard atau Logout)
 * - Toggle tema (dark/light mode)
 */
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "./auth-context";
import { useTheme } from "./theme-context";
import { Flame, Menu, X, LogOut, ChevronDown, Sun, Moon, User, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const navItems = [
    { label: "Beranda", path: "/" },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-white dark:bg-[#0a0a0f] backdrop-blur-xl" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-foreground">OrmawaEvent <span className="text-[#ff6900]">FIK</span></span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                location.pathname === item.path
                  ? "bg-[#ff6900]/10 text-[#ff6900] border-[#ff6900]/20"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border shadow-sm"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {profile && (
            <Link
              to="/dashboard"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                location.pathname.startsWith("/dashboard")
                  ? "bg-[#ff6900]/10 text-[#ff6900] border-[#ff6900]/20"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted border-border shadow-sm"
              }`}
            >
              Dashboard
            </Link>
          )}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground hover:text-foreground">
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {profile ? (
            <div className="flex items-center gap-2">
              <div className="relative">
                <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border hover:bg-accent transition">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center text-xs text-white font-bold">
                    {profile.full_name[0]}
                  </div>
                  <span className="text-sm text-foreground">{profile.full_name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                {dropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 rounded-xl bg-popover border border-border shadow-xl p-2 z-50">
                      <div className="px-3 py-2 border-b border-border mb-1">
                        <p className="text-xs text-muted-foreground">Login sebagai</p>
                        <p className="text-sm text-[#ff6900] font-semibold capitalize">
                          {profile.role === "mahasiswa" ? "Mahasiswa UPNVJ" : profile.role === "umum" ? "Masyarakat Umum" : profile.role === "admin" ? "Admin BEM FIK" : "Ormawa"}
                        </p>
                        {profile.nim && <p className="text-xs text-muted-foreground">NIM: {profile.nim}</p>}
                      </div>
                      <Link to="/dashboard" onClick={() => setDropdownOpen(false)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition mb-1">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link to="/dashboard/profil" onClick={() => setDropdownOpen(false)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-foreground hover:bg-muted transition mb-1">
                        <User className="w-4 h-4" /> Profil Saya
                      </Link>
                      <button onClick={() => { signOut(); setDropdownOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="px-4 py-2 rounded-xl border border-border text-foreground text-sm font-medium hover:bg-muted transition">
                Login
              </Link>
              <Link to="/signup" className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold hover:opacity-90 transition shadow-md shadow-[#ff6900]/20">
                Daftar
              </Link>
            </div>
          )}
        </div>

        {/* Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground">
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 md:hidden border-b border-border p-4 space-y-2 shadow-xl" style={{ backgroundColor: 'var(--background)' }}>
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
              className={`block px-4 py-3 rounded-xl text-sm font-medium ${location.pathname === item.path ? "bg-[#ff6900]/10 text-[#ff6900]" : "text-muted-foreground"}`}>
              {item.label}
            </Link>
          ))}
          {!profile && (
            <div className="flex gap-2 pt-2">
              <Link to="/login" onClick={() => setMobileOpen(false)} className="flex-1 px-4 py-3 rounded-xl border border-border text-foreground text-sm font-medium text-center">
                Login
              </Link>
              <Link to="/signup" onClick={() => setMobileOpen(false)} className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-[#ff6900] to-[#ff8c3a] text-white text-sm font-semibold text-center">
                Daftar
              </Link>
            </div>
          )}
          {profile && (
            <div className="pt-2 border-t border-border mt-2">
              <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-muted/50 rounded-xl border border-border">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff6900] to-[#ff8c3a] flex items-center justify-center text-sm text-white font-bold shrink-0">
                  {profile.full_name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{profile.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </div>
              </div>
              <div className="space-y-1">
                <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium bg-[#ff6900]/10 text-[#ff6900]">
                  Dashboard
                </Link>
                <Link to="/dashboard/profil" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted border border-transparent">
                  <User className="w-4 h-4" /> Profil Saya
                </Link>
                <button onClick={() => { signOut(); setMobileOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-left border border-transparent transition">
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
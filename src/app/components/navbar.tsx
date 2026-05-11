import React, { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "./auth-context";
import { useTheme } from "./theme-context";
import { Flame, Menu, X, LogOut, ChevronDown, Sun, Moon } from "lucide-react";

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
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? "bg-[#ff6900]/10 text-[#ff6900]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2">
          {/* Theme toggle */}
          <button onClick={toggleTheme} className="p-2 rounded-xl hover:bg-muted transition text-muted-foreground hover:text-foreground">
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {profile ? (
            <div className="flex items-center gap-2">
              <Link to="/dashboard" className="px-4 py-2 rounded-xl bg-muted border border-border text-foreground text-sm font-medium hover:bg-accent transition">
                Dashboard
              </Link>
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
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl p-4 space-y-2">
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
            <>
              <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-sm font-medium bg-[#ff6900]/10 text-[#ff6900] text-center">
                Dashboard
              </Link>
              <button onClick={() => { signOut(); setMobileOpen(false); }} className="w-full px-4 py-3 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-left">
                Logout
              </button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
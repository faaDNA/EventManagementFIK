/**
 * @file layout.tsx
 * @description Layout publik dasar untuk halaman seperti beranda, login, dan register.
 * Menampilkan Navbar di bagian atas dan merender konten halaman (Outlet) di bawahnya.
 */
import React from "react";
import { Outlet } from "react-router";
import { Navbar } from "./navbar";

export function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Navbar />
      <Outlet />
    </div>
  );
}

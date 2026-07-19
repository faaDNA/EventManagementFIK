/**
 * @file glass-card.tsx
 * @description Komponen UI dasar untuk kartu (card) bergaya glassmorphism.
 * 
 * Memberikan efek latar belakang blur (backdrop-filter) dengan border tipis dan efek hover interaktif.
 */
import React, { ReactNode } from "react";

export function GlassCard({ children, className = "", onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-border bg-card shadow-sm dark:shadow-lg dark:backdrop-blur-xl ${onClick ? "cursor-pointer hover:shadow-md dark:hover:bg-white/10 hover:border-[#ff6900]/30 transition-all duration-300" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

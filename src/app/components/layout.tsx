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

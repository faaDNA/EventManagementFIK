import { PresensiSession } from "./components/pages/dashboard/presensi-session";
import { AbsenSession } from "./components/pages/dashboard/absen-session";
import { createBrowserRouter, Navigate } from "react-router";
import { Layout } from "./components/layout";
import { DashboardLayout } from "./components/dashboard-layout";
import { HomePage } from "./components/pages/home-page";
import { LoginPage } from "./components/pages/login-page";
import { SignupPage } from "./components/pages/signup-page";
import { EventDetailPage } from "./components/pages/event-detail-page";
import { ForgotPasswordPage } from "./components/pages/forgot-password-page";
import { ResetPasswordPage } from "./components/pages/reset-password-page";
import { DashboardKegiatan } from "./components/pages/dashboard/kegiatan";
import { DashboardKegiatanSaya } from "./components/pages/dashboard/kegiatan-saya";
import { DashboardKegiatanKami } from "./components/pages/dashboard/kegiatan-kami";
import { DashboardKegiatanKamiDetail } from "./components/pages/dashboard/kegiatan-kami-detail";
import { DashboardTambahKegiatan } from "./components/pages/dashboard/tambah-kegiatan";
import { DashboardRiwayat } from "./components/pages/dashboard/riwayat";
import { DashboardAnalitik } from "./components/pages/dashboard/analitik";
import { DashboardDaftarOrmawa } from "./components/pages/dashboard/daftar-ormawa";
import { DashboardEventDetail } from "./components/pages/dashboard/event-detail";
import { DashboardEventRegister } from "./components/pages/dashboard/event-register";
import { DashboardProfilePage } from "./components/pages/dashboard/profile-page";
import { DashboardSertifikatSaya } from "./components/pages/dashboard/sertifikat-saya";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: HomePage },
      { path: "login", Component: LoginPage },
      { path: "signup", Component: SignupPage },
      { path: "forgot-password", Component: ForgotPasswordPage },
      { path: "reset-password", Component: ResetPasswordPage },
      { path: "event/:id", Component: EventDetailPage },
    ],
  },
  {
    path: "/dashboard",
    Component: DashboardLayout,
    children: [
      { index: true, element: <Navigate to="/dashboard/kegiatan" replace /> },
      { path: "kegiatan", Component: DashboardKegiatan },
      { path: "kegiatan-saya", Component: DashboardKegiatanSaya },
      { path: "kegiatan-saya/:eventId/absen/:sessionId", Component: AbsenSession },
      { path: "kegiatan-kami", Component: DashboardKegiatanKami },
      { path: "kegiatan-kami/:id", Component: DashboardKegiatanKamiDetail },
      { path: "kegiatan-kami/:id/presensi/:sessionId", Component: PresensiSession },
      { path: "tambah-kegiatan", Component: DashboardTambahKegiatan },
      { path: "riwayat", Component: DashboardRiwayat },
      { path: "analitik", Component: DashboardAnalitik },
      { path: "daftar-ormawa", Component: DashboardDaftarOrmawa },
      { path: "event/:id", Component: DashboardEventDetail },
      { path: "event/:id/daftar", Component: DashboardEventRegister },
      { path: "profil", Component: DashboardProfilePage },
      { path: "sertifikat", Component: DashboardSertifikatSaya },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
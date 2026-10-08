# OrmawaEvent FIK - Event Management System

Sistem Manajemen Kegiatan (Event Management System) berbasis Web untuk lingkungan Fakultas Ilmu Komputer (FIK). Aplikasi ini memungkinkan organisasi mahasiswa (Ormawa) untuk membuat kegiatan, mengelola pendaftaran peserta, mengelola absensi (presensi), menyelenggarakan kuis otomatis, hingga mendistribusikan e-sertifikat secara digital dan terpusat.

Dibuat menggunakan ekosistem modern: **React, Vite, Tailwind CSS, TypeScript, dan Supabase**.

---

## 🛠 Prasyarat Sistem
Sebelum menjalankan aplikasi, pastikan sistem kamu sudah terinstal alat-alat berikut:
- **Node.js** (v18 atau lebih baru)
- **npm** (atau pnpm / yarn)
- Akun **Supabase** (https://supabase.com)
- Akun **Google Cloud Console** (jika ingin mengaktifkan Google OAuth)

---

## 🚀 Panduan Instalasi & Konfigurasi

### 1. Kloning Repositori & Instalasi Dependensi
Jalankan perintah berikut pada terminal/command prompt:
```bash
# Ekstrak/Kloning repositori ini lalu masuk ke foldernya
npm install
```

### 2. Konfigurasi Supabase (Database Schema)
Aplikasi ini sangat bergantung pada skema database yang sudah didefinisikan.
1. Buat proyek baru di **Supabase Dashboard**.
2. Masuk ke menu **SQL Editor** di sisi kiri.
3. Buka file `supabase/migrations/001_initial_schema.sql` yang ada di kode sumber proyek ini.
4. Salin seluruh isi skema SQL tersebut, tempel (*paste*) ke editor Supabase, lalu klik **Run**.
5. *Skema ini akan otomatis membuat semua tabel yang dibutuhkan, fungsi, dan juga **Triggers** (seperti `handle_new_user` untuk mendaftarkan data profil saat Sign Up).*

### 3. Konfigurasi Supabase Storage (Bucket Aset)
Aplikasi ini membutuhkan wadah untuk menyimpan gambar dan file sertifikat.
1. Masuk ke menu **Storage**.
2. Klik **New Bucket**, buat bucket bernama `event-covers`. Pastikan opsi **Public bucket** dicentang (aktif), tipe file image.
3. Buat bucket satu lagi bernama `form-uploads`. Pastikan opsi **Public bucket** juga dicentang, tipe file pdf.
4. Pastikan untuk membuat **Storage Policies** agar pengguna (atau *authenticated users*) bisa mengunggah (INSERT) dan membaca (SELECT) file dari *bucket* tersebut.

### 4. Konfigurasi Autentikasi & URL Configuration
Agar alur reset password dan Google OAuth berfungsi dan bisa dialihkan kembali ke aplikasimu:
1. Masuk ke **Authentication > URL Configuration**.
2. Pada bagian **Site URL**, masukkan alamat utama aplikasi kamu (misal: `http://localhost:5173` untuk *development lokal*).
3. Pada bagian **Redirect URLs**, tambahkan rute *callback* url versi produksi jika aplikasi sudah dideploy

### 5. Konfigurasi Login Google (Google OAuth)
Aplikasi ini mendukung *Sign In with Google*
1. Masuk ke [Google Cloud Console](https://console.cloud.google.com).
2. Buat proyek baru, berikut link panduan: https://youtu.be/TjMhPr59qn4?si=3tswg1Qqvgmm9BZG.
4. Pada menu Supabase kamu (**Authentication > Sign in/Providers > Google**), salin **Callback URL (untuk OAuth)** yang disediakan oleh Supabase (contoh: `https://[PROJECT_ID].supabase.co/auth/v1/callback`).
5. Kembali ke Google Cloud Console, tempelkan URL tersebut ke kolom **Authorized redirect URIs**.
6. Salin **Client ID** dan **Client Secret** dari Google.
7. Tempelkan ke panel konfigurasi Google di Supabase, lalu pastikan mode provider Google di-**Enable** dan tekan **Save**.

### 6. Pengaturan Row Level Security (RLS)
Keamanan data di Supabase bergantung pada RLS.
- Tabel-tabel yang dibuat dari *schema* awal kemungkinan terkunci secara default.
- Masuk ke menu **Authentication > Policies**.
- Untuk keperluan *Development*, kamu bisa mengizinkan semua akses *(Enable read/write for all)* dengan membuat *policy* bernilai `true` pada tabel `events`, `profiles`, dll.
- **Penting:** Saat akan merilis aplikasi ke produksi, **wajib** memperketat RLS berdasarkan otorisasi peran (*Role-Based Access Control*), misal: hanya "Ormawa" yang bisa menambahkan kegiatan.

### 7. Konfigurasi Environment Variables (.env)
Agar aplikasi frontend bisa terkoneksi dengan backend Supabase kamu:
1. Buat file baru bernama `.env` di direktori paling luar (*root*) proyek.
2. Buka Supabase Dashboard > **Project Settings** > **API**.
3. Salin URL dan Anon Key, kemudian tuliskan seperti contoh berikut:

```env
# Supabase Project URL
VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co

# Supabase Anon/Public Key
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

### 8. Menjalankan Aplikasi
Setelah semua langkah konfigurasi selesai, jalankan server pengembangan (*development server*):
```bash
npm run dev
```
Aplikasi kini siap diakses melalui browser di alamat [http://localhost:5173](http://localhost:5173).

## 📄 Lisensi
Proyek ini dilisensikan di bawah [MIT License](LICENSE). Kamu bebas untuk menggunakan, memodifikasi, dan mendistribusikan sistem ini. Sangat direkomendasikan penggunaannya untuk keperluan belajar pengembangan web.

---
*Dibuat oleh **Daffa Naufal** untuk Tugas Akhir D3 Sistem Informasi (2026).*
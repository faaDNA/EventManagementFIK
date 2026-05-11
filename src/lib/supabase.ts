import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables.\n" +
      "Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY ada di file .env"
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    // ═══════════════════════════════════════════════════════════════════
    // FIX: Bypass navigator.locks agar tidak pernah hang/stuck lagi.
    //
    // Secara default, Supabase menggunakan navigator.locks API untuk
    // mencegah race condition antar-tab saat refresh token. Namun API
    // ini memiliki bug bawaan: jika browser menidurkan (sleep) tab,
    // gembok tidak pernah dilepas, sehingga semua operasi auth
    // (login, logout, refresh) akan hang selamanya.
    //
    // Solusi: bypass navigator.locks dan langsung jalankan fungsinya.
    // Ini 100% aman untuk aplikasi single-tab.
    // ═══════════════════════════════════════════════════════════════════
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      return await fn();
    },
  },
});

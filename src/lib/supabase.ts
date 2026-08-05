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

// In-Memory Lock untuk mencegah Race Condition React Strict Mode
let memoryLock = Promise.resolve();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,

    // ═══════════════════════════════════════════════════════════════════
    // FIX: Bypass navigator.locks dan gunakan In-Memory Lock
    //
    // Secara default, Supabase menggunakan navigator.locks API untuk
    // mencegah race condition antar-tab saat refresh token. Namun API
    // ini memiliki bug bawaan: jika browser menidurkan (sleep) tab,
    // gembok tidak pernah dilepas, sehingga semua operasi auth hang.
    //
    // Solusi lama: langsung eksekusi fn() (terlalu longgar, memicu 400
    // Invalid Refresh Token di React Strict Mode).
    //
    // Solusi baru: Gunakan In-Memory Promise Lock. Memastikan eksekusi
    // antre satu per satu di tab aktif, menghindari race condition.
    // ═══════════════════════════════════════════════════════════════════
    lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
      let release: () => void;
      const waitFor = memoryLock;
      memoryLock = new Promise(resolve => { release = resolve; });
      await waitFor;
      try {
        return await fn();
      } finally {
        release!();
      }
    },
  },
});

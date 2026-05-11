import { supabase } from "./supabase";

// ============================================================
// Supabase Storage Helper
// Sistem upload gambar:
// 1. User pilih file dari device
// 2. Upload ke Supabase Storage bucket
// 3. Dapat public URL
// 4. Simpan URL ke database (avatar_url, logo_url, cover_url)
// 5. Tampilkan: <img src={url} />
// ============================================================

export type StorageBucket = "avatars" | "ormawa-logos" | "event-covers" | "form-uploads";

/**
 * Upload file ke Supabase Storage
 * @returns public URL dari file yang di-upload, atau null jika gagal
 */
export async function uploadFile(
  bucket: StorageBucket,
  filePath: string,
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true, // timpa jika sudah ada
    });

  if (error) {
    console.error(`Upload error [${bucket}]:`, error.message);
    return { error: error.message };
  }

  // Untuk bucket public, dapat public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return { url: urlData.publicUrl, path: data.path };
}

/**
 * Upload avatar/profile picture
 * Path: avatars/{userId}.{ext}
 */
export async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${userId}.${ext}`;
  return uploadFile("avatars", filePath, file);
}

/**
 * Upload logo ormawa
 * Path: ormawa-logos/{ormawaId}.{ext}
 */
export async function uploadOrmawaLogo(ormawaId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${ormawaId}.${ext}`;
  return uploadFile("ormawa-logos", filePath, file);
}

/**
 * Upload cover event
 * Path: event-covers/{eventId}.{ext}
 */
export async function uploadEventCover(eventId: string, file: File) {
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `${eventId}.${ext}`;
  return uploadFile("event-covers", filePath, file);
}

/**
 * Upload file jawaban form (private bucket)
 * Path: form-uploads/{formId}/{userId}/{fieldId}_{timestamp}.{ext}
 */
export async function uploadFormFile(
  formId: string,
  userId: string,
  fieldId: string,
  file: File
) {
  const ext = file.name.split(".").pop() || "bin";
  const timestamp = Date.now();
  const filePath = `${formId}/${userId}/${fieldId}_${timestamp}.${ext}`;
  
  const { data, error } = await supabase.storage
    .from("form-uploads")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false, // jawaban baru, jangan timpa
    });

  if (error) {
    console.error("Form upload error:", error.message);
    return { error: error.message };
  }

  // form-uploads = private bucket, pake signed URL (berlaku 1 jam)
  const { data: signedData, error: signedError } = await supabase.storage
    .from("form-uploads")
    .createSignedUrl(data.path, 3600);

  if (signedError) {
    return { error: signedError.message };
  }

  return { url: signedData.signedUrl, path: data.path };
}

/**
 * Hapus file dari storage
 */
export async function deleteFile(bucket: StorageBucket, filePath: string) {
  const { error } = await supabase.storage.from(bucket).remove([filePath]);
  if (error) {
    console.error(`Delete error [${bucket}]:`, error.message);
    return false;
  }
  return true;
}

/**
 * Dapatkan signed URL untuk file di private bucket (form-uploads)
 * Berlaku selama durationSeconds (default 1 jam)
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  filePath: string,
  durationSeconds = 3600
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, durationSeconds);

  if (error) return null;
  return data.signedUrl;
}

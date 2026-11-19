
import { CDN_SERVICE_URL, CORE_API_URL } from './api';

// ข้อมูลผู้ใช้ที่ Backend ส่งกลับมา
export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_seller: boolean;
  avatar_url?: string | null;
}

// ผลลัพธ์เมื่อ Login หรือ Register สำเร็จ
export interface AuthResponse {
  message: string;
  token: string;
  user: AuthUser;
}

// ผลลัพธ์จากการตรวจสอบ Email
interface CheckEmailResponse {
  exists: boolean;
}

// ฟังก์ชันกลางสำหรับเรียก Auth API
async function authRequest<T>(
  endpoint: string,
  body: Record<string, string>,
): Promise<T> {
  const response = await fetch(
    `${CORE_API_URL}/api/auth/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || 'Authentication failed. Please try again.',
    );
  }

  return data as T;
}

// ตรวจสอบว่า Email มีบัญชีแล้วหรือไม่
export async function checkEmail(email: string): Promise<boolean> {
  const result = await authRequest<CheckEmailResponse>('check-email', {
    email: email.trim().toLowerCase(),
  });

  return result.exists;
}

// เข้าสู่ระบบ
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return authRequest<AuthResponse>('login', {
    email: email.trim().toLowerCase(),
    password,
  });
}

// สมัครสมาชิก
export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  return authRequest<AuthResponse>('register', {
    email: email.trim().toLowerCase(),
    password,
    displayName: displayName.trim(),
  });
}

// อัปเดตชื่อที่แสดงของบัญชีปัจจุบัน (PATCH /api/auth/profile)
export async function updateProfile(
  displayName: string,
  token: string,
): Promise<AuthUser> {
  const response = await fetch(`${CORE_API_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ displayName: displayName.trim() }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to update profile.');
  }

  return data.user as AuthUser;
}

// อัปโหลดโลโก้/รูปโปรไฟล์ไปยัง cdn-service (Supabase bucket: profile_logo)
export async function uploadMyAvatar(
  file: Blob,
  token: string,
  filename = 'avatar.png',
): Promise<string | null> {
  const form = new FormData();
  form.append('avatar', file, filename);

  const response = await fetch(`${CDN_SERVICE_URL}/api/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || `Upload failed (${response.status})`);
  }

  return data?.avatarPath ? `${CDN_SERVICE_URL}${data.avatarPath}` : null;
}

// ลบรูปโปรไฟล์ออกจาก cdn-service และ Supabase bucket: profile_logo
export async function deleteMyAvatar(token: string): Promise<void> {
  const response = await fetch(`${CDN_SERVICE_URL}/api/me/avatar`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error?.message || `Failed to remove avatar (${response.status})`);
  }
}

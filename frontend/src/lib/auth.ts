
import { CDN_SERVICE_URL, CORE_API_URL } from './api';

// ข้อมูลผู้ใช้ที่ Backend ส่งกลับมา
export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: string;
  is_seller: boolean;
  avatar_url?: string | null;
  bio?: string | null;
  featured_model_ids?: string[] | null;
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

/**
 * A failed auth request. `code` says what kind of failure it was so the form can show it in the visitor's language:
 * `API` = the server sent a message (shown as the server wrote it), `NETWORK` = the server could not be reached,
 * `GENERIC` = a failure without a message. Extends Error, so code that only reads `err.message` keeps working.
 */
export class AuthError extends Error {
  constructor(
    public code: 'API' | 'NETWORK' | 'GENERIC',
    message = '',
  ) {
    super(message || (code === 'NETWORK' ? 'Cannot reach the server. Please try again.' : 'Authentication failed. Please try again.'));
  }
}

// ฟังก์ชันกลางสำหรับเรียก Auth API
async function authRequest<T>(
  endpoint: string,
  body: Record<string, string>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `${CORE_API_URL}/api/auth/${endpoint}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
  } catch {
    throw new AuthError('NETWORK');
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.error?.message;
    throw message ? new AuthError('API', message) : new AuthError('GENERIC');
  }
  // A success answer that is not JSON is as unusable as a failure.
  if (data === null) throw new AuthError('GENERIC');

  return data as T;
}

/**
 * The login page found no account for the email: it saves the email under this key in the tab's sessionStorage and goes
 * to /register, which reads it once to fill the email field. It is not put in the URL, so it stays out of browser
 * history, referrers and server logs.
 */
export const REGISTER_EMAIL_KEY = 'lixyte-register-email';

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

// ขอรหัส OTP สำหรับรีเซ็ตรหัสผ่าน (คืน devOtp เฉพาะโหมดเดโม / mock mailbox)
export async function requestPasswordReset(email: string): Promise<string | null> {
  const result = await authRequest<{ message: string; devOtp?: string }>('forgot-password', {
    email: email.trim().toLowerCase(),
  });
  return result.devOtp ?? null;
}

// ตรวจ OTP แล้วรับ token แบบใช้ครั้งเดียวสำหรับตั้งรหัสผ่านใหม่
export async function verifyResetOtp(email: string, otp: string): Promise<string> {
  const result = await authRequest<{ token: string }>('verify-reset-otp', {
    email: email.trim().toLowerCase(),
    otp,
  });
  return result.token;
}

// ตั้งรหัสผ่านใหม่ด้วย token จากลิงก์
export async function resetPassword(token: string, password: string): Promise<void> {
  await authRequest<{ message: string }>('reset-password', { token, password });
}

// Sends a request for the signed-in account and returns the JSON body. Failures become AuthError so the page can
// show them in the visitor's language (see authErrorText).
async function accountRequest(url: string, init: RequestInit): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new AuthError('NETWORK');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.error?.message;
    throw message ? new AuthError('API', message) : new AuthError('GENERIC');
  }
  return data;
}

export interface UpdateProfileParams {
  displayName?: string;
  bio?: string;
  featuredModelIds?: string[];
}
export type UpdateProfileInput = UpdateProfileParams;

// อัปเดตข้อมูลโปรไฟล์ (ชื่อที่แสดง / bio / featuredModelIds) ของบัญชีปัจจุบัน (PATCH /api/auth/profile)
export async function updateProfile(
  params: string | UpdateProfileParams,
  token: string,
): Promise<AuthUser> {
  const body =
    typeof params === 'string'
      ? { displayName: params.trim() }
      : {
          ...(params.displayName !== undefined ? { displayName: params.displayName.trim() } : {}),
          ...(params.bio !== undefined ? { bio: params.bio.trim() } : {}),
          ...(params.featuredModelIds !== undefined ? { featuredModelIds: params.featuredModelIds } : {}),
        };

  const data = await accountRequest(`${CORE_API_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

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

  const data = await accountRequest(`${CDN_SERVICE_URL}/api/me/avatar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  return data?.avatarPath ? `${CDN_SERVICE_URL}${data.avatarPath}` : null;
}

// ลบรูปโปรไฟล์ออกจาก cdn-service และ Supabase bucket: profile_logo
export async function deleteMyAvatar(token: string): Promise<void> {
  await accountRequest(`${CDN_SERVICE_URL}/api/me/avatar`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

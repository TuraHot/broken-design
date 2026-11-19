
import { CORE_API_URL } from './api';

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

// อัปเดตโปรไฟล์ (ชื่อผู้ใช้ / รูปโปรไฟล์ avatarUrl)
export async function updateProfile(
  data: { displayName?: string; avatarUrl?: string | null },
  token: string,
): Promise<AuthUser> {
  const response = await fetch(`${CORE_API_URL}/api/auth/profile`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const resData = await response.json();
  if (!response.ok) {
    throw new Error(resData?.error?.message || 'Failed to update profile');
  }

  return resData.user as AuthUser;
}

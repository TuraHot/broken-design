// Account lookup for the email-first sign-in form. Mocked until core-api auth exists (UI only).
const REGISTERED = ['demo@example.com', 'mira@example.com', 'jun@example.com'];

/** Has this email registered before? Replace the body with a core-api call when `/api/auth/*` exists. */
export async function checkEmail(email: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 350));
  return REGISTERED.includes(email.trim().toLowerCase());
}

// Auth pages are full-screen: no navbar, no footer.
const AUTH_PATHS = ['/login', '/register', '/forgot-password'];

export const isAuthPath = (pathname: string) => AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// The admin area has its own layout (sidebar, `components/admin/AdminShell.tsx`), so the public
// navbar and footer stay out of it.
export const isAdminPath = (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/');

export const isEmbedPath = (pathname: string) => pathname === '/embed' || pathname.startsWith('/embed/');

/** Pages that bring their own chrome and must not show the public navbar / footer. */
export const hidesPublicChrome = (pathname: string) =>
  isAuthPath(pathname) || isAdminPath(pathname) || isEmbedPath(pathname);

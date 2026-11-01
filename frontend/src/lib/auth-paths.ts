// Auth pages are full-screen: no navbar, no footer.
const AUTH_PATHS = ['/login', '/forgot-password'];

export const isAuthPath = (pathname: string) => AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

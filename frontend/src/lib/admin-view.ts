// "View Website": an admin normally stays in /admin (components/AdminOnlyRedirect.tsx). The button in the
// admin layout sets this flag for the current tab so the public pages open instead of bouncing back;
// opening any /admin page clears it again. The flag only changes what the UI does; the API checks roles.
const KEY = 'adminViewSite';

export function startViewingSite(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage can be blocked (private mode): the redirect will simply win.
  }
}

export function stopViewingSite(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

export function isViewingSite(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

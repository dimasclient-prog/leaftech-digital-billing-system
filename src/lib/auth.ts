import bcrypt from "bcryptjs";

// Static credentials — password stored as bcrypt hash (never plaintext).
// Username: dimas / Password: leaftech
const USERNAME = "dimas";
const PASSWORD_HASH = "$2b$10$t0JKuAAuLdnkw9J4U0FFKOElOV01qVSToQy9XZTD78Lspnu2gBkym";
const SESSION_KEY = "leaftech_auth_v1";

export function verifyCredentials(username: string, password: string): boolean {
  if (username.trim().toLowerCase() !== USERNAME) return false;
  try {
    return bcrypt.compareSync(password, PASSWORD_HASH);
  } catch {
    return false;
  }
}

export function signIn(username: string) {
  const token = {
    u: username.trim().toLowerCase(),
    t: Date.now(),
  };
  localStorage.setItem(SESSION_KEY, btoa(JSON.stringify(token)));
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
}

export function isAuthenticated(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(atob(raw));
    return parsed?.u === USERNAME;
  } catch {
    return false;
  }
}

export function getCurrentUser(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(atob(raw));
    return parsed?.u ?? null;
  } catch {
    return null;
  }
}
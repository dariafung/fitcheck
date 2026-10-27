// Small browser-preference cookies (weather location, units). Written by page
// JS, read by both the page and the server from the Cookie header.
export const ONE_YEAR_S = 60 * 60 * 24 * 365;

// The decoded value of one cookie in a Cookie header (or document.cookie).
export function cookieValue(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1 || part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

// A Set-Cookie style string for document.cookie. maxAgeS 0 deletes it.
export function cookieString(name: string, value: string, maxAgeS = ONE_YEAR_S): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeS}; SameSite=Lax`;
}

// Browser only: stores a cookieString(...) result.
export function writeCookie(setCookie: string): void {
  document.cookie = setCookie;
}

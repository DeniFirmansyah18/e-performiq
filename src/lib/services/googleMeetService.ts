/**
 * GoogleMeetService — membuat tautan ruang wawancara.
 *
 * Bila kredensial OAuth Google tersedia di env, endpoint memakai Google Meet
 * REST API (`spaces.create`) untuk membuat ruang nyata. Bila tidak, sistem
 * melakukan fallback ke generator tautan `meet.google.com` yang deterministik-
 * tampak (pola XXX-XXXX-XXX) sehingga panel HR tetap fungsional tanpa kredensial.
 *
 * Env yang dibaca (semua opsional; integrasi aktif hanya bila lengkap):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_REFRESH_TOKEN
 *   GOOGLE_MEET_ENABLED  — "false" untuk memaksa fallback.
 *
 * Deterministik, driver-agnostic, best-effort: kegagalan API tidak boleh
 * menggagalkan penjadwalan wawancara.
 */

export interface GenerateRoomResult {
  meetingUrl: string;
  provider: 'GOOGLE_MEET_API' | 'FALLBACK';
  note?: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

/** Apakah integrasi Google Meet REST API dikonfigurasi via env. */
export function isGoogleMeetConfigured(): boolean {
  if (String(process.env.GOOGLE_MEET_ENABLED ?? '').toLowerCase() === 'false') return false;
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN,
  );
}

/** Tukar refresh token menjadi access token (OAuth2). */
async function getAccessToken(): Promise<string | null> {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN as string,
    grant_type: 'refresh_token',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!res.ok || !json.access_token) return null;
  return json.access_token;
}

/** Buat ruang Google Meet nyata via REST API. */
async function createMeetSpace(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  const res = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // accessType OPEN → "siapa pun yang memiliki tautan bisa bergabung tanpa
    // menunggu izin" (kandidat eksternal tidak diblokir oleh kebijakan org TRUSTED).
    body: JSON.stringify({ config: { accessType: 'OPEN' } }),
  });
  const json = (await res.json().catch(() => ({}))) as { meetingUri?: string; name?: string };
  if (!res.ok) return null;
  // `meetingUri` mis. https://meet.google.com/abc-defg-hij
  return json.meetingUri ?? null;
}

/** Karakter base-32 tanpa huruf ambigu agar mudah dibaca lisan. */
const ALPHA = 'abcdefghijkmnopqrstuvwxyz';

function pick(n: number): string {
  let out = '';
  for (let i = 0; i < n; i += 1) out += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return out;
}

/** Generator tautan fallback: pola khas Meet XXX-XXXX-XXX. */
function fallbackMeetUrl(): string {
  return `https://meet.google.com/${pick(3)}-${pick(4)}-${pick(3)}`;
}

/**
 * Buat tautan ruang wawancara. Coba Google Meet REST API lebih dulu (bila
 * dikonfigurasi), lalu fallback ke generator tautan.
 */
export async function generateInterviewRoom(): Promise<GenerateRoomResult> {
  if (isGoogleMeetConfigured()) {
    try {
      const uri = await createMeetSpace();
      if (uri) return { meetingUrl: uri, provider: 'GOOGLE_MEET_API' };
    } catch {
      /* jatuh ke fallback */
    }
  }
  return {
    meetingUrl: fallbackMeetUrl(),
    provider: 'FALLBACK',
    note: isGoogleMeetConfigured()
      ? 'Google Meet API gagal; memakai tautan fallback.'
      : 'Integrasi Google Meet belum dikonfigurasi; memakai tautan fallback.',
  };
}

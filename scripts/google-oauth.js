#!/usr/bin/env node
/**
 * scripts/google-oauth.js — ambil GOOGLE_REFRESH_TOKEN untuk Google Meet API.
 *
 * Alur: OAuth 2.0 Authorization Code (offline) -> refresh token.
 * Tanpa dependency tambahan (cukup Node built-in + fetch bawaan Node 18+).
 *
 * Pemakaian:
 *   1. Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di .env.local.
 *   2. node scripts/google-oauth.js
 *   3. Buka URL yang tercetak di browser, izinkan akses.
 *   4. Copy "code" dari URL redirect (baris address bar) lalu paste ke terminal.
 *   5. Script menulis GOOGLE_REFRESH_TOKEN ke .env.local.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const ENV_LOCAL = path.join(ROOT, '.env.local');

const SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

// Redirect "manual copy/paste" yang aman: halaman tidak perlu benar-benar hidup.
const REDIRECT_URI = 'http://localhost';

function readEnvLocal() {
  if (!fs.existsSync(ENV_LOCAL)) {
    console.error('✗ .env.local tidak ditemukan. Buat dulu dari .env.example.');
    process.exit(1);
  }
  const raw = fs.readFileSync(ENV_LOCAL, 'utf8');
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) map[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return { raw, map };
}

function upsertEnvLocal(raw, key, value) {
  const re = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
  const line = `${key}=${value}`;
  if (re.test(raw)) return raw.replace(re, line);
  // sisipkan di akhir bila belum ada
  return raw.replace(/\s*$/, '\n') + line + '\n';
}

async function exchangeCode(code, clientId, clientSecret) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error('✗ Gagal menukar code dengan token:');
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

async function main() {
  const { raw, map } = readEnvLocal();
  const clientId = map.GOOGLE_CLIENT_ID;
  const clientSecret = map.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('✗ GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET harus diisi di .env.local dulu.');
    process.exit(1);
  }

  const url = `${AUTH_ENDPOINT}?` + new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  }).toString();

  console.log('\n=== OTORISASI GOOGLE MEET ===');
  console.log('1) Buka URL di bawah ini di browser dan login dengan akun Google yang punya akses Meet:\n');
  console.log(url + '\n');
  console.log('2) Setelah klik "Allow", browser akan redirect ke http://localhost/?code=...');
  console.log('   (Halaman boleh gagal dimuat — yang penting URL di address bar berisi ?code=...)\n');

  const answer = await ask('3) Paste di sini SELURUH URL redirect (atau hanya nilai code-nya): ');

  let code = answer;
  if (answer.includes('code=')) {
    try {
      code = new URL(answer).searchParams.get('code') || answer;
    } catch {
      const m = answer.match(/[?&]code=([^&]+)/);
      code = m ? decodeURIComponent(m[1]) : answer;
    }
  }

  console.log('\n… menukar code dengan refresh token');
  const token = await exchangeCode(code, clientId, clientSecret);

  if (!token.refresh_token) {
    console.error('\n✗ Tidak ada refresh_token pada respons.');
    console.error('  Biasanya karena akun sudah pernah menyetujui scope ini.');
    console.error('  Solusi: cabut akses di https://myaccount.google.com/permissions lalu jalankan ulang script ini.');
    console.error('\nRespons mentah:', JSON.stringify(token, null, 2));
    process.exit(1);
  }

  const updated = upsertEnvLocal(raw, 'GOOGLE_REFRESH_TOKEN', token.refresh_token);
  fs.writeFileSync(ENV_LOCAL, updated, 'utf8');

  console.log('\n✓ Berhasil! GOOGLE_REFRESH_TOKEN sudah ditulis ke .env.local.');
  console.log('  Scope :', SCOPE);
  console.log('  Restart dev server (npm run dev) agar kredensial dibaca ulang.');
}

main().catch((err) => {
  console.error('✗ Error:', err.message);
  process.exit(1);
});

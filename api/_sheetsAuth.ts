import { createSign } from 'node:crypto';

let cachedToken: { value: string; exp: number } | null = null;

function toBase64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeJwt(email: string, pem: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header  = toBase64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const payload = toBase64url(Buffer.from(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })));

  const toSign = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(toSign);
  const sig = toBase64url(Buffer.from(signer.sign(pem, 'base64'), 'base64'));
  return `${toSign}.${sig}`;
}

export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp) return cachedToken.value;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const rawKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!email || !rawKey) throw new Error('환경변수 미설정: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY');

  const jwt = makeJwt(email, rawKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('access_token 발급 실패: ' + JSON.stringify(data));

  const exp = (Math.floor(Date.now() / 1000) + 3500) * 1000;
  cachedToken = { value: data.access_token, exp };
  return data.access_token;
}

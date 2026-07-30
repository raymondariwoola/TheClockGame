export const MAX_SHARE_CARD_BYTES = 1536 * 1024;

export function isPng(bytes) {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  return value.byteLength >= 20 && value[0] === 0x89 && value[1] === 0x50 && value[2] === 0x4e && value[3] === 0x47 &&
    value[4] === 0x0d && value[5] === 0x0a && value[6] === 0x1a && value[7] === 0x0a;
}

export async function readPng(request) {
  if ((request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'image/png') {
    return { error: 'invalid_share_card_type', status: 415 };
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_SHARE_CARD_BYTES) return { error: 'share_card_too_large', status: 413 };
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_SHARE_CARD_BYTES) return { error: 'share_card_too_large', status: 413 };
  if (!isPng(bytes)) return { error: 'invalid_share_card', status: 400 };
  return { bytes };
}

export function cardResponse(bytes) {
  if (!bytes) return Response.json({ ok: false, error: 'share_card_not_found' }, { status: 404 });
  return new Response(bytes, { headers: {
    'Content-Type': 'image/png', 'Content-Length': String(bytes.byteLength),
    'Cache-Control': 'public, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff',
  } });
}

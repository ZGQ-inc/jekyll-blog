/**
 * Cloudflare Pages Middleware
 * Intercepts TelegramBot User-Agent to render Telegram Instant View
 * seamlessly without breaking AES client-side encryption for regular users.
 */

interface Env {
  VAULT_KEY?: string;
  [key: string]: any;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function base64ToBytes(base64: string): Uint8Array {
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const response = await context.next();
  const userAgent = context.request.headers.get('User-Agent') || '';

  // Only decrypt on-the-fly for Telegram's Instant View bot
  if (!userAgent.includes('TelegramBot')) {
    return response;
  }

  const keyHex = context.env.VAULT_KEY;
  if (!keyHex) {
    // If secret is not set, pass through original response
    return response;
  }

  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();
  const match = html.match(/id="vaultData"[^>]*data-iv="([^"]+)"[^>]*data-cipher="([^"]+)"/);
  if (!match) {
    return new Response(html, response);
  }

  const ivHex = match[1];
  const cipherBase64 = match[2];

  try {
    const keyBytes = hexToBytes(keyHex);
    const ivBytes = hexToBytes(ivHex);
    const cipherBytes = base64ToBytes(cipherBase64);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      cryptoKey,
      cipherBytes
    );

    const decryptedHtml = new TextDecoder('utf-8').decode(decryptedBuffer);

    // Replace the empty container with decrypted HTML for Instant View generator
    const modifiedHtml = html.replace(
      /<div class="article-content" id="vaultDecryptedContent"[^>]*style="display:none;"[^>]*><\/div>/,
      `<div class="article-content" itemprop="articleBody">${decryptedHtml}</div>`
    );

    const newHeaders = new Headers(response.headers);
    newHeaders.delete('content-length');

    return new Response(modifiedHtml, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (err) {
    return new Response(html, response);
  }
};

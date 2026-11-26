// Standard Bybit API keys use hex HMAC-SHA256, never stored RSA keys.
export async function signBybitHmac(
  apiKey: string,
  apiSecret: string,
  params: string,
  timestamp: number,
  recvWindow: string,
): Promise<{ sign: string; type: string }> {
  if (!apiKey || !apiSecret) throw new Error('Configure a chave e o segredo da API Bybit padrão.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const message = encoder.encode(`${timestamp}${apiKey}${recvWindow}${params}`);
  const signature = await crypto.subtle.sign('HMAC', key, message);
  return {
    sign: Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join(''),
    type: '2',
  };
}
/**
 * Registro único de venues suportadas.
 *
 * Regras de segurança:
 * - Bybit mantém o caminho real existente (HMAC v2) e não é alterado aqui.
 * - Toda venue nova começa em SIMULAÇÃO. Só vira real quando a variável
 *   `<ID>_ENABLE_LIVE` for explicitamente "true" e as credenciais existirem.
 * - B3 é somente sinais/simulação: corretoras brasileiras não expõem API
 *   pública de ordens para pessoa física neste projeto.
 */

export type ExchangeId = 'BYBIT' | 'BINANCE' | 'OKX' | 'BITGET' | 'KUCOIN' | 'GATEIO' | 'B3' | 'BYBIT_TESTNET' | 'BINANCE_TESTNET';

export type ExchangeKind = 'crypto-perp' | 'b3-futures';

export interface ExchangeSpec {
  id: ExchangeId;
  name: string;
  kind: ExchangeKind;
  /** Símbolos conhecidos; na B3, a vigência é filtrada por isB3Symbol. */
  symbols: string[];
  keyEnv: string;
  secretEnv: string;
  passphraseEnv?: string;
  liveFlagEnv: string;
  /** true somente para a Bybit, que já opera com credenciais configuradas. */
  liveByDefault: boolean;
  supportsOrders: boolean;
  /** Venue de testnet/paper: nunca envia ordem real, mesmo com dry_run=false. */
  paper?: boolean;
  baseUrl?: string;
  quoteCurrency: string;
  /** Corretoras B3 que podem ser exibidas como destino dos sinais. */
  brokers?: string[];
}

/** Vigência civil (Brasília) de cada contrato B3; datas inclusivas. */
export interface B3Contract {
  symbol: string;
  validFrom: string; // YYYY-MM-DD
  expiresAt: string; // YYYY-MM-DD
  ativo: boolean;
}

/**
 * Registro dos contratos B3. A rolagem é feita aqui (e na tabela
 * public.b3_contracts): WDOZ26 -> WDOF27 em 02/12/2026 e
 * WINZ26 -> WINF27 em 17/12/2026. WINZ25/WDOF26 nunca são aceitos.
 */
export const B3_CONTRACTS: readonly B3Contract[] = [
  { symbol: 'WINZ26', validFrom: '2026-01-01', expiresAt: '2026-12-16', ativo: true },
  { symbol: 'WDOZ26', validFrom: '2026-01-01', expiresAt: '2026-12-01', ativo: true },
  { symbol: 'WINF27', validFrom: '2026-12-17', expiresAt: '2027-01-31', ativo: true },
  { symbol: 'WDOF27', validFrom: '2026-12-02', expiresAt: '2027-01-31', ativo: true },
];

/** Contratos vigentes e agendados (para registry/UI); a vigência é checada por isB3Symbol. */
export const B3_SYMBOLS: readonly string[] = B3_CONTRACTS.map((c) => c.symbol);

/** Data civil de Brasília, no formato YYYY-MM-DD (comparável lexicograficamente). */
function b3TradingDate(date: Date): string | null {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Registro único de venues; a B3 usa os contratos acima, sem ordens reais. */
export const SUPPORTED_EXCHANGES: readonly ExchangeSpec[] = [
  {
    id: 'BYBIT', name: 'Bybit', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    keyEnv: 'BYBIT_API_KEY', secretEnv: 'BYBIT_API_SECRET',
    liveFlagEnv: 'BYBIT_ENABLE_LIVE', liveByDefault: true,
    supportsOrders: true, baseUrl: 'https://api.bybit.com', quoteCurrency: 'USDT',
  },
  {
    id: 'BINANCE', name: 'Binance Futures', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    keyEnv: 'BINANCE_API_KEY', secretEnv: 'BINANCE_API_SECRET',
    liveFlagEnv: 'BINANCE_ENABLE_LIVE', liveByDefault: false,
    supportsOrders: true, baseUrl: 'https://fapi.binance.com', quoteCurrency: 'USDT',
  },
  {
    id: 'OKX', name: 'OKX', kind: 'crypto-perp',
    symbols: ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP'],
    keyEnv: 'OKX_API_KEY', secretEnv: 'OKX_API_SECRET',
    passphraseEnv: 'OKX_API_PASSPHRASE', liveFlagEnv: 'OKX_ENABLE_LIVE',
    liveByDefault: false, supportsOrders: true,
    baseUrl: 'https://www.okx.com', quoteCurrency: 'USDT',
  },
  {
    id: 'BITGET', name: 'Bitget', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    keyEnv: 'BITGET_API_KEY', secretEnv: 'BITGET_API_SECRET',
    passphraseEnv: 'BITGET_API_PASSPHRASE', liveFlagEnv: 'BITGET_ENABLE_LIVE',
    liveByDefault: false, supportsOrders: true,
    baseUrl: 'https://api.bitget.com', quoteCurrency: 'USDT',
  },
  {
    id: 'KUCOIN', name: 'KuCoin Futures', kind: 'crypto-perp',
    symbols: ['XBTUSDTM', 'ETHUSDTM', 'SOLUSDTM'],
    keyEnv: 'KUCOIN_API_KEY', secretEnv: 'KUCOIN_API_SECRET',
    passphraseEnv: 'KUCOIN_API_PASSPHRASE', liveFlagEnv: 'KUCOIN_ENABLE_LIVE',
    liveByDefault: false, supportsOrders: true,
    baseUrl: 'https://api-futures.kucoin.com', quoteCurrency: 'USDT',
  },
  {
    id: 'GATEIO', name: 'Gate.io Futures', kind: 'crypto-perp',
    symbols: ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'],
    keyEnv: 'GATEIO_API_KEY', secretEnv: 'GATEIO_API_SECRET',
    liveFlagEnv: 'GATEIO_ENABLE_LIVE', liveByDefault: false,
    supportsOrders: true, baseUrl: 'https://api.gateio.ws', quoteCurrency: 'USDT',
  },
  {
    id: 'B3', name: 'B3 (WIN/WDO)', kind: 'b3-futures',
    symbols: [...B3_SYMBOLS],
    keyEnv: 'B3_API_KEY', secretEnv: 'B3_API_SECRET',
    liveFlagEnv: 'B3_ENABLE_LIVE', liveByDefault: false,
    supportsOrders: false, quoteCurrency: 'BRL',
    brokers: ['XP', 'Inter', 'Rico', 'Genial'],
  },
  {
    id: 'BYBIT_TESTNET', name: 'Bybit Testnet', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    keyEnv: 'BYBIT_TESTNET_API_KEY', secretEnv: 'BYBIT_TESTNET_API_SECRET',
    liveFlagEnv: 'BYBIT_TESTNET_ENABLE_LIVE', liveByDefault: false,
    supportsOrders: false, paper: true,
    baseUrl: 'https://api-testnet.bybit.com', quoteCurrency: 'USDT',
  },
  {
    id: 'BINANCE_TESTNET', name: 'Binance Testnet', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    keyEnv: 'BINANCE_TESTNET_API_KEY', secretEnv: 'BINANCE_TESTNET_API_SECRET',
    liveFlagEnv: 'BINANCE_TESTNET_ENABLE_LIVE', liveByDefault: false,
    supportsOrders: false, paper: true,
    baseUrl: 'https://testnet.binancefuture.com', quoteCurrency: 'USDT',
  },
];

export function isExchangeId(value: unknown): value is ExchangeId {
  return typeof value === 'string' && SUPPORTED_EXCHANGES.some((s) => s.id === value);
}

export function isPaperExchange(value: unknown): boolean {
  const spec = getExchangeSpec(value);
  return !!spec?.paper;
}

export function getExchangeSpec(value: unknown): ExchangeSpec | null {
  if (!isExchangeId(value)) return null;
  return SUPPORTED_EXCHANGES.find((s) => s.id === value) ?? null;
}

export function isB3Symbol(symbol: unknown, date: Date = new Date()): boolean {
  if (typeof symbol !== 'string') return false;
  const day = b3TradingDate(date);
  if (!day) return false;
  const upper = symbol.trim().toUpperCase();
  return B3_CONTRACTS.some((contract) =>
    contract.ativo &&
    day >= contract.validFrom && day <= contract.expiresAt &&
    (upper === contract.symbol || upper.startsWith(`${contract.symbol}-`)),
  );
}

/** Nunca aceita os contratos legados vencidos (WINZ25/WDOF26). */
export function isExpiredB3Symbol(symbol: unknown): boolean {
  if (typeof symbol !== 'string') return false;
  return /^(WINZ25|WDOF26)(\b|-|$)/i.test(symbol.trim());
}

export function normalizeSymbol(exchange: ExchangeId, symbol: unknown): string {
  if (typeof symbol !== 'string') return '';
  const raw = symbol.trim().toUpperCase();
  if (exchange === 'B3') return raw.split(/[-:]/)[0];
  if (exchange === 'OKX') return raw.replace(/\//g, '-');
  if (exchange === 'GATEIO') return raw.replace(/-/g, '_');
  return raw.replace(/[^A-Z0-9]/g, '');
}

export type EnvReader = (name: string) => string | undefined;

const defaultEnvReader: EnvReader = (name) =>
  typeof Deno === 'undefined' ? undefined : Deno.env.get(name) ?? undefined;

export function exchangeCredentials(spec: ExchangeSpec, readEnv: EnvReader = defaultEnvReader): {
  key: string; secret: string; passphrase: string;
} {
  return {
    key: readEnv(spec.keyEnv) ?? '',
    secret: readEnv(spec.secretEnv) ?? '',
    passphrase: spec.passphraseEnv ? readEnv(spec.passphraseEnv) ?? '' : '',
  };
}

/** Live só com opt-in explícito + credenciais. B3 nunca habilita ordens. */
export function isExchangeLiveEnabled(
  spec: ExchangeSpec,
  readEnv: EnvReader = defaultEnvReader,
): boolean {
  if (!spec.supportsOrders || spec.paper || spec.id === 'B3') return false;
  const creds = exchangeCredentials(spec, readEnv);
  if (!creds.key || !creds.secret) return false;
  if (spec.passphraseEnv && !creds.passphrase) return false;
  if (spec.liveByDefault) return true;
  return (readEnv(spec.liveFlagEnv) ?? '').toLowerCase() === 'true';
}

export function exchangeSummary() {
  return SUPPORTED_EXCHANGES.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    symbols: s.symbols,
    quoteCurrency: s.quoteCurrency,
    supportsOrders: s.supportsOrders,
    simulationOnly: !s.supportsOrders || !!s.paper,
    paper: !!s.paper,
    brokers: s.brokers ?? [],
    credentialNames: [s.keyEnv, s.secretEnv, ...(s.passphraseEnv ? [s.passphraseEnv] : [])],
    enableFlag: s.liveFlagEnv,
  }));
}

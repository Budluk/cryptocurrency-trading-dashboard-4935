/**
 * Espelho (somente leitura) do registro de venues do backend.
 * Mantido em src/ para que a UI não importe código de edge functions.
 */

export type ExchangeId = 'BYBIT' | 'BINANCE' | 'OKX' | 'BITGET' | 'KUCOIN' | 'GATEIO' | 'B3';

export interface ExchangeInfo {
  id: ExchangeId;
  name: string;
  kind: 'crypto-perp' | 'b3-futures';
  symbols: string[];
  quoteCurrency: string;
  supportsOrders: boolean;
  brokers: string[];
  credentialNames: string[];
  enableFlag: string;
}

export const EXCHANGES: readonly ExchangeInfo[] = [
  {
    id: 'BYBIT', name: 'Bybit', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], quoteCurrency: 'USDT',
    supportsOrders: true, brokers: [],
    credentialNames: ['BYBIT_API_KEY', 'BYBIT_API_SECRET'], enableFlag: 'BYBIT_ENABLE_LIVE',
  },
  {
    id: 'BINANCE', name: 'Binance Futures', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], quoteCurrency: 'USDT',
    supportsOrders: true, brokers: [],
    credentialNames: ['BINANCE_API_KEY', 'BINANCE_API_SECRET'], enableFlag: 'BINANCE_ENABLE_LIVE',
  },
  {
    id: 'OKX', name: 'OKX', kind: 'crypto-perp',
    symbols: ['BTC-USDT-SWAP', 'ETH-USDT-SWAP', 'SOL-USDT-SWAP'], quoteCurrency: 'USDT',
    supportsOrders: true, brokers: [],
    credentialNames: ['OKX_API_KEY', 'OKX_API_SECRET', 'OKX_API_PASSPHRASE'], enableFlag: 'OKX_ENABLE_LIVE',
  },
  {
    id: 'BITGET', name: 'Bitget', kind: 'crypto-perp',
    symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'], quoteCurrency: 'USDT',
    supportsOrders: true, brokers: [],
    credentialNames: ['BITGET_API_KEY', 'BITGET_API_SECRET', 'BITGET_API_PASSPHRASE'], enableFlag: 'BITGET_ENABLE_LIVE',
  },
  {
    id: 'KUCOIN', name: 'KuCoin Futures', kind: 'crypto-perp',
    symbols: ['XBTUSDTM', 'ETHUSDTM', 'SOLUSDTM'], quoteCurrency: 'USDT',
    supportsOrders: true, brokers: [],
    credentialNames: ['KUCOIN_API_KEY', 'KUCOIN_API_SECRET', 'KUCOIN_API_PASSPHRASE'], enableFlag: 'KUCOIN_ENABLE_LIVE',
  },
  {
    id: 'GATEIO', name: 'Gate.io Futures', kind: 'crypto-perp',
    symbols: ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'], quoteCurrency: 'USDT',
    supportsOrders: true, brokers: [],
    credentialNames: ['GATEIO_API_KEY', 'GATEIO_API_SECRET'], enableFlag: 'GATEIO_ENABLE_LIVE',
  },
  {
    id: 'B3', name: 'B3 (WIN/WDO)', kind: 'b3-futures',
    symbols: ['WINZ26', 'WDOZ26', 'WINF27', 'WDOF27'], quoteCurrency: 'BRL',
    supportsOrders: false, brokers: ['XP', 'Inter', 'Rico', 'Genial'],
    credentialNames: [], enableFlag: 'B3_ENABLE_LIVE',
  },
];

/** Contratos vigentes e agendados; a vigência é validada no backend. */
export const B3_CONTRACTS = ['WINZ26', 'WDOZ26', 'WINF27', 'WDOF27'] as const;

export function getExchangeInfo(id: string): ExchangeInfo | undefined {
  return EXCHANGES.find((exchange) => exchange.id === id);
}

export function isSimulationOnly(id: string): boolean {
  return id === 'B3';
}

const NASDAQ_LISTING_URL = 'https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt';
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const fallbackSymbols = [
  { symbol: 'AAPL', name: 'Apple Inc.', aliases: ['apple'] },
  { symbol: 'TSLA', name: 'Tesla, Inc.', aliases: ['tesla'] },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', aliases: ['nvidia'] },
  { symbol: 'MSFT', name: 'Microsoft Corporation', aliases: ['microsoft'] },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', aliases: ['amazon'] },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C', aliases: ['google', 'alphabet'] },
  { symbol: 'GOOGL', name: 'Alphabet Inc. Class A', aliases: ['google class a', 'alphabet class a'] },
  { symbol: 'META', name: 'Meta Platforms, Inc.', aliases: ['meta', 'facebook'] },
  { symbol: 'NFLX', name: 'Netflix, Inc.', aliases: ['netflix'] },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', aliases: ['amd', 'advanced micro devices'] },
  { symbol: 'INTC', name: 'Intel Corporation', aliases: ['intel'] },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.', aliases: ['cisco'] },
  { symbol: 'ADBE', name: 'Adobe Inc.', aliases: ['adobe'] },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', aliases: ['paypal'] },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', aliases: ['costco'] },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', aliases: ['pepsico', 'pepsi'] },
  { symbol: 'AVGO', name: 'Broadcom Inc.', aliases: ['broadcom'] },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated', aliases: ['qualcomm'] },
];

function normalizeSearchKey(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  const left = normalizeSearchKey(a);
  const right = normalizeSearchKey(b);
  const matrix = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));

  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[left.length][right.length];
}

function parseListingFile(rawText) {
  const lines = rawText.trim().split(/\r?\n/);
  const header = lines[0]?.split('|') || [];
  const symbolIndex = header.indexOf('Symbol');
  const nameIndex = header.indexOf('Security Name');
  const etfIndex = header.indexOf('ETF');

  const records = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || line.startsWith('File Creation Time')) {
      continue;
    }

    const parts = line.split('|');
    const symbol = (parts[symbolIndex] || '').trim();
    const name = (parts[nameIndex] || '').trim();
    if (!symbol || !name) {
      continue;
    }

    const isEtf = (parts[etfIndex] || '').trim() === 'Y';
    const aliases = [];

    const normalizedName = name
      .replace(/\b(inc\.?|corp\.?|corporation|holdings|class\s+[a-z]|common stock|limited|ltd\.?|plc)\b/gi, ' ')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (normalizedName) {
      aliases.push(normalizedName.toLowerCase());
    }

    records.push({
      symbol,
      name,
      isEtf,
      aliases,
      normalizedSymbol: normalizeSearchKey(symbol),
      normalizedName: normalizeSearchKey(name),
      normalizedAliases: aliases.map(normalizeSearchKey),
    });
  }

  return records;
}

function computeScore(entry, query) {
  const q = normalizeSearchKey(query);
  if (!q) {
    return 0;
  }

  if (entry.normalizedSymbol === q) return 120;
  if (entry.normalizedName === q || entry.normalizedAliases.includes(q)) return 110;
  if (entry.normalizedSymbol.startsWith(q)) return 100;
  if (entry.normalizedName.startsWith(q)) return 90;
  if (entry.normalizedAliases.some((alias) => alias.startsWith(q))) return 80;
  if (entry.normalizedSymbol.includes(q)) return 70;
  if (entry.normalizedName.includes(q)) return 60;
  if (entry.normalizedAliases.some((alias) => alias.includes(q))) return 50;

  const symbolDistance = levenshtein(entry.symbol, q);
  const nameDistance = levenshtein(entry.name.slice(0, Math.max(query.length + 2, 8)), q);
  const bestDistance = Math.min(symbolDistance, nameDistance);

  if (bestDistance <= 1) return 45;
  if (bestDistance === 2 && q.length >= 4) return 35;
  return 0;
}

class SymbolService {
  constructor(refreshIntervalMs = DAY_IN_MS) {
    this.refreshIntervalMs = refreshIntervalMs;
    this.cache = {
      symbols: fallbackSymbols.map((record) => ({
        ...record,
        isEtf: false,
        normalizedSymbol: normalizeSearchKey(record.symbol),
        normalizedName: normalizeSearchKey(record.name),
        normalizedAliases: (record.aliases || []).map(normalizeSearchKey),
      })),
      refreshedAt: null,
      source: 'fallback',
      refreshError: null,
    };
    this.refreshTimer = null;
  }

  start() {
    this.refreshNow();
    this.refreshTimer = setInterval(() => {
      this.refreshNow();
    }, this.refreshIntervalMs);
  }

  async refreshNow() {
    try {
      const response = await fetch(NASDAQ_LISTING_URL, {
        headers: { 'user-agent': 'TheHype/1.0 symbol-ingestor' },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) {
        throw new Error(`Listing fetch failed with status ${response.status}`);
      }

      const rawText = await response.text();
      const symbols = parseListingFile(rawText);
      if (!symbols.length) {
        throw new Error('Listing parser returned no symbols');
      }

      this.cache = {
        symbols,
        refreshedAt: new Date().toISOString(),
        source: NASDAQ_LISTING_URL,
        refreshError: null,
      };
    } catch (error) {
      this.cache = {
        ...this.cache,
        refreshError: error.message,
      };
      console.error('[symbols] refresh failed:', error.message);
    }
  }

  search(query, limit = 20) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return [];
    }

    return this.cache.symbols
      .map((entry) => ({
        entry,
        score: computeScore(entry, trimmed),
      }))
      .filter((result) => result.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.entry.symbol.localeCompare(b.entry.symbol);
      })
      .slice(0, limit)
      .map(({ entry }) => ({
        symbol: entry.symbol,
        name: entry.name,
        aliases: entry.aliases || [],
      }));
  }

  getMeta() {
    return {
      source: this.cache.source,
      refreshedAt: this.cache.refreshedAt,
      refreshError: this.cache.refreshError,
      symbolCount: this.cache.symbols.length,
    };
  }
}

module.exports = {
  SymbolService,
  normalizeSearchKey,
};

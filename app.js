const platformConfig = {
  Reddit: { color: '#ff4500' },
  X: { color: '#0f0f10' },
  StockTwits: { color: '#2ed573' },
  YouTube: { color: '#ff0000' },
};

const sampleValuation = {
  AAPL: { pe: 29.7, dividend: 0.52 },
  TSLA: { pe: 56.2, dividend: 0.0 },
  NVDA: { pe: 68.5, dividend: 0.03 },
  MSFT: { pe: 35.1, dividend: 0.71 },
  AMZN: { pe: 50.8, dividend: 0.0 },
};

const staticNasdaqStocks = [
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

const importantPostTemplates = [
  'Large discussion about {ticker} product roadmap and expected revenue growth over the next 2 quarters.',
  'Debate on whether {ticker} has reached fair value after the recent run-up in price.',
  'Analyst clip circulating with revised target and margin expectations for {ticker}.',
  'Viral thread comparing {ticker} fundamentals against closest competitors and sector multiples.',
  'Conversation around insider activity and institutional flows impacting confidence in {ticker}.',
];

const analysisSection = document.getElementById('analysisSection');
const analyzeBtn = document.getElementById('analyzeBtn');
const stockInput = document.getElementById('stockInput');
const stockSuggestions = document.getElementById('stockSuggestions');
const searchFeedbackEl = document.getElementById('searchFeedback');
const sourceVerificationEl = document.getElementById('sourceVerification');
const chartCanvas = document.getElementById('mentionsChart');
const chartTitle = document.getElementById('chartTitle');
const chartLegend = document.getElementById('chartLegend');
const positiveCountEl = document.getElementById('positiveCount');
const negativeCountEl = document.getElementById('negativeCount');
const sentimentScoreEl = document.getElementById('sentimentScore');
const importantPostsEl = document.getElementById('importantPosts');
const investmentSummaryEl = document.getElementById('investmentSummary');
const peMetricEl = document.getElementById('peMetric');
const dividendMetricEl = document.getElementById('dividendMetric');
let fakeCommentsByTicker = {};

let fallbackSearchableNasdaqStocks = buildSearchableStocks(staticNasdaqStocks);

let latestSearchMeta = null;
let nextApiRetryAt = 0;
const stockApiBase = resolveStockApiBase();
const isGitHubPagesHost = window.location.hostname.endsWith('github.io');

populateStockSuggestions(fallbackSearchableNasdaqStocks);
initializeFallbackStocks();
loadFakeComments();
setSourceVerificationStatus(false);
analyzeBtn.addEventListener('click', runAnalysis);
stockInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    runAnalysis();
  }
});
stockInput.addEventListener('input', debounce(refreshSuggestionsFromApi, 180));
stockInput.addEventListener('blur', async () => {
  const resolved = await resolveNasdaqTicker(stockInput.value);
  if (resolved) {
    stockInput.value = resolved.symbol;
    setSearchFeedback(`Using NASDAQ ticker ${resolved.symbol} (${resolved.name}).`, resolved.isLiveVerified ? 'ok' : 'warning');
    setSourceVerificationStatus(resolved.isLiveVerified);
  }
});

async function runAnalysis() {
  const resolved = await resolveNasdaqTicker(stockInput.value);
  if (!resolved) {
    setSearchFeedback('Please enter a valid NASDAQ stock ticker or company name.', 'error');
    stockInput.focus();
    return;
  }

  const ticker = resolved.symbol;
  stockInput.value = ticker;
  setSourceVerificationStatus(resolved.isLiveVerified);

  setSearchFeedback(`Using NASDAQ ticker ${ticker} (${resolved.name}).`, 'ok');

  const simulated = generateSocialDataset(ticker);
  const comments = getFakeCommentsForTicker(ticker);
  const positive = comments.positive.length || simulated.positive;
  const negative = comments.negative.length || simulated.negative;
  const sentimentScore = Math.round((positive / (positive + negative)) * 100);
  const platformSentiment = normalizePlatformSentimentTotals(simulated.platformSentiment, positive, negative);
  const trendStrength = positive - negative;

  renderGraph(platformSentiment);
  renderLegend();
  renderSentiment(positive, negative);
  renderImportantPosts(ticker, comments);
  renderInvestmentSummary(ticker, trendStrength, sentimentScore);

  chartTitle.textContent = `${ticker} Social Sentiment by Platform`;
  analysisSection.classList.remove('hidden');
}

function populateStockSuggestions(stocks) {
  stockSuggestions.innerHTML = '';
  stocks.forEach((stock) => {
    const option = document.createElement('option');
    option.value = stock.symbol;
    option.label = stock.name;
    stockSuggestions.appendChild(option);
  });
}

function buildSearchableStocks(stocks) {
  return stocks.map((stock) => ({
    ...stock,
    searchableTerms: [stock.symbol, stock.name, ...(stock.aliases || [])].map(normalizeSearchKey),
  }));
}

async function initializeFallbackStocks() {
  const listingStocks = await loadFallbackStocksFromTxt();
  if (!listingStocks.length) {
    return;
  }

  fallbackSearchableNasdaqStocks = buildSearchableStocks(listingStocks);
  populateStockSuggestions(fallbackSearchableNasdaqStocks);
}

async function loadFakeComments() {
  try {
    const response = await fetch('data/fake_comments.json', { cache: 'no-store' });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    fakeCommentsByTicker = payload && typeof payload === 'object' ? payload : {};
  } catch (error) {
    console.warn('[fake comments] unable to load local fake comments:', error.message);
  }
}

function getFakeCommentsForTicker(ticker) {
  const comments = fakeCommentsByTicker[ticker];
  if (!comments) {
    return { positive: [], negative: [] };
  }

  return {
    positive: Array.isArray(comments.positive) ? comments.positive : [],
    negative: Array.isArray(comments.negative) ? comments.negative : [],
  };
}

function buildAliasesFromSecurityName(name) {
  const cleanedName = String(name || '').trim();
  if (!cleanedName) {
    return [];
  }

  const baseName = cleanedName.split(' - ')[0].trim();
  const normalizedBaseName = baseName
    .replace(/\b(inc\.?|corp\.?|corporation|holdings|class\s+[a-z]|common stock|ordinary shares?|limited|ltd\.?|plc|ads|etf)\b/gi, ' ')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return Array.from(new Set([baseName.toLowerCase(), normalizedBaseName].filter(Boolean)));
}

function parseNasdaqListingText(rawText) {
  const lines = String(rawText || '').trim().split(/\r?\n/);
  const header = lines[0]?.split('|') || [];
  const symbolIndex = header.indexOf('Symbol');
  const nameIndex = header.indexOf('Security Name');

  if (symbolIndex === -1 || nameIndex === -1) {
    return [];
  }

  const stocks = [];
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

    stocks.push({
      symbol,
      name,
      aliases: buildAliasesFromSecurityName(name),
    });
  }
  return stocks;
}

async function loadFallbackStocksFromTxt() {
  try {
    const response = await fetch('all_nasdaq_stock.txt', { cache: 'no-store' });
    if (!response.ok) {
      return [];
    }

    const rawText = await response.text();
    return parseNasdaqListingText(rawText);
  } catch (error) {
    console.warn('[stocks search] unable to load local NASDAQ listing file:', error.message);
    return [];
  }
}

function normalizeSearchKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveFromCollection(collection, inputValue) {
  const normalizedInput = normalizeSearchKey(inputValue.trim());
  if (!normalizedInput) {
    return null;
  }

  const stockFromSymbol = collection.find((stock) => normalizeSearchKey(stock.symbol) === normalizedInput);
  if (stockFromSymbol) {
    return stockFromSymbol;
  }

  const stockFromTerm = collection.find((stock) => {
    const terms = stock.searchableTerms || [stock.symbol, stock.name, ...(stock.aliases || [])].map(normalizeSearchKey);
    return terms.includes(normalizedInput);
  });
  if (stockFromTerm) {
    return stockFromTerm;
  }

  return collection.find((stock) => normalizeSearchKey(`${stock.symbol}${stock.name}`) === normalizedInput) || null;
}

async function resolveNasdaqTicker(inputValue) {
  const normalizedInput = normalizeSearchKey(inputValue.trim());
  if (!normalizedInput) {
    return null;
  }

  const apiMatches = await fetchStockSearch(inputValue);
  const resolvedFromApi = resolveFromCollection(apiMatches, inputValue);
  if (resolvedFromApi) {
    return resolvedFromApi;
  }

  const resolvedFromFallback = resolveFromCollection(fallbackSearchableNasdaqStocks, inputValue);
  if (!resolvedFromFallback) {
    return null;
  }

  return {
    ...resolvedFromFallback,
    isLiveVerified: false,
    verificationSource: 'fallback',
  };
}

async function refreshSuggestionsFromApi() {
  const query = stockInput.value.trim();
  if (!query) {
    populateStockSuggestions(fallbackSearchableNasdaqStocks);
    return;
  }

  const apiMatches = await fetchStockSearch(query);
  if (apiMatches.length) {
    populateStockSuggestions(apiMatches);
    return;
  }

  const fallbackMatches = fallbackSearchableNasdaqStocks.filter((stock) => {
    const q = normalizeSearchKey(query);
    return stock.searchableTerms.some((term) => term.includes(q));
  });
  populateStockSuggestions(fallbackMatches.length ? fallbackMatches : fallbackSearchableNasdaqStocks);
}

async function fetchStockSearch(query) {
  if (Date.now() < nextApiRetryAt) {
    latestSearchMeta = null;
    return [];
  }

  try {
    const response = await fetch(buildStockSearchUrl(query));
    if (!response.ok) {
      throw new Error(`Search API failed with status ${response.status}`);
    }

    const payload = await response.json();
    nextApiRetryAt = 0;
    latestSearchMeta = payload.meta || null;
    const apiResults = (payload.results || []).map((stock) => ({
      ...stock,
      isLiveVerified: Boolean(stock.isLiveVerified),
      verificationSource: stock.verificationSource || (stock.isLiveVerified ? 'live' : 'fallback'),
      searchableTerms: [stock.symbol, stock.name, ...(stock.aliases || [])].map(normalizeSearchKey),
    }));
    setSourceVerificationStatus(latestSearchMeta?.verification?.mode === 'live');
    return apiResults;
  } catch (error) {
    nextApiRetryAt = Date.now() + 30_000;
    latestSearchMeta = null;
    setSourceVerificationStatus(false);
    console.warn('[stocks search] API unavailable, using fallback resolver:', error.message);
    return [];
  }
}

function debounce(fn, delayMs) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

function setSearchFeedback(message, tone) {
  searchFeedbackEl.textContent = message;
  searchFeedbackEl.className = `search-feedback ${tone || ''}`.trim();
}

function setSourceVerificationStatus(isLiveVerified) {
  if (!sourceVerificationEl) {
    return;
  }

  sourceVerificationEl.textContent = isLiveVerified
    ? 'Live verified NASDAQ source'
    : 'NASDAQ source available';
  sourceVerificationEl.className = `source-verification ${isLiveVerified ? 'ok' : ''}`.trim();
}

function resolveStockApiBase() {
  if (typeof window === 'undefined') {
    return '';
  }

  if (typeof window.THE_HYPE_API_BASE === 'string' && window.THE_HYPE_API_BASE.trim()) {
    return window.THE_HYPE_API_BASE.trim().replace(/\/+$/, '');
  }

  const configuredBase = document
    .querySelector('meta[name="the-hype-api-base"]')
    ?.getAttribute('content')
    ?.trim();

  return configuredBase ? configuredBase.replace(/\/+$/, '') : '';
}

function buildStockSearchUrl(query) {
  const path = `/api/stocks/search?q=${encodeURIComponent(query)}&limit=20`;
  return stockApiBase ? `${stockApiBase}${path}` : path;
}

function generateSocialDataset(ticker) {
  const base = (ticker.charCodeAt(0) || 70) + (ticker.charCodeAt(1) || 40);
  const platformSentiment = Object.keys(platformConfig).reduce((acc, platform, i) => {
    const positiveBase = 120 + i * 35;
    const negativeBase = 70 + i * 22;
    const positive = Math.max(20, Math.round(positiveBase + Math.sin((base + i * 5) / 4) * 30));
    const negative = Math.max(15, Math.round(negativeBase + Math.cos((base + i * 3) / 5) * 22));

    acc[platform] = { positive, negative };
    return acc;
  }, {});

  const totals = Object.values(platformSentiment);
  const positive = totals.reduce((sum, platform) => sum + platform.positive, 0);
  const negative = totals.reduce((sum, platform) => sum + platform.negative, 0);
  const trendStrength = positive - negative;
  const sentimentScore = Math.round((positive / (positive + negative)) * 100);

  return {
    platformSentiment,
    positive,
    negative,
    sentimentScore,
    trendStrength,
  };
}

function normalizePlatformSentimentTotals(platformSentiment, targetPositive, targetNegative) {
  const platforms = Object.keys(platformSentiment);
  if (!platforms.length) {
    return {};
  }

  const totals = platforms.reduce((acc, platform) => {
    acc.positive += platformSentiment[platform].positive;
    acc.negative += platformSentiment[platform].negative;
    return acc;
  }, { positive: 0, negative: 0 });

  const adjusted = {};
  let positiveAssigned = 0;
  let negativeAssigned = 0;

  platforms.forEach((platform, index) => {
    const isLast = index === platforms.length - 1;
    const positiveValue = isLast
      ? Math.max(0, targetPositive - positiveAssigned)
      : Math.max(0, Math.round((platformSentiment[platform].positive / Math.max(totals.positive, 1)) * targetPositive));
    const negativeValue = isLast
      ? Math.max(0, targetNegative - negativeAssigned)
      : Math.max(0, Math.round((platformSentiment[platform].negative / Math.max(totals.negative, 1)) * targetNegative));

    positiveAssigned += positiveValue;
    negativeAssigned += negativeValue;
    adjusted[platform] = {
      positive: positiveValue,
      negative: negativeValue,
    };
  });

  return adjusted;
}

function renderGraph(sentimentByPlatform) {
  const ctx = chartCanvas.getContext('2d');
  const width = chartCanvas.width;
  const height = chartCanvas.height;
  const padding = { top: 24, right: 24, bottom: 40, left: 72 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const yTickCount = 6;

  ctx.clearRect(0, 0, width, height);

  const platforms = Object.keys(sentimentByPlatform);
  if (!platforms.length) {
    return;
  }

  const allValues = platforms.flatMap((platform) => [
    sentimentByPlatform[platform].positive,
    sentimentByPlatform[platform].negative,
  ]);
  const observedMaxValue = Math.max(...allValues, 10);
  const axisStep = getNiceAxisStep(observedMaxValue, yTickCount);
  const maxValue = axisStep * yTickCount;

  // grid + axes
  ctx.strokeStyle = '#2a2d34';
  ctx.lineWidth = 1;
  for (let i = 0; i <= yTickCount; i += 1) {
    const y = padding.top + (chartHeight / yTickCount) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const tickValue = maxValue - i * axisStep;
    ctx.fillStyle = '#8f98a8';
    ctx.font = '12px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.max(0, tickValue).toLocaleString(), padding.left - 10, y);
  }

  ctx.strokeStyle = '#7f8897';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = '#aeb4c2';
  ctx.font = '12px Inter, Segoe UI, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Comments', 14, 18);
  ctx.fillText('Platforms', width - 80, height - 12);

  const groupWidth = chartWidth / platforms.length;
  const barWidth = Math.min(36, groupWidth * 0.32);

  platforms.forEach((platform, index) => {
    const centerX = padding.left + index * groupWidth + groupWidth / 2;
    const positiveValue = sentimentByPlatform[platform].positive;
    const negativeValue = sentimentByPlatform[platform].negative;
    const positiveHeight = (positiveValue / maxValue) * chartHeight;
    const negativeHeight = (negativeValue / maxValue) * chartHeight;

    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(centerX - barWidth - 3, padding.top + chartHeight - positiveHeight, barWidth, positiveHeight);

    ctx.fillStyle = '#ff4d4f';
    ctx.fillRect(centerX + 3, padding.top + chartHeight - negativeHeight, barWidth, negativeHeight);

    ctx.fillStyle = '#aeb4c2';
    ctx.font = '12px Inter, Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const labelWidth = ctx.measureText(platform).width;
    ctx.fillText(platform, centerX - labelWidth / 2, height - 12);
  });
}

function getNiceAxisStep(maxValue, tickCount) {
  const roughStep = Math.max(maxValue, 1) / Math.max(tickCount, 1);
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / power;

  let niceNormalized;
  if (normalized <= 1) {
    niceNormalized = 1;
  } else if (normalized <= 2) {
    niceNormalized = 2;
  } else if (normalized <= 5) {
    niceNormalized = 5;
  } else {
    niceNormalized = 10;
  }

  return niceNormalized * power;
}

function renderLegend() {
  chartLegend.innerHTML = '';

  [
    { label: 'Positive', color: '#2ecc71' },
    { label: 'Negative', color: '#ff4d4f' },
  ].forEach((entry) => {
    const item = document.createElement('span');
    item.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = entry.color;

    const label = document.createElement('span');
    label.textContent = entry.label;

    item.append(swatch, label);
    chartLegend.append(item);
  });
}

function renderSentiment(positive, negative) {
  const score = Math.round((positive / (positive + negative)) * 100);
  positiveCountEl.textContent = positive.toLocaleString();
  negativeCountEl.textContent = negative.toLocaleString();
  sentimentScoreEl.textContent = `${score}%`;
}

function renderImportantPosts(ticker, comments) {
  importantPostsEl.innerHTML = '';

  const hasFakeComments = comments.positive.length || comments.negative.length;
  if (!hasFakeComments) {
    importantPostTemplates.slice(0, 4).forEach((template) => {
      const li = document.createElement('li');
      li.textContent = template.replace('{ticker}', ticker);
      importantPostsEl.appendChild(li);
    });
    return;
  }

  comments.positive.forEach((comment) => {
    const li = document.createElement('li');
    li.className = 'post-positive';
    li.textContent = comment;
    importantPostsEl.appendChild(li);
  });

  comments.negative.forEach((comment) => {
    const li = document.createElement('li');
    li.className = 'post-negative';
    li.textContent = comment;
    importantPostsEl.appendChild(li);
  });
}

function renderInvestmentSummary(ticker, trendStrength, sentimentScore) {
  const valuation = sampleValuation[ticker] || {
    pe: Number((18 + (ticker.charCodeAt(0) % 25)).toFixed(1)),
    dividend: Number((((ticker.charCodeAt(1) || 7) % 14) / 10).toFixed(2)),
  };

  peMetricEl.textContent = `P/E: ${valuation.pe.toFixed(1)}`;
  dividendMetricEl.textContent = `Dividend Yield: ${valuation.dividend.toFixed(2)}%`;

  const hasStrongHype = trendStrength > 20 && sentimentScore >= 60;
  const expensive = valuation.pe > 45;
  const hasDividend = valuation.dividend > 0.5;

  let summary = `${ticker} currently shows a ${sentimentScore}% positive social sentiment with a ${trendStrength > 0 ? 'rising' : 'cooling'} mention trend over the last 30 days. `;

  if (hasStrongHype && !expensive) {
    summary += 'Social momentum is strong while valuation is moderate, which can support a constructive short-to-mid term setup.';
  } else if (hasStrongHype && expensive) {
    summary += 'Online conviction is high, but the elevated P/E suggests expectations are already priced aggressively; position sizing matters.';
  } else {
    summary += 'Sentiment and trend are mixed, so a cautious approach with deeper fundamental confirmation is likely prudent.';
  }

  if (hasDividend) {
    summary += ` The ${valuation.dividend.toFixed(2)}% dividend adds a small income cushion.`;
  } else {
    summary += ' Dividend support is minimal, so returns depend mostly on growth and price appreciation.';
  }

  investmentSummaryEl.textContent = summary;
}

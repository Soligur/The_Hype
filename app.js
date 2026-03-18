const platformConfig = {
  Reddit: { color: '#ff4500' },
  X: { color: '#0f0f10' },
  StockTwits: { color: '#2ed573' },
  YouTube: { color: '#ff0000' },
};

const tickerAliases = {
  GOOGLE: 'GOOG',
  ALPHABET: 'GOOG',
  FACEBOOK: 'META',
  AMAZON: 'AMZN',
  TESLA: 'TSLA',
  MICROSOFT: 'MSFT',
  APPLE: 'AAPL',
  NVIDIA: 'NVDA',
  NETFLIX: 'NFLX',
};

const fallbackNasdaqTickers = new Set(['AAPL', 'AMZN', 'AMD', 'GOOG', 'META', 'MSFT', 'NFLX', 'NVDA', 'TSLA']);

const sampleValuation = {
  AAPL: { pe: 29.7, dividend: 0.52 },
  TSLA: { pe: 56.2, dividend: 0.0 },
  NVDA: { pe: 68.5, dividend: 0.03 },
  MSFT: { pe: 35.1, dividend: 0.71 },
  AMZN: { pe: 50.8, dividend: 0.0 },
  GOOG: { pe: 26.4, dividend: 0.0 },
  META: { pe: 29.8, dividend: 0.39 },
};

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
const searchStatusEl = document.getElementById('searchStatus');
const tickerSuggestions = document.getElementById('tickerSuggestions');
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

let nasdaqTickers = new Set();

initializeNasdaqData();

analyzeBtn.addEventListener('click', runAnalysis);
stockInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    runAnalysis();
  }
});

stockInput.addEventListener('blur', () => {
  const normalized = normalizeToTicker(stockInput.value);
  if (normalized) {
    stockInput.value = normalized;
  }
});

async function initializeNasdaqData() {
  analyzeBtn.disabled = true;

  try {
    const symbols = await fetchNasdaqSymbols();
    nasdaqTickers = symbols;
    setStatus(`NASDAQ list loaded (${nasdaqTickers.size.toLocaleString()} symbols).`, 'ok');
    populateTickerSuggestions(symbols);
  } catch (error) {
    nasdaqTickers = fallbackNasdaqTickers;
    setStatus('Could not load full NASDAQ list. Running with core fallback symbols only.', 'error');
    populateTickerSuggestions(nasdaqTickers);
  } finally {
    analyzeBtn.disabled = false;
  }
}

async function fetchNasdaqSymbols() {
  const url = 'https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/nasdaq/nasdaq_full_tickers.json';
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch NASDAQ symbols (${response.status})`);
  }

  const data = await response.json();
  return new Set(
    data
      .map((item) => String(item.Symbol || '').trim().toUpperCase())
      .filter((symbol) => symbol && /^[A-Z.]{1,8}$/.test(symbol))
  );
}

function populateTickerSuggestions(symbolSet) {
  tickerSuggestions.innerHTML = '';

  [...symbolSet]
    .sort()
    .slice(0, 300)
    .forEach((ticker) => {
      const option = document.createElement('option');
      option.value = ticker;
      tickerSuggestions.appendChild(option);
    });
}

function setStatus(message, type) {
  searchStatusEl.textContent = message;
  searchStatusEl.className = 'hint';
  if (type) {
    searchStatusEl.classList.add(type);
  }
}

function normalizeToTicker(rawInput) {
  const cleaned = rawInput.trim().toUpperCase();
  if (!cleaned) {
    return '';
  }

  if (tickerAliases[cleaned]) {
    return tickerAliases[cleaned];
  }

  return cleaned;
}

function runAnalysis() {
  const ticker = normalizeToTicker(stockInput.value);
  stockInput.classList.remove('invalid');

  if (!ticker) {
    setStatus('Enter a ticker or company name to begin.', 'error');
    stockInput.classList.add('invalid');
    stockInput.focus();
    return;
  }

  stockInput.value = ticker;

  if (!nasdaqTickers.has(ticker)) {
    setStatus(`${ticker} is not in the loaded NASDAQ symbol set. Please enter a NASDAQ-listed stock.`, 'error');
    stockInput.classList.add('invalid');
    analysisSection.classList.add('hidden');
    return;
  }

  setStatus(`Analyzing ${ticker} social data from the last 30 days.`, 'ok');

  const simulated = generateSocialDataset(ticker);
  renderGraph(simulated.dailyMentions);
  renderLegend();
  renderSentiment(simulated.positive, simulated.negative);
  renderImportantPosts(ticker);
  renderInvestmentSummary(ticker, simulated.trendStrength, simulated.sentimentScore);

  chartTitle.textContent = `${ticker} Social Mentions (Last 30 Days)`;
  analysisSection.classList.remove('hidden');
}

function generateSocialDataset(ticker) {
  const days = 30;
  const base = (ticker.charCodeAt(0) || 70) + (ticker.charCodeAt(1) || 40);
  const dailyMentions = Object.keys(platformConfig).reduce((acc, platform, i) => {
    acc[platform] = Array.from({ length: days }, (_, day) => {
      const drift = Math.sin((day + base + i * 2) / 4) * 16;
      const noise = ((base * (day + 3 + i)) % 11) - 5;
      const level = 40 + i * 10 + Math.max(0, drift + noise + day * 0.8);
      return Math.round(level);
    });
    return acc;
  }, {});

  const totals = Object.values(dailyMentions).flat();
  const trendStrength = totals[totals.length - 1] - totals[0];
  const averageMentions = totals.reduce((sum, n) => sum + n, 0) / totals.length;
  const positive = Math.round(averageMentions * 11 + (base % 35) + trendStrength * 0.9);
  const negative = Math.max(15, Math.round(averageMentions * 7 + ((200 - base) % 30) - trendStrength * 0.3));
  const sentimentScore = Math.round((positive / (positive + negative)) * 100);

  return {
    dailyMentions,
    positive,
    negative,
    sentimentScore,
    trendStrength,
  };
}

function renderGraph(seriesByPlatform) {
  const ctx = chartCanvas.getContext('2d');
  const width = chartCanvas.width;
  const height = chartCanvas.height;
  const padding = { top: 20, right: 24, bottom: 34, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  ctx.clearRect(0, 0, width, height);

  const allValues = Object.values(seriesByPlatform).flat();
  const maxValue = Math.max(...allValues, 10);

  ctx.strokeStyle = '#2a2d34';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = padding.top + (chartHeight / 5) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#7f8897';
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  ctx.fillStyle = '#aeb4c2';
  ctx.font = '12px Inter, Segoe UI, sans-serif';
  ctx.fillText('Mentions', 8, 16);
  ctx.fillText('Days', width - 44, height - 10);

  Object.entries(seriesByPlatform).forEach(([platform, points]) => {
    const color = platformConfig[platform].color;

    ctx.strokeStyle = platform === 'X' ? '#ffffff' : color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    points.forEach((value, index) => {
      const x = padding.left + (index / (points.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  });
}

function renderLegend() {
  chartLegend.innerHTML = '';

  Object.entries(platformConfig).forEach(([platform, info]) => {
    const item = document.createElement('span');
    item.className = 'legend-item';

    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = platform === 'X' ? '#ffffff' : info.color;

    const label = document.createElement('span');
    label.textContent = platform;

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

function renderImportantPosts(ticker) {
  importantPostsEl.innerHTML = '';

  importantPostTemplates.slice(0, 4).forEach((template) => {
    const li = document.createElement('li');
    li.textContent = template.replace('{ticker}', ticker);
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

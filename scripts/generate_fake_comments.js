#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NASDAQ_FILE = path.join(ROOT, 'all_nasdaq_stock.txt');
const OUTPUT_FILE = path.join(ROOT, 'data', 'fake_comments.json');

const POSITIVE_TEMPLATES = [
  'Totally-real-human take: {symbol} ({company}) is moonwalking into my pretend portfolio.',
  'Not financial advice, but my imaginary analyst says {symbol} looks wildly strong this quarter.',
  'If vibes were earnings, {symbol} would beat every estimate forever. #DefinitelyFakeComment',
  'I asked my crystal ball about {company}; it replied: "buy {symbol} and smile."',
  '{symbol} chart looks so clean that even my fake spreadsheet applauded.',
  'Huge fan of {company}. My demo account is 100% {symbol} and 0% fear.',
  'Every time {symbol} dips, my practice bot says "thank you" and adds more.',
  'I cannot believe how steady {company} looks right now. Suspiciously awesome.',
  'Pretend hedge-fund energy: {symbol} is my top conviction for no real reason.',
  'My paper portfolio loves {symbol}; my confidence is fake but enthusiastic.',
  '{company} just feels unstoppable, at least in this synthetic comment thread.',
  'Bull case for {symbol}: yes. Bear case: also yes. But I am fake-bullish anyway.',
  'I did zero research and still think {symbol} is elite. This is clearly fabricated chatter.',
  '{symbol} + patience = pretend profits. {company} keeps showing up in my fake watchlist.',
  'Algorithmic compliment incoming: {company} is executing like a machine lately.'
];

const NEGATIVE_TEMPLATES = [
  'Totally-real-human panic: {symbol} looks shaky and my fake portfolio is sweating.',
  'Not financial advice, but {company} feels overhyped in this clearly synthetic thread.',
  'If uncertainty were a stock, it would be {symbol} this week.',
  'My pretend risk model keeps flashing red around {company}.',
  '{symbol} moves like it drank too much espresso; I am fake-bearish for now.',
  'Every headline about {company} makes my demo account quietly cry.',
  'I tried to stay optimistic on {symbol}, but this fake sentiment engine says "nope."',
  '{company} might recover, but today I am roleplaying as a dramatic bear on {symbol}.',
  'My spreadsheet of made-up opinions has {symbol} in the caution zone.',
  'Synthetic hot take: {company} could be priced for perfection and reality is messy.',
  'I blinked and {symbol} moved again. Not loving the pretend volatility.',
  'Fake trader confession: {company} has me second-guessing every mock decision.',
  '{symbol} feels expensive, fragile, and loud — classic fake-thread negativity.',
  'I want to like {company}, but this week {symbol} screams "wait for clarity."',
  'Bearish simulation mode enabled: reducing my imaginary position in {symbol}.'
];

function createSeed(input) {
  let seed = 0;
  for (const char of input) {
    seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  }
  return seed || 1;
}

function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTemplatedComments(templates, symbol, company, count, suffix) {
  const rng = mulberry32(createSeed(`${symbol}-${suffix}`));
  const indices = templates.map((_, index) => index);

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return indices.slice(0, count).map((index) => {
    return templates[index]
      .replaceAll('{symbol}', symbol)
      .replaceAll('{company}', company);
  });
}

function parseNasdaqList(rawText) {
  const lines = rawText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    throw new Error('NASDAQ file appears to be empty.');
  }

  const headerParts = lines[0].split('|');
  const symbolIndex = headerParts.indexOf('Symbol');
  const securityNameIndex = headerParts.indexOf('Security Name');

  if (symbolIndex === -1 || securityNameIndex === -1) {
    throw new Error('Could not find Symbol/Security Name columns in NASDAQ file.');
  }

  const records = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split('|');
    const symbol = (parts[symbolIndex] || '').trim();
    const company = (parts[securityNameIndex] || '').trim();

    if (!symbol || !company) {
      continue;
    }

    records.push({ symbol, company });
  }

  return records;
}

function randomCount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildFakeComments(records) {
  const output = {};

  for (const { symbol, company } of records) {
    const positiveCount = randomCount(1, 10);
    const negativeCount = randomCount(1, 10);

    output[symbol] = {
      positive: pickTemplatedComments(POSITIVE_TEMPLATES, symbol, company, positiveCount, 'positive'),
      negative: pickTemplatedComments(NEGATIVE_TEMPLATES, symbol, company, negativeCount, 'negative')
    };
  }

  return output;
}

function main() {
  const rawText = fs.readFileSync(NASDAQ_FILE, 'utf8');
  const records = parseNasdaqList(rawText);
  const fakeComments = buildFakeComments(records);

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(fakeComments, null, 2)}\n`, 'utf8');

  console.log(`Generated fake comments for ${records.length} tickers at ${path.relative(ROOT, OUTPUT_FILE)}.`);
}

main();

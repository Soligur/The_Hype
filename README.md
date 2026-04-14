# The Hype

## Regenerating fake comments from NASDAQ symbols

The fake comment seed data lives in `data/fake_comments.json` and is generated from `all_nasdaq_stock.txt`.

When `all_nasdaq_stock.txt` is updated, regenerate comments with:

```bash
node scripts/generate_fake_comments.js
```

This script parses the `Symbol` and `Security Name` columns, selects 50 popular tickers, and writes 10 positive plus 10 negative obviously fake comments per ticker.

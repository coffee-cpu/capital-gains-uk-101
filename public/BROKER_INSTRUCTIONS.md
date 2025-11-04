# How to Download Transaction History

This guide explains how to download transaction history CSV files from supported brokers.

## Charles Schwab - Transaction History

**What it includes:** Regular brokerage transactions (buys, sells, dividends, etc.)

### Steps to Download:

1. Log into your Charles Schwab account at [schwab.com](https://www.schwab.com)
2. Click on the **Accounts** tab
3. Select **Transaction History**
4. If you have multiple accounts, select the specific account from the dropdown
5. Set the filter to **All Transactions**:
   - Click **Filter by Transaction Types**
   - Ensure **Select All** is checked
   - Click **Apply**
6. Select your date range:
   - Choose from the dropdown or select **Custom**
   - Enter your From/To dates
   - Click **Search**
7. Click the **Export** button (top right corner)
8. Select **CSV** as the export type
9. Click **Export** again to download

**Limitations:**
- Maximum 10,000 records per download
- If you need more, download smaller time periods

**Tips:**
- Click the Date column header to sort in ascending order (oldest first)
- This ensures transactions are imported in the correct chronological order

[📥 Download Example File](./examples/schwab-transactions-example.csv)

---

## Charles Schwab - Equity Award Center

**What it includes:** Stock plan transactions (RSU vests, stock options, ESPP, etc.)

### Steps to Download:

1. Log into the Schwab Equity Award Center at [eac.schwab.com](https://eac.schwab.com)
2. Select your **Equity Awards account**
3. Click on **History** (for transaction history)
4. Select your date range
5. Click the **Export** button
6. Select **CSV** as the export type
7. Click **Export** to download

**Important Notes:**
- Equity Award Center transactions are separate from regular brokerage transactions
- You may need both files if you have both regular trades and equity awards
- Equity awards include RSU vests with tax withholding information

**Need Help?**
- Call: 800-654-2593 (U.S. only)
- Available: Monday-Friday, 24 hours

[📥 Download Example File](./examples/schwab-equity-awards-example.csv)

---

## Generic CSV Format

If your broker isn't directly supported, you can create a CSV file in our standard format.

### Required Columns:
- `date` - Transaction date in YYYY-MM-DD format
- `type` - Transaction type: BUY, SELL, DIVIDEND, INTEREST, TAX, TRANSFER, FEE, or **STOCK_SPLIT**
- `symbol` - Stock ticker symbol (e.g., AAPL, MSFT)
- `currency` - Currency code (e.g., USD, GBP)

### Optional Columns:
- `name` - Security name (e.g., "Apple Inc.")
- `quantity` - Number of shares
- `price` - Price per share
- `total` - Total transaction amount
- `fee` - Transaction fees
- `notes` - Additional notes

### Example:

```csv
date,type,symbol,currency,name,quantity,price,total,fee,notes
2024-01-15,BUY,AAPL,USD,Apple Inc.,10,150.00,1500.00,0.00,
2024-02-20,SELL,AAPL,USD,Apple Inc.,5,160.00,800.00,0.00,
2024-03-10,DIVIDEND,AAPL,USD,Apple Inc. Dividend,,,12.50,0.00,Quarterly dividend
```

### Stock Splits

Use the Generic CSV format to record stock splits if your broker doesn't include them:

**Simply specify the split ratio - we'll calculate the quantity adjustment for you!**

```csv
date,type,symbol,ratio
2024-06-10,STOCK_SPLIT,NVDA,10:1
2022-08-25,STOCK_SPLIT,TSLA,3:1
2022-06-06,STOCK_SPLIT,AMZN,20:1
2020-08-31,STOCK_SPLIT,AAPL,4:1
```

**Split ratio format:**
- `2:1` = 2-for-1 split (shares double)
- `10:1` = 10-for-1 split (shares multiply by 10)
- `1:10` = 1-for-10 reverse split (shares divide by 10)

**Common stock splits:**
- **NVIDIA** (NVDA): 10:1 split on June 10, 2024
- **Amazon** (AMZN): 20:1 split on June 6, 2022
- **Tesla** (TSLA): 3:1 split on August 25, 2022
- **Apple** (AAPL): 4:1 split on August 31, 2020

[📥 Download Example File](./examples/generic-example.csv) | [📥 Download Stock Splits Example](./examples/stock-splits-example.csv)

---

## Trading 212 *(Coming Soon)*

Support for Trading 212 is currently in development.

---

## Need Help?

If you're having trouble downloading your transaction history or the format isn't being recognized:

1. Check that your CSV file matches the expected format
2. Verify all required columns are present
3. Ensure dates are in the correct format
4. Try the example files first to test the import process

For more information, visit our [GitHub repository](https://github.com/coffee-cpu/capital-gains-uk-101).

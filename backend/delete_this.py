import yfinance as yf

def get_current_prices(tickers: list[str]) -> list[float]:
    """
    Fetch the latest closing price for each ticker symbol in the list.
    
    Args:
        tickers: List of stock ticker symbols (e.g., ['AAPL', 'MSFT']).
    
    Returns:
        List of prices corresponding to the input tickers.
        If a price cannot be retrieved, None is returned for that symbol.
    """
    prices = []
    for symbol in tickers:
        try:
            stock = yf.Ticker(symbol)
            # Use fast_info for the most recent price (can be None if unavailable)
            price = stock.fast_info.get("lastPrice", None)
            if price is None:
                # Fallback: get today's history and take the last close
                hist = stock.history(period="1d")
                if not hist.empty:
                    price = hist['Close'].iloc[-1]
                else:
                    price = None
            prices.append(price)
        except Exception as e:
            print(f"Error fetching {symbol}: {e}")
            prices.append(None)
    return prices

# Example usage
if __name__ == "__main__":
    symbols = ['MU','WDC','SNDK','STX','COHR','LITE','GLW','AVGO','MRVL','CSCO','AAOI','CRDO','NOK','TECK','MP','RIO','AREC','AA','UUUU','IREN','CIFR','NBIS','ARM','SMCI','NVDA','AMD','INTC','WOLF','IQE','AXTI','RKLB','PL','BKSY','RDW','IRDM','SPIR','ASTS','VRT','NVT','ECL','MOD','TT','JCI','CARR','CEG','VST','OKLO','SMR','GEV','ETN','ENR','PWR']
    current_prices = get_current_prices(symbols)
    for sym, price in zip(symbols, current_prices):
        print(f"{sym}: {price}")
"""Restricted local yfinance worker. JSON stdin/stdout; no arbitrary code or URLs."""
import sys,json,re,math,contextlib,logging,os,asyncio,numbers
logging.disable(logging.CRITICAL)

def finite(value):
    try:
        n=float(value)
        return n if math.isfinite(n) else None
    except (ValueError,TypeError):return None

def clean_json(value):
    if isinstance(value,dict):return {str(k):clean_json(v) for k,v in value.items()}
    if isinstance(value,(list,tuple)):return [clean_json(v) for v in value]
    if isinstance(value,bool):return value
    if isinstance(value,numbers.Integral):return int(value)
    if isinstance(value,numbers.Real):return float(value) if math.isfinite(value) else None
    return value

def symbols(value):
    if not isinstance(value,list) or not 1<=len(value)<=5:raise ValueError('Use one to five tickers.')
    if not all(isinstance(s,str) and re.fullmatch(r'[A-Z0-9.-]{1,15}',s) for s in value):raise ValueError('Invalid ticker.')
    return list(dict.fromkeys(value))

def news_rows(rows):
    result=[]
    from datetime import datetime
    for item in rows[:30]:
        n=item.get('content',item)
        result.append({'headline':n.get('title',''),'summary':n.get('summary',''),'source':n.get('provider',{}).get('displayName','Yahoo Finance'),'url':(n.get('canonicalUrl') or {}).get('url',''),'datetime':datetime.fromisoformat(n['pubDate'].replace('Z','+00:00')).timestamp() if n.get('pubDate') else 0})
    return result

def profile(info):
    mappings={'roeTTM':('returnOnEquity',100),'peTTM':('trailingPE',1),'netProfitMarginTTM':('profitMargins',100),'revenueTTM':('totalRevenue',1),'peg':('trailingPegRatio',1),'pb':('priceToBook',1),'roaTTM':('returnOnAssets',100),'52WeekHigh':('fiftyTwoWeekHigh',1),'52WeekLow':('fiftyTwoWeekLow',1)}
    metric={k:finite(info.get(src))*mult for k,(src,mult) in mappings.items() if finite(info.get(src)) is not None}
    return {'name':info.get('longName') or info.get('shortName'),'currency':info.get('currency'),'country':info.get('country'),'exchange':info.get('exchange'),'finnhubIndustry':info.get('sector'),'weburl':info.get('website'),'metric':metric}

def quote(ticker):
    info=ticker.info
    if info.get('currency')!='USD':raise ValueError('Only USD quotes are supported.')
    price=finite(info.get('regularMarketPrice'));previous=finite(info.get('regularMarketPreviousClose'))
    if not price or not previous:raise ValueError('Quote unavailable.')
    return {'c':price,'pc':previous,'dp':(price/previous-1)*100,'t':info.get('regularMarketTime'),'currency':'USD'}

def frame_rows(frame):
    return [{'date':str(idx),'close':finite(row.get('Close'))} for idx,row in frame.tail(1500).iterrows() if finite(row.get('Close')) is not None]

def run(payload,yf):
    op=payload.get('operation');p=payload.get('params') or {}
    allowed={'quote','search','stock/profile2','stock/metric','stock/candle','news','company-news','batch','download','market','sector','industry','screener','stream','async-stream','status','financials','actions'}
    if op not in allowed:raise ValueError('Unsupported operation.')
    if op=='status':return {'available':True,'version':yf.__version__}
    if op in {'quote','stock/profile2','stock/metric','stock/candle','company-news','financials','actions'}:
        symbol=symbols([p.get('symbol')])[0];ticker=yf.Ticker(symbol)
        if op=='quote':return quote(ticker)
        if op=='actions':return [{'Date':str(idx),'Dividends':finite(row.get('Dividends')),'Stock splits':finite(row.get('Stock Splits'))} for idx,row in ticker.actions.tail(50).iterrows()]
        if op=='financials':
            return [{'name':name,'rows':[{'Metric':str(index),**{str(col.date()):finite(row[col]) for col in frame.columns[:4]}} for index,row in frame.head(30).iterrows()]} for name,frame in [('Income statement',ticker.income_stmt),('Balance sheet',ticker.balance_sheet),('Cash flow',ticker.cashflow)]]
        if op in {'stock/profile2','stock/metric'}:return profile(ticker.info)
        if op=='company-news':return news_rows(ticker.get_news(count=20))
        frame=ticker.history(period='5y',interval='1d',auto_adjust=False,raise_errors=True)
        rows=[(int(idx.timestamp()),finite(row['Close'])) for idx,row in frame.iterrows() if finite(row['Close']) is not None]
        if len(rows)<2:raise ValueError('History unavailable.')
        return {'s':'ok','c':[c for _,c in rows],'t':[t for t,_ in rows],'interval':'daily'}
    if op in {'search','news'}:
        q=p.get('q','stock market' if op=='news' else '')
        if not isinstance(q,str) or not 1<=len(q)<=80:raise ValueError('Invalid search.')
        search=yf.Search(q,max_results=20,news_count=20)
        if op=='news':return news_rows(search.news)
        return {'result':[{'symbol':r['symbol'],'description':r.get('longname') or r.get('shortname',r['symbol'])} for r in search.quotes if r.get('quoteType') in {'EQUITY','ETF'} and re.fullmatch(r'[A-Z0-9.-]{1,15}',r.get('symbol',''))]}
    if op in {'batch','download','stream','async-stream'}:
        tickers=symbols(p.get('symbols'))
        if op=='batch':return [{'symbol':s,**quote(t)} for s,t in yf.Tickers(' '.join(tickers)).tickers.items()]
        if op=='download':
            data=yf.download(tickers,period='1y',interval='1d',auto_adjust=False,group_by='ticker',threads=False,progress=False,multi_level_index=True)
            return [{'symbol':s,'history':frame_rows(data[s])} for s in tickers]
        def emit(message):
            if message.get('id') not in tickers:return
            price=finite(message.get('price'))
            if price and message.get('currency')=='USD':print(json.dumps({'symbol':message['id'],'price':price,'at':message.get('time'),'currency':'USD'}),flush=True)
        if op=='stream':
            with yf.WebSocket(verbose=False) as ws:ws.subscribe(tickers);ws.listen(emit)
        else:
            async def listen():
                async with yf.AsyncWebSocket(verbose=False) as ws:
                    await ws.subscribe(tickers)
                    await ws.listen(emit)
            asyncio.run(listen())
        return None
    if op=='market':
        region=p.get('region','US')
        if region not in {'US','GB','DE','FR','JP'}:raise ValueError('Unsupported market.')
        m=yf.Market(region);return {'status':m.status,'summary':m.summary}
    if op in {'sector','industry'}:
        key=p.get('key','')
        if not isinstance(key,str) or not re.fullmatch(r'[a-z][a-z-]{1,60}',key):raise ValueError('Invalid sector or industry.')
        obj=yf.Sector(key) if op=='sector' else yf.Industry(key)
        return {'name':obj.name,'overview':obj.overview,'companies':obj.top_companies.reset_index().head(25).to_dict(orient='records')}
    if op=='screener':
        minimum=finite(p.get('minMarketCap',0));maximum=finite(p.get('maxPE',50))
        if minimum is None or maximum is None or not 0<=minimum<=1e14 or not 0<maximum<=1000:raise ValueError('Invalid screening bounds.')
        query=yf.EquityQuery('and',[yf.EquityQuery('eq',['region','us']),yf.EquityQuery('gte',['intradaymarketcap',minimum]),yf.EquityQuery('btwn',['peratio.lasttwelvemonths',0,maximum])])
        return yf.screen(query,size=25,sortField='intradaymarketcap',sortAsc=False).get('quotes',[])

def main():
    raw=sys.stdin.readline(8193)
    if len(raw)>8192:raise ValueError('Request too large.')
    payload=json.loads(raw)
    import yfinance as yf
    cache=os.environ.get('TMA_YAHOO_CACHE')
    if cache:yf.set_tz_cache_location(cache)
    # Suppress dependency diagnostics; never forward cookies, URLs or raw exceptions.
    if payload.get('operation') in {'stream','async-stream'}:
        with contextlib.redirect_stderr(open(os.devnull,'w')):run(payload,yf)
    else:
        with contextlib.redirect_stdout(open(os.devnull,'w')),contextlib.redirect_stderr(open(os.devnull,'w')):value=run(payload,yf)
        print(json.dumps({'data':clean_json(value)},allow_nan=False,default=str),flush=True)
if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'error':'Yahoo data is unavailable. Check the ticker, connection or throttling and retry later.'}),flush=True)
        sys.exit(1)

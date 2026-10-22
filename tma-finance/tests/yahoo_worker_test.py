import unittest,types,io,contextlib,json
from unittest.mock import Mock
import importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('worker',Path(__file__).parents[1]/'yahoo/worker.py')
w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
class YahooWorkerTests(unittest.TestCase):
 def setUp(self):
  self.t=Mock();self.t.info={'currency':'USD','regularMarketPrice':110,'regularMarketPreviousClose':100,'regularMarketTime':100,'longName':'Example','returnOnEquity':.2}
  self.y=types.SimpleNamespace(Ticker=Mock(return_value=self.t))
 def test_quote_and_metrics(self):
  q=w.run({'operation':'quote','params':{'symbol':'IBM'}},self.y);self.assertAlmostEqual(q['dp'],10)
  self.assertEqual(w.run({'operation':'stock/metric','params':{'symbol':'IBM'}},self.y)['metric']['roeTTM'],20)
 def test_foreign_currency_and_invalid_input(self):
  self.t.info['currency']='GBP'
  with self.assertRaises(ValueError):w.run({'operation':'quote','params':{'symbol':'IBM'}},self.y)
  with self.assertRaises(ValueError):w.run({'operation':'quote','params':{'symbol':'../../bad'}},self.y)
  with self.assertRaises(ValueError):w.symbols(['AAPL']*6)
 def test_batch_uses_tickers(self):
  self.y.Tickers=Mock(return_value=types.SimpleNamespace(tickers={'IBM':self.t}))
  self.assertEqual(w.run({'operation':'batch','params':{'symbols':['IBM']}},self.y)[0]['symbol'],'IBM')
 def test_search_and_news(self):
  self.y.Search=Mock(return_value=types.SimpleNamespace(quotes=[{'symbol':'IBM','quoteType':'EQUITY','shortname':'Example'}],news=[{'content':{'title':'Headline','pubDate':'2026-10-22T12:00:00Z','provider':{'displayName':'Example'},'canonicalUrl':{'url':'https://example.invalid/news'}}}]))
  self.assertEqual(w.run({'operation':'search','params':{'q':'IBM'}},self.y)['result'][0]['symbol'],'IBM')
  self.assertEqual(w.run({'operation':'news'},self.y)[0]['headline'],'Headline')
 def test_market_and_equity_query(self):
  self.y.Market=Mock(return_value=types.SimpleNamespace(status={'open':False},summary={}))
  self.assertFalse(w.run({'operation':'market','params':{'region':'US'}},self.y)['status']['open'])
  self.y.EquityQuery=Mock(side_effect=lambda *args:args);self.y.screen=Mock(return_value={'quotes':[{'symbol':'IBM'}]})
  self.assertEqual(w.run({'operation':'screener','params':{'minMarketCap':1,'maxPE':20}},self.y)[0]['symbol'],'IBM')
  with self.assertRaises(ValueError):w.run({'operation':'screener','params':{'maxPE':-1}},self.y)
 def test_sector_industry_missing_values_are_serializable(self):
  frame=Mock();frame.reset_index.return_value.head.return_value.to_dict.return_value=[{'symbol':'IBM','weight':float('nan')}]
  self.y.Sector=Mock(return_value=types.SimpleNamespace(name='Technology',overview={'value':float('inf')},top_companies=frame))
  self.y.Industry=self.y.Sector
  for op in ['sector','industry']:
   value=w.clean_json(w.run({'operation':op,'params':{'key':'technology'}},self.y))
   self.assertIsNone(value['companies'][0]['weight']);json.dumps(value,allow_nan=False)
 def test_sync_stream(self):
  ws=Mock();ws.__enter__=Mock(return_value=ws);ws.__exit__=Mock(return_value=False)
  ws.listen.side_effect=lambda cb:cb({'id':'IBM','price':100,'currency':'USD'})
  self.y.WebSocket=Mock(return_value=ws)
  with contextlib.redirect_stdout(io.StringIO()) as output:w.run({'operation':'stream','params':{'symbols':['IBM']}},self.y)
  self.assertEqual(json.loads(output.getvalue())['price'],100)
if __name__=='__main__':unittest.main()

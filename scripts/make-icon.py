"""Reproducible TMApps camera icon, matching the suite's flat app tiles."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1] / 'assets'
root.mkdir(exist_ok=True)
im = Image.new('RGBA', (1024, 1024))
d = ImageDraw.Draw(im)
d.rounded_rectangle((24,24,1000,1000),radius=220,fill='#D5414C')
d.rounded_rectangle((208,338,816,744),radius=70,fill='white')
d.rounded_rectangle((350,265,590,407),radius=38,fill='white')
d.ellipse((358,389,662,693),fill='#D5414C')
d.ellipse((392,423,628,659),fill='white')
d.ellipse((428,459,592,623),fill='#D5414C')
d.rounded_rectangle((697,385,752,420),radius=12,fill='#D5414C')
im.save(root/'icon.png')
im.save(root/'icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

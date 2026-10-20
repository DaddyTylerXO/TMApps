"""Render the two-key app mark with Pillow; no external assets."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
im = Image.new('RGBA', (1024, 1024))
d = ImageDraw.Draw(im)
s = 10
def line(points, fill, width):
    p = [(int(x*s), int(y*s)) for x, y in points]
    d.line(p, fill=fill, width=width*s, joint='curve')
    for x,y in p:
        r=width*s/2
        d.ellipse((x-r,y-r,x+r,y+r),fill=fill)
def circle(x,y,r,color):
    d.ellipse(((x-r)*s,(y-r)*s,(x+r)*s,(y+r)*s),fill='#7048a4',outline=color,width=5*s)
d.rounded_rectangle((30,30,970,970),radius=280,fill='#7048a4')
line([(40,35),(21,58),(21,74),(32,74),(32,65),(41,65),(41,56),(50,45)],'#efe2ff',6)
circle(48,27,12,'#efe2ff')
line([(62,58),(56,86),(45,86),(48,76),(41,74),(44,64)],'#d3afff',6)
circle(65,46,12,'#d3afff')
im=im.resize((512,512),Image.Resampling.LANCZOS)
im.save(root/'assets/icon.png')
im.save(root/'assets/icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

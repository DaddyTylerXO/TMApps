from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).resolve().parent.parent
svg='''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect x="14" y="14" width="484" height="484" rx="130" fill="#ed65a0"/><path d="M158 225v-61a98 98 0 0 1 196 0v61" fill="none" stroke="#ffffff" stroke-width="32"/><rect x="95" y="205" width="322" height="235" rx="56" fill="#ffffff"/>'''
for i in range(6):
 x=127+(i%3)*91;y=242+(i//3)*88
 svg+=f'<rect x="{x}" y="{y}" width="76" height="70" rx="16" fill="#ed65a0"/><text x="{x+38}" y="{y+48}" text-anchor="middle" font-family="sans-serif" font-size="42" font-weight="bold" fill="#ffffff">{i+1}</text>'
svg+='</svg>'
(root/'assets/icon.svg').write_text(svg)
im=Image.new('RGBA',(512,512));d=ImageDraw.Draw(im);d.rounded_rectangle((14,14,498,498),130,fill='#ed65a0');d.arc((142,50,370,278),180,360,fill='#ffffff',width=32);d.line((158,162,158,225),fill='#ffffff',width=32);d.line((354,162,354,225),fill='#ffffff',width=32);d.rounded_rectangle((95,205,417,440),56,fill='#ffffff')
font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf',42)
for i in range(6):
 x=127+(i%3)*91;y=242+(i//3)*88;d.rounded_rectangle((x,y,x+76,y+70),16,fill='#ed65a0');d.text((x+38,y+34),str(i+1),font=font,anchor='mm',fill='#ffffff')
im.save(root/'assets/icon.png');im.save(root/'assets/icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

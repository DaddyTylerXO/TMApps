from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
r=Path(__file__).resolve().parent.parent
icon=Image.open(r/'desktop/assets/icon.png').convert('RGBA');icon.resize((1024,1024)).save(r/'desktop/assets/icon.icns')
im=Image.new('RGB',(640,420),'#22252c');d=ImageDraw.Draw(im)
font='C:/Windows/Fonts/segoeui.ttf'
d.rounded_rectangle((22,22,618,398),22,fill='#2d313b',outline='#cc5500',width=2)
d.text((42,42),'TMApps Launcher',font=ImageFont.truetype(font,25),fill='#f5f6fa')
d.text((42,84),'Your applications, together.',font=ImageFont.truetype(font,15),fill='#bec5d2')
d.line((275,210,365,210),fill='#cc5500',width=4);d.polygon([(365,210),(350,200),(350,220)],fill='#cc5500')
d.text((70,330),'Drag TMApps Launcher into Applications',font=ImageFont.truetype(font,21),fill='#f5f6fa')
d.text((86,364),'Then open it from Applications to keep one current copy.',font=ImageFont.truetype(font,14),fill='#bec5d2')
im.save(r/'desktop/assets/dmg-background.png')
p=r/'desktop/package.json';data=json.loads(p.read_text(encoding='utf-8'));data['build']['mac']['icon']='assets/icon.icns';data['build']['dmg'].update(background='assets/dmg-background.png',icon='assets/icon.icns',window={'width':640,'height':420},contents=[{'x':165,'y':210,'type':'file'},{'x':475,'y':210,'type':'link','path':'/Applications'}]);p.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')

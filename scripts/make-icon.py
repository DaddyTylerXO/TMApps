"""Render the canonical SVG into PNG/ICO using Pillow (no other dependencies)."""
from pathlib import Path
import re, xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

root=Path(__file__).resolve().parent.parent
scale=10
im=Image.new('RGBA',(100*scale,100*scale)); draw=ImageDraw.Draw(im)
def render(element, inherited):
    attrs={**inherited,**element.attrib}; tag=element.tag.rsplit('}',1)[-1]
    fill=attrs.get('fill','none'); fill=None if fill=='none' else fill
    stroke=attrs.get('stroke'); width=round(float(attrs.get('stroke-width',1))*scale)
    if tag in ('svg','g'):
        for child in element:render(child,attrs)
    elif tag=='rect':
        x,y,w,h=[float(attrs.get(k,0))*scale for k in ('x','y','width','height')]
        draw.rounded_rectangle((x,y,x+w,y+h),radius=float(attrs.get('rx',0))*scale,fill=fill,outline=stroke,width=width)
    elif tag in ('circle','ellipse'):
        x,y=[float(attrs[k])*scale for k in ('cx','cy')]
        rx=float(attrs.get('r',attrs.get('rx',0)))*scale; ry=float(attrs.get('r',attrs.get('ry',0)))*scale
        # SVG strokes straddle the ellipse boundary; Pillow draws them inward.
        edge=width/2 if stroke else 0
        draw.ellipse((x-rx-edge,y-ry-edge,x+rx+edge,y+ry+edge),fill=fill,outline=stroke,width=width)
    elif tag=='path':
        tokens=re.findall(r'[MLHVCZmlhvcz]|-?\d*\.?\d+',attrs['d']); i=0; command=None; current=(0,0); points=[]; paths=[]
        while i<len(tokens):
            if tokens[i].isalpha():
                command=tokens[i]; i+=1
                if command.upper()=='Z':
                    if points:points.append(points[0]); current=points[0]
                    continue
            count={'M':2,'L':2,'H':1,'V':1,'C':6}[command.upper()]
            values=list(map(float,tokens[i:i+count])); i+=count; relative=command.islower(); op=command.upper(); x,y=current
            if op in ('M','L'):
                end=(values[0]+(x if relative else 0),values[1]+(y if relative else 0))
                if op=='M':
                    if points:paths.append(points)
                    points=[]; command='l' if relative else 'L'
                points.append(end); current=end
            elif op=='H':current=(values[0]+(x if relative else 0),y); points.append(current)
            elif op=='V':current=(x,values[0]+(y if relative else 0)); points.append(current)
            elif op=='C':
                controls=[(values[j]+(x if relative else 0),values[j+1]+(y if relative else 0)) for j in (0,2,4)]
                for step in range(1,33):
                    t=step/32; u=1-t
                    points.append(tuple(u**3*current[k]+3*u*u*t*controls[0][k]+3*u*t*t*controls[1][k]+t**3*controls[2][k] for k in (0,1)))
                current=controls[2]
        if points:paths.append(points)
        for points in paths:
            coords=[(round(x*scale),round(y*scale)) for x,y in points]
            if fill:draw.polygon(coords,fill=fill)
            if stroke:
                draw.line(coords,fill=stroke,width=width,joint='curve')
                if attrs.get('stroke-linecap')=='round':
                    for x,y in (coords[0],coords[-1]):draw.ellipse((x-width/2,y-width/2,x+width/2,y+width/2),fill=stroke)
render(ET.parse(root/'assets/keys.svg').getroot(),{})
im=im.resize((512,512),Image.Resampling.LANCZOS)
im.save(root/'assets/icon.png'); im.save(root/'assets/icon.ico',sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])

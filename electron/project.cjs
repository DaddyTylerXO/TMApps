'use strict';
const RATIOS = { '16:9': 16/9, '9:16': 9/16, '1:1': 1, '4:5': 4/5, '4:3': 4/3 };
const RESOLUTIONS = [480, 720, 1080, 1440, 2160];
function number(value, min, max, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`${label} must be between ${min} and ${max}.`);
  return value;
}
function text(value, limit, label) { if (typeof value !== 'string' || value.length > limit || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error(`Invalid ${label}.`); return value; }
function validate(value, media) {
  if (!value || value.schemaVersion !== 1 || !Array.isArray(value.clips) || !value.clips.length || value.clips.length > 100) throw new Error('Add between 1 and 100 video clips.');
  const settings = value.settings || {};
  if (!RATIOS[settings.ratio] || !RESOLUTIONS.includes(settings.resolution) || !['solid','blur'].includes(settings.background) || !/^#[a-f\d]{6}$/i.test(settings.color) || !['smart','sdr'].includes(settings.hdr)) throw new Error('Invalid canvas or export settings.');
  number(settings.fps,24,144,'Frame rate'); if (!Number.isInteger(settings.fps)) throw new Error('Use a whole frame rate.'); number(settings.bitrate,5,100,'Bitrate');
  let duration = 0;
  const clips = value.clips.map(clip => {
    const source = media.get(clip.mediaId); if (!source || source.kind !== 'video') throw new Error('A video is missing. Reimport it before exporting.');
    number(clip.in,0,source.duration,'Clip start'); number(clip.out,clip.in + 0.04,source.duration + 0.001,'Clip end');
    duration += clip.out - clip.in;
    return { mediaId: clip.mediaId, in: clip.in, out: clip.out };
  });
  const captions = (value.captions || []).map(c => { text(c.text,2000,'caption'); number(c.start,0,duration,'Caption start'); number(c.end,c.start+0.01,duration,'Caption end'); return {text:c.text,start:c.start,end:c.end}; });
  if(captions.length>1000) throw new Error('Use at most 1,000 captions.');
  const title = text(value.title || '',200,'title'), watermark = text(value.watermark || '',100,'watermark');
  const overlay = value.overlay ? { mediaId: text(value.overlay.mediaId,100,'overlay'), x: number(value.overlay.x,0,100,'Overlay X'), y: number(value.overlay.y,0,100,'Overlay Y'), width: number(value.overlay.width,5,80,'Overlay width'), opacity: number(value.overlay.opacity,0.05,1,'Overlay opacity') } : null;
  if (overlay && media.get(overlay.mediaId)?.kind !== 'image') throw new Error('The overlay image is missing.');
  return { schemaVersion:1, name:text(value.name || 'Untitled edit',100,'project name'), clips, captions, title, watermark, overlay, settings:{...settings}, duration };
}
function dimensions(settings) {
  const ratio=RATIOS[settings.ratio], even=n=>Math.round(n/2)*2;
  return ratio >= 1 ? [even(settings.resolution*ratio),settings.resolution] : [settings.resolution,even(settings.resolution/ratio)];
}
function parseSrt(input) {
  const time=s=>{ const m=s.match(/^(\d{1,3}):(\d{2}):(\d{2})[,.](\d{3})$/); if(!m || +m[2]>59 || +m[3]>59) throw new Error('Invalid SRT time.'); return +m[1]*3600 + +m[2]*60 + +m[3]+ +m[4]/1000; };
  return input.replace(/^\uFEFF/,'').replace(/\r/g,'').trim().split(/\n\s*\n/).filter(Boolean).map(block=>{
    const lines=block.split('\n'); if(/^\d+$/.test(lines[0])) lines.shift(); const match=lines.shift()?.match(/^(\S+)\s+-->\s+(\S+)\s*$/); if(!match) throw new Error('Invalid SRT caption.');
    const start=time(match[1]),end=time(match[2]); if(end<=start) throw new Error('Caption end must follow its start.');
    return {start,end,text:lines.join('\n').replace(/<[^>]*>/g,'')};
  });
}
module.exports={ RATIOS,RESOLUTIONS,validate,dimensions,parseSrt };

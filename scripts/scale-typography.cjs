const fs = require('node:fs');
const path = require('node:path');
for (const file of ['styles.css','features.css','integrations.css']) {
  const target = path.join(__dirname,'../src',file);
  let css = fs.readFileSync(target,'utf8');
  css = css.replace(/(font-size\s*:\s*)(\d+(?:\.\d+)?)px/g,(_,prefix,size)=>`${prefix}calc(${size}px * var(--text-scale, 1))`);
  css = css.replace(/(\bfont\s*:\s*)([^;{}]+)/g,(_,prefix,value)=>prefix+(value.includes('calc(')?value:value.replace(/(\d+(?:\.\d+)?)px/, 'calc($1px * var(--text-scale, 1))')));
  fs.writeFileSync(target,css);
}

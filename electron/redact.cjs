'use strict';
// Support reports must be useful without carrying local identities or credentials.
function redact(value){return String(value)
  .replace(/\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+/g,'[redacted token]')
  .replace(/\bBearer\s+[^\s"',;]+/gi,'Bearer [redacted]')
  .replace(/\b(password|secret|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization)\s*[:=]\s*["']?[^\s"',;]+/gi,'$1=[redacted]')
  .replace(/https?:\/\/[^\s"'<>]+/g,url=>{try{const u=new URL(url);u.username='';u.password='';u.search='';u.hash='';return u.href;}catch{return '[redacted URL]';}})
  .replace(/\b[A-Z]:[\\/][^\r\n"<>|]+/gi,'[local path]')
  .replace(/\/(?:Users|home)\/[^\s/]+(?:\/[^\s:)]+)*/g,'[local path]');}
module.exports={redact};

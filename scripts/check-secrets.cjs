const fs=require('node:fs');const {execFileSync}=require('node:child_process');
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);const findings=[];
const patterns=[/gh[pousr]_[A-Za-z0-9]{30,}/,/github_pat_[A-Za-z0-9_]{50,}/,/AIza[A-Za-z0-9_-]{30,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/(?:access_token|refresh_token|client_secret|password)\s*[=:]\s*["'][A-Za-z0-9_./+-]{24,}["']/i];
for(const file of files){if(!fs.existsSync(file))continue;if(/(?:^|\/)(?:\.env(?:\..*)?|workspace\.json|provider-settings\.json)$/.test(file)){findings.push(file);continue;}const bytes=fs.readFileSync(file);if(bytes.includes(0))continue;const text=bytes.toString('utf8');if(patterns.some(p=>p.test(text)))findings.push(file);}
if(findings.length){console.error('Potential credentials found in: '+findings.join(', '));process.exit(1);}console.log('No known credential patterns or private workspace files found in tracked source.');

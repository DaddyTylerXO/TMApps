'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
const files=cp.execFileSync('git',['ls-files','-z']).toString().split('\0').filter(Boolean);
const patterns=[/\bgh[pousr]_[A-Za-z0-9]{30,}\b/,/\bgithub_pat_[A-Za-z0-9_]{50,}\b/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\bAKIA[A-Z0-9]{16}\b/];
let failed=false;
for(const file of files){if(!fs.existsSync(file)||fs.statSync(file).isDirectory())continue;const text=fs.readFileSync(file,'utf8');if(patterns.some(pattern=>pattern.test(text))){console.error('Potential credential in '+file+' (value withheld)');failed=true;}}
if(failed)process.exitCode=1;else console.log('Credential-pattern scan passed for '+files.length+' tracked files. Review generated artifacts separately.');

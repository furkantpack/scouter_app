const fs=require('fs');const ts=require('typescript');const assert=require('node:assert/strict');
const mod={exports:{}};new Function('exports','require','module',ts.transpileModule(fs.readFileSync('lib/auth-validation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod.exports,require,mod);const {safeNext,validEmail,validPassword,validWebUrl}=mod.exports;
let count=0;function check(name,fn){fn();count++;console.log('PASS',name)}
for(const value of ['https://evil.test','//evil.test','/\\evil.test','javascript:alert(1)','/api/auth/login','/login','/auth/callback'])check('redirect rejects '+value,()=>assert.equal(safeNext(value),'/auth/continue'));
check('local redirect preserved',()=>assert.equal(safeNext('/projects?view=all'),'/projects?view=all'));
check('email validation',()=>{assert(validEmail('test@example.com'));assert(!validEmail({}));assert(!validEmail('bad'))});
check('password policy',()=>{assert(validPassword('StrongPass123'));assert(!validPassword('short'));assert(!validPassword('weakpassword'))});
check('URL validation',()=>{assert(validWebUrl('https://example.com'));assert(!validWebUrl('javascript:alert(1)'));assert(!validWebUrl('https://user:pass@example.com'))});
const base='http://localhost:3000';
const cases=[['login page','/login',null,200],['register page','/register',null,200],['reset page','/reset-password',null,200],['verification page','/verification',null,200],['update page','/update-password',null,200],['onboarding protected','/add-product',null,307],['workspace protected','/api/workspace/context',null,401],['empty login','/api/auth/login',{},400],['typed login','/api/auth/login',{email:{},password:5},400],['weak signup','/api/auth/register',{email:'test@example.com',fullName:'Test',password:'weak'},400],['unauthenticated onboarding','/api/onboarding',{step:4,answers:{},completed:true},401]];
(async()=>{for(const [name,path,body,status] of cases){const response=await fetch(base+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(45000)});check(name,()=>assert.equal(response.status,status));}
const cross=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.test'},body:'{}'});check('cross-origin login rejected',()=>assert.equal(cross.status,403));
console.log(count+' checks passed');})().catch(e=>{console.error(e);process.exitCode=1});

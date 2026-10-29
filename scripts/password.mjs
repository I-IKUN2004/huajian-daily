import { hashPassword } from '../src/server/auth.mjs';
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
const password=Buffer.concat(chunks).toString().trimEnd();
if(password.length<10){console.error('从标准输入提供至少10个字符的密码');process.exit(1);}
process.stdout.write(await hashPassword(password)+'\n');


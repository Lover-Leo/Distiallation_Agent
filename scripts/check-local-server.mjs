import {spawn} from 'node:child_process';
const port=18765;
const child=spawn(process.execPath,['src/server.mjs'],{env:{...process.env,PORT:String(port),BASELINE_DIR:'outputs/local-baseline-v1',CHAT_PROVIDER:'local'},stdio:['ignore','pipe','pipe']});
try {
  await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('Server exited')));setTimeout(()=>reject(Error('Startup timeout')),10000).unref();});
  const base=`http://127.0.0.1:${port}`;
  const page=await fetch(base);if(page.status!==200)throw Error('Page failed');
  const profile=await (await fetch(base+'/api/profile')).json();if(!(profile.targetMessages>0))throw Error('Profile failed');
  const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'吃饭'})});
  const data=await response.json();if(response.status!==200||!data.evidence.length||!data.evidence.every(e=>e.day<'2026-10-05'&&e.sources.length))throw Error('Retrieval or split failed');
  const bad=await fetch(base+'/api/chat',{method:'POST',body:'{}'});if(bad.status!==400)throw Error('Input validation failed');
  const foreign=await fetch(base+'/api/chat',{method:'POST',headers:{Origin:'https://example.com'},body:JSON.stringify({message:'test'})});if(foreign.status!==403)throw Error('Origin validation failed');
  console.log(JSON.stringify({page:200,profileMessages:profile.targetMessages,retrieved:data.evidence.length,invalidInput:400,foreignOrigin:403}));
} finally {child.kill();}

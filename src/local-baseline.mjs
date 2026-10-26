import { createHash } from 'node:crypto';
const hash = text => createHash('sha256').update(text).digest('hex');
const fingerprint = text => text.normalize('NFKC').replace(/\s+/gu, '').toLowerCase();
const day = timestamp => new Date(Date.parse(timestamp) + 8 * 3600000).toISOString().slice(0, 10);
export const tokens = text => {
  const result = text.toLowerCase().match(/[a-z0-9]+|[\p{Script=Han}]{1,}/gu) || [];
  return result.flatMap(word => /\p{Script=Han}/u.test(word) ? (word.length > 1 ? Array.from({length:word.length-1},(_,i)=>word.slice(i,i+2)) : [word]) : [word]);
};

export function buildBaseline(input, target = 'self') {
  const counts = { input: input.length, duplicateId: 0, duplicateServerId: 0, emptyOrNonText: 0, redactedMessages: 0, isolatedTargets: 0, oversizedSamples: 0, crossSplitDuplicate: 0, withinSplitDuplicate: 0, heldoutAnswerOverlap: 0 };
  const ids = new Map(), servers = new Map(), rows = [];
  for (const original of input) {
    for (const key of ['platform','conversation_id','message_id','sender_id','source_file','timestamp']) if(typeof original[key] !== 'string' || !original[key]) throw Error(`Missing ${key}`);
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(original.timestamp) || !Number.isFinite(Date.parse(original.timestamp))) throw Error('Invalid timestamp');
    if (original.message_type !== 'text' || typeof original.text !== 'string' || !original.text.trim()) { counts.emptyOrNonText++; continue; }
    const prefix = JSON.stringify([original.platform,original.conversation_id]);
    const sig = JSON.stringify([original.sender_id,original.timestamp,original.text]);
    const id = prefix + original.message_id;
    if(ids.has(id)) { if(ids.get(id)!==sig) throw Error('Conflicting message ID'); counts.duplicateId++; continue; }
    ids.set(id,sig);
    const sid = original.server_id;
    if (typeof sid === 'number' && !Number.isSafeInteger(sid)) throw Error('Unsafe numeric server_id; re-normalize IDs as strings');
    if(sid != null && String(sid)!=='0' && String(sid)!=='') {
      const skey = prefix + String(sid);
      if(servers.has(skey)) { if(servers.get(skey)!==sig) throw Error('Conflicting server ID'); counts.duplicateServerId++; continue; }
      servers.set(skey,sig);
    }
    const text = original.text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[邮箱]').replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g,'[手机号]');
    if(text!==original.text)counts.redactedMessages++;
    rows.push({...original,text,key:id,time:Date.parse(original.timestamp),day:day(original.timestamp)});
  }
  rows.sort((a,b)=>a.time-b.time || a.key.localeCompare(b.key));
  const days = [...new Set(rows.map(r=>r.day))];
  if(days.length < 10) throw Error('Need at least ten active days for chronological evaluation');
  const validationStart = days[Math.floor(days.length*.8)], testStart=days[Math.floor(days.length*.9)];
  const splitFor = date => date < validationStart ? 'train' : date < testStart ? 'validation' : 'test';
  const splits={train:[],validation:[],test:[]}, sessions=[];
  const groups=Map.groupBy(rows,r=>JSON.stringify([r.platform,r.conversation_id]));
  for(const [group,messages] of groups) {
    let session;
    for(const m of messages) {
      if(!session || m.day!==session.day || m.time-session.end>1800000) {
        session={id:hash(group+m.key),group,day:m.day,start:m.time,end:m.time,turns:[]};sessions.push(session);
      }
      session.end=m.time;
      const role=m.sender_id===target?'assistant':'user', previous=session.turns.at(-1);
      const evidence={key:m.key,message_id:m.message_id,source_file:m.source_file,timestamp:m.timestamp};
      if(previous?.sender_id===m.sender_id && m.time-previous.end<=120000) {
        previous.content+='\n'+m.text;previous.evidence.push(evidence);previous.end=m.time;
      } else session.turns.push({role,sender_id:m.sender_id,content:m.text,evidence:[evidence],start:m.time,end:m.time});
    }
  }
  for(const session of sessions) {
    for(let i=0;i<session.turns.length;i++) {
      const turn=session.turns[i]; if(turn.role!=='assistant')continue;
      if(i===0 || session.turns[i-1].role!=='user'){counts.isolatedTargets++;continue;}
      let context=session.turns.slice(Math.max(0,i-6),i);
      while(context.length && context[0].role!=='user')context=context.slice(1);
      const messages=[...context,turn];
      if(messages.reduce((n,m)=>n+m.content.length,0)>12000 || turn.content.length>2000){counts.oversizedSamples++;continue;}
      splits[splitFor(session.day)].push({id:hash(session.id+turn.evidence[0].key),session_id:session.id,group:session.group,day:session.day,messages});
    }
  }
  // Keep later held-out pairs; never place the same normalized pair in earlier splits.
  const seen=new Map();
  for(const name of ['test','validation','train'])splits[name]=splits[name].filter(sample=>{
    const fp=hash(JSON.stringify(sample.messages.slice(-2).map(m=>fingerprint(m.content))));
    if(seen.has(fp)){counts[seen.get(fp)===name?'withinSplitDuplicate':'crossSplitDuplicate']++;return false;}
    seen.set(fp,name);return true;
  });
  // Exclude whole windows carrying long, exact held-out reply text, including history.
  const protectedAnswers=new Set();
  for(const name of ['test','validation','train']) {
    splits[name]=splits[name].filter(sample=>{
      if(sample.messages.some(m=>protectedAnswers.has(fingerprint(m.content)))){counts.heldoutAnswerOverlap++;return false;}
      return true;
    });
    if(name!=='train')for(const s of splits[name]) {const f=fingerprint(s.messages.at(-1).content);if(f.length>=8)protectedAnswers.add(f);}
  }
  const ownership=new Map();
  for(const [name,samples] of Object.entries(splits))for(const s of samples)for(const m of s.messages)for(const e of m.evidence) {
    if(ownership.has(e.key)&&ownership.get(e.key)!==name)throw Error('Source-message leakage');ownership.set(e.key,name);
  }
  const trainKeys=new Set(splits.train.flatMap(s=>s.messages.flatMap(m=>m.evidence.map(e=>e.key))));
  const styleRows=rows.filter(r=>r.sender_id===target&&trainKeys.has(r.key));
  const lengths=styleRows.map(r=>[...r.text].length).sort((a,b)=>a-b);
  const metric=(label, predicate)=>({label,count:styleRows.filter(predicate).length,rate:styleRows.length?styleRows.filter(predicate).length/styleRows.length:0,evidence:styleRows.filter(predicate).slice(0,5).map(r=>({message_id:r.message_id,source_file:r.source_file}))});
  const profile={scope:'仅此联系人场景；仅训练部分；统计描述，不推断人格',targetMessages:styleRows.length,
    meanCharacters:lengths.length?lengths.reduce((a,b)=>a+b,0)/lengths.length:0,medianCharacters:lengths[Math.floor(lengths.length*.5)]||0,p90Characters:lengths[Math.floor(lengths.length*.9)]||0,
    metrics:[metric('不超过10字',r=>[...r.text].length<=10),metric('问号',r=>/[?？]/u.test(r.text)),metric('叹号',r=>/[!！]/u.test(r.text)),metric('波浪号',r=>/[~～]/u.test(r.text)),metric('Unicode emoji',r=>/\p{Extended_Pictographic}/u.test(r.text))]};
  const report={...counts,retained:rows.length,activeDays:days.length,sessions:sessions.length,validationStart,testStart,
    splits:Object.fromEntries(Object.entries(splits).map(([k,v])=>[k,{samples:v.length,days:new Set(v.map(s=>s.day)).size,first:v.map(s=>s.day).sort()[0],last:v.map(s=>s.day).sort().at(-1)}])),
    leakage:{sharedSourceMessages:0,exactNormalizedPairs:0,longHeldoutAnswersInEarlierWindows:0,nearDuplicateCheck:'not implemented'},
    limitations:['仅文字，附件与引用未恢复；会话边界由午夜及30分钟空档近似。','邮箱与手机号替换不等于完整匿名化。','常用短回复可能自然跨集合重复；没有语义近似去重。']};
  return {splits,profile,report};
}

export function buildIndex(samples) {
  const postings={},lengths=[];
  samples.forEach((sample,i)=>{
    const words=tokens(sample.messages.slice(0,-1).map(m=>m.content).join('\n'));
    lengths.push(words.length);const freq=new Map();for(const word of words)freq.set(word,(freq.get(word)||0)+1);
    for(const [word,count] of freq) {if(!Object.hasOwn(postings,word))Object.defineProperty(postings,word,{value:[],enumerable:true});postings[word].push([i,count]);}
  });
  return {version:1,sampleIds:samples.map(s=>s.id),lengths,averageLength:lengths.reduce((a,b)=>a+b,0)/Math.max(1,lengths.length),postings};
}
export function searchIndex(index,samples,query,limit=3) {
  const scores=new Map(),n=index.lengths.length;
  for(const word of new Set(tokens(query))) {
    const matches=Object.hasOwn(index.postings,word)?index.postings[word]:[];
    const idf=Math.log(1+(n-matches.length+.5)/(matches.length+.5));
    for(const [i,tf] of matches) {const score=idf*tf*2.2/(tf+1.2*(.25+.75*index.lengths[i]/Math.max(1,index.averageLength)));scores.set(i,(scores.get(i)||0)+score);}
  }
  return [...scores].sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([i,score])=>{if(samples[i].id!==index.sampleIds[i])throw Error('Index does not match dataset');return {sample:samples[i],score};});
}

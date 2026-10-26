import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { retrieve } from './pipeline.mjs';
import {searchIndex} from './local-baseline.mjs';
import {resolve} from 'node:path';
const baselineDir = process.env.BASELINE_DIR;
const dataset = baselineDir ? {splits:{train:(await readFile(resolve(baselineDir,'train.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line))}} : JSON.parse(await readFile(new URL('../outputs/demo/dataset.json', import.meta.url), 'utf8'));
const index = baselineDir ? JSON.parse(await readFile(resolve(baselineDir,'index.json'),'utf8')) : null;
const profile = baselineDir ? JSON.parse(await readFile(resolve(baselineDir,'profile.json'),'utf8')) : null;
const html = await readFile(new URL(baselineDir?'./web/local.html':'./web/index.html', import.meta.url));
const port = Number(process.env.PORT || 8765);
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
  if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) { res.writeHead(403); res.end(); return; }
  if (req.method === 'GET' && req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
  if (req.method === 'GET' && req.url === '/api/profile' && profile) {res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(profile));return;}
  if (req.method !== 'POST' || req.url !== '/api/chat') { res.writeHead(404); res.end(); return; }
  if (req.headers.origin && ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin)) { res.writeHead(403); res.end(); return; }
  try {
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 16384) throw new Error('too large'); }
    const { message } = JSON.parse(body);
    if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw new Error('invalid message');
    const matches = baselineDir ? searchIndex(index,dataset.splits.train,message).map(({sample,score})=>({...sample,score})) : retrieve(dataset.splits.train, message);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ reply: baselineDir ? '以下为训练部分的真实历史示例，未生成新回复。' : matches.length ? '找到以下虚构参考示例。尚未接入语言模型，因此此处不生成模拟回复。' : '训练部分没有相关示例。尚未接入语言模型。', evidence: matches.map(m => ({ id: m.id, text: m.messages.at(-1).content, context: baselineDir?m.messages.at(-2).content:undefined, day:m.day, sources:baselineDir?m.messages.at(-1).evidence:undefined })) }));
  } catch { res.writeHead(400); res.end(JSON.stringify({ error: '请求无效，请输入 1—2000 字的消息。' })); }
});
server.requestTimeout = 15000;
server.listen(port, '127.0.0.1', () => console.log(`${baselineDir?'本地真实数据检索':'虚构数据演示'}：http://127.0.0.1:${port}`));

import {ChatError} from './deepseek.mjs';

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16384) throw new ChatError(413, 'request_too_large', '请求内容过长。');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new ChatError(400, 'invalid_json', '请求格式无效。'); }
}

export function createApp({port, html, profile, retrieve, chat = null}) {
  return async (req, res) => {
    const json = (status, value) => {
      res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify(value));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; form-action 'self'");
    const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
    if (!origins.some(origin => origin === `http://${req.headers.host}`)) {json(403, {error: '不允许访问此主机。'}); return;}
    if (req.headers.origin && !origins.includes(req.headers.origin)) {json(403, {error: '不允许跨站访问。'}); return;}
    try {
      if (req.method === 'GET' && req.url === '/') {const page=typeof html==='function'?await html():html;res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'}); res.end(page); return;}
      if (req.method === 'GET' && req.url === '/api/profile' && profile) {json(200, profile); return;}
      if (req.method === 'GET' && req.url === '/api/status') {json(200, chat ? chat.status() : {provider: 'local', ready: false}); return;}
      if (chat && req.url === '/api/sessions') {
        if (req.method === 'GET') {json(200, chat.list()); return;}
        if (req.method === 'POST') {json(201, chat.create()); return;}
      }
      const route = /^\/api\/sessions\/([a-f0-9-]{36})(\/clear)?$/.exec(req.url);
      if (chat && route) {
        if (req.method === 'GET' && !route[2]) {json(200, chat.get(route[1])); return;}
        if (req.method === 'DELETE' && !route[2]) {chat.remove(route[1]); json(200, {ok: true}); return;}
        if (req.method === 'POST' && route[2]) {chat.clear(route[1]); json(200, {ok: true}); return;}
      }
      if (req.method === 'POST' && ['/api/chat', '/api/generate'].includes(req.url)) {
        const body = await readBody(req);
        if (!body || typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) throw new ChatError(400, 'invalid_message', '请输入1—2000字的消息。');
        if (req.url === '/api/generate') {
          if (!chat) throw new ChatError(503, 'generation_disabled', '当前为本地检索模式，请使用 DeepSeek 启动脚本。');
          json(200, await chat.generate(body.session_id, body.message)); return;
        }
        const matches = retrieve(body.message);
        json(200, {reply: profile ? '以下为训练部分的真实历史示例，未生成新回复。' : '以下为虚构参考示例，未生成新回复。',
          evidence: matches.map(m => ({id: m.id, text: m.messages.at(-1).content,
            context: profile ? m.messages.at(-2).content : undefined, day: m.day, sources: profile ? m.messages.at(-1).evidence : undefined}))});
        return;
      }
      json(404, {error: '接口不存在。'});
    } catch (error) {
      if (error instanceof ChatError) json(error.status, {error: error.message, code: error.code});
      else json(500, {error: '服务处理失败，请重试。', code: 'internal_error'});
    }
  };
}

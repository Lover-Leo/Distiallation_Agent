import {randomUUID} from 'node:crypto';
import {ChatError, buildMessages, completeDeepseek} from './deepseek.mjs';

export function createChatService({config, profile, retrieve, complete = completeDeepseek, initialSessions = []}) {
  const sessions = new Map();
  if (!Array.isArray(initialSessions) || initialSessions.length > 100) throw Error('Invalid session restore data');
  for (const value of initialSessions) {
    if (!value || !/^[a-f0-9-]{36}$/.test(value.id) || sessions.has(value.id) || typeof value.title !== 'string'
      || !Number.isFinite(Date.parse(value.createdAt)) || !Number.isFinite(Date.parse(value.updatedAt))
      || !Array.isArray(value.messages) || value.messages.length > 100 || value.messages.length % 2
      || value.messages.some((m, i) => !m || m.role !== (i % 2 ? 'assistant' : 'user') || typeof m.content !== 'string' || m.content.length > 20000)) throw Error('Invalid session restore data');
    sessions.set(value.id, {id:value.id, title:value.title.slice(0,80), createdAt:value.createdAt, updatedAt:value.updatedAt,
      messages:value.messages.map(({role,content})=>({role,content})), busy:false});
  }
  let inFlight = 0;
  const session = id => {
    const value = sessions.get(id);
    if (!value) throw new ChatError(404, 'session_not_found', '会话不存在，服务重启后请新建会话。');
    return value;
  };
  const info = ({id, title, createdAt, updatedAt, messages}) => ({id, title, createdAt, updatedAt, messageCount: messages.length});
  return {
    status: () => ({provider: 'DeepSeek', model: config.model, ready: Boolean(config.apiKey),
      dataFlow: '发送当前消息、最多6轮历史、统计画像与最多3个训练示例至DeepSeek；会话仅保存在服务内存。'}),
    list: () => [...sessions.values()].map(info),
    create() {
      if (sessions.size >= 100) throw new ChatError(409, 'session_limit', '最多保留100个会话，请先删除部分会话。');
      const now = new Date().toISOString();
      const value = {id: randomUUID(), title: '新会话', createdAt: now, updatedAt: now, messages: [], busy: false};
      sessions.set(value.id, value);
      return info(value);
    },
    get(id) {const value = session(id); return {...info(value), messages: value.messages};},
    remove(id) {const value = session(id); if (value.busy) throw new ChatError(409, 'session_busy', '当前回复生成中，请完成后再删除。'); sessions.delete(id);},
    clear(id) {const value = session(id); if (value.busy) throw new ChatError(409, 'session_busy', '当前回复生成中，请完成后再清空。'); value.messages = []; value.title = '新会话'; value.updatedAt = new Date().toISOString();},
    async generate(id, message) {
      if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw new ChatError(400, 'invalid_message', '请输入1—2000字的消息。');
      const value = session(id);
      if (!config.apiKey) throw new ChatError(503, 'missing_api_key', '尚未配置 DeepSeek 密钥，请运行本地密钥配置脚本并重启服务。');
      if (value.busy || inFlight >= 2) throw new ChatError(409, 'session_busy', '正在生成回复，请稍后再发送。');
      value.busy = true; inFlight++;
      try {
        const matches = retrieve(message);
        const messages = buildMessages({profile, matches, history: value.messages, message: message.trim()});
        const contextLimited = messages.length - 4 < value.messages.length;
        const result = await complete(config, messages);
        value.messages.push({role: 'user', content: message.trim()}, {role: 'assistant', content: result.reply});
        value.messages = value.messages.slice(-100);
        if (value.title === '新会话') value.title = message.trim().slice(0, 24);
        value.updatedAt = new Date().toISOString();
        return {...result, session_id: id, evidence: matches.slice(0, 3).map(s => ({id: s.id, day: s.day})), contextLimited};
      } finally {value.busy = false; inFlight--;}
    }
  };
}

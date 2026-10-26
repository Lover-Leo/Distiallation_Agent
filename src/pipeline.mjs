import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
export function prepare(rows, target) {
  if (!target || !Array.isArray(rows)) throw new Error('需要消息数组和明确的目标 sender_id');
  const seen = new Map(), groups = new Map();
  const report = { input: rows.length, duplicates: 0, skipped: 0, retained: 0 };
  for (const original of rows) {
    const row = { ...original };
    for (const key of ['platform', 'conversation_id', 'message_id', 'sender_id', 'timestamp', 'message_type', 'source_file']) {
      if (typeof row[key] !== 'string' || !row[key].trim()) throw new Error(`消息字段缺失：${key}`);
    }
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(row.timestamp) || !Number.isFinite(Date.parse(row.timestamp))) throw new Error('timestamp 必须为含时区的 ISO 时间');
    const identity = JSON.stringify([row.platform, row.conversation_id, row.message_id]);
    const signature = JSON.stringify([row.sender_id, row.timestamp, row.message_type, row.text]);
    if (seen.has(identity)) {
      if (seen.get(identity) !== signature) throw new Error('相同消息 ID 存在冲突');
      report.duplicates++; continue;
    }
    seen.set(identity, signature);
    if (row.message_type !== 'text' || typeof row.text !== 'string' || !row.text.trim()) { report.skipped++; continue; }
    row.text = row.text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱]').replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, '[手机号]');
    const key = JSON.stringify([row.platform, row.conversation_id]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row); report.retained++;
  }
  const splits = { train: [], validation: [], test: [] }, normalized = [];
  const ordered = [...groups].sort(([a], [b]) => hash(a).localeCompare(hash(b)));
  ordered.forEach(([group, messages], index) => {
    messages.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    normalized.push(...messages);
    const split = index < Math.floor(ordered.length * .8) ? 'train' : index < Math.floor(ordered.length * .9) ? 'validation' : 'test';
    // Reconstruct samples per temporal session below, preserving source IDs.
    let turns = [], prior = 0;
    const flush = () => {
      for (let i = 1; i < turns.length; i++) {
        if (turns[i].role !== 'assistant' || turns[i - 1].role !== 'user') continue;
        splits[split].push({ id: hash(group + JSON.stringify(turns[i].message_ids)), group, source_files: [...new Set(messages.map(m => m.source_file))], messages: turns.slice(Math.max(0, i - 6), i + 1) });
      }
      turns = [];
    };
    for (const m of messages) {
      if (Date.parse(m.timestamp) - prior > 1800000) flush();
      prior = Date.parse(m.timestamp);
      const role = m.sender_id === target ? 'assistant' : 'user';
      if (turns.at(-1)?.role === role && turns.at(-1)?.sender_id === m.sender_id) {
        turns.at(-1).content += '\n' + m.text; turns.at(-1).message_ids.push(m.message_id);
      } else turns.push({ role, sender_id: m.sender_id, content: m.text, message_ids: [m.message_id] });
    }
    flush();
  });
  // Identical context/answer pairs must not cross dataset boundaries.
  const fingerprints = new Set();
  for (const name of ['test', 'validation', 'train']) {
    splits[name] = splits[name].filter(sample => {
      const fingerprint = hash(JSON.stringify(sample.messages.slice(-2).map(m => m.content)));
      if (fingerprints.has(fingerprint)) return false;
      fingerprints.add(fingerprint); return true;
    });
  }
  return { normalized, splits, report: { ...report, conversations: groups.size, samples: Object.fromEntries(Object.entries(splits).map(([k, v]) => [k, v.length])) } };
}

export function retrieve(samples, query, limit = 3) {
  const tokens = value => new Set(value.toLowerCase().match(/[\p{Script=Han}]|[a-z0-9]+/gu) || []);
  const wanted = tokens(query);
  return samples.map(sample => {
    const text = tokens(sample.messages.slice(0, -1).map(m => m.content).join(' '));
    const score = [...wanted].filter(token => text.has(token)).length / Math.max(1, wanted.size);
    return { ...sample, score };
  }).filter(sample => sample.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

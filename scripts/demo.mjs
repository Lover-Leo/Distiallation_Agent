import { mkdir, writeFile } from 'node:fs/promises';
import { prepare } from '../src/pipeline.mjs';
const topics = ['吃饭', '散步', '电影', '工作', '学习', '旅行', '音乐', '周末', '天气', '运动'];
const rows = topics.flatMap((topic, i) => ['user', 'fictional-target', 'fictional-target'].map((sender, j) => ({
  platform: 'synthetic', conversation_id: `demo-${i}`, message_id: `${i}-${j}`, sender_id: sender,
  timestamp: `2026-01-01T12:0${j}:00+08:00`, message_type: 'text',
  text: j === 0 ? `${topic}有什么计划？` : j === 1 ? `${topic}的话，等我想想～` : '晚点再聊呀',
  reply_to: null, source_file: 'generated-fictional-demo'
})));
await mkdir('data/demo', { recursive: true });
await mkdir('outputs/demo', { recursive: true });
await writeFile('data/demo/messages.json', JSON.stringify(rows, null, 2));
const result = prepare(rows, 'fictional-target');
await writeFile('outputs/demo/dataset.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.report, null, 2));

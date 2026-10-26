import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {retrieve} from './pipeline.mjs';
import {searchIndex} from './local-baseline.mjs';
import {loadLocalEnv, deepseekConfig} from './config.mjs';
import {createChatService} from './chat-service.mjs';
import {createApp} from './http-app.mjs';

await loadLocalEnv();
const baselineDir = process.env.BASELINE_DIR;
const useDeepseek = process.env.CHAT_PROVIDER === 'deepseek';
if (useDeepseek && !baselineDir) throw Error('DeepSeek 模式需要指定 BASELINE_DIR。');
const samples = baselineDir
  ? (await readFile(resolve(baselineDir, 'train.jsonl'), 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
  : JSON.parse(await readFile(new URL('../outputs/demo/dataset.json', import.meta.url), 'utf8')).splits.train;
const index = baselineDir ? JSON.parse(await readFile(resolve(baselineDir, 'index.json'), 'utf8')) : null;
const profile = baselineDir ? JSON.parse(await readFile(resolve(baselineDir, 'profile.json'), 'utf8')) : null;
const find = message => baselineDir ? searchIndex(index, samples, message).map(({sample}) => sample) : retrieve(samples, message);
const initialSessions = useDeepseek && process.env.CHAT_SESSION_IMPORT ? JSON.parse(await readFile(resolve(process.env.CHAT_SESSION_IMPORT), 'utf8')) : [];
const chat = useDeepseek ? createChatService({config: deepseekConfig(), profile, retrieve: find, initialSessions}) : null;
const page = useDeepseek ? './web/chat.html' : baselineDir ? './web/local.html' : './web/index.html';
const html = () => readFile(new URL(page, import.meta.url));
await html();
const port = Number(process.env.PORT || 8765);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT 必须为有效端口。');
const server = http.createServer(createApp({port, html, profile, retrieve: find, chat}));
server.requestTimeout = 15000;
server.listen(port, '127.0.0.1', () => console.log(`${useDeepseek ? 'DeepSeek 风格聊天' : baselineDir ? '本地真实数据检索' : '虚构数据演示'}：http://127.0.0.1:${port}`));
server.on('error', error => {console.error(error.code === 'EADDRINUSE' ? '端口已占用，请停止旧服务或设置 PORT。' : '本地服务启动失败。'); process.exitCode = 1;});

import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const url = `http://127.0.0.1:${process.env.PORT || 8765}`;

async function status() {
  let response;
  try { response = await fetch(url + '/api/status', {signal: AbortSignal.timeout(1000)}); }
  catch { return false; }
  let data;
  try { data = await response.json(); } catch { throw Error('端口已被其他程序使用，请先关闭该程序或设置 PORT。'); }
  if (data.provider !== 'DeepSeek') throw Error('此端口运行的不是 DeepSeek 聊天服务，请先停止旧服务。');
  return true;
}

try {
  const running = await status();
  if (!running) {
    await import('./start-deepseek.mjs');
    let ready = false;
    for (let i = 0; i < 40; i++) {
      if (await status()) {ready = true; break;}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!ready) throw Error('启动超时，请查看窗口中的错误信息。');
  }
  console.log(running ? '服务已在运行，打开聊天页面。' : '启动完成，请保持此窗口开启。按 Ctrl+C 停止服务。');
  console.log(url);
  if (!process.argv.includes('--no-browser')) {
    const browser = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'rundll32.exe'), ['url.dll,FileProtocolHandler', url], {windowsHide: true, stdio: 'ignore', detached: true});
    browser.on('error', () => console.error('浏览器未能自动打开，请手动访问上方地址。'));
    browser.unref();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

# DeepSeek 风格聊天

更新：2026-10-26（Asia/Shanghai）。已完成官方 DeepSeek API 接入及两轮真实联通检查，仍未微调模型。

## 启动与配置

当前电脑已保存本机密钥，可以直接执行：

最方便的方式是在项目文件夹双击 **快速启动.cmd**：会自动复用已运行的 DeepSeek 服务；未运行时启动，待服务就绪后打开默认浏览器。若新启动服务，请保持终端窗口开启。

```powershell
.\start-deepseek.cmd
```

打开 http://127.0.0.1:8765 。也可在资源管理器双击根目录 start-deepseek.cmd。此入口可从任何当前目录运行，自动查找 PATH 中的 Node.js 或本机已有 Codex Node.js，不修改 PowerShell 脚本执行策略。如果旧的本地检索服务占用端口，先在旧终端按 Ctrl+C。停止服务同样按 Ctrl+C。

更换密钥时运行以下命令，在隐藏输入中粘贴新的密钥，再重启服务：

```powershell
.\scripts\configure-deepseek.ps1
```

密钥保存于根目录 .env，Git 忽略该文件。服务器读取后不会发送给网页，也不输出原始上游错误。环境变量优先于 .env；如果环境变量中已有旧密钥，需先更新或移除。

新克隆仓库不包含 .env 或真实数据。需先生成本地基线产物，再配置密钥。配置模板为 .env.example，默认模型 deepseek-flash，响应超时 45 秒。DEEPSEEK_MODEL 可覆盖模型名，DEEPSEEK_TIMEOUT_MS 范围为 1000—120000 毫秒。

## 已授权的数据流

用户在本聊天明确允许发送下述内容至 DeepSeek，用于生成风格回复：

- 当前输入消息。
- 最多 6 轮本次会话，按完整问答保留，累计最多 6000 字符。
- 训练部分统计画像中的长度和标点等指标，不发送画像中的本地文件路径或证据 ID。
- 最多 3 个检索到的训练示例，每个示例的前文和回复分别最多 600 字符。

请求前替换可识别的邮箱及中国大陆手机号，但这不能清除全部身份信息。示例可能包含你与联系人的私聊内容。不会上传整库、验证集或测试集；调用不进行微调。事实记忆仍为空，不把旧消息当作本人当前事实。

只有使用 DeepSeek 模式并发送聊天消息时才发起云端生成；启动服务、查看配置和切换会话不调用模型。原来的 .\scripts\start-local.ps1 继续提供完全本地检索。

## 会话行为

支持新建、切换、查看、清空和删除会话。会话存放于服务内存，页面刷新可重新读取，服务重启即消失；目前最多 100 个会话，每个保留最近 100 条消息。模型实际接收的历史更短，页面会在上下文裁剪时提示。

相同会话生成期间禁止重复发送、清空或删除；服务最多同时生成两条回复。失败不追加用户消息或空回复，输入保留便于重试。密钥错误、余额不足、限流、超时均显示可理解提示，不自动重试付费请求。

网页仅绑定本机，明确标注 AI 模拟，并显示本次参考样本的日期与编号；生成结果不写入真人数据集、画像、索引或事实记忆。

## 实测与限制

2026-10-26，官方模型列表确认账户可用 deepseek-flash、deepseek-v4-pro。实际采用 deepseek-flash，非思考、非流式，最多生成 512 tokens。

两轮端到端检查成功，耗时分别约 557 ms、1390 ms，回复分别为 10、11 字符；每轮使用 3 个训练示例，历史读取与清空／删除通过。结果记录在被 Git 忽略的 outputs/deepseek/live-check.json，不保存测试回复正文。

17 项 Node 测试覆盖配置、输入预算、会话隔离、更新时恢复、请求失败回滚、并发锁、上游错误脱敏及 HTTP 路由。联通与工程测试不能证明风格还原、事实准确或抵抗提示注入；这些仍需独立测试集和人工试聊。暂未提供流式输出、持久会话或自动摘要。

## 长对话界面（2026-10-26 更新）

聊天页使用固定视口布局，只有消息区滚动；底部输入框和发送按钮始终可见。说明及来源收进弹窗；支持 Enter 发送、Shift+Enter 换行，并避免中文输入法确认候选词时误发送。

收到回复时直接追加，不重建整段记录；用户向上阅读旧消息时保留位置，提供“回到最新”。切换会话会滚动到该会话最新位置。后续 HTML 布局更新可刷新直接加载，不必重启服务。

已用 80 条虚构消息在 1440×900、1280×720、390×844、360×640、800×450 五种尺寸实测，检查输入区和发送按钮完整可见、无整页滚动、旧消息节点及阅读位置保留、快捷键和说明弹窗。测试没有调用 DeepSeek。

浏览器检查报告与虚构消息截图保存在 outputs/ui-check/。可选重跑需要 Playwright Core 与本机 Chrome：

```powershell
npm install --prefix outputs/ui-tools --no-package-lock --ignore-scripts playwright-core
node scripts/check-chat-ui.mjs
```

本次更新运行中的服务时临时备份并恢复了原有会话，逐条核对成功后删除备份；这不是常规会话持久化，正常停止服务后会话仍会消失。

```powershell
node --test tests/*.test.mjs
node scripts/check-local-server.mjs
```

真实云端检查会产生 API 调用并发送授权片段，必须显式选择：

```powershell
node scripts/check-deepseek-live.mjs --live
```

## 接口依据

- [DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/)：官方地址、模型名与 Bearer 鉴权。
- [Chat Completions](https://api-docs.deepseek.com/zh-cn/api/create-chat-completion/)：请求与响应字段。
- [思考模式](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/)：显式关闭默认思考模式。
- [错误码](https://api-docs.deepseek.com/zh-cn/quick_start/error_codes/)：认证、余额、限流与服务故障处理。

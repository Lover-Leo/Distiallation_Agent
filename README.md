# 个人风格 Agent

从本人授权的私聊记录构建表达统计和历史检索基线。当前已完成本地数据处理、历史检索及 DeepSeek 多轮生成；尚未执行微调。

## 当前结果

- 已导出首个指定微信私聊的 125,997 条文字；样本发送方向与内容获用户确认。
- 用户选择最近半年范围，并接受实际覆盖的 2026-06-13 至 2026-10-26，不补齐更早记录。
- 按时间分为训练 13,072 组、验证 1,832 组、测试 1,899 组。
- 基于训练部分生成表达统计和 BM25 检索库；网页可查看历史前文、本人回复和证据来源。
- 已选择 DeepSeek，并通过两轮真实调用；事实记忆为空。真实数据、画像、索引、联系人配置和依赖均不提交 Git。

## 启动

需要 Node.js 22 或更新版本。网页与数据管线使用 Node.js 标准库，无 npm 安装步骤。

### 当前电脑：DeepSeek 聊天与本地检索

本机已经生成 outputs/local-baseline-v1 并配置密钥，可直接运行生成式聊天：

```powershell
.\start-deepseek.cmd
```

访问 http://127.0.0.1:8765 ，按 Ctrl+C 停止。支持多轮生成、新建／切换／清空／删除会话。按用户授权，每次将有限会话、统计与最多 3 个训练示例发送至 DeepSeek。详见 [DeepSeek 配置及数据流](docs/deepseek.md)。

更换密钥运行 `.\scripts\configure-deepseek.ps1`，在隐藏输入中粘贴后重启。纯本地检索运行 `.\scripts\start-local.ps1`。

### 新克隆仓库：虚构数据演示

仓库不包含真实数据，先运行：

```powershell
node scripts/demo.mjs
node src/server.mjs
```

确保没有设置 BASELINE_DIR 或 CHAT_PROVIDER 环境变量。演示会话仅在页面内存中保存；刷新后消失。

## 构建真实数据基线

```powershell
node scripts/build-local-baseline.mjs 输入的normalized.json outputs/local-baseline-v2
```

输出目录必须尚不存在。统一输入是消息对象数组，字段为 platform、conversation_id、message_id、sender_id、timestamp、message_type、text、source_file、reply_to 和可选 server_id。时间必须带时区；服务器 ID 使用字符串；当前真实管线目标 sender_id 为 self。详见 [本地基线说明](docs/local-baseline.md)。

scripts/prepare.mjs 和 src/pipeline.mjs 保留用于多会话演示；单联系人真实数据使用 src/local-baseline.mjs 的时间切分流程。

## 微信导出

已在 Windows 微信 4.1.15.56 上完成指定私聊提取。运行入口、上游来源和依赖见 [导出工具说明](tools/wechat-export/README.md)，范围见 [数据范围](docs/data-scope.md)。私有配置位于 data/private/export-scope.json，不随仓库分发。导出依赖独立安装于 tools/wechat-export/deps，不能把通用 Node.js 启动环境视为完整的微信导出环境。

## 验证

```powershell
node --test tests/*.test.mjs
python tests/test_wechat_scope.py
```

当前 17 项 Node 测试通过，之前 1 项虚构 SQLite 范围测试通过。本机 HTTP 冒烟已通过；有真实基线产物时可运行 node scripts/check-local-server.mjs 重测。浏览器交互及生成效果尚未评测。

## 限制与下一步

仅使用文字；附件与引用尚未恢复。邮箱和手机号替换不等于完整匿名化，尚无语义近似去重。统计只代表此联系人场景，不推断人格。下一步使用独立测试输入检查生成风格、上下文和事实可靠性，再评估是否微调。

详见 [当前进度](当前进度.md) 与 [总体方案](任务目标与分阶段实施方案.md)。

# Personal Style Agent · 个人表达风格助手

从已授权的文字聊天记录中构建表达统计与历史检索基线，再按需接入 DeepSeek 生成多轮回复。项目用于探索“历史表达参考如何影响生成风格”，当前为**研究原型，尚未执行模型微调**。

仓库提供可独立运行的虚构数据演示。真实聊天记录、检索索引、统计画像和 API 密钥均不包含在仓库中。

## 已实现的能力

- 文字消息规范化、去重、按时间划分训练／验证／测试集。
- 基于训练集生成表达统计与 BM25 检索索引，查看历史前文、回复及证据来源。
- 本地网页检索，以及可选的 DeepSeek 多轮聊天。
- 聊天会话的新建、切换、清空与删除；会话保存在服务内存中。

| 模式 | 所需数据 | 云端模型调用 |
| --- | --- | --- |
| 虚构数据演示 | 演示脚本生成的数据 | 无 |
| 本地基线检索 | 本地构建的训练集、索引与画像 | 无 |
| DeepSeek 聊天 | 本地基线与 API 密钥 | 发送聊天消息时调用 |

## 快速开始：虚构数据演示

需要 **Node.js 22 或更新版本**。网页与数据管线使用 Node.js 标准库，无需安装 npm 依赖。

```sh
git clone https://github.com/Lover-Leo/Distiallation_Agent.git
cd Distiallation_Agent
node scripts/demo.mjs
node src/server.mjs
```

启动前确保没有设置 `BASELINE_DIR` 和 `CHAT_PROVIDER` 环境变量，以免加载其他运行模式。打开 [本地演示页面](http://127.0.0.1:8765)，按 `Ctrl+C` 停止服务。

演示脚本生成虚构消息，并写入 `data/demo/` 与 `outputs/demo/`。演示会话只保存在页面内存，刷新后清空。

## 使用自己的本地基线

### 1. 准备规范化输入

输入为 JSON 消息数组，包含 `platform`、`conversation_id`、`message_id`、`sender_id`、`timestamp`、`message_type`、`text`、`source_file`、`reply_to` 和可选的 `server_id`。

时间戳需要时区；服务器消息 ID 建议使用字符串，避免数值精度丢失。当前基线脚本以 `sender_id: "self"` 标识目标回复方，且需要至少 10 个活跃日期。字段语义、时间切分与数据范围见[本地基线说明](docs/local-baseline.md)。

### 2. 构建基线并启动本地检索

以下示例使用 PowerShell；先将规范化输入准备为 `data/private/normalized.json`：

```powershell
New-Item -ItemType Directory -Force outputs | Out-Null
node scripts/build-local-baseline.mjs data/private/normalized.json outputs/local-baseline-v1
$env:BASELINE_DIR = 'outputs/local-baseline-v1'
$env:CHAT_PROVIDER = 'local'
node src/server.mjs
```

基线输出目录必须尚不存在；已有同名目录时请换用新的版本名。产物包括训练／验证／测试集、画像、检索索引与质量报告。当前生成的 `memory.json` 事实列表为空，不会自动把历史聊天当成已确认事实。

### 3. 可选：启用 DeepSeek

先停止本地服务，在仓库根目录配置密钥，再启动生成模式：

```powershell
.\scripts\configure-deepseek.ps1
$env:BASELINE_DIR = 'outputs/local-baseline-v1'
$env:CHAT_PROVIDER = 'deepseek'
node src/server.mjs
```

配置脚本通过隐藏输入将密钥保存到本机 `.env`。也可参考 [.env.example](.env.example) 手动配置；不要将真实密钥写入源码或提交记录。

| 设置 | 位置 | 用途 |
| --- | --- | --- |
| `BASELINE_DIR` | 进程环境变量 | 基线输出目录 |
| `CHAT_PROVIDER` | 进程环境变量 | 设置为 `deepseek` 时启用生成，其余值为本地检索 |
| `PORT` | 进程环境变量 | 本地端口，默认 `8765` |
| `DEEPSEEK_API_KEY` | `.env` 或进程环境变量 | API 密钥 |
| `DEEPSEEK_MODEL` | `.env` 或进程环境变量 | 模型名，默认值见 [.env.example](.env.example) |
| `DEEPSEEK_TIMEOUT_MS` | `.env` 或进程环境变量 | 请求超时，默认 `45000` 毫秒 |

`.env` 只加载表中的三个 `DEEPSEEK_*` 设置；切换基线、模式和端口需要设置进程环境变量。快捷入口 [start-deepseek.cmd](start-deepseek.cmd) 固定使用 `outputs/local-baseline-v1`，运行前需已有该基线。

### 数据流与保存方式

本地检索使用训练集；DeepSeek 模式每次发送当前问题、最多 6 轮且总计不超过 6000 字符的历史会话、部分表达统计，以及最多 3 个训练示例。示例的前文与回复各截取最多 600 字符。验证集和测试集不用于检索。

当前消息与所选文本会替换邮箱及中国大陆手机号，但这不等于完整匿名化。每次发送前应了解所用数据范围；详细说明见 [DeepSeek 配置及数据流](docs/deepseek.md)。

服务默认仅监听 `127.0.0.1`。生成模式的会话保存在服务内存，服务重启后不自动恢复；它不是带用户登录和持久化存储的多人部署版本。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| [src/](src/) | 数据管线、检索、生成服务、HTTP 接口与网页 |
| [scripts/](scripts/) | 虚构演示、基线构建、启动及验证入口 |
| [tests/](tests/) | Node.js 测试与 Python 数据范围测试 |
| [docs/](docs/) | 环境、数据范围、基线与云端调用说明 |
| [tools/wechat-export/](tools/wechat-export/) | 固定版本的第三方导出组件及来源说明 |

微信导出需要独立的 Python 环境与本机私有范围配置，不属于最小演示的启动前提。运行入口、依赖与兼容性边界见[导出工具说明](tools/wechat-export/README.md)和[导出调研](docs/wechat-export-research.md)。

## 验证

从仓库根目录运行已有测试：

```sh
node --test tests/*.test.mjs
python tests/test_wechat_scope.py
```

Node.js 测试使用模拟的模型响应，不需要真实密钥。Python 范围测试使用虚构 SQLite 数据，不能作为实际微信客户端兼容性证明。真实模型调用与真实数据验证应单独记录，不能替代离线测试。

## 当前限制

仅处理文字，尚未恢复附件与引用；未实现语义近似去重。表达统计仅描述数据覆盖的会话场景，不等同于人格判断。历史例句不能证明当前事实，也不能保证生成内容准确。生成效果、风格一致性与浏览器交互仍需系统评测。

## 更多文档

- [环境说明](docs/environment.md) · [数据范围](docs/data-scope.md)
- [当前进度](当前进度.md) · [总体实施方案](任务目标与分阶段实施方案.md)
- [维护与验证约定](CONTRIBUTING.md)

第三方导出组件的 Apache-2.0 许可保留在其[原目录](tools/wechat-export/LICENSE)；该许可适用于对应组件。

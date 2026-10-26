# 本地导出依赖

`exporter_core.py` 与 LICENSE 来自 https://github.com/zhuzhangxue/wechat-chat-export ，固定提交 `2c49469`（v1.4.0），2026-10-26 下载。上游采用 Apache-2.0；原文件保留不改，范围限制由 scripts/wechat_scope.py 在内存中应用。

安装于 deps/ 的依赖不提交 Git。使用本机 Codex 附带的 Python 3.12.14，避免修改系统环境。完整环境应保存为 outputs/ 内的版本清单。

运行入口：`scripts/export_wechat_sample.py`。范围配置位于 Git 忽略的 `data/private/export-scope.json`，包含联系人与数据路径；请勿提交该文件。结果仅写入 outputs/ 下独立运行目录。

范围限制：精确唯一联系人、私聊、指定日期区间和文字。sample_limit 为整数时执行小样本；为 null 时导出该范围全部文字。原始消息数据库是加密分片，解密缓存的粒度可能大于单个会话；SQL 查询与输出限制在指定范围，缓存由上游临时目录机制清理。不会调用平台发消息接口或云端模型。

请勿直接调用上游默认 CLI：原版没有本项目的日期及联系人歧义限制。脚本对预期源码片段严格检查，失配即停止。虚构 SQLite 测试不代表实际客户端兼容。

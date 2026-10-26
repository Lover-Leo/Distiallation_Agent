# Windows 微信导出核验

日期：2026-10-26。只检查公开文档及本地程序版本，没有运行提取或读取私聊。

## 当前候选

[wechat-chat-export](https://github.com/zhuzhangxue/wechat-chat-export) 声明支持 Windows 微信 4.1.12+，可按联系人名称导出 TXT、Markdown 和 JSON；Windows 发布程序无需另装 Python。[发布页](https://github.com/zhuzhangxue/wechat-chat-export/releases) 当前显示 v1.4.0。

本机文件版本为 4.1.15.56。落在项目声明范围内不等于实际验证成功。

查看 [CLI 源码](https://raw.githubusercontent.com/zhuzhangxue/wechat-chat-export/main/cli.py) 未发现日期筛选参数。因此当前不能直接执行原版导出，将其描述为只处理最近一年。后续需先核查核心查询并加入时间筛选；不能默认扩大到该联系人的全部历史。第一次只处理指定联系人纯文本，保留 JSON 中发送者及来源标识，用于抽查。

## 其他核验结果

- [chatlog](https://github.com/sjzar/chatlog) 当前为项目移除通知，不能按旧教程作为现成工具使用。
- [WeFlow](https://github.com/hicccc77/WeFlow) 当前 README 提示需要自行设计的原生组件；其 GitHub 发布页当前无发行包，尚不是已验证的一键路线。

## 待输入与执行顺序

1. 指定第一个联系人的准确备注名或账号，并核对是否重名。
2. 确认微信设置中显示的实际数据存储目录（安装目录不等于数据目录）。
3. 核查并适配日期筛选，准备独立导出目录和源数据备份。
4. 保持本人微信登录后验证小样本；核对双方发送方向、日期、引用和数量。
5. 验证后再处理其余指定联系人。当前不调用云端模型。

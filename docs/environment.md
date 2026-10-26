# 环境与启动记录

检查日期：2026-10-26（Asia/Shanghai）。

- Node.js：v24.22.1；当前终端可直接调用，无需安装项目依赖。
- CPU：Intel Core i7-14650HX。
- 内存：系统报告约 15.73 GiB。
- GPU：NVIDIA GeForce RTX 5070 Laptop GPU，8151 MiB 显存；驱动 610.47。
- D 盘检查时剩余约 382.63 GiB。
- 默认 python / py 指向 WindowsApps，启动失败；未安装或修改 Python 环境。
- CIM 查询受限，CPU/内存通过 Node.js os 模块读取，GPU 通过 nvidia-smi 读取。

尚未测量模型推理速度、训练显存或成本。8 GB 显存不能直接证明某种训练配置可运行。

阶段 0 待确认：目标人物及授权范围、数据设备和导出格式、时间段、模型运行方式。当前仅处理程序生成的虚构样本。

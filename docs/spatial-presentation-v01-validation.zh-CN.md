# AFFiNE Presentation V0.1 实施与验证记录

日期：2026-09-22。

## 交付状态

V0.1 Frame Navigator 已提交，最终 12 项演示测试全部通过。V0.2 平滑过渡、V0.3 自由漫游与独立 Resume 按钮尚未实现。未创建上游 PR，未打包桌面安装程序。

- 仓库：https://github.com/layzerff/AFFiNE
- 分支：https://github.com/layzerff/AFFiNE/tree/feature/spatial-presentation
- 上游基线：d897bb3d84099e54a6b3c0bd5f4265f8aa87d190（canary）。
- 需求提交：583d9611c41ea0f8a9afc845618e17c0b08ec114。
- 功能提交：4f89d2e6c99a9a74ac3a11edf1c6a885cc156b59。

## 改动文件

`blocksuite/affine/blocks/frame/src/edgeless-toolbar/presentation-toolbar.ts`：新增 63 行，增加 Go to frame 原生选择器，显示序号与标题，按 Frame ID 解析最新索引，复用原有定位链路。Previous/Next、Frame Order 菜单及标题点击回到当前 Frame 功能保留。处理空列表、只读模式、键盘事件隔离、焦点期间工具栏显示及删除 Frame 后索引越界。无持久化字段或依赖变更。

`tests/blocksuite/e2e/edgeless/presentation.spec.ts`：新增 87 行，增加 4 项测试，覆盖空演示、只读演示、任意跳转后继续 Previous/Next、键盘选择与 Escape。

## 实际验证

命令通过仓库自带 `.yarn/releases/yarn-4.18.0.cjs` 执行。

| 检查                                                                                                  | 最终结果                           |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------- |
| yarn lint                                                                                             | 退出码 0，格式检查覆盖 7457 个文件 |
| 改动文件 oxlint --deny-warnings、oxfmt --check                                                        | 退出码 0                           |
| yarn typecheck                                                                                        | 依赖初始化结束后重跑，退出码 0     |
| tsc -b blocksuite/affine/blocks/frame/tsconfig.json tests/blocksuite/tsconfig.json --pretty false     | 退出码 0                           |
| yarn workspace @affine-test/blocksuite test edgeless/presentation.spec.ts --workers=1 --timeout=60000 | 12 passed，退出码 0，约 1.7 分钟   |

首次 10 项测试中，原有 Frame 面板排序测试出现一次翻页断言失败。上游原始工具栏单独复测通过，修改版连续复测两次通过，最终完整 12 项测试全部通过。没有修改原用例来掩盖失败；其偶发失败根因尚未确定。

首次全仓 typecheck 在依赖初始化尚未结束时报告 Prisma 等类型缺失；初始化完成后重跑已通过，先前错误不是最终检查结论。

## 环境与限制

- Windows、Node 24.19.0、Yarn 4.18.0。上游要求 Node >=22.12.0 且 <23.0.0，.nvmrc 指定 22.23.2；匹配运行时下载超时，正式上游提交前应再用 Node 22 CI 验证。
- Git clone 网络超时，改用官方 codeload 源码包及 Git Data API，在 fork 原始历史上提交，没有另建根提交。
- yarn install --immutable 最终退出 1：Electron 下载连接超时。浏览器测试已跑通，但桌面打包未验证。
- V0.1 为原生选择器，不含缩略图。大量 Frame、协作删除/重排、极窄窗口和跨浏览器行为尚未全部人工验收。
- 原生 select 再选同一项通常不触发 change；回到当前 Frame 继续使用原有标题入口，独立 Resume 按钮属于 V0.3。

## 后续源码结论

底层能够支持需求，无需重构文档模型。frame-manager 已有独立 presentationIndex；viewport 已有平移和缩放动画；PanTool 与键盘处理已有中键/空格临时拖动及 restoredAfterPan 恢复逻辑。

V0.2 需要协调动画取消、退出/销毁、减少动态效果与黑色遮罩。navigator-bg-widget 当前围绕目标 Frame 渲染遮罩，直接开启 smooth 参数不足以保证整张画布滑移的体验。V0.3 需要复用临时拖动逻辑并补充明确 Resume 入口。两阶段分别实施、验证、提交，不混入本次 V0.1 最小补丁。

英文 PR 描述草稿另附，尚未发布。

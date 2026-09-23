# AFFiNE Spatial Presentation V0.2 / V0.3

日期：2026-09-23。仓库：layzerff/AFFiNE。分支：feature/spatial-presentation。

## 本轮结果

V0.2 与 V0.3 已实现。演示中可以任选 Frame，以平滑平移和缩放移动到目标，并直接拖动画布或缩放，再使用 Resume 回到当前 Frame。演示顺序、Previous/Next 与文档格式保持原有机制。没有创建上游 PR，没有签署 CLA，没有生成桌面安装包。

## V0.2 平滑过渡

功能提交：261ccf17bc3527da72799d6cb3454d39d64e94d0。

- 300 毫秒平移与缩放插值，复用 viewport 的目标适配计算和最终定位；初次进入演示保持直接定位。
- Previous/Next 和 Frame 选择器触发动画；快速重新选择会取消上一段，从当前视角前往最新目标。
- 系统 prefers-reduced-motion 设置为 reduce 时直接定位。
- 指针操作、滚轮、视口开始调整大小、切换工具与卸载均取消未完成动画。
- 移动期间暂时隐藏黑色遮罩，结束后按原有设置恢复；遮罩位置随视口更新，不改写文档数据。

修改文件：

1. blocksuite/affine/blocks/frame/src/present-tool.ts：可取消动画及临时动画状态。
2. blocksuite/affine/blocks/frame/src/edgeless-toolbar/presentation-toolbar.ts：导航触发动画、记录最新索引、阻止退出后的延迟定位。
3. blocksuite/affine/blocks/frame/src/present/navigator-bg-widget.ts：过渡期间隐藏遮罩并更新位置。
4. blocksuite/framework/std/src/gfx/viewport-element.ts：把中途挂载的视图纳入下次可见性清理。
5. tests/blocksuite/e2e/edgeless/presentation.spec.ts：动画中间状态、减少动态效果、退出取消及连续跳转测试。

### 发现并修复的回归

原有便签可见性用例在动画后失败：视口已经移到便签之外、没有选中元素，但便签仍为 active。原因是动画中途挂载的视图未记录到上一轮可见集合，后续清理可能遗漏。修正可见集合记录后，原失败用例连续三次通过；最终完整演示测试 15/15 通过。没有放宽原测试断言。

## V0.3 漫游与 Resume

功能提交：38ff6a4bf1fc5b357f47420b9556710ed75b6301（feat(editor): roam and resume during presentations）。

- 演示工具直接响应左键拖动；保留原有滚轮/触控板行为，Ctrl+滚轮缩放已实际验证。
- 漫游保持当前 Frame 索引，暂时隐藏遮罩，取消进行中的过渡；不进入内容编辑工具。
- Resume 按钮在漫游后可用，平滑回到当前 Frame。空演示禁用该按钮。
- 漫游中按 Next/Previous 仍沿当前索引继续。既有中键/空格临时拖动的恢复标记也能启用 Resume。
- 普通模式、只读模式下的拖动和返回均通过浏览器测试。

修改文件：present-tool.ts、presentation-toolbar.ts、navigator-bg-widget.ts，以及 presentation.spec.ts；均为上述 V0.2 路径。

## 验证记录

使用仓库自带 Yarn 4.18.0，通过 Node 24.19.0 执行；Windows、Playwright Chromium Headless Shell。

| 阶段 | 检查                                      | 结果                                   |
| ---- | ----------------------------------------- | -------------------------------------- |
| V0.2 | yarn typecheck                            | 退出码 0                               |
| V0.2 | yarn lint；修复后变更文件 oxlint 与 oxfmt | 退出码 0                               |
| V0.2 | 完整 presentation.spec.ts                 | 15 passed，退出码 0                    |
| V0.2 | 原便签回归重复运行                        | 连续 3 passed                          |
| V0.3 | yarn typecheck                            | 退出码 0                               |
| V0.3 | 完整 presentation.spec.ts                 | 18 passed，退出码 0                    |
| V0.3 | yarn lint；变更文件 oxlint 与 oxfmt       | 退出码 0，全仓格式检查覆盖 7457 个文件 |

测试命令：`yarn workspace @affine-test/blocksuite test edgeless/presentation.spec.ts --workers=1 --timeout=60000`。

## 使用方法

进入 Edgeless 演示后，在序号/标题下拉框选择 Frame。Previous/Next 保留；在画布上按住左键拖动，或沿用滚轮/触控板操作。需要回到当前演示位置时点击 Resume。

## 剩余范围与限制

- 未增加多 Storyline、Presenter Notes、隐藏/跳过 Frame 或多个持久化路径；这些仍是后续需求。
- 尚未在官方要求的 Node 22 环境、Electron 桌面包、Safari/Firefox 或真实触控板上验证。本次浏览器测试使用 Node 24；不能等同于官方 Node 22 CI 通过。
- 长距离/大规模画布的性能、极窄窗口布局及协作删除/重排的全面验收仍需补充。此次验证的是具体列出的浏览器场景。
- 既有中键/空格路径对黑色背景偏好的处理没有重构；新左键和滚轮漫游不写入该偏好。
- 本地源码来自官方 codeload，GitHub 提交通过 Git Data API 接续原历史；本地目录并非完整 Git clone。

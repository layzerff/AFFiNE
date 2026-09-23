# AFFiNE Spatial Presentation 开发需求

日期：2026-09-22。状态：V0.1 已实现并提交，12 项演示测试通过；V0.2/V0.3 待实施。详见实施与验证记录。

## 目标与边界

增强 Edgeless Presentation，使用户既可按既定顺序演示，也可随时选择任意 Frame，并在后续阶段以平滑平移、缩放保持画布空间关系。保留旧文档兼容性、Previous/Next、全屏和现有演示设置。

第一阶段只做 V0.1 Frame Navigator。各阶段独立 commit，只有验证通过才将阶段标为完成。不自动向上游创建 PR，不代用户签署 CLA。

## 上游基线

- 仓库：https://github.com/toeverything/AFFiNE
- 最新已读取贡献说明：https://github.com/toeverything/AFFiNE/blob/canary/docs/CONTRIBUTING.md
- 贡献分支：canary；功能分支：feature/spatial-presentation。
- 官方要求：yarn lint、yarn typecheck、相关测试；PR 标题遵循 Conventional Commits。上游合并前需要贡献者签署 CLA。
- 已读取 package.json：Node >=22.12.0 且 <23.0.0，Yarn 4.18.0。当前可用 Node 为 24.19.0，需要配置匹配版本。
- 克隆完成后记录实际基线 commit SHA，再次检查仓库及子目录开发规则，不以浮动分支名代替可复现基线。

## V0.1：Frame Navigator

### 行为

1. 演示工具栏提供清晰可发现的 Frame 列表入口，窄窗口与全屏也可使用。
2. 列表按现有演示顺序展示序号及标题，标识当前 Frame；长列表可滚动，长标题截断且可查看完整文本。
3. 点击任意 Frame 后立即定位该 Frame，同时更新当前演示索引。随后 Previous/Next 从新位置继续。
4. 通过唯一 Frame ID 解析最新目标，避免协作删除或重排后跳错；无标题使用可读占位标题。
5. 支持键盘访问和可见焦点。列表内部交互不能冒泡为画布编辑或翻页操作；关闭列表后焦点返回入口。
6. 零 Frame 时显示明确空状态且不可执行无效跳转；单 Frame、首尾边界保持现有行为。
7. 当前 Frame 再次选中时可重新定位，兼容用户已暂时偏离当前视角的情况。

### 实现约束

- 复用 EdgelessFrameManager.frames 的排序结果，不按画布 x/y 坐标重新排序。
- 复用现有 viewport 定位、当前索引和 navigatorFrameChanged 通知链路。
- 优先复用现有菜单、弹层、图标及 Frame 列表组件；读取 Frame Order 菜单后再决定最小改动位置。
- 不增加数据库字段、文档属性、迁移或新的持久化顺序；不引入大型依赖。
- 保留现有标题点击回到当前 Frame、Previous/Next、全屏退出及只读模式逻辑。

### 验收

- 建立至少 5 个空间位置打乱、演示顺序明确的 Frame，从第 1 个跳到第 4 个，再 Previous 到第 3 个、Next 到第 4 个。
- 覆盖空列表、单 Frame、重复标题、长标题、至少 50 个 Frame、窄窗口和全屏。
- 覆盖鼠标、Tab/Enter、菜单关闭与焦点恢复，以及演示退出。
- 演示过程中重命名、删除或重排 Frame 后不发生越界或错误目标定位。
- 打开旧文档，验证顺序沿用原规则；导航操作不写入文档数据。

## V0.2：平滑 viewport transition

先检查 viewport 内建动画 API，优先复用。Previous/Next 与任意跳转都在同一画布上平移、缩放到目标；不使用截图切页。保留 fit/fill 计算。

需验证连续快速跳转时旧动画可取消且最终目标准确；全屏尺寸变化、退出演示、组件销毁和用户拖动不会遗留动画。尊重 prefers-reduced-motion，提供即时定位退路。初次进入演示及尺寸变化是否动画，以现有结构和视觉验证决定。

验收覆盖距离较远、尺度差较大、快速连续跳转、减少动态效果、fit/fill、低性能场景。动画不能改写 Frame 顺序或几何数据。

## V0.3：自由 roam 与 Resume

演示中允许拖动画布、滚轮或触控板缩放；保持演示界面，不误触内容编辑。手动 roam 只改变 viewport，不改变当前演示 Frame。

提供明确的 Return to Presentation / Resume 按钮，回到当前 Frame；从 roam 状态点击 Previous/Next 时按当前 Frame 的相邻项继续。目标被删除时使用可预测的有效邻项；无 Frame 时安全显示空状态。退出后恢复原有工具与只读模式行为。

需检查现有 PanTool 和 restoredAfterPan 的支持范围，避免重复建立状态机。测试指针、触控板、只读、动画中断、全屏与退出。

## 后续扩展（不纳入 V0.1）

多 Storyline、多个演示路径、Presenter Notes、隐藏/跳过 Frame。涉及持久化时单独设计数据模型、迁移与旧客户端兼容方案；本轮不预先添加字段。

## 已确认的源码线索

- blocksuite/affine/blocks/frame/src/edgeless-toolbar/presentation-toolbar.ts：当前索引、Previous/Next、热键、全屏、viewport 定位、Frame Order 入口。
- blocksuite/affine/blocks/frame/src/frame-manager.ts：frames 按 framePresentationComparator 排序；使用 presentationIndex，并兼容旧 index。
- blocksuite/affine/blocks/frame/src/present-tool.ts：PresentToolOption 已包含 mode 与 restoredAfterPan。
- 当前 _moveToCurrentFrame 调用 setViewportByBound(bound, [0, 0, 0, 0], false)。该调用关闭动画，但动画参数语义仍需读取 viewport 实现确认。
- 当前工具栏已有 Frame Order 按钮，不能在未阅读组件实现前断言现有列表完全不支持跳转。

## 提交与验证记录要求

建议提交：feat(editor): add presentation frame navigator；feat(editor): animate presentation viewport transitions；feat(editor): resume presentation after canvas roaming。

每阶段记录基线、commit SHA、变更文件、行为变化、实际执行命令、退出码、测试结果与未验证项。先跑相关测试及改动范围检查，再跑官方 lint/typecheck；依赖或网络失败标记为阻塞，不可记为通过。

验证应含交互测试：列表跳转更新索引并使 Previous/Next 正确衔接。V0.2/V0.3 需浏览器视觉及输入验证，单纯静态检查不足以验收。

## 当前进展与环境约束

用户已创建 fork：https://github.com/layzerff/AFFiNE 。功能分支 feature/spatial-presentation 已从 canary 建立，基线 d897bb3d84099e54a6b3c0bd5f4265f8aa87d190。

本地 Git clone 多次因 443 连接失败退出，已通过官方 codeload 下载源码，并通过 Git Data API 在上游原始历史上提交。Node 24 下全仓 lint、typecheck 和 12 项演示测试通过；Node 22 尚未复验，Electron 下载超时导致桌面打包环境未完成。

V0.1 实现采用原生 select 展示序号与标题，按 Frame ID 查找最新索引，复用已有定位链路。原生控件负责列表、焦点与键盘选择；原有标题入口仍用于重新定位当前 Frame。未额外实现缩略图、多路线或持久化字段。

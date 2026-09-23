# 上游 PR 描述草稿（尚未提交）

建议保持三个功能提交分别审阅；也可使用下述整体描述。目标分支为 toeverything/AFFiNE:canary。文档提交属于 fork 的开发记录，可不带入上游功能 PR。CLA 仍由贡献者本人处理。

## Title

feat(editor): support spatial navigation during presentations

## Problem and behavior

Presenters can now choose any frame from a keyboard-accessible picker and continue Previous/Next from that position. Frame navigation pans and zooms across the canvas instead of immediately cutting between views. Presenters can also drag or zoom the canvas, then use Resume to return to the current frame without changing the presentation order.

The existing presentation ordering and document schema are preserved. The picker and roaming behavior work in readonly presentations. Empty presentations disable navigation controls that need a target.

## Implementation

- Use the existing frame order and IDs for selection.
- Add a cancellable 300 ms camera transition, using existing viewport fit and final positioning calculations. Respect reduced-motion preferences. New navigation replaces an in-flight transition; user input, resize, tool deactivation and teardown cancel it.
- Temporarily hide the frame mask during animation or roaming and keep it aligned with the viewport.
- Track block views mounted between viewport refreshes so they can be hidden when they leave the viewport. This fixes a note-visibility regression exposed by camera animation.
- Keep roaming state transient in the presentation tool. No document fields, migrations, or new dependencies.

## Validation

- V0.1 presentation suite: 12 passed.
- V0.2 presentation suite: 15 passed; the exposed note-visibility regression passed three consecutive runs after the fix.
- V0.3 presentation suite: 18 passed, including editable/readonly dragging and Resume, wheel zoom and Resume, frame selection, reduced motion, rapid navigation, exit cancellation, and existing presentation behavior.
- Repository lint, formatting and typecheck passed for both new stages; post-fix changed-file checks also passed.

Validation ran on Windows with Node 24.19.0 and Chromium Headless Shell. Supported Node 22 CI remains necessary. Electron packaging, other browsers and large-canvas performance were not validated.

## Scope

Multiple storylines, presenter notes, skipping frames and persistent presentation paths remain follow-up work. This change does not submit or migrate new presentation data.

import { EdgelessCRUDIdentifier } from '@blocksuite/affine-block-surface';
import { DisposableGroup } from '@blocksuite/global/disposable';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import type { BlockComponent } from '@blocksuite/std';
import { generateKeyBetweenV2 } from '@blocksuite/std/gfx';
import { css, html, LitElement, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { EdgelessFrameManagerIdentifier } from '../frame-manager';

export class EdgelessFrameOrderMenu extends SignalWatcher(
  WithDisposable(LitElement)
) {
  static override styles = css`
    :host {
      position: relative;
    }
    .edgeless-frame-order-items-container {
      max-height: 281px;
      border-radius: 8px;
      padding: 8px;
      background: var(--affine-background-overlay-panel-color);
      box-shadow: var(--affine-menu-shadow);
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .edgeless-frame-order-items-container.embed {
      padding: 0;
      background: unset;
      box-shadow: unset;
      border-radius: 0;
    }

    .item {
      box-sizing: border-box;
      width: 256px;
      border-radius: 4px;
      padding: 4px;
      display: flex;
      gap: 4px;
      align-items: center;
      cursor: pointer;
      touch-action: none;
    }

    .draggable:hover {
      background-color: var(--affine-hover-color);
    }

    .item:hover .drag-indicator {
      opacity: 1;
    }

    .drag-indicator {
      cursor: grab;
      width: 4px;
      height: 12px;
      border-radius: 1px;
      opacity: 0.2;
      background: var(--affine-placeholder-color);
      margin-right: 2px;
    }

    .title {
      font-size: 14px;
      font-weight: 400;
      height: 22px;
      line-height: 22px;
      color: var(--affine-text-primary-color);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    input {
      width: 100%;
      min-width: 0;
      font: inherit;
      color: inherit;
      background: var(--affine-background-primary-color);
      border: 1px solid var(--affine-primary-color);
    }
    .item[aria-current='true'] {
      background: var(--affine-hover-color);
    }
    .item:focus-visible {
      outline: 2px solid var(--affine-primary-color);
    }
    .clone {
      visibility: hidden;
      position: absolute;
      z-index: 1;
      left: 8px;
      height: 30px;
      border: 1px solid var(--affine-border-color);
      box-shadow: var(--affine-menu-shadow);
      background-color: var(--affine-white);
      pointer-events: none;
    }

    .indicator-line {
      visibility: hidden;
      position: absolute;
      z-index: 1;
      left: 8px;
      background-color: var(--affine-primary-color);
      height: 1px;
      width: 90%;
    }
  `;

  get crud() {
    return this.edgeless.std.get(EdgelessCRUDIdentifier);
  }

  private get _frameMgr() {
    return this.edgeless.std.get(EdgelessFrameManagerIdentifier);
  }

  private get _frames() {
    return this._frameMgr.frames;
  }

  private _drag?: DisposableGroup;
  private _suppressClick = false;

  @state()
  private accessor _editingId: string | null = null;

  private _navigate(id: string) {
    this.dispatchEvent(
      new CustomEvent('frame-navigate', {
        detail: id,
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _rename(id: string) {
    if (this.edgeless.store.readonly) return;
    this._editingId = id;
    await this.updateComplete;
    const input = this.renderRoot.querySelector<HTMLInputElement>('input');
    input?.focus();
    input?.select();
  }

  private _finishRename(input: HTMLInputElement, save: boolean) {
    const frame = this._frames.find(frame => frame.id === this._editingId);
    this._editingId = null;
    const value = input.value.trim();
    if (
      !save ||
      !frame ||
      !value ||
      this.edgeless.store.readonly ||
      value === frame.props.title.toString()
    )
      return;
    this.edgeless.store.captureSync();
    this.edgeless.store.transact(() => {
      const title = frame.props.title.yText;
      title.delete(0, title.length);
      title.insert(0, value);
    });
    this.edgeless.store.captureSync();
  }

  private _bindEvent() {
    this._disposables.addFromEvent(this._container, 'wheel', e =>
      e.stopPropagation()
    );
    this._disposables.addFromEvent(this._container, 'pointerdown', e => {
      e.stopPropagation();
      this._suppressClick = false;
      if (e.button !== 0 || this.edgeless.store.readonly || this._editingId)
        return;
      const row = (e.target as HTMLElement).closest<HTMLElement>('.draggable');
      if (!row) return;
      e.preventDefault();
      row.focus();
      this._drag?.dispose();
      const drag = (this._drag = new DisposableGroup());
      const id = row.id;
      const rect = row.getBoundingClientRect();
      const startX = e.clientX,
        startY = e.clientY;
      let dragging = false;
      let beforeId: string | null | undefined;
      this._curIndex = this._frames.findIndex(frame => frame.id === id);
      const cleanup = () => {
        this._clone.style.visibility = 'hidden';
        this._indicatorLine.style.visibility = 'hidden';
        drag.dispose();
        this._drag = undefined;
      };
      drag.addFromEvent(this.ownerDocument, 'pointermove', move => {
        if (move.pointerId !== e.pointerId) return;
        if (
          !dragging &&
          Math.hypot(move.clientX - startX, move.clientY - startY) < 5
        )
          return;
        dragging = true;
        this._suppressClick = true;
        move.preventDefault();
        const container = this._container.getBoundingClientRect();
        const host = this.getBoundingClientRect();
        this._clone.style.visibility = 'visible';
        this._clone.style.left =
          move.clientX - host.left - (startX - rect.left) + 'px';
        this._clone.style.top =
          move.clientY - host.top - (startY - rect.top) + 'px';
        if (
          move.clientY < container.top ||
          move.clientY > container.bottom ||
          move.clientX < container.left ||
          move.clientX > container.right
        ) {
          beforeId = undefined;
          this._indicatorLine.style.visibility = 'hidden';
          return;
        }
        if (move.clientY < container.top + 24) this._container.scrollTop -= 12;
        if (move.clientY > container.bottom - 24)
          this._container.scrollTop += 12;
        const rows = [
          ...this._container.querySelectorAll<HTMLElement>('.draggable'),
        ];
        const next = rows.find(item => {
          const r = item.getBoundingClientRect();
          return move.clientY <= r.top + r.height / 2 + 1;
        });
        beforeId = next?.id ?? null;
        const top =
          next?.getBoundingClientRect().top ??
          rows.at(-1)!.getBoundingClientRect().bottom;
        this._indicatorLine.style.visibility = 'visible';
        this._indicatorLine.style.top = top - host.top - 2 + 'px';
      });
      drag.addFromEvent(this.ownerDocument, 'pointerup', up => {
        if (up.pointerId !== e.pointerId) return;
        cleanup();
        if (
          !dragging ||
          beforeId === undefined ||
          beforeId === id ||
          this.edgeless.store.readonly
        )
          return;
        const frames = this._frames;
        if (!frames.some(frame => frame.id === id)) return;
        const remaining = frames.filter(frame => frame.id !== id);
        const index =
          beforeId === null
            ? remaining.length
            : remaining.findIndex(frame => frame.id === beforeId);
        if (index < 0 || frames.findIndex(frame => frame.id === id) === index)
          return;
        this.edgeless.store.captureSync();
        this._frameMgr.refreshLegacyFrameOrder();
        this.crud.updateElement(id, {
          presentationIndex: generateKeyBetweenV2(
            remaining[index - 1]?.props.presentationIndex || null,
            remaining[index]?.props.presentationIndex || null
          ),
        });
        this.edgeless.store.captureSync();
        this.requestUpdate();
      });
      drag.addFromEvent(this.ownerDocument, 'pointercancel', cleanup);
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._drag?.dispose();
    this._disposables.dispose();
  }

  override firstUpdated() {
    this._bindEvent();
  }

  override render() {
    const frame = this._frames[this._curIndex];

    return html`
      <div
        class="edgeless-frame-order-items-container ${
          this.embed ? 'embed' : ''
        }"
        data-range-sync-exclude="true"
        @keydown=${(e: KeyboardEvent) => e.stopPropagation()}
        @click=${(e: MouseEvent) => e.stopPropagation()}
      >
        ${repeat(
          this._frames,
          frame => frame.id,
          (frame, index) => html`
            <div
              class="item draggable"
              id=${frame.id}
              index=${index}
              aria-current=${frame.id === this.activeFrameId ? 'true' : 'false'}
              role="button"
              tabindex="0"
              aria-label=${frame.props.title.toString() || 'Untitled frame'}
              @click=${() => {
                if (!this._suppressClick && !this._editingId)
                  this._navigate(frame.id);
              }}
              @contextmenu=${(event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                this._rename(frame.id).catch(console.error);
              }}
              @keydown=${(event: KeyboardEvent) => {
                if (this._editingId) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  this._navigate(frame.id);
                } else if (event.key === 'F2') {
                  event.preventDefault();
                  this._rename(frame.id).catch(console.error);
                }
              }}
            >
              <div class="drag-indicator"></div>
              ${
                this._editingId === frame.id
                  ? html` <input
                      aria-label="Frame name"
                      data-range-sync-exclude="true"
                      .value=${frame.props.title.toString()}
                      @click=${(event: MouseEvent) => event.stopPropagation()}
                      @blur=${(event: FocusEvent) => this._finishRename(event.target as HTMLInputElement, true)}
                      @keydown=${(event: KeyboardEvent) => {
                        event.stopPropagation();
                        if (event.isComposing) return;
                        if (event.key === 'Enter' || event.key === 'Escape') {
                          event.preventDefault();
                          this._finishRename(
                            event.target as HTMLInputElement,
                            event.key === 'Enter'
                          );
                        }
                      }}
                    />`
                  : html`<div class="title">
                      ${frame.props.title.toString() || 'Untitled frame'}
                    </div>`
              }
            </div>
          `
        )}
        <div class="indicator-line"></div>
        <div class="clone item">
          ${
            frame
              ? html`<div class="drag-indicator"></div>
                  <div class="index">${this._curIndex + 1}</div>
                  <div class="title">${frame.props.title.toString()}</div>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  @query('.clone')
  private accessor _clone!: HTMLDivElement;

  @query('.edgeless-frame-order-items-container')
  private accessor _container!: HTMLDivElement;

  @state()
  private accessor _curIndex = -1;

  @query('.indicator-line')
  private accessor _indicatorLine!: HTMLDivElement;

  @property({ attribute: false })
  accessor edgeless!: BlockComponent;

  @property({ attribute: false })
  accessor embed = false;

  @property({ attribute: false })
  accessor activeFrameId: string | null = null;
}


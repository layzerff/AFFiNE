import type { Bound } from '@blocksuite/global/gfx';
import { BaseTool } from '@blocksuite/std/gfx';
import { signal } from '@preact/signals-core';

import type { NavigatorMode } from './frame-manager';

export type PresentToolOption = {
  mode?: NavigatorMode;
  restoredAfterPan?: boolean;
};

export class PresentTool extends BaseTool<PresentToolOption> {
  static override toolName: string = 'frameNavigator';

  readonly transitioning$ = signal(false);

  private _animation: number | null = null;

  cancelTransition() {
    if (this._animation !== null) cancelAnimationFrame(this._animation);
    this._animation = null;
    this.transitioning$.value = false;
  }

  moveToFrame(bound: Bound, smooth: boolean) {
    this.cancelTransition();
    const viewport = this.gfx.viewport;
    if (
      !smooth ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      viewport.setViewportByBound(bound, [0, 0, 0, 0], false);
      return;
    }

    const start = {
      x: viewport.centerX,
      y: viewport.centerY,
      zoom: viewport.zoom,
    };
    const target = viewport.getFitToScreenData(
      bound,
      [0, 0, 0, 0],
      viewport.ZOOM_MAX,
      0
    );
    const started = performance.now();
    this.transitioning$.value = true;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 300);
      if (progress === 1) {
        // Use the existing fit calculation for the exact final viewport.
        viewport.setViewportByBound(bound, [0, 0, 0, 0], false);
        this._animation = null;
        this.transitioning$.value = false;
        return;
      }
      const eased = progress * progress * (3 - 2 * progress);
      viewport.setViewport(
        start.zoom * Math.pow(target.zoom / start.zoom, eased),
        [
          start.x + (target.centerX - start.x) * eased,
          start.y + (target.centerY - start.y) * eased,
        ]
      );
      this._animation = requestAnimationFrame(step);
    };
    this._animation = requestAnimationFrame(step);
  }

  override mounted() {
    this.disposable.add(
      this.std.event.add('wheel', () => {
        if (this.active) this.cancelTransition();
      })
    );
    this.disposable.add(
      this.gfx.viewport.resizeStarted.subscribe(() => this.cancelTransition())
    );
  }

  override pointerDown() {
    this.cancelTransition();
  }

  override deactivate() {
    this.cancelTransition();
  }

  override unmounted() {
    this.cancelTransition();
    this.disposable.dispose();
  }
}

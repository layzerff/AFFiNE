import type { Bound } from '@blocksuite/global/gfx';
import type { PointerEventState } from '@blocksuite/std';
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

  readonly roaming$ = signal(false);

  private _lastPoint: [number, number] | null = null;

  private _animation: number | null = null;

  cancelTransition() {
    if (this._animation !== null) cancelAnimationFrame(this._animation);
    this._animation = null;
    this.transitioning$.value = false;
  }

  moveToFrame(bound: Bound, smooth: boolean) {
    this.cancelTransition();
    this.roaming$.value = false;
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
    // Measure travel in viewport widths so large and small canvases feel alike.
    const distance = Math.hypot(
      target.centerX - start.x,
      target.centerY - start.y
    );
    const span = Math.max(
      1,
      Math.min(viewport.viewportBounds.w, viewport.viewportBounds.h)
    );
    const travel = distance / span;
    const zoomTravel = Math.abs(Math.log(target.zoom / start.zoom));
    const duration = Math.min(
      1000,
      360 + 180 * Math.log1p(travel) + 100 * zoomTravel
    );
    // A restrained pullback retains spatial context on long jumps.
    const pullback = Math.min(0.65, Math.max(0, travel - 0.75) * 0.18);
    const started = performance.now();
    this.transitioning$.value = true;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      if (progress === 1) {
        // Use the existing fit calculation for the exact final viewport.
        viewport.setViewportByBound(bound, [0, 0, 0, 0], false);
        this._animation = null;
        this.transitioning$.value = false;
        return;
      }
      const eased = progress ** 3 * (10 + progress * (-15 + 6 * progress));
      viewport.setViewport(
        Math.max(
          viewport.ZOOM_MIN,
          start.zoom *
            Math.pow(target.zoom / start.zoom, eased) *
            Math.exp(-pullback * Math.sin(Math.PI * eased) ** 2)
        ),
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
        if (this.active) {
          this.cancelTransition();
          this.roaming$.value = true;
        }
      })
    );
    this.disposable.add(
      this.gfx.viewport.resizeStarted.subscribe(() => this.cancelTransition())
    );
  }

  override pointerDown() {
    this.cancelTransition();
  }

  override activate(options: PresentToolOption) {
    this.roaming$.value = !!options.restoredAfterPan;
  }

  override dragStart(event: PointerEventState) {
    this.cancelTransition();
    this.roaming$.value = true;
    this._lastPoint = [event.x, event.y];
  }

  override dragMove(event: PointerEventState) {
    if (!this._lastPoint) return;
    const viewport = this.gfx.viewport;
    viewport.applyDeltaCenter(
      (this._lastPoint[0] - event.x) / viewport.zoom,
      (this._lastPoint[1] - event.y) / viewport.zoom
    );
    this._lastPoint = [event.x, event.y];
  }

  override dragEnd() {
    this._lastPoint = null;
  }

  override deactivate() {
    this.cancelTransition();
    this._lastPoint = null;
    this.roaming$.value = false;
  }

  override unmounted() {
    this.cancelTransition();
    this.disposable.dispose();
  }
}


import { expect } from '@playwright/test';

import {
  assertEdgelessTool,
  createFrame,
  createNote,
  createShapeElement,
  dragBetweenViewCoords,
  edgelessCommonSetup,
  enterPresentationMode,
  getSelectedBound,
  getViewportCenter,
  locatorPresentationToolbarButton,
  resizeElementByHandle,
  selectElementInEdgeless,
  selectNoteInEdgeless,
  setEdgelessTool,
  Shape,
  switchEditorMode,
  toggleEditorReadonly,
  toggleFramePanel,
} from '../utils/actions/edgeless.js';
import {
  copyByKeyboard,
  pasteByKeyboard,
  pressEscape,
  selectAllBlocksByKeyboard,
} from '../utils/actions/keyboard.js';
import {
  enterPlaygroundRoom,
  initEmptyEdgelessState,
  waitNextFrame,
} from '../utils/actions/misc.js';
import { test } from '../utils/playwright.js';

test.describe('presentation', () => {
  test('official frame list stays open with toolbar auto-hide', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [400, 300], [600, 500]);
    await enterPresentationMode(page);
    await waitNextFrame(page, 500);
    await page.locator('.navigator-setting-button').click();
    await page
      .locator('.item-container')
      .filter({ hasText: 'Hide toolbar' })
      .locator('toggle-switch')
      .click();
    await page.locator('.navigator-setting-button').click();
    await page.locator('.edgeless-frame-order-button').click();
    const items = page.locator('edgeless-frame-order-menu .item.draggable');
    await page.mouse.move(400, 300);
    await expect(items.first()).toBeVisible();
    await items.nth(1).click();
    await expect(page.locator('.edgeless-frame-navigator-count')).toHaveText(
      '2 / 2'
    );
    await items.first().click();
    await expect(page.locator('.edgeless-frame-navigator-count')).toHaveText(
      '1 / 2'
    );
    await expect(page.locator('.frame-picker')).toHaveCount(0);
  });

  test('right click renames without navigating and Escape cancels editing', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [400, 300], [600, 500]);
    await enterPresentationMode(page);
    await waitNextFrame(page, 600);
    const center = await getViewportCenter(page);
    await page.locator('.edgeless-frame-order-button').click();
    const items = page.locator('edgeless-frame-order-menu .item.draggable');
    await items.nth(1).click({ button: 'right' });
    const input = page.getByRole('textbox', { name: 'Frame name' });
    await expect(input).toBeFocused();
    await input.fill('方案验证');
    await input.press('ArrowLeft');
    await expect(page.locator('.edgeless-frame-navigator-count')).toHaveText(
      '1 / 2'
    );
    await input.press('Enter');
    await expect(items.nth(1)).toHaveText('方案验证');
    expect(await getViewportCenter(page)).toEqual(center);
    await items.nth(1).click({ button: 'right' });
    await input.fill('cancelled');
    await input.press('Escape');
    await expect(items.nth(1)).toHaveText('方案验证');
    await assertEdgelessTool(page, 'frameNavigator');
    await items.nth(1).click();
    await expect(page.locator('.edgeless-frame-navigator-title')).toHaveText(
      '方案验证'
    );
  });

  for (const readonly of [false, true]) {
    test(`drag and resume preserve the presentation path (readonly=${readonly})`, async ({
      page,
    }) => {
      await edgelessCommonSetup(page);
      await createFrame(page, [100, 100], [200, 200]);
      await createFrame(page, [400, 300], [600, 500]);
      if (readonly) await toggleEditorReadonly(page);
      await enterPresentationMode(page);
      await waitNextFrame(page, 500);
      const initial = await getViewportCenter(page);
      const count = page.locator('.edgeless-frame-navigator-count');
      const resume = page.getByRole('button', { name: 'Resume presentation' });
      const mask = page.locator('.edgeless-navigator-black-background');
      await expect(resume).toBeDisabled();
      await page.mouse.move(350, 350);
      await page.mouse.down();
      await page.mouse.move(500, 430, { steps: 5 });
      await page.mouse.up();
      await expect.poll(() => getViewportCenter(page)).not.toEqual(initial);
      await expect(count).toHaveText('1 / 2');
      await expect(mask).toBeHidden();
      await assertEdgelessTool(page, 'frameNavigator');
      await expect(resume).toBeEnabled();
      await resume.click();
      await expect.poll(() => getViewportCenter(page)).toEqual(initial);
      await expect(mask).toBeVisible();
      await expect(count).toHaveText('1 / 2');

      await page.mouse.move(350, 350);
      await page.mouse.down();
      await page.mouse.move(450, 400, { steps: 3 });
      await page.mouse.up();
      await locatorPresentationToolbarButton(page, 'next').click();
      await expect(count).toHaveText('2 / 2');
      await expect(resume).toBeDisabled();
    });
  }

  test('wheel zoom can be resumed without changing the frame', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [400, 400]);
    await enterPresentationMode(page);
    await waitNextFrame(page, 500);
    const getZoom = () =>
      page.evaluate(
        () => document.querySelector('affine-edgeless-root')!.gfx.viewport.zoom
      );
    const initialZoom = await getZoom();
    const initialCenter = await getViewportCenter(page);
    await page.mouse.move(400, 350);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, 200);
    await page.keyboard.up('Control');
    await expect.poll(getZoom).not.toBe(initialZoom);
    await expect(page.locator('.edgeless-frame-navigator-count')).toHaveText(
      '1 / 1'
    );
    await page.getByRole('button', { name: 'Resume presentation' }).click();
    await expect.poll(getZoom).toBe(initialZoom);
    await expect.poll(() => getViewportCenter(page)).toEqual(initialCenter);
  });

  test('frame transition visits intermediate viewports and honors reduced motion', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [400, 300], [600, 500]);
    await enterPresentationMode(page);
    await waitNextFrame(page, 500);

    const sampleJump = () =>
      page
        .locator('edgeless-frame-order-menu .item.draggable')
        .last()
        .evaluate(async element => {
          const root = document.querySelector('affine-edgeless-root')!;
          const viewport = root.gfx.viewport;
          const samples: number[][] = [];
          const subscription = viewport.viewportUpdated.subscribe(() => {
            samples.push([viewport.centerX, viewport.centerY, viewport.zoom]);
          });
          (element as HTMLElement).click();
          await new Promise(resolve => setTimeout(resolve, 1100));
          subscription.unsubscribe();
          return samples;
        });
    await page.locator('.edgeless-frame-order-button').click();

    const animated = await sampleJump();
    expect(
      new Set(animated.map(sample => JSON.stringify(sample))).size
    ).toBeGreaterThan(2);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page
      .locator('edgeless-frame-order-menu .item.draggable')
      .first()
      .click();
    const instant = await sampleJump();
    expect(new Set(instant.map(sample => JSON.stringify(sample))).size).toBe(1);
  });

  test('exiting presentation cancels an in-flight transition', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [400, 300], [600, 500]);
    await enterPresentationMode(page);
    await waitNextFrame(page, 500);
    await locatorPresentationToolbarButton(page, 'next').click();
    await pressEscape(page);
    await assertEdgelessTool(page, 'default');
    await waitNextFrame(page, 500);
    const center = await getViewportCenter(page);
    await waitNextFrame(page, 350);
    expect(await getViewportCenter(page)).toEqual(center);
  });

  test('rapid frame selections finish at the latest target', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [300, 100], [400, 200]);
    await createFrame(page, [500, 300], [700, 500]);
    await enterPresentationMode(page);
    await waitNextFrame(page, 500);
    await page.locator('.edgeless-frame-order-button').click();
    const picker = page.locator('edgeless-frame-order-menu .item.draggable');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await picker.filter({ hasText: 'Frame 3' }).click();
    const expected = await getViewportCenter(page);
    await picker.filter({ hasText: 'Frame 1' }).click();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await picker.filter({ hasText: 'Frame 2' }).click();
    await picker.filter({ hasText: 'Frame 3' }).click();
    await expect.poll(() => getViewportCenter(page)).toEqual(expected);
    await waitNextFrame(page, 350);
    expect(await getViewportCenter(page)).toEqual(expected);
  });

  test('official frame list is disabled for an empty presentation', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await enterPresentationMode(page);
    await page.locator('.edgeless-frame-order-button').click();
    const picker = page.locator('edgeless-frame-order-menu .item.draggable');
    await expect(picker).toHaveCount(0);
    await locatorPresentationToolbarButton(page, 'next').click();
    await locatorPresentationToolbarButton(page, 'previous').click();
    await expect(page.locator('.edgeless-frame-navigator-count')).toHaveText(
      '0 / 0'
    );
  });

  test('official frame list works in a readonly presentation', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [300, 100], [400, 200]);
    await toggleEditorReadonly(page);
    await enterPresentationMode(page);
    await page.locator('.edgeless-frame-order-button').click();
    const picker = page.locator('edgeless-frame-order-menu .item.draggable');
    await expect(picker.first()).toBeVisible();
    await picker.last().click({ button: 'right' });
    await expect(page.getByRole('textbox', { name: 'Frame name' })).toHaveCount(
      0
    );
    await picker.filter({ hasText: 'Frame 2' }).click();
    await expect(page.locator('.edgeless-frame-navigator-count')).toHaveText(
      '2 / 2'
    );
    await assertEdgelessTool(page, 'frameNavigator');
  });

  test('official frame list jumps and continues from the selected frame', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    // Deliberately create frames in a different order from their x positions.
    await createFrame(page, [400, 100], [500, 200]);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [250, 100], [350, 200]);
    await enterPresentationMode(page);

    await page.locator('.edgeless-frame-order-button').click();
    const picker = page.locator('edgeless-frame-order-menu .item.draggable');
    const title = page.locator('.edgeless-frame-navigator-title');
    const next = locatorPresentationToolbarButton(page, 'next');
    const previous = locatorPresentationToolbarButton(page, 'previous');
    await expect(title).toHaveText('Frame 1');
    await title.click();
    await page.locator('.edgeless-frame-order-button').click();
    const initialCenter = await getViewportCenter(page);
    await expect(picker).toHaveText(['Frame 1', 'Frame 2', 'Frame 3']);

    await picker.filter({ hasText: 'Frame 3' }).click();
    await expect(title).toHaveText('Frame 3');
    await expect.poll(() => getViewportCenter(page)).not.toEqual(initialCenter);
    await previous.click();
    await expect(title).toHaveText('Frame 2');
    await next.click();
    await expect(title).toHaveText('Frame 3');
    await page.locator('.edgeless-frame-order-button').click();
    await picker.filter({ hasText: 'Frame 1' }).click();
    await expect(title).toHaveText('Frame 1');
    await expect.poll(() => getViewportCenter(page)).toEqual(initialCenter);
  });

  test('official list supports keyboard activation in a compact toolbar', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [300, 100], [400, 200]);
    await page.setViewportSize({ width: 540, height: 900 });
    await enterPresentationMode(page);
    await waitNextFrame(page, 600);
    await page.locator('.edgeless-frame-order-button').click();
    const item = page
      .locator('edgeless-frame-order-menu .item.draggable')
      .last();
    await item.focus();
    await item.press('Enter');
    await expect(page.locator('.edgeless-frame-navigator-count')).toHaveText(
      '2 / 2'
    );
    await assertEdgelessTool(page, 'frameNavigator');
  });

  test('should render note when enter presentation mode', async ({ page }) => {
    await edgelessCommonSetup(page);
    await createShapeElement(page, [100, 100], [200, 200], Shape.Square);
    await createNote(page, [300, 100], 'hello');

    // Frame shape
    await setEdgelessTool(page, 'frame');
    await dragBetweenViewCoords(page, [80, 80], [220, 220]);
    await waitNextFrame(page, 100);

    // Frame note
    await setEdgelessTool(page, 'frame');
    await dragBetweenViewCoords(page, [240, 0], [800, 200]);

    expect(await page.locator('affine-frame').count()).toBe(2);

    await enterPresentationMode(page);
    await waitNextFrame(page, 100);

    const nextButton = locatorPresentationToolbarButton(page, 'next');
    await nextButton.click();
    const edgelessNote = page.locator('affine-edgeless-note');
    await expect(edgelessNote).toBeVisible();

    const prevButton = locatorPresentationToolbarButton(page, 'previous');
    await prevButton.click();
    await expect(edgelessNote).toBeHidden();

    await waitNextFrame(page, 300);
    await nextButton.click();
    await expect(edgelessNote).toBeVisible();
  });

  test('should exit presentation mode when press escape', async ({ page }) => {
    await edgelessCommonSetup(page);
    await createNote(page, [300, 100], 'hello');

    // Frame note
    await setEdgelessTool(page, 'frame');
    await dragBetweenViewCoords(page, [240, 0], [800, 200]);

    expect(await page.locator('affine-frame').count()).toBe(1);

    await enterPresentationMode(page);
    await waitNextFrame(page, 300);

    await assertEdgelessTool(page, 'frameNavigator');
    const navigatorBlackBackground = page.locator(
      '.edgeless-navigator-black-background'
    );
    await expect(navigatorBlackBackground).toBeVisible();

    await pressEscape(page);
    await waitNextFrame(page, 100);

    await assertEdgelessTool(page, 'default');
    await expect(navigatorBlackBackground).toBeHidden();
  });

  test('should be able to adjust order of presentation in toolbar', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);

    await createFrame(page, [100, 100], [100, 200]);
    await createFrame(page, [200, 100], [300, 200]);
    await createFrame(page, [300, 100], [400, 200]);
    await createFrame(page, [400, 100], [500, 200]);

    await enterPresentationMode(page);

    await page.locator('.edgeless-frame-order-button').click();
    const frameItems = page.locator(
      'edgeless-frame-order-menu .item.draggable'
    );
    const dragIndicators = page.locator(
      'edgeless-frame-order-menu .drag-indicator'
    );

    await expect(frameItems).toHaveCount(4);
    await expect(frameItems.nth(0)).toHaveText('Frame 1');
    await expect(frameItems.nth(1)).toHaveText('Frame 2');
    await expect(frameItems.nth(2)).toHaveText('Frame 3');
    await expect(frameItems.nth(3)).toHaveText('Frame 4');

    await waitNextFrame(page, 600);
    // 1 2 3 4
    await frameItems.nth(2).dragTo(dragIndicators.nth(0));
    // 3 1 2 4
    await frameItems.nth(3).dragTo(dragIndicators.nth(2));
    // 3 1 4 2
    await frameItems.nth(1).dragTo(dragIndicators.nth(3));
    // 3 4 1 2

    await expect(frameItems).toHaveCount(4);
    await expect(frameItems.nth(0)).toHaveText('Frame 3');
    await expect(frameItems.nth(1)).toHaveText('Frame 4');
    await expect(frameItems.nth(2)).toHaveText('Frame 1');
    await expect(frameItems.nth(3)).toHaveText('Frame 2');

    const currentFrame = page.locator('.edgeless-frame-navigator-title');
    const nextButton = locatorPresentationToolbarButton(page, 'next');

    await expect(currentFrame).toHaveText('Frame 1');
    expect(await getViewportCenter(page)).toEqual(beforeDrag);
    await frameItems.first().click();
    await expect(currentFrame).toHaveText('Frame 3');
    await nextButton.click();
    await expect(currentFrame).toHaveText('Frame 4');
    await nextButton.click();
    await expect(currentFrame).toHaveText('Frame 1');
    await nextButton.click();
    await expect(currentFrame).toHaveText('Frame 2');
  });

  test('should be able to adjust order of presentation in frame panel', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);

    await createFrame(page, [100, 100], [200, 200]);
    await createFrame(page, [200, 100], [300, 200]);
    await createFrame(page, [300, 100], [400, 200]);
    await createFrame(page, [400, 100], [500, 200]);

    // await enterPresentationMode(page);

    await toggleFramePanel(page);

    // await page.locator('.edgeless-frame-order-button').click();
    const frameCards = page.locator('affine-frame-card .frame-card-body');
    const frameTitles = page.locator('affine-frame-card-title .card-title');

    await expect(frameTitles).toHaveCount(4);
    await expect(frameTitles.nth(0)).toHaveText('Frame 1');
    await expect(frameTitles.nth(1)).toHaveText('Frame 2');
    await expect(frameTitles.nth(2)).toHaveText('Frame 3');
    await expect(frameTitles.nth(3)).toHaveText('Frame 4');

    const drag = async (from: number, to: number) => {
      const startBBox = await frameCards.nth(from).boundingBox();
      expect(startBBox).not.toBeNull();
      if (startBBox === null) return;

      const endBBox = await frameTitles.nth(to).boundingBox();
      expect(endBBox).not.toBeNull();
      if (endBBox === null) return;

      await page.mouse.move(
        startBBox.x + startBBox.width / 2,
        startBBox.y + startBBox.height / 2
      );
      await page.mouse.down();
      await page.mouse.move(endBBox.x + endBBox.width / 2, endBBox.y, {
        steps: 2,
      });
      await page.mouse.up();
    };

    await waitNextFrame(page, 600);
    // 1 2 3 4
    await drag(2, 0);
    // 3 1 2 4
    await drag(3, 2);
    // 3 1 4 2
    await drag(1, 3);
    // 3 4 1 2

    await expect(frameTitles).toHaveCount(4);
    await expect(frameTitles.nth(0)).toHaveText('Frame 3');
    await expect(frameTitles.nth(1)).toHaveText('Frame 4');
    await expect(frameTitles.nth(2)).toHaveText('Frame 1');
    await expect(frameTitles.nth(3)).toHaveText('Frame 2');

    await enterPresentationMode(page);
    await page.locator('.edgeless-frame-order-button').click();
    const frameItems = page.locator(
      'edgeless-frame-order-menu .item.draggable'
    );

    await expect(frameItems).toHaveCount(4);
    await expect(frameItems.nth(0)).toHaveText('Frame 3');
    await expect(frameItems.nth(1)).toHaveText('Frame 4');
    await expect(frameItems.nth(2)).toHaveText('Frame 1');
    await expect(frameItems.nth(3)).toHaveText('Frame 2');

    const currentFrame = page.locator('.edgeless-frame-navigator-title');
    const nextButton = locatorPresentationToolbarButton(page, 'next');

    await expect(currentFrame).toHaveText('Frame 3');
    await nextButton.click();
    await expect(currentFrame).toHaveText('Frame 4');
    await nextButton.click();
    await expect(currentFrame).toHaveText('Frame 1');
    await nextButton.click();
    await expect(currentFrame).toHaveText('Frame 2');
  });

  test('duplicate frames should keep the presentation orders', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);

    await createFrame(page, [100, 100], [100, 200]);
    await createFrame(page, [200, 100], [300, 200]);
    await createFrame(page, [300, 100], [400, 200]);
    await createFrame(page, [400, 100], [500, 200]);

    await selectAllBlocksByKeyboard(page);
    await copyByKeyboard(page);
    await pasteByKeyboard(page);

    await enterPresentationMode(page);
    await page.locator('.edgeless-frame-order-button').click();
    const frameItems = page.locator(
      'edgeless-frame-order-menu .item.draggable'
    );

    await expect(frameItems).toHaveCount(8);
    await expect(frameItems.nth(0)).toHaveText('Frame 1');
    await expect(frameItems.nth(1)).toHaveText('Frame 2');
    await expect(frameItems.nth(2)).toHaveText('Frame 3');
    await expect(frameItems.nth(3)).toHaveText('Frame 4');
    await expect(frameItems.nth(4)).toHaveText('Frame 1');
    await expect(frameItems.nth(5)).toHaveText('Frame 2');
    await expect(frameItems.nth(6)).toHaveText('Frame 3');
    await expect(frameItems.nth(7)).toHaveText('Frame 4');
  });

  test('note should hide the collapse button when enter presentation mode', async ({
    page,
  }) => {
    await enterPlaygroundRoom(page);
    const { noteId } = await initEmptyEdgelessState(page);
    await switchEditorMode(page);

    await selectNoteInEdgeless(page, noteId);
    await resizeElementByHandle(page, { x: 0, y: 70 }, 'bottom-right');

    await createFrame(page, [100, 100], [100, 200]);

    await enterPresentationMode(page);

    const collapseButton = page.getByTestId('edgeless-note-collapse-button');
    await expect(collapseButton).not.toBeVisible();
  });

  test('note should be visible when enter presentation mode', async ({
    page,
  }) => {
    await enterPlaygroundRoom(page);
    const { noteId } = await initEmptyEdgelessState(page);
    await switchEditorMode(page);

    await selectNoteInEdgeless(page, noteId);
    const noteBound = await getSelectedBound(page);
    await pressEscape(page, 3);

    const frame1 = await createFrame(
      page,
      [noteBound[0] - 10, noteBound[1] - 10],
      [noteBound[0] + noteBound[2] + 10, noteBound[1] + noteBound[3] + 10]
    );
    await selectElementInEdgeless(page, [frame1]);
    const frame1Bound = await getSelectedBound(page);
    await pressEscape(page);

    await createFrame(
      page,
      [frame1Bound[0] + frame1Bound[2] + 10, frame1Bound[1]],
      [frame1Bound[0] + 2 * frame1Bound[2], frame1Bound[1] + frame1Bound[3]]
    );

    await enterPresentationMode(page);
    const nextButton = locatorPresentationToolbarButton(page, 'next');
    const prevButton = locatorPresentationToolbarButton(page, 'previous');

    const note = page.locator('affine-edgeless-note');
    await expect(note).toBeVisible();

    await nextButton.click();
    await expect(note).toBeHidden();

    await prevButton.click();
    await expect(note).toBeVisible();
  });

  test('should disable black background when space+drag in presentation mode', async ({
    page,
  }) => {
    await edgelessCommonSetup(page);
    await createNote(page, [300, 100], 'hello');
    await setEdgelessTool(page, 'frame');
    await dragBetweenViewCoords(page, [240, 0], [800, 200]);

    expect(await page.locator('affine-frame').count()).toBe(1);
    await enterPresentationMode(page);
    await waitNextFrame(page, 300);

    await assertEdgelessTool(page, 'frameNavigator');

    // Verify black background is initially visible
    const navigatorBlackBackground = page.locator(
      '.edgeless-navigator-black-background'
    );
    await expect(navigatorBlackBackground).toBeVisible();

    // Press space and drag to trigger the black background disable logic
    await page.keyboard.down('Space');
    await dragBetweenViewCoords(page, [400, 300], [500, 400]);
    await page.keyboard.up('Space');

    await waitNextFrame(page, 100);
    await expect(navigatorBlackBackground).toBeHidden();
  });
});


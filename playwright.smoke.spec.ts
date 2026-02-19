import { expect, test } from '@playwright/test';

async function openGame(page: Parameters<typeof test>[0]['page']) {
  await page.goto('/');
  await expect(page.locator('.main-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.game')).toBeVisible();
  await expect(page.locator('.board')).toBeVisible();
}

test('menu + gameplay + pause + tutorial + profile flows work', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.main-menu')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'FREE BLOCK' })).toBeVisible();

  await page.getByRole('button', { name: 'How to Play' }).click();
  await expect(page.getByRole('heading', { name: 'How to Play' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Got it!' }).click();
  await expect(page.locator('.main-menu')).toBeVisible();

  await page.getByRole('button', { name: 'Profile' }).click();
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.main-menu')).toBeVisible();

  await openGame(page);

  const filledPieces = page.locator('.piece-preview:not(.piece-preview--empty)');
  await expect(filledPieces).toHaveCount(3);

  const pieceBox = await filledPieces.first().boundingBox();
  const boardBox = await page.locator('.board').boundingBox();
  expect(pieceBox).not.toBeNull();
  expect(boardBox).not.toBeNull();

  const sx = pieceBox!.x + pieceBox!.width / 2;
  const sy = pieceBox!.y + pieceBox!.height / 2;
  const targetX = boardBox!.x + boardBox!.width * 0.52;
  const targetY = boardBox!.y + boardBox!.height * 0.52;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('.piece-preview--empty')).toHaveCount(1);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('.pause-overlay')).toHaveCount(0);
});

test('touch drag uses upward finger offset', async ({ page }) => {
  await openGame(page);

  const piece = page.locator('.piece-preview:not(.piece-preview--empty)').first();
  const box = await piece.boundingBox();
  expect(box).not.toBeNull();

  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(page.locator('.drag-overlay')).toBeVisible();
  const mouseOverlayBox = await page.locator('.drag-overlay').boundingBox();
  expect(mouseOverlayBox).not.toBeNull();

  await page.mouse.up();

  await piece.dispatchEvent('pointerdown', {
    pointerType: 'touch',
    button: 0,
    clientX: x,
    clientY: y,
    bubbles: true,
  });

  await expect(page.locator('.drag-overlay')).toBeVisible();
  const touchOverlayBox = await page.locator('.drag-overlay').boundingBox();
  expect(touchOverlayBox).not.toBeNull();

  // FINGER_OFFSET is 40px; allow small variance.
  expect(touchOverlayBox!.y).toBeLessThan(mouseOverlayBox!.y - 30);
});

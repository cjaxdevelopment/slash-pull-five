import { test, expect } from '@playwright/test';

test('professions route searches mapped items, displays Forever character coverage and approves account links', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/profs');
  await expect(page.getByRole('heading', { name: 'TEST FIXTURES Professions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My characters' })).toHaveCount(0);
  const materials = page.getByRole('button', {
    name: 'Materials for Fixture shared recipe',
    exact: true,
  });
  await materials.hover();
  await expect(page.getByRole('tooltip')).toContainText('Fixture reagent');
  await expect(page.getByRole('tooltip')).toContainText('× 2');
  await materials.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const count = page.getByRole('button', {
    name: '2 crafters for Fixture shared recipe',
    exact: true,
  });
  await count.hover();
  await expect(page.getByRole('tooltip')).toContainText('FixtureAlt');
  await count.focus();
  await count.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Crafters for Fixture shared recipe', exact: true })
    .click({ position: { x: 6, y: 6 } });
  await expect(page.getByRole('dialog')).toContainText('2 crafters');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await count.click();
  await expect(page.getByRole('dialog')).toContainText('2 crafters');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'FixtureAlt Smith', exact: true })
    .click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Request refresh', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText('50 / 100');
  await page.getByRole('dialog').locator('.profs-tiers summary').click();
  const characterRecipe = page
    .getByRole('dialog')
    .getByRole('link', { name: 'Fixture shared recipe (Wowhead)', exact: true });
  await characterRecipe.hover();
  await expect(page.getByRole('tooltip')).toContainText('Fixture reagent');
  await expect(characterRecipe).toHaveAttribute('href', 'https://www.wowhead.com/forever/item=700');
  await characterRecipe.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Officer sign in', exact: true }).first().click();
  await page.getByLabel('Username', { exact: true }).fill('testlead');
  await page.getByLabel('Password', { exact: true }).fill('e2e-only-test-password');
  await page.getByRole('button', { name: 'Officer sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Professions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'TEST FIXTURES Professions' })).toBeVisible();
  await expect(page.locator('.profs-guild-name')).toHaveText('TEST FIXTURES');
  await expect(page.getByText('2 crafters', { exact: true })).toBeVisible();
  await expect(page.locator('.profs-data-status > div')).toBeHidden();
  await page.locator('.profs-data-status summary').click();
  await expect(page.locator('.profs-data-status')).toContainText('1 not fetched');
  await expect(page.locator('.profs-data-status')).toContainText('Automatic refresh every hour');
  await page.locator('.profs-data-status summary').click();
  await page.getByLabel('Recipe or crafted item', { exact: true }).fill('Fixture crafted potion');
  await expect(
    page.getByRole('button', { name: 'Crafters for Fixture shared recipe', exact: true }),
  ).toBeVisible();

  await page.screenshot({ path: '.local/qa-profs-fixtures-recipes-desktop.png', fullPage: true });
  await expect(
    page.getByRole('link', { name: 'View Fixture shared recipe on Wowhead', exact: true }),
  ).toHaveAttribute('href', 'https://www.wowhead.com/forever/item=700');
  await page.getByRole('button', { name: 'Fixture shared recipe', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('2 crafters');
  await expect(page.getByRole('dialog')).not.toContainText('Unknown coverage');
  await expect(page.getByRole('dialog')).not.toContainText('Not listed');
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Fixture crafted potion', exact: true }),
  ).toHaveAttribute('href', 'https://www.wowhead.com/forever/item=700');
  await expect(
    page.getByRole('button', { name: 'Fixture shared recipe', exact: true }),
  ).toHaveAttribute('data-wowhead', 'item=700&domain=forever');

  await expect(page.locator('.profs-item-icon').first()).toHaveAttribute(
    'src',
    /render.worldofwarcraft.com/,
  );
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await count.click();
  await expect(page.getByRole('dialog')).toContainText('2 crafters');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'FixtureAlt Smith', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('50 / 100');
  await page.getByRole('dialog').locator('summary').click();
  await expect(page.getByRole('dialog')).toContainText('Fixture shared recipe');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await page.getByRole('button', { name: 'FixtureUnfetched Smith', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Recipes are unknown');
  await expect(page.getByRole('dialog')).toContainText('Not fetched');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'My characters', exact: true }).click();
  await page
    .getByLabel('Character to link', { exact: true })
    .selectOption({ label: 'FixtureCrafter Smith' });
  await page.getByRole('button', { name: 'Request administrator approval', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
  await page.getByLabel('I have independently verified ownership', { exact: false }).check();
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByLabel('Main character', { exact: true }).locator('option')).toHaveCount(2);
  await page
    .getByLabel('Main character', { exact: true })
    .selectOption({ label: 'FixtureCrafter Smith' });
  await page.getByLabel('Preferred Discord contact', { exact: true }).fill('fixture-contact');
  await page.getByRole('button', { name: 'Save contact & main', exact: true }).click();
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await expect(page.getByText('testlead · Main', { exact: true })).toBeVisible();
  await expect(page.getByText('Discord: fixture-contact', { exact: true })).toBeVisible();
  await page.screenshot({ path: '.local/qa-profs-fixtures-desktop.png', fullPage: true });
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveCount(0);
  await expect(
    page.locator('.profs-character-card .wow-character-name').filter({ hasText: 'FixtureCrafter' }),
  ).toHaveCSS('color', 'rgb(63, 199, 235)');
  await expect(
    page.locator('.profs-character-card .wow-character-name').filter({ hasText: 'FixtureAlt' }),
  ).toHaveCSS('color', 'rgb(0, 112, 221)');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('link', { name: 'Professions', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'TEST FIXTURES Professions' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.local/qa-profs-fixtures-mobile-dark.png', fullPage: true });
  await page.getByRole('link', { name: 'Raid planner', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raid composition', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Professions', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'TEST FIXTURES Professions' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'My characters', exact: true })).toHaveCount(0);
  await expect(page.getByText('Discord: fixture-contact', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Characters', exact: true }).click();
  await expect(page.getByText('Discord: fixture-contact', { exact: true })).toHaveCount(0);
  const publicData = await (await page.request.get('/api/profs')).json();
  expect(publicData.characters.every((c: { discord: string | null }) => c.discord === null)).toBe(
    true,
  );
  expect(errors).toEqual([]);
});

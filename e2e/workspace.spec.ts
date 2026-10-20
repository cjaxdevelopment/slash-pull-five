import { test, expect } from '@playwright/test';
test('private accounts plan and share raid compositions', async ({ page, browser }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.locator('.signin-brand')).toContainText('Rewound');
  await expect(page).toHaveTitle(/Rewound/);
  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute(
    'autocomplete',
    'username',
  );
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
  await page.screenshot({ path: '.local/qa-signin-desktop.png', fullPage: true });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(16, 21, 30)');
  await page.screenshot({ path: '.local/qa-signin-dark.png', fullPage: true });
  await page.getByLabel('Username', { exact: true }).fill('testlead');
  await page.getByLabel('Password', { exact: true }).fill('e2e-only-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Raid composition', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roster', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'New composition', exact: true }).click();
  await page.getByLabel('Composition name').fill('Progression');
  await page.screenshot({ path: '.local/qa-modal-desktop.png' });
  await expect(page.getByLabel('Raid size').locator('option')).toHaveText([
    '10-man',
    '20-man',
    '40-man',
  ]);
  await page.getByLabel('Raid size').selectOption('10');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create composition', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  async function add(cls: string, spec: string, name: string, group: string) {
    await page.getByRole('button', { name: 'New character', exact: true }).click();
    await page.getByLabel('Class', { exact: true }).selectOption(cls);
    await page.getByLabel('Spec', { exact: true }).selectOption(spec);
    await page.getByLabel('Name (optional)').fill(name);
    await page.getByRole('button', { name: 'Add character', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Add ' + name + ' to composition', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Add to', { exact: true }).selectOption(group);
    await page
      .getByRole('button', { name: 'Add ' + name + ' to composition', exact: true })
      .click();
    await expect(page.getByLabel('Move ' + name, { exact: true })).toHaveValue(group);
    await expect(page.getByRole('button', { name: 'Edit ' + name, exact: true })).toBeVisible();
  }
  await add('druid', 'balance', 'Moon', '1');
  await add('druid', 'feral', 'Claw', '2');
  await add('shaman', 'enhancement', 'Wind', '1');
  await add('shaman', 'restoration', 'Grace', '2');
  await add('mage', 'frost', 'Frost', '2');
  const buff = (name: string) =>
    page.getByTestId('buff-row').filter({ has: page.getByRole('button', { name, exact: true }) });
  await expect(buff('Spell crit')).toHaveAttribute('data-status', 'covered');
  await expect(buff('Melee / ranged crit')).toHaveAttribute('data-status', 'covered');
  await expect(buff('Agility')).toHaveAttribute('data-status', 'covered');
  await expect(buff('Mana regeneration')).toHaveAttribute('data-status', 'covered');
  await page.getByRole('button', { name: 'Spell crit', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Moonkin Aura', exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(buff('Spell crit')).toHaveAttribute('data-status', 'covered');
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  const pool = page.getByRole('complementary', { name: 'Character pool', exact: true });
  const group1 = page.getByRole('region', { name: 'Group 1', exact: true });
  await expect(pool.getByTestId('pool-character')).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove Frost from composition', exact: true }).click();
  await expect(pool.getByRole('button', { name: 'Edit Frost', exact: true })).toBeVisible();
  await expect(buff('Intellect')).toHaveAttribute('data-status', 'missing');
  await page.getByLabel('Search character pool').fill('priest');
  await expect(pool.getByText('No matching characters.', { exact: true })).toBeVisible();
  await page.getByLabel('Search character pool').fill('mage');
  // Move across the card in steps so Chrome starts the native HTML5 drag.
  const sourceBox = await pool.getByTestId('pool-character').boundingBox();
  const targetBox = await group1.getByTestId('empty-slot').first().boundingBox();
  await page.mouse.move(sourceBox!.x + 10, sourceBox!.y + 20);
  await page.mouse.down();
  await page.mouse.move(targetBox!.x + 100, targetBox!.y + 20, { steps: 15 });
  await page.mouse.up();
  await expect(group1.getByLabel('Move Frost', { exact: true })).toHaveValue('1');
  await expect(pool.getByTestId('pool-character')).toHaveCount(0);
  await expect(buff('Intellect')).toHaveAttribute('data-status', 'covered');
  await group1
    .getByTestId('comp-character')
    .filter({ has: page.getByRole('button', { name: 'Edit Frost', exact: true }) })
    .dragTo(pool);
  await expect(pool.getByTestId('pool-character')).toHaveCount(1);
  await page.getByLabel('Add to', { exact: true }).selectOption('2');
  await pool.getByRole('button', { name: 'Add Frost to composition', exact: true }).click();
  await expect(page.getByLabel('Move Frost', { exact: true })).toHaveValue('2');
  await page.getByLabel('Search character pool').clear();
  await page.getByRole('button', { name: 'Edit Grace', exact: true }).click();
  await page.getByLabel('Flametongue Totem', { exact: false }).check();
  await page.getByRole('button', { name: 'Save character', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(buff('Extra melee attacks')).toHaveAttribute('data-status', 'conflict');
  await page.getByRole('button', { name: 'Edit Grace', exact: true }).click();
  await page.getByLabel('Flametongue Totem', { exact: false }).uncheck();
  await page.getByRole('button', { name: 'Save character', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(buff('Extra melee attacks')).toHaveAttribute('data-status', 'covered');
  await page.getByLabel('Move Grace', { exact: true }).selectOption('bench');
  await expect(buff('Mana regeneration')).toHaveAttribute('data-status', 'partial');
  await expect(buff('Agility')).toHaveAttribute('data-status', 'missing');
  await page.reload();
  await expect(page.getByLabel('Move Grace', { exact: true })).toHaveValue('bench');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: '.local/qa-planner-desktop.png', fullPage: true });
  const original = await page.getByLabel('Saved composition').inputValue();
  await page.getByRole('button', { name: 'New composition', exact: true }).click();
  await page.getByLabel('Composition name').fill('Second team');
  await page.getByLabel('Raid size').selectOption('10');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create composition', exact: true })
    .click();
  await expect(pool.getByTestId('pool-character')).toHaveCount(5);
  await pool.getByTestId('pool-character').filter({ hasText: 'Moon' }).dragTo(group1);
  await expect(group1.getByLabel('Move Moon', { exact: true })).toHaveValue('1');
  await pool
    .getByTestId('pool-character')
    .filter({ hasText: 'Claw' })
    .dragTo(page.getByRole('region', { name: 'Bench', exact: true }));
  await expect(page.getByLabel('Move Claw', { exact: true })).toHaveValue('bench');
  await page.screenshot({ path: '.local/qa-rewound-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: '.local/qa-rewound-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await page.getByLabel('Saved composition').selectOption(original);
  await expect(page.getByLabel('Move Claw', { exact: true })).toHaveValue('2');
  await expect(page.getByLabel('Move Grace', { exact: true })).toHaveValue('bench');
  await page.getByLabel('Raid actions', { exact: true }).click();
  await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
  await expect(page.getByLabel('Saved composition')).toHaveValue(/.+/);
  await expect(page.getByLabel('Saved composition').locator('option:checked')).toHaveText(
    'Progression (copy)',
  );
  await expect(page.getByLabel('Move Grace', { exact: true })).toHaveValue('bench');
  await expect(page.getByRole('link', { name: 'Officers', exact: true })).toHaveCount(0);
  const privatePlanUrl = page.url();
  for (const username of ['bru', 'ct', 'peko']) {
    const context = await browser.newContext();
    const friend = await context.newPage();
    friend.on('pageerror', (e) => errors.push(e.message));
    await friend.goto('/');
    await friend.getByLabel('Username', { exact: true }).fill(username.toUpperCase());
    await friend.getByLabel('Password', { exact: true }).fill('e2e-private-password');
    await friend.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(friend.getByText('No raids yet', { exact: true })).toBeVisible();
    await expect(friend.getByRole('link', { name: 'Officers', exact: true })).toHaveCount(0);
    await friend.getByRole('button', { name: 'New composition', exact: true }).click();
    await friend.getByLabel('Composition name').fill(username + ' team');
    await friend.getByLabel('Raid size').selectOption('20');
    await friend
      .getByRole('dialog')
      .getByRole('button', { name: 'Create composition', exact: true })
      .click();
    await expect(friend.getByRole('dialog')).not.toBeVisible();
    await friend.reload();
    await expect(friend.getByLabel('Saved composition').locator('option:checked')).toHaveText(
      username + ' team',
    );
    await friend.goto(privatePlanUrl);
    await expect(friend.getByText('Raid not found', { exact: true })).toBeVisible();
    await expect(friend.getByRole('button', { name: 'Edit Frost', exact: true })).toHaveCount(0);
    await context.close();
  }
  await page.getByLabel('Move Frost', { exact: true }).selectOption('1');
  await expect(page.getByLabel('Move Frost', { exact: true })).toHaveValue('1');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Remove Frost from composition', exact: true }).click();
  await expect(
    pool.getByRole('button', { name: 'Add Frost to composition', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: '.local/qa-rewound-mobile.png', fullPage: true });
  await page.getByLabel('Add to', { exact: true }).selectOption('1');
  await pool.getByRole('button', { name: 'Add Frost to composition', exact: true }).click();
  await expect(page.getByLabel('Move Frost', { exact: true })).toHaveValue('1');
  await page.screenshot({ path: '.local/qa-planner-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Edit Moon', exact: true }).click();
  await expect(page.getByLabel('Moonkin Aura', { exact: false })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel('Raid actions', { exact: true }).click();
  await page.getByRole('button', { name: 'Edit raid', exact: true }).click();
  await page.getByLabel('Raid size').selectOption('40');
  await page.getByLabel('Notes (optional)').fill('Progression lineup');
  await page.getByRole('button', { name: 'Save composition', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Group 8', exact: true })).toBeVisible();
  await page.locator('.raid-notes summary').click();
  await expect(page.getByText('Progression lineup', { exact: true })).toBeVisible();
  await page.locator('.raid-notes summary').click();
  await page.screenshot({ path: '.local/qa-rewound-40.png', fullPage: true });
  await page.getByLabel('Raid actions', { exact: true }).click();
  await page.getByRole('button', { name: 'Edit raid', exact: true }).click();
  await page.getByLabel('Raid size').selectOption('20');
  await page.getByRole('button', { name: 'Save composition', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Group 8', exact: true })).toHaveCount(0);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: '.local/qa-cards-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 960, height: 1440 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(960);
  await page.screenshot({ path: '.local/qa-cards-tablet.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.local/qa-rewound-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await page.screenshot({ path: '.local/qa-rewound-light.png', fullPage: true });
  // Build straight from the spec palette, then swap exact positions.
  await page.getByRole('button', { name: 'Dark mode', exact: true }).click();
  await page.getByRole('button', { name: 'New composition', exact: true }).click();
  await page.getByLabel('Composition name').fill('Planner tools');
  await page.getByLabel('Raid size').selectOption('10');
  await page.getByRole('button', { name: 'Create composition', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await pool.getByRole('button', { name: 'Specs', exact: true }).click();
  await pool.getByRole('button', { name: 'Warrior', exact: true }).click();
  const template = (name: string) => pool.getByTestId('spec-template').filter({ hasText: name });
  const character = (name: string) =>
    page.getByTestId('comp-character').filter({
      has: page.getByRole('button', { name: 'Edit ' + name, exact: true }),
    });
  const group2 = page.getByRole('region', { name: 'Group 2', exact: true });
  await template('Protection').dragTo(group1.getByTestId('empty-slot').first());
  await expect(character('Protection Warrior')).toHaveAttribute('data-slot', '1');
  await page.getByLabel('Add to', { exact: true }).selectOption('1');
  await pool.getByRole('button', { name: 'Add Protection Warrior', exact: true }).click();
  await expect(character('Protection Warrior 2')).toHaveAttribute('data-slot', '2');
  await pool.getByRole('button', { name: 'Shaman', exact: true }).click();
  await template('Restoration').dragTo(group2.getByTestId('empty-slot').first());
  await expect(character('Restoration Shaman')).toHaveAttribute('data-group', '2');
  await character('Protection Warrior').dragTo(character('Restoration Shaman'));
  await expect(character('Protection Warrior')).toHaveAttribute('data-group', '2');
  await expect(character('Restoration Shaman')).toHaveAttribute('data-group', '1');
  await expect(character('Restoration Shaman')).toHaveAttribute('data-slot', '1');
  const categories = page.getByRole('group', { name: 'Coverage categories' });
  await categories.getByRole('button', { name: /^Utility/ }).click();
  await expect(buff('Mana cooldown')).toHaveAttribute('data-status', 'covered');
  await categories.getByRole('button', { name: /^Debuffs/ }).click();
  await expect(buff('Major armor reduction')).toHaveAttribute('data-status', 'covered');

  // Pet choices change both party buffs and utility without allowing multiple pets.
  await pool.getByRole('button', { name: 'Warlock', exact: true }).click();
  await pool.getByRole('button', { name: 'Add Demonology Warlock', exact: true }).click();
  await expect(character('Demonology Warlock')).toBeVisible();
  await page.getByRole('button', { name: 'Edit Demonology Warlock', exact: true }).click();
  await page.getByLabel('Pet support', { exact: true }).selectOption('imp');
  await page.getByRole('button', { name: 'Save character', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await categories.getByRole('button', { name: /^Buffs/ }).click();
  await expect(buff('Stamina (Imp)')).toHaveAttribute('data-status', 'partial');
  await expect(group1.getByLabel('Stamina (Imp)', { exact: true })).toHaveText('Imp');
  await page.getByRole('button', { name: 'Edit Demonology Warlock', exact: true }).click();
  await page.getByLabel('Pet support', { exact: true }).selectOption('felhunter');
  await page
    .getByRole('group', { name: 'Character abilities' })
    .getByRole('button', { name: 'Debuffs', exact: true })
    .click();
  await page.getByLabel('Curse of Recklessness', { exact: false }).check();
  await expect(page.getByLabel('Curse of the Elements', { exact: false })).not.toBeChecked();
  await page.getByRole('button', { name: 'Save character', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(buff('Stamina (Imp)')).toHaveAttribute('data-status', 'missing');
  await categories.getByRole('button', { name: /^Debuffs/ }).click();
  await expect(buff('Magic damage vulnerability')).toHaveAttribute('data-status', 'missing');
  await categories.getByRole('button', { name: /^Utility/ }).click();
  await expect(buff('Interrupt')).toHaveAttribute('data-status', 'covered');
  await page.screenshot({ path: '.local/qa-planner-tools-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '.local/qa-planner-tools-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });

  // Share links work without cookies, sign-in, or private workspace requests.
  await page.getByLabel('Raid actions', { exact: true }).click();
  await page.getByRole('button', { name: 'Share link', exact: true }).click();
  const raidLink = await page.getByLabel('Raid link', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  const privateRequests: string[] = [];
  visitor.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) privateRequests.push(request.url());
  });
  visitor.on('pageerror', (e) => errors.push(e.message));
  await visitor.goto(raidLink);
  await expect(visitor.getByRole('heading', { name: 'Planner tools', exact: true })).toBeVisible();
  await expect(visitor.getByText('Read-only snapshot', { exact: true })).toBeVisible();
  await expect(visitor.getByRole('region', { name: 'Group 1', exact: true })).toContainText(
    'Restoration Shaman',
  );
  await expect(visitor.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await visitor
    .getByRole('group', { name: 'Coverage categories' })
    .getByRole('button', { name: /^Utility/ })
    .click();
  await expect(
    visitor
      .getByTestId('buff-row')
      .filter({ has: visitor.getByRole('button', { name: 'Interrupt', exact: true }) }),
  ).toHaveAttribute('data-status', 'covered');
  await visitor.screenshot({ path: '.local/qa-shared-raid.png', fullPage: true });
  await visitor.goto('/share#v1.invalid');
  await expect(visitor.getByRole('alert')).toContainText('This raid link is invalid');
  expect(privateRequests).toEqual([]);
  await visitorContext.close();

  // Remove an accidental template from the raid, then delete it from the pool.
  await pool.getByRole('button', { name: 'Warrior', exact: true }).click();
  await pool.getByRole('button', { name: 'Add Protection Warrior', exact: true }).click();
  await expect(character('Protection Warrior 3')).toBeVisible();
  await page
    .getByRole('button', { name: 'Remove Protection Warrior 3 from composition', exact: true })
    .click();
  await pool.getByRole('button', { name: 'Characters', exact: true }).click();
  await pool.getByRole('button', { name: 'Delete Protection Warrior 3', exact: true }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toContainText('all saved raids');
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    pool.getByRole('button', { name: 'Delete Protection Warrior 3', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await pool.getByRole('button', { name: 'Delete Protection Warrior 3', exact: true }).click();
  await page.screenshot({ path: '.local/qa-delete-character-mobile.png', fullPage: true });
  await confirmation.getByRole('button', { name: 'Delete character', exact: true }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(
    pool.getByRole('button', { name: 'Edit Protection Warrior 3', exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(pool).toBeVisible();
  await expect(
    pool.getByRole('button', { name: 'Edit Protection Warrior 3', exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

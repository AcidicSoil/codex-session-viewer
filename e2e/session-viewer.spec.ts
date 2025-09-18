import { expect, test } from '@playwright/test'
import { login } from './utils/login'
import { loadSessionFixture } from './utils/session'

const FIXTURE = 'session-basic.jsonl'

test.describe('Codex Session Viewer E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await login(page)
  })

  test('loads a session and filters the timeline', async ({ page }) => {
    await loadSessionFixture(page, FIXTURE)

    await expect(page.getByTestId('metadata-timestamp')).toContainText('2025-09-15T12:00:00.000Z')
    await expect(
      page.locator('pre').filter({ hasText: 'Open the timeline and review file changes.' }).first()
    ).toBeVisible()

    await page.getByLabel('Filter by event type').selectOption('FileChange')
    await expect(page.getByTestId('event-message')).toHaveCount(0)
    await expect(page.getByTestId('event-filechange')).toHaveCount(1)

    await page.getByLabel('Filter by event type').selectOption('All')
    await page.getByLabel('Search events').fill('modernized')
    await expect(page.getByTestId('event-localshellcall')).toHaveCount(1)
    await expect(page.getByTestId('event-filechange')).toHaveCount(1)
    await expect(page.getByTestId('filter-chip-search')).toContainText('search: modernized')

    await page.getByTestId('filters-reset').click()
    await expect(page.getByLabel('Search events')).toHaveValue('')
  })

  test('focuses apply_patch events and manages bookmarks', async ({ page }) => {
    await loadSessionFixture(page, FIXTURE)

    await page.getByLabel('Search events').fill('apply_patch')
    await expect(page.getByTestId('event-localshellcall').first()).toBeVisible()

    const bookmarkToggle = page.getByRole('button', { name: 'Add bookmark' }).first()
    await bookmarkToggle.click()
    await expect(page.getByRole('button', { name: 'Remove bookmark' })).toBeVisible()

    const bookmarksFilter = page.getByTestId('bookmark-filter-toggle')
    await expect(bookmarksFilter).toHaveAttribute('aria-pressed', 'false')
    await bookmarksFilter.click()
    await expect(bookmarksFilter).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('filter-chip-bm')).toBeVisible()

    await page.getByTestId('bookmarks-clear').click()
    await bookmarksFilter.click()
    await expect(bookmarksFilter).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByRole('button', { name: 'Add bookmark' })).toBeVisible()
  })
})

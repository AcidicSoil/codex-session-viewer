import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, type Page } from '@playwright/test'

/**
 * Loads a canned session by uploading the fixture via the file picker.
 */
export async function loadSessionFixture(page: Page, fixtureFile: string) {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const absolutePath = path.resolve(here, '..', 'fixtures', fixtureFile)
  const upload = page.locator('input[type="file"][accept=".jsonl,.txt"]')
  await upload.setInputFiles(absolutePath)
  const sessionIdCell = page.getByText('e2e-session-001', { exact: true }).first()
  await expect(sessionIdCell).toBeVisible()
}

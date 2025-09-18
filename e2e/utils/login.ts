import type { Page } from '@playwright/test'

/**
 * Centralized login helper to keep real authentication flows in one place.
 * The session viewer does not require auth today, so this is a no-op.
 */
export async function login(_page: Page): Promise<void> {
  // Intentionally empty until authentication is introduced.
}

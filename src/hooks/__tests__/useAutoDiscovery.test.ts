/* @vitest-environment jsdom */
import React from 'react'
import { describe, it, expect } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import useAutoDiscovery from '../../hooks/useAutoDiscovery'

function TestComp() {
  const { projectFiles, sessionAssets, isLoading, reload } = useAutoDiscovery()
  return React.createElement(
    'div',
    null,
    React.createElement('div', { id: 'loading' }, String(isLoading)),
    React.createElement('div', { id: 'filesCount' }, String(projectFiles.length)),
    React.createElement('div', { id: 'sessionsCount' }, String(sessionAssets.length)),
    React.createElement('button', { id: 'reload', onClick: () => reload() }, 'reload'),
  )
}

describe('useAutoDiscovery', () => {
  it('discovers project files and supports reload debounce', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => { root.render(React.createElement(TestComp)) })

    // Allow initial effect to run
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })

    const loadingEl = container.querySelector('#loading')!
    const filesEl = container.querySelector('#filesCount')!
    expect(loadingEl.textContent).toBe('false')
    expect(Number(filesEl.textContent || '0')).toBeGreaterThan(0)

    const reloadBtn = container.querySelector('#reload') as HTMLButtonElement
    await act(async () => { reloadBtn.click() })
    await act(async () => { await new Promise(r => setTimeout(r, 420)) })
    expect(loadingEl.textContent).toBe('false')

    root.unmount()
    document.body.removeChild(container)
  })
})


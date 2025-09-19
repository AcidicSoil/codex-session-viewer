/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import TwoFileDiff, { exportDiff } from '../TwoFileDiff'

const downloadTextMock = vi.fn()
const diff2HtmlMock = vi.fn(() => '<div class="d2h-wrapper"></div>')
const diffViewMock = vi.fn((props: any) => React.createElement('div', { 'data-testid': 'mock-diff-view' }))

vi.mock('../../utils/download', () => ({ downloadText: downloadTextMock }))

vi.mock('diff2html', () => ({
  html: diff2HtmlMock,
}))

vi.mock('@monaco-editor/react', () => ({
  DiffEditor: () => React.createElement('div', { 'data-testid': 'monaco-diff' }),
}))

vi.mock('../DiffView', () => ({
  __esModule: true,
  default: (props: any) => diffViewMock(props),
}))

vi.mock('react-resizable-panels', () => {
  const React = require('react') as typeof import('react')
  return {
    PanelGroup: ({ children, onLayout }: any) => {
      React.useEffect(() => {
        onLayout?.([70, 30])
      }, [onLayout])
      return React.createElement('div', { 'data-testid': 'panel-group' }, children)
    },
    Panel: ({ children, className }: any) => React.createElement('div', { className }, children),
    PanelResizeHandle: ({ children, ...props }: any) =>
      React.createElement('div', { role: 'separator', tabIndex: 0, ...props }, children),
  }
})

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver
}

class ResizeObserverMock {
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  ;(window as any).ResizeObserver = ResizeObserverMock
}

beforeEach(() => {
  downloadTextMock.mockClear()
  diff2HtmlMock.mockClear()
  diffViewMock.mockClear()
})

afterEach(() => {
  cleanup()
})

describe('TwoFileDiffViewer', () => {
  it('renders drop zone on the server', () => {
    const html = renderToString(React.createElement(TwoFileDiff))
    expect(html).toContain('Drop files or browse')
  })

  it('loads dropped files and exposes metadata', async () => {
    render(React.createElement(TwoFileDiff))
    const dropZone = await screen.findByTestId('twofile-drop')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['hello'], 'left.txt', { type: 'text/plain' }))
    transfer.items.add(new File(['world'], 'right.txt', { type: 'text/plain' }))

    fireEvent.drop(dropZone, { dataTransfer: transfer })

    await waitFor(() => {
      expect(screen.getByText(/left\.txt/i)).toBeInTheDocument()
      expect(screen.getByText(/right\.txt/i)).toBeInTheDocument()
      expect(screen.getByText(/Orientation/i).nextSibling?.textContent).toMatch(/Baseline → Proposed/i)
    })
  })

  it('swaps orientation when swap button is clicked', async () => {
    render(React.createElement(TwoFileDiff))
    const dropZone = await screen.findByTestId('twofile-drop')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['foo'], 'a.txt', { type: 'text/plain' }))
    transfer.items.add(new File(['bar'], 'b.txt', { type: 'text/plain' }))
    fireEvent.drop(dropZone, { dataTransfer: transfer })
    await screen.findByText(/a\.txt/i)
    const swap = await screen.findByRole('button', { name: /swap sides/i })
    fireEvent.click(swap)
    await waitFor(() => {
      expect(screen.getByText(/Orientation/i).nextSibling?.textContent).toMatch(/Proposed change → Baseline/i)
    })
  })

  it('exports unified diff via download helper', async () => {
    render(React.createElement(TwoFileDiff))
    const dropZone = await screen.findByTestId('twofile-drop')
    const transfer = new DataTransfer()
    transfer.items.add(new File(['foo'], 'a.ts', { type: 'text/plain' }))
    transfer.items.add(new File(['bar'], 'b.ts', { type: 'text/plain' }))
    fireEvent.drop(dropZone, { dataTransfer: transfer })
    await screen.findByText(/a\.ts/i)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Unified diff/i }))
    await waitFor(() => {
      expect(downloadTextMock).toHaveBeenCalled()
      const [filename, content] = downloadTextMock.mock.calls[0]!
      expect(filename).toMatch(/a-ts-vs-b-ts\.diff$/)
      expect(content).toContain('--- a.ts')
    })
  })

  it('dismisses the order notice', async () => {
    render(React.createElement(TwoFileDiff))
    const dismiss = await screen.findByRole('button', { name: /dismiss order notice/i })
    fireEvent.click(dismiss)
    await waitFor(() => {
      expect(screen.queryByText(/Order notice/)).not.toBeInTheDocument()
    })
  })

  it('toggle expand/minimize updates aria-pressed state', async () => {
    render(React.createElement(TwoFileDiff))
    const expand = await screen.findByRole('button', { name: /expand diff viewer height/i })
    fireEvent.click(expand)
    expect(expand).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(expand)
    expect(expand).toHaveAttribute('aria-pressed', 'false')

    const minimize = screen.getByRole('button', { name: /minimize diff viewer/i })
    fireEvent.click(minimize)
    expect(minimize).toHaveAttribute('aria-pressed', 'true')
  })

  it('sends baseline content to DiffView when baseline is on the left', () => {
    render(
      React.createElement(TwoFileDiff, {
        initialLeftFile: { name: 'left.txt', content: 'baseline content' },
        initialRightFile: { name: 'right.txt', content: 'proposed content' },
      })
    )
    const call = diffViewMock.mock.calls.at(-1)?.[0]
    expect(call?.original).toBe('baseline content')
    expect(call?.modified).toBe('proposed content')
  })

  it('sends baseline content to DiffView when baseline is on the right', () => {
    render(
      React.createElement(TwoFileDiff, {
        initialLeftFile: { name: 'left.txt', content: 'baseline content' },
        initialRightFile: { name: 'right.txt', content: 'proposed content' },
        leftToRight: false,
      })
    )
    const call = diffViewMock.mock.calls.at(-1)?.[0]
    expect(call?.original).toBe('proposed content')
    expect(call?.modified).toBe('baseline content')
  })

  it('exportDiff helper generates html diff', () => {
    const result = exportDiff({
      left: { name: 'one.txt', content: 'a' },
      right: { name: 'two.txt', content: 'b' },
      format: 'html',
      includeMetadata: true,
      theme: 'light',
    })
    expect(diff2HtmlMock).toHaveBeenCalledTimes(1)
    const [diffString, options] = diff2HtmlMock.mock.calls[0]!
    expect(diffString).toContain('@@')
    expect(options).toMatchObject({
      inputFormat: 'diff',
      outputFormat: 'side-by-side',
      drawFileList: false,
    })
    expect(result.extension).toBe('html')
    expect(result.content).toContain('<!doctype html>')
    expect(result.content).toContain('Diff metadata')
    expect(result.content).toContain('d2h-wrapper')
  })
})


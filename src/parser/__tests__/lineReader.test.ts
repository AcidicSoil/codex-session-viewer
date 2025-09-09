import { describe, it, expect } from 'vitest'
import { splitLinesTransform, streamTextLines } from '../../utils/lineReader'

function blobFrom(str: string) {
  return new Blob([str], { type: 'text/plain' })
}

describe('splitLinesTransform', () => {
  it('splits on \n and preserves order', async () => {
    const ts = splitLinesTransform()
    const r = new ReadableStream<string>({
      start(ctrl) {
        ctrl.enqueue('a\n b')
        ctrl.enqueue('c\n')
        ctrl.close()
      },
    })
    const out = r.pipeThrough(ts)
    const got: string[] = []
    for await (const s of out as any as AsyncIterable<string>) got.push(s)
    expect(got).toEqual(['a', ' bc'])
  })

  it('handles CRLF', async () => {
    const blob = blobFrom('one\r\ntwo\r\n')
    const got: string[] = []
    for await (const s of streamTextLines(blob)) got.push(s)
    expect(got).toEqual(['one', 'two'])
  })

  it('emits final partial line without trailing newline', async () => {
    const blob = blobFrom('last line without newline')
    const got: string[] = []
    for await (const s of streamTextLines(blob)) got.push(s)
    expect(got).toEqual(['last line without newline'])
  })
})

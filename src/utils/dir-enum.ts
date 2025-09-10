export async function enumerateFiles(
  root: FileSystemDirectoryHandle,
  predicate: (path: string, isFile: boolean) => boolean,
  base: string = ''
): Promise<string[]> {
  const results: string[] = []
  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    // @ts-ignore iterable entries
    for await (const [name, handle] of (dir as any).entries()) {
      const path = prefix ? `${prefix}/${name}` : name
      if (handle.kind === 'file') {
        if (predicate(path, true)) results.push(path)
      } else if (handle.kind === 'directory') {
        if (predicate(path, false)) results.push(path)
        await walk(handle, path)
      }
    }
  }
  await walk(root, base)
  return results
}

export interface FileEntryInfo {
  path: string
  size?: number
  mtime?: number
}

export async function enumerateFilesInfo(
  root: FileSystemDirectoryHandle,
  predicate: (path: string, isFile: boolean) => boolean,
  base: string = ''
): Promise<FileEntryInfo[]> {
  const results: FileEntryInfo[] = []
  async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
    // @ts-ignore iterable entries
    for await (const [name, handle] of (dir as any).entries()) {
      const path = prefix ? `${prefix}/${name}` : name
      if (handle.kind === 'file') {
        if (predicate(path, true)) {
          try {
            const f = await (handle as FileSystemFileHandle).getFile()
            results.push({ path, size: f.size, mtime: f.lastModified })
          } catch {
            results.push({ path })
          }
        }
      } else if (handle.kind === 'directory') {
        if (predicate(path, false)) {
          // usually we don't push directories; continue traversal
        }
        await walk(handle, path)
      }
    }
  }
  await walk(root, base)
  return results
}

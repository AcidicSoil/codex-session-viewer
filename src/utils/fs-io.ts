export async function readFileText(root: FileSystemDirectoryHandle, path: string): Promise<string> {
  const parts = path.split('/').filter(Boolean)
  let dir: any = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]!)
  }
  const fh = await dir.getFileHandle(parts[parts.length - 1]!)
  const file = await fh.getFile()
  return await file.text()
}


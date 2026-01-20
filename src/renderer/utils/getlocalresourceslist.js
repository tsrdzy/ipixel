export async function getFilesFromHandles() {
  const fileHandles = await window.showOpenFilePicker({ multiple: true })
  const filePromises = Array.from(fileHandles).map((handle) => handle.getFile())
  return await Promise.all(filePromises)
}
export async function getFolderFromHandles(currentPath = '') {
  const handle = await window.showDirectoryPicker()

  let fileList = [] // 创建一个空数组来存储所有文件对象

  // 遍历该目录下的所有项（文件和子目录）
  for await (const entry of handle.values()) {
    const name = entry.name
    const path = currentPath ? `${currentPath}/${name}` : name

    if (entry.kind === 'file') {
      // 如果是文件，获取其 File 对象
      const file = await entry.getFile()
      // 可选：为文件对象添加路径信息，方便后续使用
      file.relativePath = path
      fileList.push(file) // 将文件对象直接加入数组
    } else if (entry.kind === 'directory') {
      // 如果是目录，递归遍历，并将返回的文件数组合并到当前数组
      const subDirectoryFiles = await traverseDirectory(entry, path)
      fileList = fileList.concat(subDirectoryFiles)
    }
  }
  return fileList // 返回扁平的文件对象数组
}
async function traverseDirectory(handle, currentPath = '') {
  let fileList = [] // 创建一个空数组来存储所有文件对象

  // 遍历该目录下的所有项（文件和子目录）
  for await (const entry of handle.values()) {
    const name = entry.name
    const path = currentPath ? `${currentPath}/${name}` : name

    if (entry.kind === 'file') {
      // 如果是文件，获取其 File 对象
      const file = await entry.getFile()
      // 可选：为文件对象添加路径信息，方便后续使用
      file.relativePath = path
      fileList.push(file) // 将文件对象直接加入数组
    } else if (entry.kind === 'directory') {
      // 如果是目录，递归遍历，并将返回的文件数组合并到当前数组
      const subDirectoryFiles = await traverseDirectory(entry, path)
      fileList = fileList.concat(subDirectoryFiles)
    }
  }
  return fileList // 返回扁平的文件对象数组
}

export async function getFilesFromHandles(multiple = true, acceptTypes = []) {
  try {
    // 构建文件类型过滤配置
    const pickerOptions = {
      multiple: multiple // 控制是否多选
    }

    // 如果指定了文件类型，则配置类型过滤器
    if (acceptTypes.length > 0) {
      const typeMap = {
        image: {
          description: 'Images',
          accept: { 'image/*': ['.png', '.gif', '.jpeg', '.jpg', '.webp'] }
        },
        pdf: {
          description: 'PDF Documents',
          accept: { 'application/pdf': ['.pdf'] }
        },
        text: {
          description: 'Text Files',
          accept: { 'text/plain': ['.txt'] }
        }
        // 可根据需要继续添加其他类型
      }

      pickerOptions.types = acceptTypes.map((type) => typeMap[type.toLowerCase()]).filter(Boolean) // 过滤掉不存在的类型

      // 当指定了文件类型时，排除"所有文件"选项
      pickerOptions.excludeAcceptAllOption = true
    }

    const fileHandles = await window.showOpenFilePicker(pickerOptions)
    const filePromises = Array.from(fileHandles).map((handle) => handle.getFile())
    return await Promise.all(filePromises)
  } catch (error) {
    console.log({ error: error })
    // 可根据错误类型进行更精细的错误处理
    if (error.name === 'AbortError') {
      console.log('用户取消了文件选择')
    }
    return [] // 返回空数组而不是undefined，更易处理
  }
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

// 拖拽上传
export async function getFilesFromDrop(event) {
  const items = event.dataTransfer.items
  const filePromises = []

  // 为每个项目创建处理Promise
  for (const item of items) {
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry()
      if (entry) {
        filePromises.push(processEntry(entry))
      } else {
        // 备用方案：直接获取文件
        const file = item.getAsFile()
        if (file) {
          file.relativePath = file.name
          filePromises.push([file]) // 包装成数组以保持统一格式
        }
      }
    }
  }

  // 等待所有Promise完成
  const results = await Promise.all(filePromises)
  return results.flat()
}
async function processEntry(entry, path = '') {
  const files = []
  const currentPath = path ? `${path}/${entry.name}` : entry.name

  if (entry.isFile) {
    const file = await new Promise((resolve, reject) => {
      entry.file(resolve, reject)
    })
    file.relativePath = currentPath
    files.push(file)
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    let entries = []

    // 循环读取直到没有更多条目（每次最多返回100个[7](@ref)）
    const readEntries = async () => {
      const batch = await new Promise((resolve) => {
        reader.readEntries(resolve)
      })
      if (batch.length > 0) {
        entries = entries.concat(batch)
        await readEntries() // 继续读取直到空数组
      }
    }

    await readEntries()

    // 并行处理所有子条目
    const subFilePromises = entries.map((subEntry) => processEntry(subEntry, currentPath))
    const subFiles = await Promise.all(subFilePromises)
    files.push(...subFiles.flat())
  }

  return files
}

export default function getImageDimensions(file) {
  return new Promise((resolve) => {
    // 首先检查文件类型是否为图片
    if (!file || !file.type.startsWith('image/')) {
      resolve({ width: 0, height: 0 })
      return
    }

    // 创建Image对象来加载图片并获取宽高
    const img = new Image()
    const url = URL.createObjectURL(file) // 创建临时URL

    img.onload = function () {
      URL.revokeObjectURL(url) // 释放内存
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      })
    }

    img.onerror = function () {
      URL.revokeObjectURL(url)
      resolve({ width: 0, height: 0 }) // 加载失败时返回0
    }

    img.src = url // 开始加载图片
  })
}

/**
 * 精灵图分割函数
 * @param {string} base64Data - Base64格式的精灵图数据
 * @param {boolean} autoSplit - 是否自动分割
 * @param {Object} options - 分割参数配置
 * @param {string} fileName - 输出文件名模板
 * @param {string} format - 输出图片格式
 * @returns {Promise<File[]>} - 返回分割后的小图File对象数组
 */
export default async function splitSprite(
  base64Data,
  autoSplit,
  options = {},
  fileName = 'sprite',
  format = 'png'
) {
  return new Promise(async (resolve, reject) => {
    try {
      // 创建Image对象加载Base64数据
      const img = new Image()
      img.onload = async () => {
        try {
          // 创建画布进行处理
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)

          let spriteRects = []

          if (autoSplit) {
            // 自动分割模式
            const bgColor = options.bgcolor || 'transparent'
            spriteRects = await autoDetectSprites(ctx, canvas.width, canvas.height, bgColor)
          } else {
            // 手动分割模式
            spriteRects = manualDetectSprites(canvas.width, canvas.height, options)
          }

          // 过滤无用分割区域（完全透明或纯背景色）
          const bgColor = options.bgcolor || 'transparent'
          const tolerance = options.tolerance || 10
          spriteRects = filterUselessRects(spriteRects, ctx, bgColor, tolerance)
          
          console.log(`过滤后剩余有用区域: ${spriteRects.length}个`)
          
          // 根据检测到的区域裁剪图片并生成File对象
          const files = await cropSpritesToFiles(canvas, spriteRects, fileName, format)
          resolve(files)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = base64Data
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * 过滤无用分割区域（完全透明或纯背景色）
 * @param {Array} spriteRects - 检测到的精灵区域数组
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {string} bgColor - 背景颜色
 * @param {number} tolerance - 颜色容差
 * @returns {Array} - 过滤后的有用区域数组
 */
function filterUselessRects(spriteRects, ctx, bgColor = 'transparent', tolerance = 10) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height)
    const data = imageData.data
    const width = ctx.canvas.width
    
    // 将背景色转换为RGB格式
    const targetRGB = bgColor !== 'transparent' ? hexToRgb(bgColor) : null
    
    return spriteRects.filter(rect => {
        let transparentPixelCount = 0
        let bgColorPixelCount = 0
        let totalPixels = rect.width * rect.height
        
        // 如果区域太小，直接过滤掉
        if (rect.width < 2 || rect.height < 2) {
            return false
        }
        
        // 检查区域内的每个像素
        for (let y = rect.y; y < rect.y + rect.height; y++) {
            for (let x = rect.x; x < rect.x + rect.width; x++) {
                const index = (y * width + x) * 4
                const r = data[index]
                const g = data[index + 1]
                const b = data[index + 2]
                const a = data[index + 3]
                
                // 检查是否透明
                if (a === 0) {
                    transparentPixelCount++
                    continue
                }
                
                // 检查是否匹配背景色
                if (targetRGB && a > 0) {
                    const distance = colorDistance(r, g, b, targetRGB.r, targetRGB.g, targetRGB.b)
                    if (distance <= tolerance) {
                        bgColorPixelCount++
                    }
                }
            }
        }
        
        // 如果全部像素都是透明的，过滤掉
        if (transparentPixelCount === totalPixels) {
            console.log(`过滤完全透明区域: ${rect.x},${rect.y} ${rect.width}x${rect.height}`)
            return false
        }
        
        // 如果全部像素都是背景色，过滤掉
        if (bgColorPixelCount === totalPixels) {
            console.log(`过滤纯背景色区域: ${rect.x},${rect.y} ${rect.width}x${rect.height}`)
            return false
        }
        
        // 如果透明像素占比超过95%，也过滤掉（几乎是透明的）
        if (transparentPixelCount / totalPixels > 0.95) {
            console.log(`过滤近乎透明区域: ${rect.x},${rect.y} ${rect.width}x${rect.height}`)
            return false
        }
        
        return true
    })
}

/**
 * 将检测到的精灵区域裁剪为File对象
 * @param {HTMLCanvasElement} sourceCanvas - 源画布
 * @param {Array} spriteRects - 精灵区域数组
 * @param {string} fileName - 文件名模板
 * @param {string} format - 图片格式
 * @returns {Promise<File[]>} - File对象数组
 */
async function cropSpritesToFiles(sourceCanvas, spriteRects, fileName, format) {
  const files = []

  // 获取文件扩展名和MIME类型映射[1,6](@ref)
  const formatMap = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp'
  }

  // 使用默认格式如果指定的格式不支持[3,7](@ref)
  const mimeType = formatMap[format.toLowerCase()] || 'image/png'
  const actualFormat = Object.keys(formatMap).find((key) => formatMap[key] === mimeType) || 'png'

  // 提取文件名（不含扩展名）[1,4](@ref)
  const baseName = fileName.replace(/\.[^/.]+$/, '')

  for (let i = 0; i < spriteRects.length; i++) {
    const rect = spriteRects[i]

    // 创建新画布用于裁剪
    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = rect.width
    cropCanvas.height = rect.height

    const cropCtx = cropCanvas.getContext('2d')

    // 设置透明背景[3](@ref)
    cropCtx.clearRect(0, 0, rect.width, rect.height)

    // 裁剪精灵[7,9](@ref)
    cropCtx.drawImage(
      sourceCanvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height, // 源图像区域
      0,
      0,
      rect.width,
      rect.height // 目标区域
    )

    // 将画布转换为Blob然后转为File对象[6](@ref)
    const blob = await new Promise((resolve) => {
      cropCanvas.toBlob(resolve, mimeType)
    })

    // 生成文件名：基础名_序号.格式[1,4](@ref)
    const numberedFileName = `${baseName}_${i + 1}.${actualFormat}`

    const file = new File([blob], numberedFileName, {
      type: mimeType,
      lastModified: new Date().getTime()
    })

    files.push(file)
  }

  return files
}

/**
 * 自动检测精灵区域
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @param {string} bgColor - 背景颜色
 * @returns {Promise<Array>} - 精灵区域数组
 */
function autoDetectSprites(ctx, width, height, bgColor) {
  return new Promise((resolve) => {
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    // 如果指定了背景色，将其转换为透明
    if (bgColor !== 'transparent') {
      const targetRGB = hexToRgb(bgColor)
      const tolerance = 10

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]

        if (colorDistance(r, g, b, targetRGB.r, targetRGB.g, targetRGB.b) < tolerance) {
          data[i + 3] = 0
        }
      }
    }

    const visited = new Array(width * height).fill(false)
    const sprites = []
    const minSize = 2

    // 使用洪水填充算法检测连通区域[5](@ref)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x
        const alpha = data[index * 4 + 3]

        if (!visited[index] && alpha > 0) {
          const region = floodFill(x, y, data, visited, width, height)

          if (region.width >= minSize && region.height >= minSize) {
            sprites.push(region)
          }
        }
      }
    }

    // 按位置排序（从上到下，从左到右）[1](@ref)
    sprites.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y
      return a.x - b.x
    })

    resolve(sprites)
  })
}

/**
 * 手动检测精灵区域（网格分割）
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @param {Object} options - 分割参数
 * @returns {Array} - 精灵区域数组
 */
function manualDetectSprites(width, height, options) {
  const {
    width: spriteWidth,
    height: spriteHeight,
    margin = 0,
    paddingX = 0,
    paddingY = 0,
    // 添加最小尺寸参数
    minWidth = 2,
    minHeight = 2
  } = options

  // 检查参数有效性
  if (spriteWidth < minWidth || spriteHeight < minHeight) {
    console.warn(`手动分割参数无效: 精灵尺寸${spriteWidth}x${spriteHeight}小于最小要求${minWidth}x${minHeight}`)
    return []
  }

  const sprites = []
  const availableWidth = width - 2 * margin
  const availableHeight = height - 2 * margin

  const cols = Math.floor((availableWidth + paddingX) / (spriteWidth + paddingX))
  const rows = Math.floor((availableHeight + paddingY) / (spriteHeight + paddingY))

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = margin + col * (spriteWidth + paddingX)
      const y = margin + row * (spriteHeight + paddingY)

      if (x + spriteWidth <= width && y + spriteHeight <= height) {
        sprites.push({
          x,
          y,
          width: spriteWidth,
          height: spriteHeight
        })
      }
    }
  }

  return sprites
}

/**
 * 洪水填充算法检测连通区域
 * @param {number} startX - 起始X坐标
 * @param {number} startY - 起始Y坐标
 * @param {Uint8ClampedArray} imageData - 图像数据
 * @param {Array} visited - 访问标记数组
 * @param {number} width - 图片宽度
 * @param {number} height - 图片高度
 * @returns {Object} - 区域边界信息
 */
function floodFill(startX, startY, imageData, visited, width, height) {
  const stack = [[startX, startY]]
  let minX = startX, minY = startY, maxX = startX, maxY = startY

  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const index = y * width + x

    if (x < 0 || x >= width || y < 0 || y >= height || visited[index]) {
      continue
    }

    const alpha = imageData[index * 4 + 3]
    if (alpha === 0) continue

    visited[index] = true
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)

    // 四向连通[5](@ref)
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}

/**
 * 十六进制颜色转RGB对象
 * @param {string} hex - 十六进制颜色值
 * @returns {Object} RGB颜色对象
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : { r: 0, g: 0, b: 0 }
}

/**
 * 计算颜色距离
 * @param {number} r1 - 颜色1的R值
 * @param {number} g1 - 颜色1的G值
 * @param {number} b1 - 颜色1的B值
 * @param {number} r2 - 颜色2的R值
 * @param {number} g2 - 颜色2的G值
 * @param {number} b2 - 颜色2的B值
 * @returns {number} 颜色距离
 */
function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2))
}

// 导出所有函数以便测试
export {
  filterUselessRects,
  cropSpritesToFiles,
  autoDetectSprites,
  manualDetectSprites,
  floodFill,
  hexToRgb,
  colorDistance
}
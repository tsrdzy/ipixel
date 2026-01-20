import { ipcMain } from 'electron'
import Aseprite from 'ase-parser'
import sharp from 'sharp'

// ase转png
export default () => {
  ipcMain.handle('asetopng', async (event, aseBinaryData) => {
    try {
      let binaryData

      if (aseBinaryData instanceof Buffer) {
        // 如果已经是 Buffer，直接使用
        binaryData = aseBinaryData
      } else if (aseBinaryData instanceof Uint8Array) {
        // 将 Uint8Array 转换为 Buffer
        binaryData = Buffer.from(aseBinaryData)
      } else if (aseBinaryData instanceof ArrayBuffer) {
        // 如果原始数据是 ArrayBuffer，也转换为 Buffer
        binaryData = Buffer.from(aseBinaryData)
      } else {
        throw new Error(`不支持的二进制数据格式: ${aseBinaryData.constructor.name}`)
      }

      // 检查输入数据
      if (!binaryData || !(binaryData instanceof Buffer)) {
        throw new Error('Invalid ASE binary data: Expected Buffer')
      }

      // 创建Aseprite解析实例[1](@ref)
      const aseFile = new Aseprite(binaryData, 'input.aseprite')

      // 解析ASE文件[1](@ref)
      aseFile.parse()

      // 检查是否有帧数据
      if (!aseFile.frames || aseFile.frames.length === 0) {
        throw new Error('No frames found in ASE file')
      }

      // 获取第一帧（可以根据需要扩展为多帧处理）[1](@ref)
      const frame = aseFile.frames[0]

      // 创建透明背景画布[1,3](@ref)
      const background = sharp({
        create: {
          width: aseFile.width,
          height: aseFile.height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        }
      }).png()

      // 对cel进行排序（按图层顺序）[1](@ref)
      const sortedCels = frame.cels.slice().sort((a, b) => {
        const orderA = a.layerIndex + a.zIndex
        const orderB = b.layerIndex + b.zIndex
        return orderA - orderB || a.zIndex - b.zIndex
      })

      // 准备合成操作
      const compositeOperations = []

      for (const cel of sortedCels) {
        // 检查cel数据是否有效[1](@ref)
        if (!cel.rawCelData || cel.w === 0 || cel.h === 0) {
          continue
        }

        // 创建cel的sharp实例[1](@ref)
        const celImage = sharp(cel.rawCelData, {
          raw: {
            width: cel.w,
            height: cel.h,
            channels: 4
          }
        })

        // 转换为PNG buffer[3](@ref)
        const celBuffer = await celImage.png().toBuffer()

        // 添加到合成操作[1](@ref)
        compositeOperations.push({
          input: celBuffer,
          top: cel.ypos,
          left: cel.xpos,
          blend: 'over' // 使用alpha混合
        })
      }

      // 如果没有任何有效的cel，返回错误
      if (compositeOperations.length === 0) {
        throw new Error('No valid cel data found in the frame')
      }

      // 执行图像合成[1](@ref)
      const finalImage = await background.composite(compositeOperations).png().toBuffer()

      // 返回PNG图片数据（可以转换为base64或直接返回buffer）
      return {
        success: true,
        pngData: finalImage,
        width: aseFile.width,
        height: aseFile.height,
        frameCount: aseFile.numFrames,
        message: `Successfully converted ASE to PNG (${compositeOperations.length} layers)`
      }
    } catch (error) {
      console.error('ASE to PNG conversion error:', error)

      return {
        success: false,
        error: error.message,
        pngData: null,
        width: 0,
        height: 0
      }
    }
  })
}

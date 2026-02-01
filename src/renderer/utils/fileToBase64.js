/**
 * 将文件转换为Base64编码
 * @param {File|File[]} file - 单个文件或文件数组
 * @returns {Promise<string|string[]>} Base64编码字符串或字符串数组
 */
export default function fileToBase64(file) {
  // 处理单个文件
  const convertSingleFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        // 返回完整的Data URL（包含Base64编码）[1,2](@ref)
        resolve(e.target.result)
      }

      reader.onerror = (error) => {
        reject(new Error(`文件读取失败: ${error}`))
      }

      // 使用readAsDataURL方法将文件转换为Base64编码[3,4](@ref)
      reader.readAsDataURL(file)
    })
  }

  // 判断输入类型
  if (Array.isArray(file)) {
    // 处理文件数组，使用Promise.all并行转换[6](@ref)
    return Promise.all(file.map(convertSingleFile))
  } else {
    // 处理单个文件
    return convertSingleFile(file)
  }
}

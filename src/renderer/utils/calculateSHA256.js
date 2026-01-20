/**
 * 使用浏览器原生API计算文件的SHA-256哈希值
 * @param {File|ArrayBuffer} fileInput - 二进制文件对象(File)或ArrayBuffer
 * @returns {Promise<string>} - 解析为SHA-256哈希值(十六进制字符串)的Promise
 */
async function calculateSHA256(fileInput) {
  let arrayBuffer;
  // 判断输入是File对象还是ArrayBuffer
  if (fileInput instanceof File) {
    // 如果是File对象，先获取其ArrayBuffer
    arrayBuffer = await fileInput.arrayBuffer();
  } else if (fileInput instanceof ArrayBuffer) {
    arrayBuffer = fileInput;
  } else {
    throw new Error('输入必须是File对象或ArrayBuffer');
  }

  // 使用crypto.subtle.digest计算哈希
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  // 将ArrayBuffer转换为字节数组
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // 将字节数组转换为十六进制字符串
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}
export default calculateSHA256
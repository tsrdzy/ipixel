export default function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = function (event) {
      // event.target.result 即为包含二进制数据的ArrayBuffer
      resolve(event.target.result)
    }

    reader.onerror = function (error) {
      reject(error)
    }

    // 关键步骤：开始将File读取为ArrayBuffer
    reader.readAsArrayBuffer(file)
  })
}

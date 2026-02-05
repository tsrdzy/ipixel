export default function bufferToBase64(data, type = 'image/png') {
  const blob = new Blob([data], { type: type }) //类型一定要写！！！
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    reader.onload = () => resolve(reader.result)
    reader.onerror = (error) => reject(error)
  })
}

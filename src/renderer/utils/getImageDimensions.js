export default function getImageDimensions(file) {
  return new Promise((resolve) => {
    // 检查输入是否为有效数据
    if (!file) {
      resolve({ width: 0, height: 0 });
      return;
    }

    // 判断输入类型：Base64 字符串或 File 对象
    const isBase64 = typeof file === 'string' && 
                    (file.startsWith('data:image/') || 
                     /^[A-Za-z0-9+/]*={0,2}$/.test(file.replace(/^data:image\/[a-z]+;base64,/, '')));

    const isFile = file instanceof File;

    if (!isBase64 && !isFile) {
      resolve({ width: 0, height: 0 });
      return;
    }

    // 创建 Image 对象来加载图片并获取宽高
    const img = new Image();
    let urlToRevoke = null;

    // 设置加载完成和错误处理
    img.onload = function () {
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke); // 释放内存（仅针对 File 对象）
      }
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      });
    };

    img.onerror = function () {
      if (urlToRevoke) {
        URL.revokeObjectURL(urlToRevoke);
      }
      resolve({ width: 0, height: 0 }); // 加载失败时返回 0
    };

    // 根据不同类型设置图片源
    if (isBase64) {
      // 处理 Base64 字符串
      let base64String = file;
      // 如果是不完整的 Base64（缺少 data:image/ 前缀），自动补全[7](@ref)
      if (!base64String.startsWith('data:image/')) {
        // 可以尝试检测图片类型，这里默认使用 png[6](@ref)
        base64String = `data:image/png;base64,${base64String}`;
      }
      img.src = base64String;
    } else if (isFile) {
      // 检查文件类型是否为图片[5](@ref)
      if (!file.type.startsWith('image/')) {
        resolve({ width: 0, height: 0 });
        return;
      }
      
      // 处理 File 对象
      urlToRevoke = URL.createObjectURL(file);
      img.src = urlToRevoke;
    }
  });
}
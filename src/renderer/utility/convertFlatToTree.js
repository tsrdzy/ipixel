// 自动识别父ID字段的扁平化转树形函数
function convertFlatToTree(flatData) {
  if (!flatData || flatData.length === 0) return []

  // 自动检测父ID字段
  const firstItem = flatData[0]
  let parentKey

  if (firstItem.hasOwnProperty('parent_folder_id')) {
    parentKey = 'parent_folder_id'
  } else if (firstItem.hasOwnProperty('parent_tag_id')) {
    parentKey = 'parent_tag_id'
  } else {
    console.warn('未找到 parent_folder_id 或 parent_tag_id 字段，使用默认转换')
    parentKey = 'parent_folder_id' // 默认回退
  }

  const map = {}
  const tree = []

  // 第一遍遍历：创建节点映射表
  flatData.forEach((item) => {
    const { name, ...rest } = item
    map[item.id] = {
      ...rest,
      label: name, // 将name转换为label
      children: [] // 初始化children
    }
  })

  // 第二遍遍历：连接父子节点
  flatData.forEach((item) => {
    const node = map[item.id]
    const parentId = item[parentKey]

    if (parentId !== null && parentId !== undefined) {
      // 如果父节点存在，将当前节点添加到父节点的children中
      const parent = map[parentId]
      if (parent) {
        parent.children.push(node)
      } else {
        console.warn(`父节点 ID ${parentId} 不存在，忽略节点 ${item.id}`)
      }
    } else {
      // parentId 为 null 或 undefined 表示根节点
      tree.push(node)
    }
  })

  return tree
}

export default convertFlatToTree

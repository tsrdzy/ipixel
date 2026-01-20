//当前展开数组
function getExpandedIds(treeData) {
  const expandedIds = []

  function traverse(nodes) {
    nodes.forEach((node) => {
      if (node.expanded === 1) {
        expandedIds.push(node.id)
      }
      // 递归遍历子节点
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    })
  }
  traverse(treeData)
  return expandedIds
}
export default getExpandedIds

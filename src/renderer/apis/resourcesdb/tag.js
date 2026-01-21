import convertFlatToTree from '@/utils/convertFlatToTree.js'
import getExpandedIds from '@/utils/getExpandedIds.js'
const dbtable = 'tags'
//查询标签列表
async function DB_gettagslist() {
  const data = await db.sql(`SELECT * FROM ${dbtable}`)
  return [convertFlatToTree(data), getExpandedIds(data)]
}
//创建标签
async function DB_createtag(parent_tag_id) {
  const secondsTimestamp = Math.floor(Date.now() / 1000)
  if (parent_tag_id != undefined) {
    return await db.sql(
      `INSERT INTO ${dbtable} (parent_tag_id, name, color ,expanded ,created_at ,updated_at) VALUES (${parent_tag_id}, '新建文件夹', '', false,${secondsTimestamp}, ${secondsTimestamp})`
    )
  } else {
    return await db.sql(
      `INSERT INTO ${dbtable} (name, color,expanded, created_at , updated_at) VALUES ('新建标签', '', false, ${secondsTimestamp}, ${secondsTimestamp})`
    )
  }
}
//更新标签
async function DB_updatetag(id, data = {}) {
  if (id != undefined && data.length != 0) {
    let setdata = ''
    for (let d in data) {
      if (data == 'name' || data == 'color') {
        setdata = setdata + d + " = '" + data[d] + "',"
      } else {
        setdata = setdata + d + ' = ' + data[d] + ','
      }
    }
    if (setdata.length != 0) {
      setdata = setdata.substring(0, setdata.length - 1)
      return await db.sql(`UPDATE ${dbtable} SET ${setdata} WHERE id = ${id}`)
    } else {
      return -1
    }
  }
}
//删除标签
async function DB_deletetag(id) {
  if (id != undefined) {
    return await db.sql(`DELETE FROM ${dbtable} WHERE id = ${id}`)
  }
}

export { DB_gettagslist, DB_createtag, DB_updatetag, DB_deletetag }

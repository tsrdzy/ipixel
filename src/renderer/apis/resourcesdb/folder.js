import convertFlatToTree from '@/utility/convertFlatToTree.js'
import getExpandedIds from '@/utility/getExpandedIds.js'
const dbtable = 'folders'
//查询文件列表
async function DB_getfolderslist() {
  const data = await db.sql(`SELECT * FROM ${dbtable}`)
  return [convertFlatToTree(data), getExpandedIds(data)]
}
//创建文件夹
async function DB_createfolder(parent_folder_id) {
  const secondsTimestamp = Math.floor(Date.now() / 1000)
  if (parent_folder_id != undefined) {
    return await db.sql(
      `INSERT INTO ${dbtable} (parent_folder_id, name, color ,expanded ,created_at ,updated_at) VALUES (${parent_folder_id}, '新建文件夹', '', false,${secondsTimestamp}, ${secondsTimestamp})`
    )
  } else {
    return await db.sql(
      `INSERT INTO ${dbtable} (name, color,expanded, created_at , updated_at) VALUES ('新建文件夹', '', false, ${secondsTimestamp}, ${secondsTimestamp})`
    )
  }
}
//更新文件夹
async function DB_updatefolder(id, data = {}) {
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
//删除文件夹
async function DB_deletefolder(id) {
  if (id != undefined) {
    return await db.sql(`DELETE FROM ${dbtable} WHERE id = ${id}`)
  }
}

export { DB_getfolderslist, DB_createfolder, DB_updatefolder, DB_deletefolder }

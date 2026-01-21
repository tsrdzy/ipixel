import calculateSHA256 from '@/utils/calculateSHA256.js'
import fileToArrayBuffer from '@/utils/fileToArrayBuffer.js'
//查询资源列表
async function DB_getresourceslist(where) {
  const _where = where
  let _whereData = ''
  let _whereArray = []
  if (_where != undefined) {
    _whereData = 'WHERE '
    for (var i = 0; i < _where.length; i++) {
      _whereData = _whereData + _where[i].key + _where[i].operator + '? or '
      _whereArray.push(_where[i].value)
    }
    if (_whereArray.length != 0) {
      _whereData = _whereData.substring(0, _whereData.length - 3)
    }
  }
  return await db.sql(`SELECT * FROM resources ${_whereData}`, ..._whereArray)
}
//查询header需求内容
async function DB_getheaderlist() {
  const datas = {}
  datas.type = await db.sql(`SELECT DISTINCT type as option FROM resources`)
  datas.format = await db.sql(`SELECT DISTINCT format as option FROM resources`)
  return datas
}

//添加资源
async function DB_createresources(folder_id, file) {
  const name = file.name
  const bufferFile = await fileToArrayBuffer(file)
  const secondsTimestamp = Math.floor(Date.now() / 1000)
  const hash = await calculateSHA256(bufferFile)
  const hash_prefix = hash.substring(0, 2)
  const created_at = secondsTimestamp
  const updated_at = secondsTimestamp
  const format = name.substring(name.lastIndexOf('.'))
  const size = file.size
  const type = file.type

  const savefilemessage = await db.savefile(hash, format, bufferFile)

  if (savefilemessage.success == true) {
    return await db.sql(
      `INSERT INTO resources (folder_id, name,hash, hash_prefix , created_at,updated_at,format,size,type,rating,is_gif,width,height,parent_id,is_parent_sprite) 
  VALUES (?, ?, ?,?, ?, ?, ?, ?,?,0,false,0,0,null,false)`,
      folder_id,
      name,
      hash,
      hash_prefix,
      created_at,
      updated_at,
      format,
      size,
      type
    )
  } else {
    return {
      success: false,
      message: '添加失败',
      data: savefilemessage
    }
  }
}

//获取资源总数
async function DB_getresourcescount(list, key, value) {
  let where = ''
  if (key != undefined && value != undefined) {
    where = ` WHERE ${key}=?`
    return await db.sql(`SELECT COUNT(*) FROM ${list}` + where, value)
  } else {
    return await db.sql(`SELECT COUNT(*) FROM ${list}`)
  }
}
export { DB_getresourceslist, DB_getheaderlist, DB_createresources, DB_getresourcescount }

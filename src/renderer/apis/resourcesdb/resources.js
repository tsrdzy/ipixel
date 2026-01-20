import calculateSHA256 from '@/utils/calculateSHA256.js'
import fileToArrayBuffer from '@/utils/fileToArrayBuffer.js'
//查询资源列表
async function DB_getresourceslist(data = {}) {
  return await db.sql(`SELECT * FROM resources`)
}
//查询header需求内容
async function DB_getheaderlist() {
  return await db.sql(`SELECT COUNT(*) FROM resources`)
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
      data:savefilemessage
    }
  }
}

export { DB_getresourceslist, DB_getheaderlist, DB_createresources }

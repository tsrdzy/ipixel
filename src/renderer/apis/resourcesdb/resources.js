import calculateSHA256 from '@/utils/calculateSHA256.js'
import fileToArrayBuffer from '@/utils/fileToArrayBuffer.js'
import getImageDimensions from '@/utils/getImageDimensions.js'
//查询资源列表
async function DB_getresourceslist(where = []) {
  let _whereData = ''
  let _whereArray = []
  if (where.length != 0) {
    _whereData = ''
    for (var i = 0; i < where.length; i++) {
      _whereData +=
        (where[i].type == undefined ? '' : where[i].type) +
        ' ' +
        where[i].key +
        ' ' +
        where[i].operator +
        ' ? '
      if (where[i].key == 'name') {
        _whereArray.push('%' + where[i].value + '%')
      } else {
        _whereArray.push(where[i].value)
      }
    }

    if (_whereData[0] == 'O' && _whereData[1] == 'R') {
      _whereData = _whereData.substring(2, _whereData.length)
    }
    if (_whereData[0] == 'A' && _whereData[1] == 'N') {
      _whereData = _whereData.substring(3, _whereData.length)
    }

    _whereData = 'WHERE' + _whereData
  }
  return await db.sql(`SELECT * FROM resources ${_whereData}`, ..._whereArray)
}
//查询header需求内容
async function DB_getheaderlist() {
  const datas = {}
  datas.format = await db.sql(`SELECT DISTINCT format as option FROM resources`)
  console.log(datas.format)
  if (datas.format.state != 'error') {
    let formatArray = datas.format
    for (var i = 0; i < datas.format.length; i++) {
      formatArray[i].value = {
        key: 'format',
        value: datas.format[i].option,
        operator: '=',
        type: 'AND'
      }
    }
    // { key: 'width', value: 16, operator: '<=', type: 'AND' }
    return formatArray
  } else {
    return []
  }
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
  const dimensions = await getImageDimensions(file)
  const width = dimensions.width
  const height = dimensions.height
  const savefilemessage = await db.savefile(hash, format, bufferFile)

  if (savefilemessage.success == true) {
    return await db.sql(
      `INSERT INTO resources (folder_id, name,hash, hash_prefix , created_at,updated_at,format,size,type,rating,is_gif,width,height,parent_id,is_parent_sprite) 
  VALUES (?, ?, ?,?, ?, ?, ?, ?,?,0,false,?,?,null,false)`,
      folder_id,
      name,
      hash,
      hash_prefix,
      created_at,
      updated_at,
      format,
      size,
      type,
      width,
      height
    )
  } else {
    return {
      success: false,
      message: '添加失败',
      data: savefilemessage
    }
  }
}

//删除资源
async function DB_deleteresources(id, hash, file_suffix) {
  if (id != undefined) {
    const data = await db.deletefile(hash, file_suffix)
    if (data.success) {
      return await db.sql(`DELETE FROM resources WHERE id = ${id}`)
    } else {
      return { success: false, message: '文件删除失败', data }
    }
  }
}

//修改资源
async function DB_setresources(id, set = {},) {
  //(folder_id, name,hash, hash_prefix , created_at,updated_at,format,size,type
  // ,rating,is_gif,width,height,parent_id,is_parent_sprite)
  //  VALUES (?, ?, ?,?, ?, ?, ?, ?,?,0,false,?,?,null,false)
  let sets = ''
  let setsArray = []
  if (!isEmpty(set)) {
    for (let key in set) {
      sets = sets + key + '=? '
      setsArray.push(set[key])
    }

    return await db.sql(`UPDATE resources SET ${sets} WHERE id=${id}`, ...setsArray)
  }
  return { success: false, message: '无修改项' }
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

function isEmpty(obj) {
  return Object.keys(obj).length === 0
}
export {
  DB_getresourceslist,
  DB_getheaderlist,
  DB_createresources,
  DB_getresourcescount,
  DB_deleteresources,
  DB_setresources
}

async function DB_getfolderslist() {
  return await db.sql('SELECT * FROM folders')
}
async function DB_gettagslist() {
  return await db.sql('SELECT * FROM tags')
}
export { DB_getfolderslist, DB_gettagslist }

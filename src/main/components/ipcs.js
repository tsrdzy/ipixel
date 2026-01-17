import db from './db/index.js'
import store from './store/index.js'
import file from './file/index.js'
function ipcs() {
  db()
  store()
  file()
}

export default ipcs

import db from './db/index.js'
import store from './store/index.js'
import file from './file/index.js'
import utils from './utils/index.js'
function ipcs() {
  db()
  store()
  file()
  utils()
}

export default ipcs

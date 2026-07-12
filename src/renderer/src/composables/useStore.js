import { reactive } from 'vue'

/**
 * 全局应用状态
 * 通过 IPC 与主进程交互，渲染层不直接接触文件系统
 */
const state = reactive({
  // 资源库状态
  initialized: false,
  libraryPath: null,
  library: null,
  // 资源库列表（历史记录）
  libraries: [],
  // 数据
  models: [],
  tags: [],
  loading: false,
  // 视图路由：'init' | 'home' | 'upload' | 'edit'
  view: 'init',
  // 当前编辑的模型（edit 模式）
  editingModel: null
})

/** 启动时检查资源库状态 */
async function checkStatus() {
  state.loading = true
  try {
    const res = await window.api.library.status()
    state.libraries = res.libraries || []
    state.initialized = res.initialized
    state.libraryPath = res.libraryPath
    state.library = res.library
    state.view = res.initialized ? 'home' : 'init'
    if (res.initialized) {
      await loadAll()
    }
  } finally {
    state.loading = false
  }
}

/** 加载模型列表 + 标签池 */
async function loadAll() {
  const [models, tags] = await Promise.all([
    window.api.models.list(),
    window.api.tags.list()
  ])
  state.models = models
  state.tags = tags
}

/** 创建资源库 */
async function createLibrary(folderPath, name) {
  const res = await window.api.library.create(folderPath, name)
  state.initialized = true
  state.libraryPath = res.libraryPath
  state.library = res.library
  state.libraries = res.libraries || []
  state.models = []
  state.tags = []
  state.view = 'home'
  window.location.hash = '#/model'
}

/** 打开列表中的已有资源库 */
async function openLibrary(folderPath) {
  const res = await window.api.library.open(folderPath)
  state.initialized = true
  state.libraryPath = res.libraryPath
  state.library = res.library
  state.libraries = res.libraries || []
  await loadAll()
  state.view = 'home'
  window.location.hash = '#/model'
}

/** 浏览并打开已有资源库（弹窗选择） */
async function browseAndOpenLibrary() {
  const res = await window.api.library.selectAndOpen()
  if (!res) return // 用户取消
  state.initialized = true
  state.libraryPath = res.libraryPath
  state.library = res.library
  state.libraries = res.libraries || []
  await loadAll()
  state.view = 'home'
  window.location.hash = '#/model'
}

/** 从列表中删除资源库记录（不删除磁盘文件） */
async function removeLibrary(folderPath) {
  const list = await window.api.library.remove(folderPath)
  state.libraries = list || []
  // 若删除的是当前激活库，回到初始化页
  if (state.libraryPath === folderPath) {
    state.initialized = false
    state.libraryPath = null
    state.library = null
    state.models = []
    state.tags = []
    state.view = 'init'
  }
}

/** 切换资源库（回到初始化页） */
function switchLibrary() {
  state.view = 'init'
}

/** 关闭当前资源库 */
async function closeLibrary() {
  await window.api.library.close()
  state.initialized = false
  state.libraryPath = null
  state.library = null
  state.models = []
  state.tags = []
  state.view = 'init'
}

/** 重命名当前资源库 */
async function renameLibrary(newName) {
  if (!state.libraryPath) return
  const res = await window.api.library.rename(state.libraryPath, newName)
  state.library = res.library
  state.libraries = res.libraries || []
}

/** 保存资源库设置（持久化到 library.json） */
async function saveSettings(settings) {
  if (!state.libraryPath) return
  const library = await window.api.library.updateSettings(settings)
  state.library = library
}

/** 进入上传页 */
function goUpload() {
  state.editingModel = null
  state.view = 'upload'
}

/** 进入编辑页 */
function goEdit(model) {
  state.editingModel = model
  state.view = 'edit'
}

/** 返回首页并刷新 */
async function goHome() {
  state.editingModel = null
  state.view = 'home'
  await loadAll()
}

/**
 * 批量上传：仅复制文件到库内，返回每个模型的 buffer + 元数据
 * 渲染层负责生成封面、提交到分片
 * @param {Function} onProgress - 进度回调 ({ current, total, fileName, stage }) => void
 * @returns {Promise<{total:number, items:Array}|null>}
 */
async function batchUpload(onProgress) {
  let unsubscribe = null
  if (typeof onProgress === 'function') {
    unsubscribe = window.api.models.onBatchUploadProgress(onProgress)
  }
  try {
    return await window.api.models.batchUpload()
  } finally {
    if (unsubscribe) unsubscribe()
  }
}

/** 删除模型 */
async function deleteModel(id) {
  await window.api.models.delete(String(id))
  // 从本地列表中移除
  state.models = state.models.filter((m) => m.id !== id)
  // 重新加载标签池（删除模型可能让某些标签不再被使用）
  try {
    state.tags = await window.api.tags.list()
  } catch (e) {
    // ignore
  }
}

export function useStore() {
  return {
    state,
    checkStatus,
    loadAll,
    createLibrary,
    openLibrary,
    browseAndOpenLibrary,
    removeLibrary,
    switchLibrary,
    closeLibrary,
    renameLibrary,
    saveSettings,
    goUpload,
    goEdit,
    goHome,
    batchUpload,
    deleteModel
  }
}

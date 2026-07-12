import { reactive } from 'vue'

const instances = {}

export function createUploadState(editingKey) {
  if (instances[editingKey]) {
    return instances[editingKey]
  }

  const state = reactive({
    view: 'list',
    pendingUpload: null,
    [editingKey]: null
  })

  const baseKey = editingKey.replace(/^editing/, '')
  const methodName = `setEditing${baseKey.charAt(0).toUpperCase() + baseKey.slice(1)}`

  const instance = {
    state,
    setView(view) {
      state.view = view
    },
    setPendingUpload(data) {
      state.pendingUpload = data
      state[editingKey] = null
      state.view = 'upload'
    },
    [methodName](item) {
      state[editingKey] = item
      state.pendingUpload = null
      state.view = 'upload'
    },
    reset() {
      state.view = 'list'
      state.pendingUpload = null
      state[editingKey] = null
    }
  }

  instances[editingKey] = instance
  return instance
}
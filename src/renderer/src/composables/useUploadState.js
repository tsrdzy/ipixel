import { reactive } from 'vue'

export function createUploadState(editingKey) {
  const state = reactive({
    view: 'list',
    pendingUpload: null,
    [editingKey]: null
  })

  return {
    state,
    setView(view) {
      state.view = view
    },
    setPendingUpload(data) {
      state.pendingUpload = data
      state[editingKey] = null
      state.view = 'upload'
    },
    [`setEditing${editingKey.charAt(0).toUpperCase() + editingKey.slice(1)}`](item) {
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
}
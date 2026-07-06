import { reactive } from 'vue'

const state = reactive({
  view: 'list',
  pendingUpload: null,
  editingFont: null
})

export function useFontState() {
  function setView(view) {
    state.view = view
  }

  function setPendingUpload(data) {
    state.pendingUpload = data
    state.editingFont = null
    state.view = 'upload'
  }

  function setEditingFont(font) {
    state.editingFont = font
    state.pendingUpload = null
    state.view = 'upload'
  }

  function reset() {
    state.view = 'list'
    state.pendingUpload = null
    state.editingFont = null
  }

  return {
    state,
    setView,
    setPendingUpload,
    setEditingFont,
    reset
  }
}

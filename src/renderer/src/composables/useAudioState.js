import { reactive } from 'vue'

const state = reactive({
  view: 'list',
  pendingUpload: null,
  editingAudio: null
})

export function useAudioState() {
  function setView(view) {
    state.view = view
  }

  function setPendingUpload(data) {
    state.pendingUpload = data
    state.editingAudio = null
    state.view = 'upload'
  }

  function setEditingAudio(audio) {
    state.editingAudio = audio
    state.pendingUpload = null
    state.view = 'upload'
  }

  function reset() {
    state.view = 'list'
    state.pendingUpload = null
    state.editingAudio = null
  }

  return {
    state,
    setView,
    setPendingUpload,
    setEditingAudio,
    reset
  }
}

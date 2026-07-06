import { reactive } from 'vue'

const state = reactive({
  view: 'list',       // 'list' | 'upload'
  pendingUpload: null, // 上传后待编辑的数据
  editingImage: null   // 编辑已有图片
})

export function useImageState() {
  function setView(view) {
    state.view = view
  }

  function setPendingUpload(data) {
    state.pendingUpload = data
    state.editingImage = null
    state.view = 'upload'
  }

  function setEditingImage(image) {
    state.editingImage = image
    state.pendingUpload = null
    state.view = 'upload'
  }

  function reset() {
    state.view = 'list'
    state.pendingUpload = null
    state.editingImage = null
  }

  return {
    state,
    setView,
    setPendingUpload,
    setEditingImage,
    reset
  }
}

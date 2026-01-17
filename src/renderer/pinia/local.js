import { defineStore } from 'pinia'

export const useLocalStore = defineStore('local', {
  state: () => ({
    currentlySelectedFolderID: undefined, //当前选中文件夹ID
    currentlySelectedtagID: undefined //当前选中标签ID
  })
})

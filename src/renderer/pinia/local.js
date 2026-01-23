import { defineStore } from 'pinia'

export const useLocalStore = defineStore('local', {
  state: () => ({
    currentlySelectedFolderID: undefined, //当前选中文件夹ID
    currentlySelectedtagID: undefined, //当前选中标签ID
    currentlySelectedType: undefined, //当前选中类型
    currentlySelectedID: undefined, //当前选中,
    currentlySelectedResourcesID: undefined, //当前选中资源ID
    currentlySelectedResourcesList: [], //当前选中资源列表
    cardSize: 0, //card大小
    getWhere: {
      search: '',
      created_at: 'ALL',
      format: 'ALL',
      width: 'ALL',
      size: 'ALL',
      rating: 'ALL',
      folder_id: 'ALL'
    }
  })
})

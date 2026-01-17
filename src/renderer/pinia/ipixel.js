import { defineStore } from 'pinia'

export const useIpixelStore = defineStore('ipixel', {
  state: () => ({
    theme: '',
    language: ''
  })
})

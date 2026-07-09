import { createUploadState } from './useUploadState'

export function useFontState() {
  return createUploadState('editingFont')
}
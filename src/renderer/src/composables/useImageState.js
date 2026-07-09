import { createUploadState } from './useUploadState'

export function useImageState() {
  return createUploadState('editingImage')
}
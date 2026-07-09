import { createUploadState } from './useUploadState'

export function useAudioState() {
  return createUploadState('editingAudio')
};
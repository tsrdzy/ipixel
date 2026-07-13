<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import WaveSurfer from 'wavesurfer.js'
import { useStore } from '../composables/useStore'
import { useAudioState } from '../composables/useAudioState'
import { useDragUpload } from '../composables/useDragUpload'

const router = useRouter()
const { state, switchLibrary, closeLibrary, renameLibrary, saveSettings } = useStore()
const { setPendingUpload, setEditingAudio } = useAudioState()
const { t } = useI18n()

const audios = ref([])
const keyword = ref('')
const sortBy = ref('uploadTime')
const sortDir = ref('desc')
const selectedTags = ref([])
const selectedFormats = ref([])
const selectedIds = ref([])
const isMultiSelect = ref(false)
const anchorId = ref(null)
const previewSize = ref(state.library?.settings?.audioPreviewSize || 5)
const cardHeight = computed(() => 50 + (previewSize.value - 1) * 10) // 50px ~ 140px
const displaySettings = reactive(state.library?.settings?.audioDisplay || { name: true, tags: true, duration: true, fileSize: true, uploadTime: true, fileType: true, sampleRate: true, channels: true })

function onPreviewSizeChange() {
  saveSettings({ audioPreviewSize: previewSize.value })
}
function onDisplayChange() {
  saveSettings({ audioDisplay: { ...displaySettings } })
}
const allFieldsSelected = computed({
  get() {
    return Object.values(displaySettings).every(v => v)
  },
  set(val) {
    Object.keys(displaySettings).forEach(key => {
      displaySettings[key] = val
    })
    onDisplayChange()
  }
})

const isIndeterminate = computed(() => {
  const values = Object.values(displaySettings)
  return values.some(v => v) && !values.every(v => v)
})
function onSelectAll(val) {
  allFieldsSelected.value = val
}
const loading = ref(false)

const isDragging = ref(false)
const dragStartGlobal = ref({ x: 0, y: 0 })
const dragEndGlobal = ref({ x: 0, y: 0 })
const contentRef = ref(null)
const showSelectionBox = ref(false)
let lastMouseX = 0
let lastMouseY = 0

const playingId = ref(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(1)
const playbackRate = ref(1)
const isLooping = ref(false)
let wavesurfer = null
const waveContainers = {}

const allTagsInUse = computed(() => {
  const map = new Map()
  audios.value.forEach((a) => {
    a.tags && a.tags.forEach((tag) => {
      map.set(tag, (map.get(tag) || 0) + 1)
    })
  })
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
})

const allFormatsInUse = computed(() => {
  const map = new Map()
  audios.value.forEach((a) => {
    if (a.fileType) {
      const fmt = a.fileType.toLowerCase()
      map.set(fmt, (map.get(fmt) || 0) + 1)
    }
  })
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
})

const filteredAudios = computed(() => {
  let list = audios.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    list = list.filter((a) =>
      (a.name || '').toLowerCase().includes(kw) ||
      (a.fileName || '').toLowerCase().includes(kw)
    )
  }
  if (selectedTags.value.length > 0) {
    list = list.filter((a) =>
      a.tags && selectedTags.value.some((tag) => a.tags.includes(tag))
    )
  }
  if (selectedFormats.value.length > 0) {
    list = list.filter((a) => selectedFormats.value.includes((a.fileType || '').toLowerCase()))
  }
  list = [...list].sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'name') {
      cmp = (a.name || '').localeCompare(b.name || '')
    } else if (sortBy.value === 'fileSize') {
      cmp = (a.fileSize || 0) - (b.fileSize || 0)
    } else if (sortBy.value === 'duration') {
      cmp = (a.duration || 0) - (b.duration || 0)
    } else if (sortBy.value === 'uploadTime') {
      cmp = new Date(a.uploadTime || 0).getTime() - new Date(b.uploadTime || 0).getTime()
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return list
})

function formatSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatTime(time) {
  if (!time) return '—'
  return new Date(time).toLocaleString()
}

function formatDuration(sec) {
  if (!sec || sec <= 0) return '00:00'
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(sec % 60)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

async function handleLibCommand(cmd) {
  if (cmd === 'create') {
    router.push('/select-library?tab=create')
  } else if (cmd === 'switch') {
    router.push('/select-library?tab=open')
  } else if (cmd === 'close') {
    closeLibrary()
    router.push('/select-library')
  } else if (cmd === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt(t('init.libraryName'), t('init.rename'), {
        inputValue: state.library?.name || '',
        confirmButtonText: t('common.ok'),
        cancelButtonText: t('common.cancel'),
        inputValidator: (v) => (v && v.trim() ? true : t('common.name') + t('common.empty'))
      })
      await renameLibrary(value.trim())
      ElMessage.success(t('common.ok'))
    } catch (e) {
      // 用户取消
    }
  }
}

async function loadAudios() {
  loading.value = true
  try {
    const list = await window.api.audios.list()
    audios.value = list || []
  } catch (e) {
    console.error('加载音频列表失败:', e)
    ElMessage.error(t('common.loadFailed'))
  } finally {
    loading.value = false
  }
}

function handleUpload() {
  setPendingUpload({ new: true })
}

async function handleBatchUpload() {
  try {
    const result = await window.api.audios.batchUpload()
    if (!result) return
    let success = 0
    let dup = 0
    for (const item of result.items) {
      if (item.duplicate) {
        dup++
      } else if (item.meta) {
        await window.api.audios.save(item.meta)
        success++
      }
    }
    ElMessage.success(`${t('common.success')}: ${success}, ${t('audio.duplicate')}: ${dup}`)
    await loadAudios()
  } catch (e) {
    console.error('批量上传失败:', e)
    ElMessage.error(e.message || t('common.failed'))
  }
}

// ====== 拖拽上传 ======
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']

const dragBatchVisible = ref(false)

async function handleDragUpload(filePaths) {
  dragBatchVisible.value = true
  try {
    const result = await window.api.audios.batchUploadByPaths(filePaths)
    if (!result) return
    if (result.invalidFormat) {
      ElMessage.warning(t('common.invalidFormat', { formats: AUDIO_EXTS.join(', ').toUpperCase() }))
      return
    }
    let success = 0
    let dup = 0
    for (const item of result.items) {
      if (item.duplicate) {
        dup++
      } else if (item.meta) {
        await window.api.audios.save(item.meta)
        success++
      }
    }
    ElMessage.success(`${t('common.success')}: ${success}, ${t('audio.duplicate')}: ${dup}`)
    await loadAudios()
  } catch (e) {
    console.error('拖拽上传失败:', e)
    ElMessage.error(e.message || t('common.failed'))
  } finally {
    dragBatchVisible.value = false
  }
}

const { isDragOver, onDragEnter, onDragOver, onDragLeave, onDrop } = useDragUpload({
  extensions: AUDIO_EXTS,
  typeLabel: t('sidebar.audio'),
  onUpload: handleDragUpload
})

function handleUploadCommand(cmd) {
  if (cmd === 'single') handleUpload()
  else if (cmd === 'batch') handleBatchUpload()
}

function handleSortCommand(cmd) {
  if (cmd === 'asc' || cmd === 'desc') {
    sortDir.value = cmd
  } else {
    if (sortBy.value === cmd) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortBy.value = cmd
      sortDir.value = 'desc'
    }
  }
}

function isSelected(id) {
  const idStr = String(id)
  return selectedIds.value.some((sid) => String(sid) === idStr)
}

function toggleSelect(audio) {
  const audioId = String(audio.id)
  const idx = selectedIds.value.findIndex((sid) => String(sid) === audioId)
  if (idx === -1) {
    selectedIds.value.push(audio.id)
  } else {
    selectedIds.value.splice(idx, 1)
  }
  isMultiSelect.value = selectedIds.value.length > 0
}

function handleSelect(audio, e) {
  const event = e || window.event
  if (!event) {
    selectedIds.value = [audio.id]
    isMultiSelect.value = true
    anchorId.value = String(audio.id)
    return
  }

  const audioId = String(audio.id)

  if (event.ctrlKey || event.metaKey) {
    toggleSelect(audio)
    if (!anchorId.value) {
      anchorId.value = audioId
    }
  } else if (event.shiftKey) {
    const list = filteredAudios.value
    const currentIdx = list.findIndex((a) => String(a.id) === audioId)
    if (currentIdx === -1) return

    if (!anchorId.value || selectedIds.value.length === 0) {
      anchorId.value = audioId
      selectedIds.value = [audio.id]
      isMultiSelect.value = true
    } else {
      const anchorIdx = list.findIndex((a) => String(a.id) === anchorId.value)
      if (anchorIdx === -1) {
        anchorId.value = audioId
        selectedIds.value = [audio.id]
        isMultiSelect.value = true
        return
      }

      const start = Math.min(currentIdx, anchorIdx)
      const end = Math.max(currentIdx, anchorIdx)
      const newSelected = []
      for (let i = start; i <= end; i++) {
        newSelected.push(list[i].id)
      }
      selectedIds.value = newSelected
      isMultiSelect.value = true
    }
  } else {
    selectedIds.value = [audio.id]
    isMultiSelect.value = true
    anchorId.value = audioId
  }
}

function handleDblClick(audio) {
  if (selectedIds.value.length === 0 || selectedIds.value.length === 1 && selectedIds.value[0] === audio.id) {
    setEditingAudio(audio)
  }
}

function clearSelection() {
  selectedIds.value = []
  isMultiSelect.value = false
  anchorId.value = null
}

function selectAll() {
  const list = filteredAudios.value
  selectedIds.value = list.map((a) => a.id)
  isMultiSelect.value = selectedIds.value.length > 0
  if (selectedIds.value.length > 0) {
    anchorId.value = String(list[0].id)
  }
}

function selectInverse() {
  const list = filteredAudios.value
  const allIds = new Set(list.map((a) => String(a.id)))
  const selectedSet = new Set(selectedIds.value.map((id) => String(id)))
  const inverseIds = []
  allIds.forEach((id) => {
    if (!selectedSet.has(id)) {
      const audio = list.find((a) => String(a.id) === id)
      if (audio) inverseIds.push(audio.id)
    }
  })
  selectedIds.value = inverseIds
  isMultiSelect.value = selectedIds.value.length > 0
  if (selectedIds.value.length > 0) {
    anchorId.value = String(selectedIds.value[0])
  } else {
    anchorId.value = null
  }
}

async function handleBatchDelete() {
  if (selectedIds.value.length === 0) return
  try {
    await ElMessageBox.confirm(
      `${t('common.delete')} ${selectedIds.value.length} ${t('audio.items')}？`,
      t('common.delete'),
      { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') }
    )
    for (const id of selectedIds.value) {
      await window.api.audios.delete(id)
    }
    ElMessage.success(t('common.success'))
    selectedIds.value = []
    isMultiSelect.value = false
    anchorId.value = null
    await loadAudios()
  } catch (e) {
    // 用户取消
  }
}

async function handleBatchAddTag() {
  if (selectedIds.value.length === 0) return
  try {
    const { value } = await ElMessageBox.prompt(t('home.enterTag'), t('home.batchAddTag'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      inputValidator: (v) => (v && v.trim() ? true : t('home.enterTag'))
    })
    const tag = value.trim()
    for (const id of selectedIds.value) {
      const audio = audios.value.find((a) => a.id === id)
      if (audio) {
        if (!audio.tags) audio.tags = []
        if (!audio.tags.includes(tag)) {
          audio.tags.push(tag)
          try {
            const patch = { tags: [...audio.tags] }
            await window.api.audios.update(String(id), patch)
          } catch (e) {
            console.error('批量添加标签失败:', id, e)
          }
        }
      }
    }
    await loadAudios()
    ElMessage.success(t('home.tagsAdded', { count: selectedIds.value.length }))
  } catch (e) {
    // 用户取消
  }
}

let justBoxSelected = false

function handleContentClick(e) {
  if (justBoxSelected) {
    justBoxSelected = false
    return
  }
  if (e.target === contentRef.value || e.target.closest('.content') === contentRef.value && !e.target.closest('.audio-card')) {
    clearSelection()
  }
}

function updateDragEnd() {
  if (!isDragging.value || !contentRef.value) return
  const rect = contentRef.value.getBoundingClientRect()
  const viewportX = lastMouseX - rect.left
  const viewportY = lastMouseY - rect.top
  dragEndGlobal.value = {
    x: viewportX + contentRef.value.scrollLeft,
    y: viewportY + contentRef.value.scrollTop
  }
}

function handleMouseDown(e) {
  if (!contentRef.value) return
  if (e.ctrlKey || e.metaKey || e.shiftKey) {
    return
  }
  isDragging.value = true
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  const rect = contentRef.value.getBoundingClientRect()
  const viewportX = e.clientX - rect.left
  const viewportY = e.clientY - rect.top
  dragStartGlobal.value = {
    x: viewportX + contentRef.value.scrollLeft,
    y: viewportY + contentRef.value.scrollTop
  }
  dragEndGlobal.value = { ...dragStartGlobal.value }
  showSelectionBox.value = true
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  contentRef.value.addEventListener('scroll', updateDragEnd)
}

function handleMouseMove(e) {
  if (!isDragging.value || !contentRef.value) return
  lastMouseX = e.clientX
  lastMouseY = e.clientY
  const rect = contentRef.value.getBoundingClientRect()
  const viewportX = e.clientX - rect.left
  const viewportY = e.clientY - rect.top
  dragEndGlobal.value = {
    x: viewportX + contentRef.value.scrollLeft,
    y: viewportY + contentRef.value.scrollTop
  }
}

function handleMouseUp(e) {
  if (!isDragging.value || !contentRef.value) return
  e.stopPropagation()
  isDragging.value = false
  showSelectionBox.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  contentRef.value.removeEventListener('scroll', updateDragEnd)

  const startX = Math.min(dragStartGlobal.value.x, dragEndGlobal.value.x)
  const startY = Math.min(dragStartGlobal.value.y, dragEndGlobal.value.y)
  const endX = Math.max(dragStartGlobal.value.x, dragEndGlobal.value.x)
  const endY = Math.max(dragStartGlobal.value.y, dragEndGlobal.value.y)

  const cards = contentRef.value.querySelectorAll('.audio-card')
  const newSelected = []
  cards.forEach((card) => {
    const cardLeft = card.offsetLeft
    const cardTop = card.offsetTop
    const cardRight = cardLeft + card.offsetWidth
    const cardBottom = cardTop + card.offsetHeight
    if (cardLeft < endX && cardRight > startX && cardTop < endY && cardBottom > startY) {
      const audioId = card.getAttribute('data-audio-id')
      if (audioId) {
        newSelected.push(audioId)
      }
    }
  })
  if (newSelected.length > 0) {
    justBoxSelected = true
    if (e.ctrlKey || e.metaKey) {
      selectedIds.value = [...new Set([...selectedIds.value, ...newSelected])]
    } else {
      selectedIds.value = newSelected
    }
    isMultiSelect.value = true
  } else if (!(e.ctrlKey || e.metaKey)) {
    justBoxSelected = true
    clearSelection()
  }
}

function handleProgressClick(audio, e) {
  if (!wavesurfer || playingId.value !== audio.id) return
  const rect = e.currentTarget.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  wavesurfer.seekTo(Math.max(0, Math.min(1, percent)))
}

function getWaveColors() {
  const styles = getComputedStyle(document.documentElement)
  const waveColor = styles.getPropertyValue('--text-3').trim() || 'rgba(255, 255, 255, 0.3)'
  const progressColor = styles.getPropertyValue('--text-1').trim() || 'rgba(255, 255, 255, 0.9)'
  return { waveColor, progressColor }
}

async function togglePlay(audio) {
  if (playingId.value === audio.id) {
    if (wavesurfer) {
      if (isPlaying.value) {
        wavesurfer.pause()
      } else {
        wavesurfer.play()
      }
    }
    return
  }

  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }

  playingId.value = audio.id
  isPlaying.value = false
  currentTime.value = 0
  duration.value = audio.duration || 0

  try {
    const src = await window.api.audios.read(audio.id, audio.fileName)
    if (!src) {
      ElMessage.error('无法读取音频文件')
      playingId.value = null
      return
    }

    await nextTick()
    const container = waveContainers[audio.id]
    if (!container) {
      ElMessage.error('无法找到播放容器')
      playingId.value = null
      return
    }

    const { waveColor, progressColor } = getWaveColors()

    wavesurfer = WaveSurfer.create({
      container: container,
      waveColor: waveColor,
      progressColor: progressColor,
      url: src,
      height: 40,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
    })

    wavesurfer.setVolume(volume.value)
    wavesurfer.setPlaybackRate(playbackRate.value)

    wavesurfer.on('timeupdate', (t) => {
      currentTime.value = t
      if (isLooping.value && duration.value > 0 && t >= duration.value - 0.1) {
        setTimeout(() => {
          if (wavesurfer) {
            wavesurfer.seekTo(0)
            wavesurfer.play()
          }
        }, 100)
      }
    })

    wavesurfer.on('ready', () => {
      duration.value = wavesurfer.getDuration()
      wavesurfer.play()
    })

    wavesurfer.on('play', () => {
      isPlaying.value = true
    })

    wavesurfer.on('pause', () => {
      isPlaying.value = false
    })

    wavesurfer.on('ended', () => {
      if (!isLooping.value) {
        isPlaying.value = false
        currentTime.value = 0
        wavesurfer.seekTo(0)
      }
    })

    wavesurfer.on('error', () => {
      playingId.value = null
      isPlaying.value = false
      ElMessage.error('播放失败')
    })
  } catch (e) {
    console.error('播放失败:', e)
    playingId.value = null
    isPlaying.value = false
    ElMessage.error(e.message || '播放失败')
  }
}

function handleVolumeChange(val) {
  volume.value = val
  if (wavesurfer) {
    wavesurfer.setVolume(val)
  }
}

function handleRateChange(val) {
  playbackRate.value = val
  if (wavesurfer) {
    wavesurfer.setPlaybackRate(val)
  }
}

function toggleLoop() {
  isLooping.value = !isLooping.value
  console.log('[AudioLoop] toggleLoop called, isLooping:', isLooping.value)
}

onMounted(() => {
  loadAudios()
})

onUnmounted(() => {
  if (wavesurfer) {
    wavesurfer.destroy()
    wavesurfer = null
  }
})
</script>

<template>
  <div class="home">
    <header class="topbar">
      <div class="topbar-left">
        <el-dropdown trigger="click" @command="handleLibCommand">
          <span class="lib-name iconfont">
            &#xeb1a; {{ state.library?.name || t('sidebar.audio') }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="create">{{ t('init.create') }}</el-dropdown-item>
              <el-dropdown-item command="switch">{{ t('init.switchLibrary') }}</el-dropdown-item>
              <el-dropdown-item command="close">{{ t('init.closeLibrary') }}</el-dropdown-item>
              <el-dropdown-item command="rename" divided>{{ t('init.rename') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="topbar-center">
        <el-input
          v-model="keyword"
          :placeholder="t('audio.searchPlaceholder')"
          clearable
          size="large"
          class="search-input"
        >
          <template #prefix>
            <i class="iconfont icon-search"></i>
          </template>
        </el-input>
      </div>
      <div class="topbar-right">
        <el-popover trigger="click" placement="bottom" :width="240">
          <template #reference>
            <el-button type="primary" :title="t('common.previewSize')">
              <i class="iconfont">&#xeb56;</i>
            </el-button>
          </template>
          <div style="padding: 8px 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
              <span style="font-size: 13px; color: var(--text-2);">{{ t('common.previewSize') }}</span>
              <span style="font-size: 13px; font-weight: 600; color: var(--el-color-primary);">{{ previewSize }}</span>
            </div>
            <el-slider v-model="previewSize" :min="1" :max="10" :step="1" @change="onPreviewSizeChange" />
          </div>
        </el-popover>
        <el-popover trigger="click" placement="bottom" :width="200">
          <template #reference>
            <el-button type="primary" :title="t('common.displayFields')">
              <i class="iconfont">&#xeb14;</i>
            </el-button>
          </template>
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 4px;">
            <el-checkbox v-model="allFieldsSelected" :indeterminate="isIndeterminate" @change="onSelectAll">{{ t('common.selectAll') }}</el-checkbox>
            <div style="border-bottom: 1px solid var(--border-soft); margin: 4px 0;"></div>
            <el-checkbox v-model="displaySettings.name" @change="onDisplayChange">{{ t('common.name') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.tags" @change="onDisplayChange">{{ t('common.tags') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.duration" @change="onDisplayChange">{{ t('audio.duration') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fileSize" @change="onDisplayChange">{{ t('common.fileSize') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.uploadTime" @change="onDisplayChange">{{ t('common.uploadTime') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fileType" @change="onDisplayChange">{{ t('common.format') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.sampleRate" @change="onDisplayChange">{{ t('audio.sampleRate') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.channels" @change="onDisplayChange">{{ t('audio.channels') }}</el-checkbox>
          </div>
        </el-popover>
        <el-dropdown trigger="click" popper-class="sort-popper" @command="handleSortCommand">
          <el-button type="primary">
            <i class="iconfont icon-sort"></i>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="asc" :class="{ 'is-active': sortDir === 'asc' }">{{ t('common.sort') }} A-Z</el-dropdown-item>
              <el-dropdown-item command="desc" :class="{ 'is-active': sortDir === 'desc' }">{{ t('common.sort') }} Z-A</el-dropdown-item>
              <el-dropdown-item divided command="uploadTime" :class="{ 'is-active': sortBy === 'uploadTime' }">{{ t('common.uploadTime') }}</el-dropdown-item>
              <el-dropdown-item command="fileSize" :class="{ 'is-active': sortBy === 'fileSize' }">{{ t('common.fileSize') }}</el-dropdown-item>
              <el-dropdown-item command="name" :class="{ 'is-active': sortBy === 'name' }">{{ t('common.name') }}</el-dropdown-item>
              <el-dropdown-item command="duration" :class="{ 'is-active': sortBy === 'duration' }">{{ t('audio.duration') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-dropdown trigger="hover" @command="handleUploadCommand">
          <el-button type="primary" @click="handleUpload">
            <i class="iconfont icon-cloud-upload"></i>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="single">{{ t('home.singleUpload') }}</el-dropdown-item>
              <el-dropdown-item command="batch">{{ t('home.batchUpload') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <div class="filter-bar">
      <div class="filter-left">
        <el-select v-model="selectedTags" multiple :placeholder="t('home.tagsPlaceholder')" class="filter-select">
          <template #default>
            <el-option v-for="tag in allTagsInUse" :key="tag.name" :value="tag.name">
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <span>
                  <span style="font-family: 'iconfont'; margin-right: 6px;">&#xeb2a;</span>
                  <span>{{ tag.name }}</span>
                </span>
                <span style="color: var(--text-3); font-size: 12px;">{{ tag.count }}</span>
              </div>
            </el-option>
          </template>
        </el-select>

        <el-select v-model="selectedFormats" multiple :placeholder="t('home.formatsPlaceholder')" class="filter-select">
          <template #default>
            <el-option v-for="fmt in allFormatsInUse" :key="fmt.name" :value="fmt.name">
              <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <span>
                  <span style="font-family: 'iconfont'; margin-right: 6px;">&#xeb13;</span>
                  <span>{{ fmt.name.toUpperCase() }}</span>
                </span>
                <span style="color: var(--text-3); font-size: 12px;">{{ fmt.count }}</span>
              </div>
            </el-option>
          </template>
        </el-select>
      </div>
      <div class="filter-right">
        <div class="batch-actions">
          <span class="selected-count">{{ selectedIds.length === 0 ? t('common.unselected') : t('common.selected') + ' ' + selectedIds.length }}</span>
          <el-button text @click="selectAll">{{ t('home.selectAll') }}</el-button>
          <el-button text @click="selectInverse">{{ t('home.selectInverse') }}</el-button>
          <el-button text @click="clearSelection" :disabled="selectedIds.length === 0">{{ t('common.cancel') }}</el-button>
          <el-button text @click="handleBatchAddTag" :disabled="selectedIds.length === 0"><i class="iconfont icon-tag"></i> {{ t('home.addTag') }}</el-button>
          <el-button text type="danger" @click="handleBatchDelete" :disabled="selectedIds.length === 0">
            <i class="iconfont icon-trash-alt"></i> {{ t('common.delete') }}
          </el-button>
        </div>
      </div>
    </div>

    <main class="content"
          ref="contentRef"
          @click="handleContentClick"
          @mousedown="handleMouseDown"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop">
      <div v-if="filteredAudios.length" class="audio-list">
        <div
          v-for="audio in filteredAudios"
          :key="audio.id"
          class="audio-card"
          :class="{ selected: isSelected(audio.id), 'is-dragging': isDragging }"
          :data-audio-id="audio.id"
          @click="handleSelect(audio, $event)"
          @dblclick="handleDblClick(audio)"
        >
          <div class="audio-top">
            <div class="audio-play-btn" @click.stop="togglePlay(audio)" @dblclick.stop>
              <i class="iconfont" v-if="playingId === audio.id && isPlaying">&#xeb4b;</i>
              <i class="iconfont" v-else>&#xeb4d;</i>
            </div>
            <div v-if="displaySettings.name" class="audio-name" :title="audio.name || audio.fileName">{{ audio.name || audio.fileName }}</div>
          </div>
          <div class="audio-waveform" v-if="playingId === audio.id">
            <div :ref="el => { if (el) waveContainers[audio.id] = el }" class="wave-container" @click="handleProgressClick(audio, $event)" @dblclick.stop></div>
            <span class="progress-time">{{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}</span>
          </div>
          <div class="audio-controls" v-if="playingId === audio.id" @dblclick.stop>
            <div class="control-item">
              <div class="volume-control">
                <span class="control-text">音量</span>
                <el-slider
                  v-model="volume"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  :show-tooltip="false"
                  class="volume-slider"
                  @input="handleVolumeChange"
                  @click.stop
                  @mousedown.stop
                />
              </div>
            </div>
            <div class="control-item">
              <el-select v-model="playbackRate" size="small" class="rate-select" @change="handleRateChange" @click.stop>
                <el-option :value="0.5" label="0.5x" />
                <el-option :value="0.75" label="0.75x" />
                <el-option :value="1" label="1x" />
                <el-option :value="1.25" label="1.25x" />
                <el-option :value="1.5" label="1.5x" />
                <el-option :value="2" label="2x" />
              </el-select>
            </div>
            <div class="control-item">
              <button
                class="loop-btn"
                :class="{ active: isLooping }"
                @click.stop="toggleLoop"
                @dblclick.stop
                :title="isLooping ? '取消循环' : '循环播放'"
              >
                <span class="iconfont loop-icon">&#xeb54;</span>
              </button>
            </div>
          </div>
          <div v-if="displaySettings.fileType || displaySettings.duration || displaySettings.fileSize || displaySettings.channels || displaySettings.sampleRate" class="audio-meta">
            <span v-if="displaySettings.fileType" class="file-type-tag">
              <i class="iconfont icon-file"></i>
              {{ (audio.fileType || '').toUpperCase() }}
            </span>
            <span v-if="displaySettings.duration">{{ formatDuration(audio.duration) }}</span>
            <span v-if="displaySettings.fileSize">{{ formatSize(audio.fileSize) }}</span>
            <span v-if="displaySettings.channels && audio.channels">{{ audio.channels }}ch</span>
            <span v-if="displaySettings.sampleRate && audio.sampleRate">{{ audio.sampleRate / 1000 }}kHz</span>
          </div>
          <div v-if="displaySettings.tags && audio.tags && audio.tags.length" class="audio-tags">
            <el-tag
              v-for="t in audio.tags.slice(0, 4)"
              :key="t"
              size="small"
            >
              <span style="font-family: 'iconfont'; margin-right: 4px;">&#xeb2a;</span>
              {{ t }}
            </el-tag>
            <span v-if="audio.tags.length > 4" class="more">+{{ audio.tags.length - 4 }}</span>
          </div>
        </div>
      </div>
      <el-empty v-else :description="audios.length === 0 ? t('audio.empty') : t('common.noMatch')" />

      <div
        v-if="showSelectionBox"
        class="selection-box"
        :style="{
          left: Math.min(dragStartGlobal.x, dragEndGlobal.x) + 'px',
          top: Math.min(dragStartGlobal.y, dragEndGlobal.y) + 'px',
          width: Math.abs(dragEndGlobal.x - dragStartGlobal.x) + 'px',
          height: Math.abs(dragEndGlobal.y - dragStartGlobal.y) + 'px'
        }"
      />
    </main>

    <el-dialog v-model="dragBatchVisible" title="拖拽上传中" width="480px" :close-on-click-modal="false" :close-on-press-escape="false" :show-close="false">
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px;">
        <i class="iconfont icon-sync is-loading" style="font-size: 24px; color: var(--primary);"></i>
        <span style="font-size: 14px; color: var(--text-2);">正在上传...</span>
      </div>
    </el-dialog>

    <!-- 拖拽上传蒙版 -->
    <div v-if="isDragOver" class="drag-overlay">
      <div class="drag-overlay-content">
        <i class="iconfont icon-cloud-upload"></i>
        <p>{{ t('common.dropHere') }}</p>
        <p class="drag-overlay-formats">MP3 · WAV · OGG · FLAC · AAC · M4A</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
}
.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.topbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
  padding: 0 20px;
}
.lib-name {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  outline: none;
  border-radius: 4px;
  transition: background 0.2s;
}
.lib-name:hover {
  background: var(--el-fill-color-light);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.search-input {
  width: 400px;
}
.search-input :deep(.el-input__prefix .iconfont) {
  font-size: 14px;
}
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 24px;
  border-bottom: 1px solid var(--border-soft);
  flex-shrink: 0;
  min-height: 40px;
}
.filter-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-select {
  width: 160px;
}
.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--primary-soft);
  border-radius: 6px;
  border: 1px solid var(--primary);
}
.selected-count {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  background: var(--primary);
  color: white;
  border-radius: 10px;
}
.content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px 32px;
  position: relative;
}
.audio-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.audio-card {
  padding: 12px 16px;
  background: var(--bg-soft);
  border-radius: 8px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, min-height 0.2s;
  min-height: v-bind(cardHeight + 'px');
}
.audio-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.audio-card.selected {
  border-color: var(--primary);
}
.audio-top {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.audio-play-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  cursor: pointer;
}
.audio-play-btn .iconfont {
  font-size: 26px;
  color: var(--text-2);
  transition: color 0.2s;
}
.audio-play-btn:hover .iconfont {
  color: var(--el-color-primary);
}
.audio-name {
  flex: 1;
  font-size: 14px;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.audio-waveform {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  padding-left: 48px;
}
.wave-container {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}
.progress-time {
  font-size: 11px;
  color: var(--text-3);
  min-width: 80px;
  text-align: right;
  white-space: nowrap;
}
.audio-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-left: 48px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.control-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}
.control-text {
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}
.volume-slider {
  width: 100px;
}
.rate-select {
  width: 80px;
}
.loop-btn {
  padding: 4px 12px;
  font-size: 12px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: all 0.2s;
}
.loop-btn:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.loop-btn.active {
  background: var(--primary);
  border-color: var(--primary);
  color: white;
}
.loop-icon {
  font-size: 16px;
}
.file-type-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: 11px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 4px;
  letter-spacing: 0.5px;
  backdrop-filter: blur(6px);
}
.file-type-tag .iconfont {
  font-size: 12px;
}
.audio-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-3);
  padding-left: 48px;
}
.audio-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 48px;
  margin-top: 8px;
}
.more {
  font-size: 11px;
  color: var(--text-3);
  padding: 1px 4px;
}
.selection-box {
  position: absolute;
  border: 2px dashed var(--primary);
  background: var(--primary-soft);
  pointer-events: none;
  z-index: 100;
}

/* 拖拽上传蒙版 */
.drag-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.drag-overlay-content {
  text-align: center;
  color: #fff;
}
.drag-overlay-content .iconfont {
  font-size: 64px;
  color: var(--primary);
  display: block;
  margin-bottom: 16px;
}
.drag-overlay-content p {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
}
.drag-overlay-formats {
  font-size: 13px !important;
  font-weight: 400 !important;
  margin-top: 8px !important;
  opacity: 0.7;
}
</style>

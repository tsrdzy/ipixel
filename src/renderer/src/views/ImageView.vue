<script setup>
import { ref, computed, onMounted, defineComponent, watchEffect, h, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { useStore } from '../composables/useStore'
import { useImageState } from '../composables/useImageState'
import { useDragUpload } from '../composables/useDragUpload'
import { useResourceShortcuts } from '../composables/useResourceShortcuts'
import { useSettingsStore } from '../stores/settings'

const router = useRouter()
const settingsStore = useSettingsStore()
const { state, switchLibrary, renameLibrary, saveSettings, closeLibrary } = useStore()
const { setPendingUpload, setEditingImage } = useImageState()
const { t } = useI18n()

// ====== 状态 ======
const images = ref([])
const keyword = ref('')
const sortBy = ref('uploadTime')
const sortDir = ref('desc')
const selectedTags = ref([])
const selectedColors = ref([])
const selectedFormats = ref([])
const selectedColorPicker = ref('')
const colorTolerance = ref(50)
const colorPickerVisible = ref(false)
const tempColorPicker = ref('')
const tempColorTolerance = ref(50)
const showColorClear = ref(false)
const selectedIds = ref([])
const isMultiSelect = ref(false)
const previewSize = ref(state.library?.settings?.imagePreviewSize || 5)
const gridMinWidth = computed(() => 100 + (previewSize.value - 1) * 30) // 100px ~ 370px
const displaySettings = reactive(state.library?.settings?.imageDisplay || { name: true, tags: true, dimensions: true, fileSize: true, uploadTime: true, fileType: true, colors: true })

function onPreviewSizeChange() {
  saveSettings({ imagePreviewSize: previewSize.value })
}
function onDisplayChange() {
  saveSettings({ imageDisplay: { ...displaySettings } })
}
function confirmColorFilter() {
  selectedColorPicker.value = tempColorPicker.value
  colorTolerance.value = tempColorTolerance.value
  colorPickerVisible.value = false
}
function cancelColorFilter() {
  tempColorPicker.value = selectedColorPicker.value
  tempColorTolerance.value = colorTolerance.value
}
function clearColorPicker() {
  selectedColorPicker.value = ''
  colorTolerance.value = 50
}
function openColorPicker() {
  tempColorPicker.value = selectedColorPicker.value
  tempColorTolerance.value = colorTolerance.value
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
const anchorId = ref(null)
const loading = ref(false)
const showScrollTop = ref(false)

// 框选相关
const isDragging = ref(false)
const dragStartGlobal = ref({ x: 0, y: 0 })
const dragEndGlobal = ref({ x: 0, y: 0 })
const contentRef = ref(null)
const showSelectionBox = ref(false)
let lastMouseX = 0
let lastMouseY = 0

// ====== 32 色调色板 ======
const COLOR_HEX = {
  black: '#000000', white: '#ffffff', gray: '#808080', darkgray: '#404040', lightgray: '#c0c0c0',
  red: '#ff0000', darkred: '#8b0000', coral: '#ff7f50', salmon: '#fa8072',
  orange: '#ffa500', gold: '#ffd700', yellow: '#ffff00', khaki: '#f0e68c',
  green: '#00ff00', darkgreen: '#006400', lime: '#80ff00', olive: '#808000',
  teal: '#008080', turquoise: '#40e0d0', cyan: '#00ffff',
  blue: '#0000ff', darkblue: '#00008b', navy: '#000080', indigo: '#4b0082',
  purple: '#800080', violet: '#ee82ee', magenta: '#ff00ff', plum: '#dda0dd',
  pink: '#ffc0cb', brown: '#8b4513', silver: '#c0c0c0', orchid: '#da70d6'
}

// ====== 异步图片缩略图子组件 ======
const ImageThumb = defineComponent({
  props: { image: { type: Object, required: true } },
  setup(props) {
    const src = ref('')
    watchEffect(async () => {
      try {
        const s = await window.api.images.read(props.image.id, props.image.fileName)
        src.value = s || ''
      } catch {
        src.value = ''
      }
    })
    return () => {
      if (!src.value) return h('div', { class: 'thumb-placeholder' }, '—')
      const isPixelArt = props.image.width < 512 || props.image.height < 512
      return h('img', {
        src: src.value,
        class: ['thumb-img', { 'thumb-img-pixel': isPixelArt }],
        draggable: false
      })
    }
  }
})

// ====== 计算属性 ======
const allTagsInUse = computed(() => {
  const map = new Map()
  images.value.forEach((img) => {
    img.tags && img.tags.forEach((tag) => {
      map.set(tag, (map.get(tag) || 0) + 1)
    })
  })
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
})

// 主色和辅色合并统计
const allColorsInUse = computed(() => {
  const map = new Map()
  images.value.forEach((img) => {
    if (img.dominantColor) {
      map.set(img.dominantColor, (map.get(img.dominantColor) || 0) + 1)
    }
    if (img.secondaryColor && img.secondaryColor !== img.dominantColor) {
      map.set(img.secondaryColor, (map.get(img.secondaryColor) || 0) + 1)
    }
  })
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
})

const allFormatsInUse = computed(() => {
  const map = new Map()
  images.value.forEach((img) => {
    if (img.fileType) {
      const fmt = img.fileType.toLowerCase()
      map.set(fmt, (map.get(fmt) || 0) + 1)
    }
  })
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name))
})

const filteredImages = computed(() => {
  let list = images.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    list = list.filter((img) =>
      (img.name || '').toLowerCase().includes(kw) ||
      (img.fileName || '').toLowerCase().includes(kw)
    )
  }
  if (selectedTags.value.length > 0) {
    list = list.filter((img) =>
      img.tags && selectedTags.value.some((tag) => img.tags.includes(tag))
    )
  }
  // 颜色筛选：主色或辅色匹配即可，支持颜色选择器范围匹配
  if (selectedColors.value.length > 0 || selectedColorPicker.value) {
    list = list.filter((img) => {
      const colorMatches = (selectedColors.value.includes(img.dominantColor) ||
        selectedColors.value.includes(img.secondaryColor))
      if (colorMatches) return true
      
      if (selectedColorPicker.value) {
        const targetRgb = hexToRgb(selectedColorPicker.value)
        if (targetRgb) {
          return colorMatchesRange(img.dominantColor, targetRgb, colorTolerance.value) ||
                 colorMatchesRange(img.secondaryColor, targetRgb, colorTolerance.value)
        }
      }
      return false
    })
  }
  if (selectedFormats.value.length > 0) {
    list = list.filter((img) => selectedFormats.value.includes((img.fileType || '').toLowerCase()))
  }
  list = [...list].sort((a, b) => {
    let cmp = 0
    if (sortBy.value === 'name') {
      cmp = (a.name || '').localeCompare(b.name || '')
    } else if (sortBy.value === 'fileSize') {
      cmp = (a.fileSize || 0) - (b.fileSize || 0)
    } else if (sortBy.value === 'uploadTime') {
      cmp = new Date(a.uploadTime || 0).getTime() - new Date(b.uploadTime || 0).getTime()
    } else if (sortBy.value === 'width') {
      cmp = (a.width || 0) - (b.width || 0)
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })
  return list
})

// ====== 工具函数 ======
function parseRgb(colorStr) {
  const match = colorStr.match(/rgb\((\d+),(\d+),(\d+)\)/)
  if (match) {
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) }
  }
  return null
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null
}

function colorMatchesRange(colorStr, targetRgb, tolerance = 10) {
  const color = parseRgb(colorStr)
  if (!color) return false
  return Math.abs(color.r - targetRgb.r) <= tolerance &&
         Math.abs(color.g - targetRgb.g) <= tolerance &&
         Math.abs(color.b - targetRgb.b) <= tolerance
}

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

// ====== 资源库名字下拉菜单命令处理（与 HomeView 一致） ======
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

// ====== 加载图片列表 ======
async function loadImages() {
  loading.value = true
  images.value = []
  const loadingInstance = ElLoading.service({
    target: contentRef.value,
    text: t('common.loading'),
    background: 'rgba(255, 255, 255, 0.8)'
  })
  try {
    const list = await window.api.images.list()
    images.value = list || []
  } catch (e) {
    console.error('加载图片列表失败:', e)
    ElMessage.error(t('common.loadFailed'))
  } finally {
    loadingInstance.close()
    loading.value = false
  }
}

// ====== 上传图片（先进入详情页，在详情页内选择文件） ======
function handleUpload() {
  setPendingUpload({ new: true })
}

// ====== 批量上传 ======
async function handleBatchUpload() {
  try {
    const result = await window.api.images.batchUpload()
    if (!result) return
    let success = 0
    let dup = 0
    for (const item of result.items) {
      if (item.duplicate) {
        dup++
      } else if (item.meta) {
        await window.api.images.save(item.meta)
        success++
      }
    }
    ElMessage.success(`${t('common.success')}: ${success}, ${t('image.duplicate')}: ${dup}`)
    await loadImages()
  } catch (e) {
    console.error('批量上传失败:', e)
    ElMessage.error(e.message || t('common.failed'))
  }
}

// ====== 拖拽上传 ======
const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'bmp', 'webp', 'gif', 'tga']

const dragBatchVisible = ref(false)
const dragBatchProgress = ref(0)
const dragBatchCurrent = ref(0)
const dragBatchTotal = ref(0)
const dragBatchFileName = ref('')

async function handleDragUpload(filePaths) {
  dragBatchVisible.value = true
  dragBatchProgress.value = 0
  dragBatchCurrent.value = 0
  dragBatchTotal.value = 0
  dragBatchFileName.value = ''

  let unsubscribe = null
  unsubscribe = window.api.images.onBatchUploadProgress((data) => {
    dragBatchProgress.value = Math.round((data.current / data.total) * 100)
    dragBatchCurrent.value = data.current
    dragBatchTotal.value = data.total
    dragBatchFileName.value = data.fileName
  })

  try {
    const result = await window.api.images.batchUploadByPaths(filePaths)
    if (!result) return
    if (result.invalidFormat) {
      ElMessage.warning(t('common.invalidFormat', { formats: IMAGE_EXTS.join(', ').toUpperCase() }))
      return
    }
    let success = 0
    let dup = 0
    for (const item of result.items) {
      if (item.duplicate) {
        dup++
      } else if (item.meta) {
        await window.api.images.save(item.meta)
        success++
      }
    }
    ElMessage.success(`${t('common.success')}: ${success}, ${t('image.duplicate')}: ${dup}`)
    await loadImages()
  } catch (e) {
    console.error('拖拽上传失败:', e)
    ElMessage.error(e.message || t('common.failed'))
  } finally {
    if (unsubscribe) unsubscribe()
    dragBatchVisible.value = false
  }
}

const { isDragOver, onDragEnter, onDragOver, onDragLeave, onDrop } = useDragUpload({
  extensions: IMAGE_EXTS,
  typeLabel: t('sidebar.image'),
  onUpload: handleDragUpload
})

function isSelected(id) {
  const idStr = String(id)
  return selectedIds.value.some((sid) => String(sid) === idStr)
}

function toggleSelect(img) {
  const imgId = String(img.id)
  const idx = selectedIds.value.findIndex((sid) => String(sid) === imgId)
  if (idx === -1) {
    selectedIds.value.push(img.id)
  } else {
    selectedIds.value.splice(idx, 1)
  }
  isMultiSelect.value = selectedIds.value.length > 0
}

function handleSelect(img, e) {
  const event = e || window.event
  if (!event) {
    selectedIds.value = [img.id]
    isMultiSelect.value = true
    anchorId.value = String(img.id)
    return
  }

  const imgId = String(img.id)

  if (event.ctrlKey || event.metaKey) {
    toggleSelect(img)
    if (!anchorId.value) {
      anchorId.value = imgId
    }
  } else if (event.shiftKey) {
    const list = filteredImages.value
    const currentIdx = list.findIndex((i) => String(i.id) === imgId)
    if (currentIdx === -1) return

    if (!anchorId.value || selectedIds.value.length === 0) {
      anchorId.value = imgId
      selectedIds.value = [img.id]
      isMultiSelect.value = true
    } else {
      const anchorIdx = list.findIndex((i) => String(i.id) === anchorId.value)
      if (anchorIdx === -1) {
        anchorId.value = imgId
        selectedIds.value = [img.id]
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
    selectedIds.value = [img.id]
    isMultiSelect.value = true
    anchorId.value = imgId
  }
}

function handleDblClick(img) {
  if (selectedIds.value.length === 0 || selectedIds.value.length === 1 && selectedIds.value[0] === img.id) {
    setEditingImage(img)
  }
}

function clearSelection() {
  selectedIds.value = []
  isMultiSelect.value = false
  anchorId.value = null
}

function selectAll() {
  const list = filteredImages.value
  selectedIds.value = list.map((img) => img.id)
  isMultiSelect.value = selectedIds.value.length > 0
  if (selectedIds.value.length > 0) {
    anchorId.value = String(list[0].id)
  }
}

function selectInverse() {
  const list = filteredImages.value
  const allIds = new Set(list.map((img) => String(img.id)))
  const selectedSet = new Set(selectedIds.value.map((id) => String(id)))
  const inverseIds = []
  allIds.forEach((id) => {
    if (!selectedSet.has(id)) {
      const img = list.find((i) => String(i.id) === id)
      if (img) inverseIds.push(img.id)
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
      `${t('common.delete')} ${selectedIds.value.length} ${t('image.items')}？`,
      t('common.delete'),
      { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') }
    )
    for (const id of selectedIds.value) {
      await window.api.images.delete(id)
    }
    ElMessage.success(t('common.success'))
    selectedIds.value = []
    isMultiSelect.value = false
    anchorId.value = null
    await loadImages()
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
      const img = images.value.find((i) => i.id === id)
      if (img) {
        if (!img.tags) img.tags = []
        if (!img.tags.includes(tag)) {
          img.tags.push(tag)
          try {
            const patch = { tags: [...img.tags] }
            await window.api.images.update(String(id), patch)
          } catch (e) {
            console.error('批量添加标签失败:', id, e)
          }
        }
      }
    }
    await loadImages()
    ElMessage.success(t('home.tagsAdded', { count: selectedIds.value.length }))
  } catch (e) {
    // 用户取消
  }
}

async function handleExport() {
  if (selectedIds.value.length === 0) return
  try {
    const ids = [...selectedIds.value]
    const result = await window.api.images.export(ids)
    if (result) {
      ElMessage.success(t('common.export', { count: result.count, dir: result.dir }))
    }
  } catch (e) {
    console.error('导出失败:', e)
    ElMessage.error(t('common.failed'))
  }
}

async function handleSingleAddTag(img) {
  try {
    const { value } = await ElMessageBox.prompt(t('home.enterTag'), t('home.addTag'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      inputValidator: (v) => (v && v.trim() ? true : t('home.enterTag'))
    })
    const tag = value.trim()
    if (!img.tags) img.tags = []
    if (!img.tags.includes(tag)) {
      img.tags.push(tag)
      await window.api.images.update(String(img.id), { tags: [...img.tags] })
      await loadImages()
      ElMessage.success(t('common.success'))
    }
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
  if (e.target === contentRef.value || e.target.closest('.content') === contentRef.value && !e.target.closest('.image-card')) {
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
  if (e.button === 2) return
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

  const cards = contentRef.value.querySelectorAll('.image-card')
  const newSelected = []
  cards.forEach((card) => {
    const cardLeft = card.offsetLeft
    const cardTop = card.offsetTop
    const cardRight = cardLeft + card.offsetWidth
    const cardBottom = cardTop + card.offsetHeight
    if (cardLeft < endX && cardRight > startX && cardTop < endY && cardBottom > startY) {
      const imgId = card.getAttribute('data-image-id')
      if (imgId) {
        newSelected.push(imgId)
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

// ====== 删除图片 ======
async function handleDelete(img) {
  try {
    await ElMessageBox.confirm(t('image.confirmDelete'), t('common.delete'), {
      type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel')
    })
    await window.api.images.delete(img.id)
    ElMessage.success(t('common.success'))
    await loadImages()
  } catch (e) {
    // 用户取消或出错
  }
}

// ====== 排序命令 ======
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

// ====== 上传命令 ======
function handleUploadCommand(cmd) {
  if (cmd === 'single') handleUpload()
  else if (cmd === 'batch') handleBatchUpload()
}

const {
  contextMenuVisible,
  contextMenuPosition,
  contextMenuType,
  contextMenuItem,
  handleContextMenu,
  handleContextMenuCommand
} = useResourceShortcuts({
  filteredList: filteredImages,
  selectedIds,
  isMultiSelect,
  anchorId,
  contentRef,
  onSelectAll: selectAll,
  onClearSelection: clearSelection,
  onDelete: handleDelete,
  onBatchDelete: handleBatchDelete,
  onBatchAddTag: handleBatchAddTag,
  onExport: handleExport,
  onRefresh: loadImages,
  onOpenDetail: setEditingImage,
  onAddTag: handleSingleAddTag,
  getPreviewSize: () => previewSize.value,
  shortcuts: settingsStore.shortcuts
})

function handleScroll() {
  if (contentRef.value) {
    showScrollTop.value = contentRef.value.scrollTop > 200
  }
}

function scrollToTop() {
  if (contentRef.value) {
    contentRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  loadImages()
  if (contentRef.value) {
    contentRef.value.addEventListener('scroll', handleScroll)
  }
})
</script>

<template>
  <div class="home">
    <!-- 顶栏：标题、搜索、排序、上传 -->
    <header class="topbar">
      <div class="topbar-left">
        <el-dropdown trigger="click" @command="handleLibCommand">
          <span class="lib-name iconfont">
            &#xeb1a; {{ state.library?.name || t('sidebar.image') }}
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
          :placeholder="t('image.searchPlaceholder')"
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
            <el-checkbox v-model="displaySettings.dimensions" @change="onDisplayChange">{{ t('common.dimensions') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fileSize" @change="onDisplayChange">{{ t('common.fileSize') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.uploadTime" @change="onDisplayChange">{{ t('common.uploadTime') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fileType" @change="onDisplayChange">{{ t('common.format') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.colors" @change="onDisplayChange">{{ t('image.dominantColor') }}</el-checkbox>
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
              <el-dropdown-item command="width" :class="{ 'is-active': sortBy === 'width' }">{{ t('image.width') }}</el-dropdown-item>
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

    <!-- 筛选栏：标签、颜色、格式、多选操作 -->
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

        <el-popover 
          v-model:visible="colorPickerVisible"
          placement="bottom-start"
          width="370px"
          trigger="click"
          class="color-picker-popover"
          @show="openColorPicker"
          @hide="cancelColorFilter"
        >
          <template #reference>
            <div class="filter-select color-filter-btn" @mouseenter="showColorClear = true" @mouseleave="showColorClear = false">
              <span v-if="selectedColorPicker" class="color-preview" :style="{ background: selectedColorPicker }"></span>
              <span class="color-label">{{ selectedColorPicker ? '' : t('image.colorFilter') }}</span>
              <i v-if="showColorClear && selectedColorPicker" class="iconfont icon-close color-clear-btn" @click.stop="clearColorPicker"></i>
              <i class="iconfont icon-chevron-down"></i>
            </div>
          </template>
          <div class="color-picker-panel-wrapper">
            <el-color-picker-panel 
              v-model="tempColorPicker" 
              :show-alpha="false"
              @change="() => {}"
            />
            <div class="color-tolerance-wrapper">
              <span class="tolerance-label">{{ t('image.tolerance') }}</span>
              <el-input-number 
                v-model="tempColorTolerance" 
                :min="0" 
                :max="100" 
                :step="1"
                class="tolerance-input"
                size="small"
              />
            </div>
            <div class="color-picker-actions">
              <el-button size="small" type="primary" @click="confirmColorFilter">{{ t('common.confirm') }}</el-button>
            </div>
          </div>
        </el-popover>

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

    <!-- 图片网格 -->
    <main class="content"
          ref="contentRef"
          @click="handleContentClick"
          @mousedown="handleMouseDown"
          @dragenter="onDragEnter"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
          @contextmenu="handleContextMenu">
      <div v-if="filteredImages.length" class="grid">
        <div
          v-for="img in filteredImages"
          :key="img.id"
          class="image-card"
          :class="{ selected: isSelected(img.id), 'is-dragging': isDragging }"
          :data-image-id="img.id"
          @click="handleSelect(img, $event)"
          @dblclick="handleDblClick(img)"
        >
          <span v-if="displaySettings.fileType" class="file-type-badge">{{ (img.fileType || '').toUpperCase() }}</span>
          <div class="image-thumb">
            <ImageThumb :image="img" />
          </div>
          <div v-if="displaySettings.name || displaySettings.tags || displaySettings.dimensions || displaySettings.fileSize || displaySettings.colors" class="image-info">
            <div v-if="displaySettings.name" class="image-name" :title="img.name || img.fileName">{{ img.name || img.fileName }}</div>
            <div v-if="displaySettings.tags && img.tags && img.tags.length" class="image-tags">
              <el-tag
                v-for="t in img.tags.slice(0, 4)"
                :key="t"
                size="small"
              >
                <span style="font-family: 'iconfont'; margin-right: 4px;">&#xeb2a;</span>
                {{ t }}
              </el-tag>
              <span v-if="img.tags.length > 4" class="more">+{{ img.tags.length - 4 }}</span>
            </div>
            <div v-if="displaySettings.dimensions || displaySettings.fileSize" class="image-meta">
              <span v-if="displaySettings.dimensions">{{ img.width }}×{{ img.height }}</span>
              <span v-if="displaySettings.fileSize">{{ formatSize(img.fileSize) }}</span>
            </div>
            <div v-if="displaySettings.colors" class="image-colors">
              <span class="color-dot" :style="{ background: img.dominantColor || '#ccc' }" :title="img.dominantColor || ''"></span>
              <span class="color-dot" :style="{ background: img.secondaryColor || '#ccc' }" :title="img.secondaryColor || ''"></span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else :description="images.length === 0 ? t('image.empty') : t('common.noMatch')" />

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
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <el-progress :percentage="dragBatchProgress" :stroke-width="8" />
        <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-3);">
          <span>{{ dragBatchFileName }}</span>
          <span>{{ dragBatchCurrent }} / {{ dragBatchTotal }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- 拖拽上传蒙版 -->
    <div v-if="isDragOver" class="drag-overlay">
      <div class="drag-overlay-content">
        <i class="iconfont icon-cloud-upload"></i>
        <p>{{ t('common.dropHere') }}</p>
        <p class="drag-overlay-formats">PNG · JPG · JPEG · BMP · WEBP · GIF · TGA</p>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="context-menu"
        :style="{
          left: contextMenuPosition.x + 'px',
          top: contextMenuPosition.y + 'px'
        }"
        @click.stop
      >
        <div class="context-menu-list">
          <template v-if="contextMenuType === 'blank'">
            <div class="context-menu-item" @click="handleContextMenuCommand('select-all')">
              <span class="context-menu-icon">&#xeb39;</span>
              <span>{{ t('home.selectAll') }}</span>
            </div>
            <div class="context-menu-item" @click="handleContextMenuCommand('refresh')">
              <span class="context-menu-icon">&#xeb6d;</span>
              <span>{{ t('common.refresh') }}</span>
            </div>
          </template>
          <template v-else-if="contextMenuType === 'item'">
            <div class="context-menu-item" @click="handleContextMenuCommand('open-detail')">
              <span class="context-menu-icon">&#xeb58;</span>
              <span>{{ t('common.openDetail') }}</span>
            </div>
            <div class="context-menu-item" @click="handleContextMenuCommand('add-tag')">
              <span class="context-menu-icon">&#xeb2a;</span>
              <span>{{ t('home.addTag') }}</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item context-menu-item-danger" @click="handleContextMenuCommand('delete')">
              <span class="context-menu-icon">&#xe872;</span>
              <span>{{ t('common.delete') }}</span>
            </div>
          </template>
          <template v-else-if="contextMenuType === 'batch'">
            <div class="context-menu-item" @click="handleContextMenuCommand('batch-add-tag')">
              <span class="context-menu-icon">&#xeb2a;</span>
              <span>{{ t('home.batchAddTag') }} ({{ selectedIds.length }})</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item context-menu-item-danger" @click="handleContextMenuCommand('batch-delete')">
              <span class="context-menu-icon">&#xe872;</span>
              <span>{{ t('home.batchDelete') }} ({{ selectedIds.length }})</span>
            </div>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- 回到顶部按钮 -->
    <transition name="fade">
      <div
        v-if="showScrollTop"
        class="scroll-top-btn"
        @click="scrollToTop"
        :title="t('common.backToTop')"
      >
        <span class="iconfont">&#xe74a;</span>
      </div>
    </transition>
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
.color-filter-select {
  width: 160px;
}
.color-filter-btn {
  width: 160px;
  height: 32px;
  display: flex;
  align-items: center;
  padding: 0 11px;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  background: var(--el-fill-color-blank);
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-regular);
  transition: all 0.2s;
  box-sizing: border-box;
}
.color-filter-btn:hover {
  border-color: var(--el-border-color-hover);
}
.color-filter-btn:focus {
  outline: none;
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-9);
}
.color-filter-btn .color-preview {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-light);
  flex-shrink: 0;
}
.color-filter-btn .color-label {
  flex: 1;
  text-align: left;
  color: var(--el-text-color-placeholder);
  padding-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.color-filter-btn .color-clear-btn {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  padding: 0 4px;
  margin-left: 4px;
  flex-shrink: 0;
}
.color-filter-btn .color-clear-btn:hover {
  color: var(--el-text-color-regular);
}
.color-filter-btn .icon-chevron-down {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  margin-left: 4px;
}
.color-picker-popover :deep(.el-popover) {
  padding: 0;
}
.color-picker-panel-wrapper {
  padding: 8px;
}
.color-tolerance-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-soft);
}
.tolerance-label {
  font-size: 12px;
  color: var(--text-3);
  flex-shrink: 0;
}
.tolerance-input {
  flex: 1;
}
.color-picker-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-soft);
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(v-bind(gridMinWidth + 'px'), 1fr));
  gap: 16px;
}

/* 图片卡片 */
.image-card {
  background: var(--bg-soft);
  border-radius: 8px;
  border: 2px solid transparent;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
}
.image-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.image-card.selected {
  border-color: var(--primary);
}
.file-type-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  z-index: 1;
}
.image-thumb {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
}
.image-thumb :deep(.thumb-img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.image-thumb :deep(.thumb-img-pixel) {
  image-rendering: pixelated;
}
.image-thumb :deep(.thumb-placeholder) {
  color: var(--text-3);
  font-size: 24px;
}
.image-info {
  padding: 8px 10px;
}
.image-name {
  font-size: 13px;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 8px;
}
.image-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.more {
  font-size: 11px;
  color: var(--text-3);
  padding: 1px 4px;
}
.image-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-3);
  margin-bottom: 4px;
}
.image-colors {
  display: flex;
  gap: 4px;
}
.color-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1px solid var(--border-soft);
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

/* 右键菜单 */
.context-menu {
  position: fixed;
  z-index: 9999;
  background: var(--bg-soft);
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  min-width: 180px;
  overflow: hidden;
}
.context-menu-list {
  padding: 4px 0;
}
.context-menu-item {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
  color: var(--text-1);
  transition: background 0.15s;
}
.context-menu-item:hover {
  background: var(--bg-hover);
}
.context-menu-item-danger:hover {
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
}
.context-menu-icon {
  font-family: 'iconfont';
  margin-right: 8px;
  font-size: 14px;
}
.context-menu-divider {
  height: 1px;
  background: var(--border-soft);
  margin: 4px 0;
}

/* 回到顶部按钮 */
.scroll-top-btn {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 44px;
  height: 44px;
  background: var(--bg-soft);
  border: 1px solid var(--border-soft);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  transition: all 0.2s;
}
.scroll-top-btn:hover {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
}
.scroll-top-btn .iconfont {
  font-size: 18px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

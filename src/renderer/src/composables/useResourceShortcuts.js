import { ref, onMounted, onUnmounted } from 'vue'

export function useResourceShortcuts({
  filteredList,
  selectedIds,
  isMultiSelect,
  anchorId,
  contentRef,
  onSelectAll,
  onClearSelection,
  onDelete,
  onBatchDelete,
  onBatchAddTag,
  onExport,
  onRefresh,
  onOpenDetail,
  onAddTag,
  getPreviewSize = () => 5,
  shortcuts = {
    selectAll: { key: 'a', ctrl: true },
    delete: { key: 'Delete', ctrl: false },
    export: { key: 's', ctrl: true },
    arrowUp: { key: 'ArrowUp', ctrl: false },
    arrowDown: { key: 'ArrowDown', ctrl: false },
    arrowLeft: { key: 'ArrowLeft', ctrl: false },
    arrowRight: { key: 'ArrowRight', ctrl: false }
  }
}) {
  const contextMenuVisible = ref(false)
  const contextMenuPosition = ref({ x: 0, y: 0 })
  const contextMenuType = ref('')
  const contextMenuItem = ref(null)

  const gridCols = ref(5)

  function calculateGridCols() {
    if (!contentRef.value) return
    const cards = contentRef.value.querySelectorAll('.image-card, .audio-card, .font-card')
    if (cards.length < 2) {
      gridCols.value = 1
      return
    }
    const firstCard = cards[0]
    const secondCard = cards[1]
    const firstTop = firstCard.offsetTop
    let cols = 1
    for (let i = 1; i < cards.length; i++) {
      if (cards[i].offsetTop === firstTop) {
        cols++
      } else {
        break
      }
    }
    gridCols.value = Math.max(1, cols)
  }

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

    const ctrlPressed = e.ctrlKey || e.metaKey

    if (shortcuts.selectAll && e.key.toLowerCase() === shortcuts.selectAll.key.toLowerCase() && ctrlPressed === shortcuts.selectAll.ctrl) {
      e.preventDefault()
      onSelectAll()
      return
    }

    if (shortcuts.delete && e.key === shortcuts.delete.key && ctrlPressed === shortcuts.delete.ctrl) {
      e.preventDefault()
      if (selectedIds.value.length > 0) {
        onBatchDelete()
      }
      return
    }

    if (shortcuts.export && e.key.toLowerCase() === shortcuts.export.key.toLowerCase() && ctrlPressed === shortcuts.export.ctrl) {
      e.preventDefault()
      if (selectedIds.value.length > 0) {
        onExport()
      }
      return
    }

    if (shortcuts.arrowUp && e.key === shortcuts.arrowUp.key && ctrlPressed === shortcuts.arrowUp.ctrl) {
      e.preventDefault()
      handleArrowKey('ArrowUp')
      return
    }

    if (shortcuts.arrowDown && e.key === shortcuts.arrowDown.key && ctrlPressed === shortcuts.arrowDown.ctrl) {
      e.preventDefault()
      handleArrowKey('ArrowDown')
      return
    }

    if (shortcuts.arrowLeft && e.key === shortcuts.arrowLeft.key && ctrlPressed === shortcuts.arrowLeft.ctrl) {
      e.preventDefault()
      handleArrowKey('ArrowLeft')
      return
    }

    if (shortcuts.arrowRight && e.key === shortcuts.arrowRight.key && ctrlPressed === shortcuts.arrowRight.ctrl) {
      e.preventDefault()
      handleArrowKey('ArrowRight')
      return
    }
  }

  function handleArrowKey(key) {
    const list = filteredList.value
    if (list.length === 0) return

    if (selectedIds.value.length === 0) {
      selectedIds.value = [list[0].id]
      isMultiSelect.value = true
      anchorId.value = String(list[0].id)
      return
    }

    const currentId = selectedIds.value[selectedIds.value.length - 1]
    const currentIdx = list.findIndex(item => String(item.id) === String(currentId))
    if (currentIdx === -1) return

    calculateGridCols()
    const cols = gridCols.value

    let newIdx = currentIdx
    switch (key) {
      case 'ArrowUp':
        newIdx = currentIdx - cols
        break
      case 'ArrowDown':
        newIdx = currentIdx + cols
        break
      case 'ArrowLeft':
        newIdx = currentIdx - 1
        break
      case 'ArrowRight':
        newIdx = currentIdx + 1
        break
    }

    if (newIdx < 0) {
      newIdx = 0
    } else if (newIdx >= list.length) {
      newIdx = list.length - 1
    }

    if (key === 'ArrowRight' && (currentIdx + 1) % cols === 0 && currentIdx + cols < list.length) {
      newIdx = currentIdx + cols
    }

    selectedIds.value = [list[newIdx].id]
    isMultiSelect.value = true
    anchorId.value = String(list[newIdx].id)

    scrollToItem(newIdx)
  }

  function scrollToItem(idx) {
    if (!contentRef.value) return
    const cards = contentRef.value.querySelectorAll('.image-card, .audio-card, .font-card')
    const card = cards[idx]
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  function handleContextMenu(e) {
    e.preventDefault()

    const target = e.target
    const card = target.closest('.image-card, .audio-card, .font-card')

    if (card) {
      const itemId = card.getAttribute('data-image-id') || card.getAttribute('data-audio-id') || card.getAttribute('data-font-id')
      const item = filteredList.value.find(i => String(i.id) === itemId)
      if (item) {
        if (selectedIds.value.length > 1) {
          contextMenuType.value = 'batch'
        } else {
          contextMenuType.value = 'item'
        }
        contextMenuItem.value = item
      }
    } else {
      contextMenuType.value = 'blank'
      contextMenuItem.value = null
    }

    contextMenuPosition.value = { x: e.clientX, y: e.clientY }
    contextMenuVisible.value = true
  }

  function closeContextMenu() {
    contextMenuVisible.value = false
  }

  function handleContextMenuCommand(cmd) {
    closeContextMenu()

    switch (cmd) {
      case 'select-all':
        onSelectAll()
        break
      case 'refresh':
        onRefresh()
        break
      case 'open-detail':
        if (contextMenuItem.value) {
          onOpenDetail(contextMenuItem.value)
        }
        break
      case 'add-tag':
        if (contextMenuItem.value) {
          onAddTag(contextMenuItem.value)
        }
        break
      case 'delete':
        if (contextMenuItem.value) {
          onDelete(contextMenuItem.value)
        }
        break
      case 'batch-add-tag':
        if (onBatchAddTag) {
          onBatchAddTag()
        }
        break
      case 'batch-delete':
        if (onBatchDelete) {
          onBatchDelete()
        }
        break
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('click', closeContextMenu)
    if (contentRef.value) {
      calculateGridCols()
      window.addEventListener('resize', calculateGridCols)
    }
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
    document.removeEventListener('click', closeContextMenu)
    window.removeEventListener('resize', calculateGridCols)
  })

  return {
    contextMenuVisible,
    contextMenuPosition,
    contextMenuType,
    contextMenuItem,
    handleContextMenu,
    handleContextMenuCommand
  }
}
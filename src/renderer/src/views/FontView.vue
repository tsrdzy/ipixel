<script setup>import { ref, computed, onMounted, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useStore } from '../composables/useStore';
import { useFontState } from '../composables/useFontState';
const router = useRouter();
const { state, switchLibrary, renameLibrary, saveSettings } = useStore();
const { setPendingUpload, setEditingFont } = useFontState();
const { t } = useI18n();
const fonts = ref([]);
const keyword = ref('');
const sortBy = ref('uploadTime');
const sortDir = ref('desc');
const selectedTags = ref([]);
const selectedFormats = ref([]);
const selectedIds = ref([]);
const isMultiSelect = ref(false);
const anchorId = ref(null);
const loading = ref(false);
const previewSize = ref(state.library?.settings?.fontPreviewSize || 5);
const gridMinWidth = computed(() => 100 + (previewSize.value - 1) * 30);
const previewFontSizeTop = computed(() => 18 + (previewSize.value - 1) * 4);
const previewFontSizeBottom = computed(() => 26 + (previewSize.value - 1) * 6);
const displaySettings = reactive(state.library?.settings?.fontDisplay || { name: true, tags: true, fontFamily: true, fontWeight: true, fontStyle: true, fileSize: true, uploadTime: true, fileType: true });

function onPreviewSizeChange() {
  saveSettings({ fontPreviewSize: previewSize.value });
}
function onDisplayChange() {
  saveSettings({ fontDisplay: { ...displaySettings } });
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
function onSelectAll(val) {
  allFieldsSelected.value = val
}
const isDragging = ref(false);
const dragStartGlobal = ref({ x: 0, y: 0 });
const dragEndGlobal = ref({ x: 0, y: 0 });
const contentRef = ref(null);
const showSelectionBox = ref(false);
let lastMouseX = 0;
let lastMouseY = 0;
const fontPreviewRefs = ref({});
const allTagsInUse = computed(() => {
 const map = new Map();
 fonts.value.forEach((f) => {
 f.tags && f.tags.forEach((tag) => {
 map.set(tag, (map.get(tag) || 0) + 1);
 });
 });
 return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
});
const allFormatsInUse = computed(() => {
 const map = new Map();
 fonts.value.forEach((f) => {
 if (f.fileType) {
 const fmt = f.fileType.toLowerCase();
 map.set(fmt, (map.get(fmt) || 0) + 1);
 }
 });
 return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
});
const filteredFonts = computed(() => {
 let list = fonts.value;
 if (keyword.value) {
 const kw = keyword.value.toLowerCase();
 list = list.filter((f) =>
 (f.name || '').toLowerCase().includes(kw) ||
 (f.fileName || '').toLowerCase().includes(kw) ||
 (f.fontFamily || '').toLowerCase().includes(kw)
 );
 }
 if (selectedTags.value.length > 0) {
 list = list.filter((f) =>
 f.tags && selectedTags.value.some((tag) => f.tags.includes(tag))
 );
 }
 if (selectedFormats.value.length > 0) {
 list = list.filter((f) => selectedFormats.value.includes((f.fileType || '').toLowerCase()));
 }
 list = [...list].sort((a, b) => {
 let cmp = 0;
 if (sortBy.value === 'name') {
 cmp = (a.name || '').localeCompare(b.name || '');
 }
 else if (sortBy.value === 'fileSize') {
 cmp = (a.fileSize || 0) - (b.fileSize || 0);
 }
 else if (sortBy.value === 'fontFamily') {
 cmp = (a.fontFamily || '').localeCompare(b.fontFamily || '');
 }
 else if (sortBy.value === 'uploadTime') {
 cmp = new Date(a.uploadTime || 0).getTime() - new Date(b.uploadTime || 0).getTime();
 }
 return sortDir.value === 'asc' ? cmp : -cmp;
 });
 return list;
});
function formatSize(bytes) {
 if (!bytes)
 return '—';
 if (bytes < 1024)
 return bytes + ' B';
 if (bytes < 1024 * 1024)
 return (bytes / 1024).toFixed(1) + ' KB';
 return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function formatTime(time) {
 if (!time)
 return '—';
 return new Date(time).toLocaleString();
}
async function handleLibCommand(cmd) {
 if (cmd === 'switch') {
 switchLibrary();
 router.push('/model');
 }
 else if (cmd === 'rename') {
 try {
 const { value } = await ElMessageBox.prompt(t('init.libraryName'), t('init.rename'), {
 inputValue: state.library?.name || '',
 confirmButtonText: t('common.ok'),
 cancelButtonText: t('common.cancel'),
 inputValidator: (v) => (v && v.trim() ? true : t('common.name') + t('common.empty'))
 });
 await renameLibrary(value.trim());
 ElMessage.success(t('common.ok'));
 }
 catch (e) {
 // 用户取消
 }
 }
}
async function loadFonts() {
 loading.value = true;
 try {
 const list = await window.api.fonts.list();
 fonts.value = list || [];
 await Promise.all(fonts.value.map(async (font) => {
 const src = await window.api.fonts.read(font.id, font.fileName);
 if (src) {
 const fontFace = new FontFace(font.fontFamily, `url(${src})`, {
 weight: font.fontWeight,
 style: font.fontStyle
 });
 await fontFace.load();
 document.fonts.add(fontFace);
 font.hasLoaded = true;
 }
 }));
 }
 catch (e) {
 console.error('加载字体列表失败:', e);
 ElMessage.error(t('common.loadFailed'));
 }
 finally {
 loading.value = false;
 }
}
function handleUpload() {
 setPendingUpload({ new: true });
}
async function handleBatchUpload() {
 try {
 const result = await window.api.fonts.batchUpload();
 if (!result)
 return;
 let success = 0;
 let dup = 0;
 for (const item of result.items) {
 if (item.duplicate) {
 dup++;
 }
 else if (item.meta) {
 await window.api.fonts.save(item.meta);
 success++;
 }
 }
 ElMessage.success(`${t('common.success')}: ${success}, ${t('image.duplicate')}: ${dup}`);
 await loadFonts();
 }
 catch (e) {
 console.error('批量上传失败:', e);
 ElMessage.error(e.message || t('common.failed'));
 }
}
function handleUploadCommand(cmd) {
 if (cmd === 'single')
 handleUpload();
 else if (cmd === 'batch')
 handleBatchUpload();
}
function handleSortCommand(cmd) {
 if (cmd === 'asc' || cmd === 'desc') {
 sortDir.value = cmd;
 }
 else {
 if (sortBy.value === cmd) {
 sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
 }
 else {
 sortBy.value = cmd;
 sortDir.value = 'desc';
 }
 }
}
function isSelected(id) {
 const idStr = String(id);
 return selectedIds.value.some((sid) => String(sid) === idStr);
}
function toggleSelect(font) {
 const fontId = String(font.id);
 const idx = selectedIds.value.findIndex((sid) => String(sid) === fontId);
 if (idx === -1) {
 selectedIds.value.push(font.id);
 }
 else {
 selectedIds.value.splice(idx, 1);
 }
 isMultiSelect.value = selectedIds.value.length > 0;
}
function handleSelect(font, e) {
 const event = e || window.event;
 if (!event) {
 selectedIds.value = [font.id];
 isMultiSelect.value = true;
 anchorId.value = String(font.id);
 return;
 }
 const fontId = String(font.id);
 if (event.ctrlKey || event.metaKey) {
 toggleSelect(font);
 if (!anchorId.value) {
 anchorId.value = fontId;
 }
 }
 else if (event.shiftKey) {
 const list = filteredFonts.value;
 const currentIdx = list.findIndex((f) => String(f.id) === fontId);
 if (currentIdx === -1)
 return;
 if (!anchorId.value || selectedIds.value.length === 0) {
 anchorId.value = fontId;
 selectedIds.value = [font.id];
 isMultiSelect.value = true;
 }
 else {
 const anchorIdx = list.findIndex((f) => String(f.id) === anchorId.value);
 if (anchorIdx === -1) {
 anchorId.value = fontId;
 selectedIds.value = [font.id];
 isMultiSelect.value = true;
 return;
 }
 const start = Math.min(currentIdx, anchorIdx);
 const end = Math.max(currentIdx, anchorIdx);
 const newSelected = [];
 for (let i = start; i <= end; i++) {
 newSelected.push(list[i].id);
 }
 selectedIds.value = newSelected;
 isMultiSelect.value = true;
 }
 }
 else {
 selectedIds.value = [font.id];
 isMultiSelect.value = true;
 anchorId.value = fontId;
 }
}
function handleDblClick(font) {
 if (selectedIds.value.length === 0 || selectedIds.value.length === 1 && selectedIds.value[0] === font.id) {
 setEditingFont(font);
 }
}
function clearSelection() {
 selectedIds.value = [];
 isMultiSelect.value = false;
 anchorId.value = null;
}
function selectAll() {
 const list = filteredFonts.value;
 selectedIds.value = list.map((f) => f.id);
 isMultiSelect.value = selectedIds.value.length > 0;
 if (selectedIds.value.length > 0) {
 anchorId.value = String(list[0].id);
 }
}
function selectInverse() {
 const list = filteredFonts.value;
 const allIds = new Set(list.map((f) => String(f.id)));
 const selectedSet = new Set(selectedIds.value.map((id) => String(id)));
 const inverseIds = [];
 allIds.forEach((id) => {
 if (!selectedSet.has(id)) {
 const font = list.find((f) => String(f.id) === id);
 if (font)
 inverseIds.push(font.id);
 }
 });
 selectedIds.value = inverseIds;
 isMultiSelect.value = selectedIds.value.length > 0;
 if (selectedIds.value.length > 0) {
 anchorId.value = String(selectedIds.value[0]);
 }
 else {
 anchorId.value = null;
 }
}
async function handleBatchDelete() {
 if (selectedIds.value.length === 0)
 return;
 try {
 await ElMessageBox.confirm(`${t('common.delete')} ${selectedIds.value.length} ${t('font.items')}？`, t('common.delete'), { type: 'warning', confirmButtonText: t('common.ok'), cancelButtonText: t('common.cancel') });
 for (const id of selectedIds.value) {
 await window.api.fonts.delete(id);
 }
 ElMessage.success(t('common.success'));
 selectedIds.value = [];
 isMultiSelect.value = false;
 anchorId.value = null;
 await loadFonts();
 }
 catch (e) {
 // 用户取消
 }
}
async function handleBatchAddTag() {
 if (selectedIds.value.length === 0)
 return;
 try {
 const { value } = await ElMessageBox.prompt(t('home.enterTag'), t('home.batchAddTag'), {
 confirmButtonText: t('common.ok'),
 cancelButtonText: t('common.cancel'),
 inputValidator: (v) => (v && v.trim() ? true : t('home.enterTag'))
 });
 const tag = value.trim();
 for (const id of selectedIds.value) {
 const font = fonts.value.find((f) => f.id === id);
 if (font) {
 if (!font.tags)
 font.tags = [];
 if (!font.tags.includes(tag)) {
 font.tags.push(tag);
 try {
 const patch = { tags: [...font.tags] };
 await window.api.fonts.update(String(id), patch);
 }
 catch (e) {
 console.error('批量添加标签失败:', id, e);
 }
 }
 }
 }
 await loadFonts();
 ElMessage.success(t('home.tagsAdded', { count: selectedIds.value.length }));
 }
 catch (e) {
 // 用户取消
 }
}
let justBoxSelected = false;
function handleContentClick(e) {
 if (justBoxSelected) {
 justBoxSelected = false;
 return;
 }
 if (e.target === contentRef.value || e.target.closest('.content') === contentRef.value && !e.target.closest('.font-card')) {
 clearSelection();
 }
}
function updateDragEnd() {
 if (!isDragging.value || !contentRef.value)
 return;
 const rect = contentRef.value.getBoundingClientRect();
 const viewportX = lastMouseX - rect.left;
 const viewportY = lastMouseY - rect.top;
 dragEndGlobal.value = {
 x: viewportX + contentRef.value.scrollLeft,
 y: viewportY + contentRef.value.scrollTop
 };
}
function handleMouseDown(e) {
 if (!contentRef.value)
 return;
 if (e.ctrlKey || e.metaKey || e.shiftKey) {
 return;
 }
 isDragging.value = true;
 lastMouseX = e.clientX;
 lastMouseY = e.clientY;
 const rect = contentRef.value.getBoundingClientRect();
 const viewportX = e.clientX - rect.left;
 const viewportY = e.clientY - rect.top;
 dragStartGlobal.value = {
 x: viewportX + contentRef.value.scrollLeft,
 y: viewportY + contentRef.value.scrollTop
 };
 dragEndGlobal.value = { ...dragStartGlobal.value };
 showSelectionBox.value = true;
 document.addEventListener('mousemove', handleMouseMove);
 document.addEventListener('mouseup', handleMouseUp);
 contentRef.value.addEventListener('scroll', updateDragEnd);
}
function handleMouseMove(e) {
 if (!isDragging.value || !contentRef.value)
 return;
 lastMouseX = e.clientX;
 lastMouseY = e.clientY;
 const rect = contentRef.value.getBoundingClientRect();
 const viewportX = e.clientX - rect.left;
 const viewportY = e.clientY - rect.top;
 dragEndGlobal.value = {
 x: viewportX + contentRef.value.scrollLeft,
 y: viewportY + contentRef.value.scrollTop
 };
}
function handleMouseUp(e) {
 if (!isDragging.value || !contentRef.value)
 return;
 e.stopPropagation();
 isDragging.value = false;
 showSelectionBox.value = false;
 document.removeEventListener('mousemove', handleMouseMove);
 document.removeEventListener('mouseup', handleMouseUp);
 contentRef.value.removeEventListener('scroll', updateDragEnd);
 const startX = Math.min(dragStartGlobal.value.x, dragEndGlobal.value.x);
 const startY = Math.min(dragStartGlobal.value.y, dragEndGlobal.value.y);
 const endX = Math.max(dragStartGlobal.value.x, dragEndGlobal.value.x);
 const endY = Math.max(dragStartGlobal.value.y, dragEndGlobal.value.y);
 const cards = contentRef.value.querySelectorAll('.font-card');
 const newSelected = [];
 cards.forEach((card) => {
 const cardLeft = card.offsetLeft;
 const cardTop = card.offsetTop;
 const cardRight = cardLeft + card.offsetWidth;
 const cardBottom = cardTop + card.offsetHeight;
 if (cardLeft < endX && cardRight > startX && cardTop < endY && cardBottom > startY) {
 const fontId = card.getAttribute('data-font-id');
 if (fontId) {
 newSelected.push(fontId);
 }
 }
 });
 if (newSelected.length > 0) {
 justBoxSelected = true;
 if (e.ctrlKey || e.metaKey) {
 selectedIds.value = [...new Set([...selectedIds.value, ...newSelected])];
 }
 else {
 selectedIds.value = newSelected;
 }
 isMultiSelect.value = true;
 }
 else if (!(e.ctrlKey || e.metaKey)) {
 justBoxSelected = true;
 clearSelection();
 }
}
onMounted(() => {
 loadFonts();
});
</script>

<template>
  <div class="home">
    <header class="topbar">
      <div class="topbar-left">
        <el-dropdown trigger="click" @command="handleLibCommand">
          <span class="lib-name iconfont">
            &#xeb1a; {{ state.library?.name || t('sidebar.font') }}
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="rename">{{ t('init.rename') }}</el-dropdown-item>
              <el-dropdown-item command="switch" divided>{{ t('init.switchLibrary') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="topbar-center">
        <el-input
          v-model="keyword"
          :placeholder="t('font.searchPlaceholder')"
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
            <el-checkbox v-model="allFieldsSelected" @change="onSelectAll">{{ t('common.selectAll') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.name" @change="onDisplayChange">{{ t('common.name') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.tags" @change="onDisplayChange">{{ t('common.tags') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fontFamily" @change="onDisplayChange">{{ t('font.fontFamily') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fontWeight" @change="onDisplayChange">{{ t('font.fontWeight') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fontStyle" @change="onDisplayChange">{{ t('font.fontStyle') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fileSize" @change="onDisplayChange">{{ t('common.fileSize') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.uploadTime" @change="onDisplayChange">{{ t('common.uploadTime') }}</el-checkbox>
            <el-checkbox v-model="displaySettings.fileType" @change="onDisplayChange">{{ t('common.format') }}</el-checkbox>
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
              <el-dropdown-item command="fontFamily" :class="{ 'is-active': sortBy === 'fontFamily' }">{{ t('font.fontFamily') }}</el-dropdown-item>
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
          @mousedown="handleMouseDown">
      <div v-if="filteredFonts.length" class="grid">
        <div
          v-for="font in filteredFonts"
          :key="font.id"
          class="font-card"
          :class="{ selected: isSelected(font.id), 'is-dragging': isDragging }"
          :data-font-id="font.id"
          @click="handleSelect(font, $event)"
          @dblclick="handleDblClick(font)"
        >
          <span v-if="displaySettings.fileType" class="file-type-badge">{{ (font.fileType || '').toUpperCase() }}</span>
          <div class="font-preview">
            <div class="preview-text-top" :style="{ fontFamily: font.hasLoaded ? font.fontFamily : 'inherit', fontWeight: font.fontWeight, fontStyle: font.fontStyle }">
              {{ t('font.sampleTextTop') }}
            </div>
            <div class="preview-text-bottom" :style="{ fontFamily: font.hasLoaded ? font.fontFamily : 'inherit', fontWeight: font.fontWeight, fontStyle: font.fontStyle }">
              iPixel
            </div>
          </div>
          <div v-if="displaySettings.name || displaySettings.fontFamily || displaySettings.fileSize" class="font-info">
            <div v-if="displaySettings.name" class="font-name" :title="font.name || font.fileName">{{ font.name || font.fileName }}</div>
            <div v-if="displaySettings.fontFamily || displaySettings.fileSize" class="font-meta">
              <span v-if="displaySettings.fontFamily">{{ font.fontFamily }}</span>
              <span v-if="displaySettings.fileSize">{{ formatSize(font.fileSize) }}</span>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else :description="fonts.length === 0 ? t('font.empty') : t('common.noMatch')" />

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
  background: var(--el-color-primary-light-9);
  border-radius: 6px;
  border: 1px solid var(--el-color-primary-light-7);
}
.selected-count {
  font-size: 13px;
  font-weight: 600;
  padding: 2px 8px;
  background: var(--el-color-primary);
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

.font-card {
  background: var(--bg-soft);
  border-radius: 8px;
  border: 2px solid transparent;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  position: relative;
}
.font-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.font-card.selected {
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
.font-preview {
  width: 100%;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
}
.preview-text-top {
  font-size: v-bind(previewFontSizeTop + 'px');
  color: var(--text-1);
  margin-bottom: 8px;
}
.preview-text-bottom {
  font-size: v-bind(previewFontSizeBottom + 'px');
  color: var(--text-2);
  font-weight: 700;
}
.font-info {
  padding: 8px 10px;
}
.font-name {
  font-size: 13px;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}
.font-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-3);
}
.selection-box {
  position: absolute;
  border: 2px dashed var(--el-color-primary);
  background: rgba(64, 158, 255, 0.15);
  pointer-events: none;
  z-index: 100;
}
</style>

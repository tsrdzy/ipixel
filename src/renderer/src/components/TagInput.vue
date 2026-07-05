<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  pool: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const input = ref('')
const showSuggest = ref(false)

const suggestions = computed(() => {
  const q = input.value.trim().toLowerCase()
  const pool = props.pool.filter((t) => !props.modelValue.includes(t))
  if (!q) return pool.slice(0, 8)
  return pool.filter((t) => t.toLowerCase().includes(q)).slice(0, 8)
})

function addTag(tag) {
  tag = tag.trim()
  if (!tag || props.modelValue.includes(tag)) return
  emit('update:modelValue', [...props.modelValue, tag])
  input.value = ''
}

function removeTag(tag) {
  emit(
    'update:modelValue',
    props.modelValue.filter((t) => t !== tag)
  )
}

function onKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    if (input.value.trim()) addTag(input.value)
  } else if (e.key === 'Backspace' && !input.value && props.modelValue.length) {
    removeTag(props.modelValue[props.modelValue.length - 1])
  }
}

function handleBlur() {
  setTimeout(() => {
    showSuggest.value = false
  }, 150)
}
</script>

<template>
  <div class="tag-input">
    <div class="tag-tags">
      <el-tag
        v-for="t in modelValue"
        :key="t"
        closable
        size="small"
        @close="removeTag(t)"
      >
        {{ t }}
      </el-tag>
    </div>
    <el-input
      v-model="input"
      placeholder="输入标签后回车添加"
      @keydown="onKeydown"
      @focus="showSuggest = true"
      @blur="handleBlur"
    />
    <ul v-if="showSuggest && suggestions.length" class="suggest">
      <li v-for="s in suggestions" :key="s" @mousedown.prevent="addTag(s)">
        {{ s }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tag-input {
  position: relative;
}
.tag-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
  min-height: 4px;
}
.suggest {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 10;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
}
.suggest li {
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}
.suggest li:hover {
  background: var(--bg-hover);
}
</style>

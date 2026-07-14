<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'


// ObjectLoader 在 three 核心模块中
const ObjectLoader = THREE.ObjectLoader

const props = defineProps({
  buffer: { type: Object, default: null },
  fileType: { type: String, default: '' },
  viewParams: { type: Object, default: null },
  // 辅助文件列表：[{ name, dataBase64, role }]
  auxFiles: { type: Array, default: () => [] }
})

const emit = defineEmits(['loaded', 'error'])

const containerRef = ref(null)
const loading = ref(false)
const errorMsg = ref('')
const showFloor = ref(false)
const autoRotate = ref(false) // 自动旋转
const animations = ref([]) // 动画列表 [{ name, index }]
const currentAnimIndex = ref(-1) // 当前播放的动画索引，-1 表示无
const animDropdownOpen = ref(false) // 动画下拉菜单展开状态

let scene, camera, renderer, controls, gridHelper, floorGroup
let currentModel = null
let mixer = null
let animationClips = [] // 当前模型的所有动画片段
let currentAction = null // 当前播放的 action
let clock = null
let rafId = null
let resizeObserver = null
let sceneReady = false
let themeObserver = null // 监听 html.dark 变化以切换场景背景

/** 读取当前主题对应的 viewer 背景十六进制数 */
function getThemeBgHex() {
  const cssVar = getComputedStyle(document.documentElement)
    .getPropertyValue('--bg-viewer')
    .trim()
  // 解析 #RRGGBB 或 rgba/rgb
  if (cssVar.startsWith('#')) {
    return parseInt(cssVar.slice(1), 16)
  }
  const m = cssVar.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (m) {
    return (parseInt(m[1]) << 16) | (parseInt(m[2]) << 8) | parseInt(m[3])
  }
  return document.documentElement.classList.contains('dark') ? 0x1f2024 : 0xf0f2f5
}

/** 根据当前主题更新场景背景色 */
function updateSceneBackground() {
  if (scene && scene.background) {
    scene.background.setHex(getThemeBgHex())
    if (renderer) renderer.render(scene, camera)
  }
}

function toArrayBuffer(data) {
  if (!data) return null
  if (data instanceof ArrayBuffer) return data
  if (data.buffer instanceof ArrayBuffer) {
    if (data.byteOffset === 0 && data.byteLength === data.buffer.byteLength) {
      return data.buffer
    }
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  }
  throw new Error('无法转换为 ArrayBuffer')
}

function base64ToUint8Array(base64) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function base64ToText(base64) {
  return new TextDecoder().decode(base64ToUint8Array(base64))
}

/** 根据文件名扩展名构造贴图/资源 URL 映射 */
function buildResourceMap(auxFiles) {
  const map = {}
  for (const f of auxFiles || []) {
    if (!f.name || !f.dataBase64) continue
    const mime = guessMime(f.name)
    const blob = base64ToBlob(f.dataBase64, mime)
    map[f.name] = URL.createObjectURL(blob)
  }
  return map
}

function base64ToBlob(base64, mime) {
  const bytes = base64ToUint8Array(base64)
  return new Blob([bytes], { type: mime || 'application/octet-stream' })
}

function guessMime(name) {
  const ext = name.toLowerCase().split('.').pop()
  const m = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    bmp: 'image/bmp',
    webp: 'image/webp',
    tga: 'image/x-tga',
    bin: 'application/octet-stream',
    json: 'application/json'
  }
  return m[ext] || 'application/octet-stream'
}

function loadModel() {
  if (!props.buffer || !props.fileType) return
  if (!sceneReady) {
    console.warn('[ModelViewer] 场景未就绪，延迟加载模型')
    requestAnimationFrame(loadModel)
    return
  }
  loading.value = true
  errorMsg.value = ''
  console.log('[ModelViewer] 开始加载模型, 类型:', props.fileType, '数据大小:', props.buffer.byteLength || props.buffer.length, '辅助文件:', (props.auxFiles || []).length)

  try {
    const ab = toArrayBuffer(props.buffer)
    const ext = props.fileType.toLowerCase()
    let object

    if (ext === 'glb' || ext === 'gltf') {
      loadGLTF(ab, ext)
      return
    } else if (ext === 'obj') {
      object = loadOBJ(ab)
    } else if (ext === 'stl') {
      object = loadSTL(ab)
    } else if (ext === 'fbx') {
      loadFBX(ab)
      return
    } else if (ext === 'json') {
      loadJSON(ab)
      return
    } else {
      throw new Error('不支持的文件类型: ' + ext)
    }

    onModelLoaded(object)
  } catch (e) {
    loading.value = false
    errorMsg.value = e.message || '加载失败'
    emit('error', e)
    console.error('[ModelViewer] 加载异常:', e)
  }
}

function loadGLTF(ab, ext) {
  const loader = new GLTFLoader()
  // 若有 .bin / 贴图，构造 blob URL 供 GLTFLoader 解析外部资源
  const resourceMap = buildResourceMap(props.auxFiles)

  // 通过拦截 fetch 让 GLTFLoader 拿到本地 blob
  const originalFetch = globalThis.fetch
  globalThis.fetch = function (url, options) {
    if (typeof url === 'string') {
      const fileName = url.split('/').pop().split('?')[0]
      if (resourceMap[fileName]) {
        return Promise.resolve(new Response(resourceMap[fileName]))
      }
      if (resourceMap[url]) {
        return Promise.resolve(new Response(resourceMap[url]))
      }
    }
    return originalFetch.call(this, url, options)
  }

  loader.parse(
    ab,
    '',
    (gltf) => {
      globalThis.fetch = originalFetch
      // 释放 blob URL
      Object.values(resourceMap).forEach((u) => URL.revokeObjectURL(u))
      console.log('[ModelViewer] GLTF 解析成功, scene:', gltf.scene)
      const obj = gltf.scene
      if (gltf.animations && gltf.animations.length) {
        setupMixer(obj, gltf.animations)
      }
      onModelLoaded(obj)
    },
    (err) => {
      globalThis.fetch = originalFetch
      Object.values(resourceMap).forEach((u) => URL.revokeObjectURL(u))
      loading.value = false
      errorMsg.value = '模型解析失败: ' + (err.message || err)
      emit('error', err)
      console.error('[ModelViewer] GLTF 解析失败:', err)
    }
  )
}

function loadOBJ(ab) {
  const text = new TextDecoder().decode(ab)
  const objLoader = new OBJLoader()
  // 查找 MTL 文件
  const mtlFile = (props.auxFiles || []).find((f) => f.role === 'mtl' || f.name.toLowerCase().endsWith('.mtl'))
  if (mtlFile && mtlFile.dataBase64) {
    const mtlText = base64ToText(mtlFile.dataBase64)
    const mtlLoader = new MTLLoader()
    // 为贴图构造资源映射
    const resourceMap = buildResourceMap(
      (props.auxFiles || []).filter((f) => f.role === 'texture')
    )
    // 重写 path 处理让 mtlLoader 通过 manager 找到贴图
    const manager = new THREE.LoadingManager()
    manager.setURLModifier((url) => {
      const fileName = url.split('/').pop().split('?')[0]
      return resourceMap[fileName] || resourceMap[url] || url
    })
    mtlLoader.manager = manager
    const materials = mtlLoader.parse(mtlText, '')
    materials.preload()
    objLoader.setMaterials(materials)
  }
  return objLoader.parse(text)
}

function loadSTL(ab) {
  const loader = new STLLoader()
  const geometry = loader.parse(ab)
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({
    color: 0xb0b0c0,
    metalness: 0.1,
    roughness: 0.7
  })
  return new THREE.Mesh(geometry, material)
}

function loadFBX(ab) {
  const loader = new FBXLoader()
  try {
    const obj = loader.parse(ab, '')
    if (obj.animations && obj.animations.length) {
      setupMixer(obj, obj.animations)
    }
    onModelLoaded(obj)
  } catch (e) {
    loading.value = false
    errorMsg.value = 'FBX 解析失败: ' + (e.message || e)
    emit('error', e)
    console.error('[ModelViewer] FBX 解析失败:', e)
  }
}

function loadJSON(ab) {
  try {
    const text = new TextDecoder().decode(ab)
    const json = JSON.parse(text)
    // Three.js JSON 模型格式：用 ObjectLoader
    const loader = new ObjectLoader()
    // 为贴图构造资源映射
    const resourceMap = buildResourceMap(
      (props.auxFiles || []).filter((f) => f.role === 'texture')
    )
    loader.manager.setURLModifier((url) => {
      const fileName = url.split('/').pop().split('?')[0]
      return resourceMap[fileName] || resourceMap[url] || url
    })

    const obj = loader.parse(json)
    if (!obj) throw new Error('JSON 解析返回空对象')

    // 加载动画 JSON
    const animFiles = (props.auxFiles || []).filter(
      (f) => f.role === 'animation' && f.name.toLowerCase().endsWith('.json')
    )
    if (animFiles.length) {
      const clips = []
      for (const af of animFiles) {
        try {
          const animJson = JSON.parse(base64ToText(af.dataBase64))
          // 兼容 AnimationClip 数组或单个
          const parsed = THREE.AnimationClip.parse(animJson)
          if (Array.isArray(parsed)) clips.push(...parsed)
          else clips.push(parsed)
        } catch (e) {
          console.warn('[ModelViewer] 动画 JSON 解析失败:', af.name, e)
        }
      }
      if (clips.length) setupMixer(obj, clips)
    }

    onModelLoaded(obj)
  } catch (e) {
    loading.value = false
    errorMsg.value = 'JSON 模型解析失败: ' + (e.message || e)
    emit('error', e)
    console.error('[ModelViewer] JSON 解析失败:', e)
  }
}

function setupMixer(object, clips) {
  animationClips = clips || []
  // 构建动画列表（用于 UI 显示）
  animations.value = animationClips.map((clip, i) => ({
    index: i,
    name: cleanAnimName(clip.name) || `动画 ${i + 1}`,
    duration: clip.duration || 0
  }))

  if (animationClips.length > 0) {
    mixer = new THREE.AnimationMixer(object)
    if (!clock) clock = new THREE.Clock()
    // 默认播放第一个动画
    playAnimation(0)
  }
}

/** 清理动画名后缀（.action / _action / .anim / _anim / .clip 等） */
function cleanAnimName(name) {
  if (!name) return ''
  return String(name)
    .replace(/\.(action|anim|clip|json|fbx)$/i, '')
    .replace(/[_\-\s](action|anim|clip)$/i, '')
    .trim()
}

/** 播放指定索引的动画 */
function playAnimation(index) {
  if (!mixer || !animationClips.length) return
  // 停止当前动画
  if (currentAction) {
    currentAction.stop()
    currentAction = null
  }
  if (index < 0 || index >= animationClips.length) {
    currentAnimIndex.value = -1
    return
  }
  const clip = animationClips[index]
  currentAction = mixer.clipAction(clip)
  currentAction.reset()
  currentAction.play()
  currentAnimIndex.value = index
  console.log('[ModelViewer] 播放动画:', index, clip.name)
}

/** 切换动画选择 */
function selectAnimation(index) {
  if (index === currentAnimIndex.value) {
    // 再次点击同一个 → 暂停（停止）
    if (currentAction) {
      currentAction.stop()
      currentAction = null
    }
    currentAnimIndex.value = -1
  } else {
    playAnimation(index)
  }
  animDropdownOpen.value = false // 选择后关闭下拉
}

/** 当前动画名称（用于按钮显示） */
const currentAnimName = computed(() => {
  if (currentAnimIndex.value < 0) return '未播放'
  const a = animations.value.find((x) => x.index === currentAnimIndex.value)
  return a ? a.name : '未播放'
})

function toggleAnimDropdown() {
  animDropdownOpen.value = !animDropdownOpen.value
}

function closeAnimDropdown() {
  animDropdownOpen.value = false
}

function onModelLoaded(object) {
  if (currentModel) {
    scene.remove(currentModel)
    disposeObject(currentModel)
  }

  currentModel = object

  // 检查模型是否包含可渲染的网格
  let hasMesh = false
  let meshCount = 0
  object.traverse((child) => {
    if (child.isMesh) {
      hasMesh = true
      meshCount++
      if (!child.material || child.material.isMeshBasicMaterial) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xb0b0c0,
          metalness: 0.1,
          roughness: 0.7
        })
      }
      child.castShadow = true
      child.receiveShadow = true
    }
  })

  console.log('[ModelViewer] 模型加载完成, 网格数:', meshCount, '包含网格:', hasMesh)

  if (!hasMesh) {
    loading.value = false
    errorMsg.value = '模型不包含可渲染的网格'
    emit('error', new Error('模型不包含可渲染的网格'))
    return
  }

  scene.add(object)
  loading.value = false

  // 默认让模型转身正对相机（多数模型默认背对 +Z 方向的相机）
  // 注意：必须在计算包围盒之前旋转，确保旋转后模型仍然居中
  object.rotation.y += Math.PI

  // 计算包围盒 → 尺寸
  const box = new THREE.Box3().setFromObject(object)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  console.log('[ModelViewer] 模型包围盒:', {
    min: box.min,
    max: box.max,
    size: size,
    center: center
  })

  // 检查包围盒是否有效
  if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z)) {
    console.error('[ModelViewer] 包围盒无效')
    errorMsg.value = '模型包围盒无效'
    return
  }

  // 目标：让包围盒水平居中（x=0, z=0），底部贴地（y=0）
  // 这样模型几何中心在 (0, size.y/2, 0)，与 controls.target 一致，旋转时模型不会漂移
  const targetCenter = new THREE.Vector3(0, size.y / 2, 0)
  const offset = targetCenter.clone().sub(center)
  object.position.add(offset)

  // 适配视角（必须在 emit 之前，确保截图时视角正确）
  if (props.viewParams) {
    restoreView(props.viewParams)
  } else {
    fitView(size)
  }

  // 立即渲染一帧，确保截图能拿到正确画面
  if (renderer) renderer.render(scene, camera)

  emit('loaded', {
    dimensions: {
      x: round(size.x),
      y: round(size.y),
      z: round(size.z)
    },
    animationCount: animations.value.length
  })
}

function round(n) {
  return Math.round(n * 100) / 100
}

function fitView(size) {
  if (!currentModel || !camera || !renderer) return
  let maxDim = Math.max(size.x, size.y, size.z)
  // 处理尺寸为 0 或极小的情况
  if (maxDim < 0.001) {
    console.warn('[ModelViewer] 模型尺寸过小，使用默认视角')
    camera.position.set(5, 5, 8)
    camera.near = 0.01
    camera.far = 1000
    camera.updateProjectionMatrix()
    controls.target.set(0, 0, 0)
    controls.update()
    return
  }

  // 根据相机 FOV 和容器宽高比精确计算距离，让模型完美填充视图
  const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight
  const fov = (camera.fov * Math.PI) / 180 // 弧度
  // 垂直方向的半视场角对应距离
  const distH = (size.y / 2) / Math.tan(fov / 2)
  // 水平方向的半视场角对应距离（考虑宽高比）
  const distW = (size.x / 2) / (Math.tan(fov / 2) * aspect)
  // 取较大值确保模型完全可见，再留 30% 边距
  let dist = Math.max(distH, distW, size.z / 2) * 1.3
  // 考虑对角线尺寸，确保从斜角看也能完整显示
  const diag = Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z)
  dist = Math.max(dist, diag * 1.1)

  // 相机放在斜 45 度角，略高位置
  camera.position.set(dist * 0.6, dist * 0.5, dist * 0.8)
  camera.near = maxDim / 1000
  camera.far = maxDim * 10000
  camera.updateProjectionMatrix()
  // 目标点在模型中心高度
  controls.target.set(0, size.y / 2, 0)
  controls.update()

  if (gridHelper) gridHelper.position.y = 0

  console.log('[ModelViewer] 视角已适配, 相机位置:', camera.position, '目标:', controls.target, '距离:', dist)
}

function toggleFloor() {
  showFloor.value = !showFloor.value
  if (floorGroup) floorGroup.visible = showFloor.value
}

function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value
  if (controls) {
    controls.autoRotate = autoRotate.value
    controls.autoRotateSpeed = 2.0 // 旋转速度
  }
}

function restoreView(params) {
  if (!params) return
  if (params.cameraPosition) {
    camera.position.set(
      params.cameraPosition.x,
      params.cameraPosition.y,
      params.cameraPosition.z
    )
  }
  if (params.cameraTarget) {
    controls.target.set(
      params.cameraTarget.x,
      params.cameraTarget.y,
      params.cameraTarget.z
    )
  }
  controls.update()
}

function getViewParams() {
  return JSON.parse(
    JSON.stringify({
      cameraPosition: {
        x: round(camera.position.x),
        y: round(camera.position.y),
        z: round(camera.position.z)
      },
      cameraTarget: {
        x: round(controls.target.x),
        y: round(controls.target.y),
        z: round(controls.target.z)
      }
    })
  )
}

function captureThumbnail() {
  if (!renderer) return ''
  // 截图时临时切换为透明背景，便于预览图跟随主题色
  const originalBg = scene.background
  scene.background = null
  renderer.render(scene, camera)
  const dataUrl = renderer.domElement.toDataURL('image/png')
  scene.background = originalBg
  renderer.render(scene, camera)
  return dataUrl
}

function resetView() {
  if (!currentModel) return
  const box = new THREE.Box3().setFromObject(currentModel)
  const size = box.getSize(new THREE.Vector3())
  fitView(size)
}

function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose()
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose())
      } else {
        child.material?.dispose()
      }
    }
  })
}

function setupScene() {
  const el = containerRef.value
  if (!el) {
    console.error('[ModelViewer] 容器元素不存在')
    return
  }

  let w = el.clientWidth
  let h = el.clientHeight
  console.log('[ModelViewer] setupScene, 容器尺寸:', w, h)

  // 如果容器尺寸为 0，等待下一帧
  if (w === 0 || h === 0) {
    requestAnimationFrame(setupScene)
    return
  }

  scene = new THREE.Scene()
  scene.background = new THREE.Color(getThemeBgHex())

  camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000)
  camera.position.set(5, 5, 8)

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  el.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  const ambient = new THREE.AmbientLight(0xffffff, 0.55)
  scene.add(ambient)

  const dir = new THREE.DirectionalLight(0xffffff, 1.0)
  dir.position.set(10, 15, 8)
  dir.castShadow = true
  dir.shadow.mapSize.set(1024, 1024)
  dir.shadow.camera.near = 0.5
  dir.shadow.camera.far = 80
  dir.shadow.camera.left = -20
  dir.shadow.camera.right = 20
  dir.shadow.camera.top = 20
  dir.shadow.camera.bottom = -20
  scene.add(dir)

  const dir2 = new THREE.DirectionalLight(0xffffff, 0.3)
  dir2.position.set(-8, 6, -6)
  scene.add(dir2)

  // 地板组：网格 + 阴影承接面，可显示/隐藏，默认隐藏
  floorGroup = new THREE.Group()
  // 使用较大网格 + fog 让远处淡出，视觉上无限延伸
  gridHelper = new THREE.GridHelper(2000, 200, 0x3a3b40, 0x2a2b2f)
  gridHelper.material.opacity = 0.5
  gridHelper.material.transparent = true
  floorGroup.add(gridHelper)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(4000, 4000),
    new THREE.ShadowMaterial({ opacity: 0.3 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  floorGroup.add(ground)

  // 启用 fog 让远处淡出，营造无限平铺感
  scene.fog = new THREE.Fog(0x1f2024, 30, 200)
  // 默认隐藏地板
  floorGroup.visible = false
  scene.add(floorGroup)

  sceneReady = true
  animate()

  resizeObserver = new ResizeObserver(() => onResize())
  resizeObserver.observe(el)

  console.log('[ModelViewer] 场景初始化完成')
}

function animate() {
  rafId = requestAnimationFrame(animate)
  if (controls) controls.update()
  if (mixer && clock) {
    const delta = clock.getDelta()
    mixer.update(delta)
  }
  if (renderer && scene && camera) renderer.render(scene, camera)
}

function onResize() {
  const el = containerRef.value
  if (!el || !camera || !renderer) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w === 0 || h === 0) return
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

watch(
  () => [props.buffer, props.fileType],
  () => {
    if (props.buffer) loadModel()
  }
)

onMounted(() => {
  console.log('[ModelViewer] onMounted')
  // 使用 requestAnimationFrame 确保 DOM 布局完成后再初始化场景
  requestAnimationFrame(() => {
    setupScene()
    if (props.buffer) loadModel()
  })

  // 监听 html.dark class 变化，主题切换时同步更新 Three.js 场景背景
  themeObserver = new MutationObserver(() => {
    updateSceneBackground()
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  themeObserver?.disconnect()
  themeObserver = null
  controls?.dispose()
  if (mixer) {
    try { mixer.stopAllAction() } catch (e) {}
    try { mixer.uncacheRoot(mixer.getRoot()) } catch (e) {}
  }
  mixer = null
  currentAction = null
  animationClips = []
  animations.value = []
  currentAnimIndex.value = -1
  if (currentModel) disposeObject(currentModel)
  renderer?.dispose()
  sceneReady = false
})

defineExpose({ captureThumbnail, getViewParams, resetView })
</script>

<template>
  <div class="viewer-wrap">
    <div ref="containerRef" class="viewer-canvas" @click="closeAnimDropdown"></div>

    <!-- 右上角控制按钮组 -->
    <div class="control-group">
      <el-button
        class="ctrl-btn"
        :class="{ active: autoRotate }"
        circle
        @click="toggleAutoRotate"
        title="自动旋转"
      >
        <i class="iconfont" aria-hidden="true">&#xe64c;</i>
      </el-button>
      <el-button
        class="ctrl-btn"
        :class="{ active: showFloor }"
        circle
        @click="toggleFloor"
        title="显示/隐藏地板"
      >
        <i class="iconfont" aria-hidden="true">&#xe853;</i>
      </el-button>
    </div>

    <!-- 底部动画下拉选择 -->
    <div v-if="animations.length" class="anim-panel" @click.stop>
      <button class="anim-trigger" @click="toggleAnimDropdown">
        <i class="iconfont anim-icon" :class="currentAnimIndex >= 0 ? 'icon-movie' : 'icon-play'"></i>
        <span class="anim-current">{{ currentAnimName }}</span>
        <el-badge :value="animations.length" class="anim-count" type="info" />
        <i class="iconfont icon-chevron-down anim-caret" :class="{ open: animDropdownOpen }"></i>
      </button>
      <transition name="anim-drop">
        <div v-if="animDropdownOpen" class="anim-dropdown">
          <button
            class="anim-option"
            :class="{ active: currentAnimIndex === -1 }"
            @click="selectAnimation(-1); playAnimation(-1)"
          >
            <i class="iconfont icon-movie anim-icon"></i>
            <span>停止播放</span>
          </button>
          <button
            v-for="anim in animations"
            :key="anim.index"
            class="anim-option"
            :class="{ active: currentAnimIndex === anim.index }"
            @click="selectAnimation(anim.index)"
          >
            <i class="iconfont anim-icon" :class="currentAnimIndex === anim.index ? 'icon-movie' : 'icon-play'"></i>
            <span class="anim-name">{{ anim.name }}</span>
            <span class="anim-dur">{{ anim.duration.toFixed(1) }}s</span>
          </button>
        </div>
      </transition>
    </div>

    <div v-if="loading" class="viewer-overlay">
      <i class="iconfont icon-movie spinner"></i>
      <span>正在加载模型...</span>
    </div>
    <div v-if="errorMsg" class="viewer-overlay viewer-error">
      <el-alert :title="errorMsg" type="error" show-icon :closable="false" class="error-alert" />
    </div>
  </div>
</template>

<style scoped>
.viewer-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-viewer);
  border-radius: var(--radius);
  overflow: hidden;
}
.viewer-canvas {
  width: 100%;
  height: 100%;
}
.viewer-canvas :deep(canvas) {
  display: block;
}
.floor-toggle,
.ctrl-btn {
  backdrop-filter: blur(8px);
}
.control-group {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 6px;
}
.ctrl-btn.active {
  background: var(--primary) !important;
  color: #fff !important;
  border-color: var(--primary) !important;
}
/* 动画面板（下拉） */
.anim-panel {
  position: absolute;
  left: 12px;
  bottom: 12px;
  min-width: 180px;
  max-width: 320px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  backdrop-filter: blur(10px);
  user-select: none;
}
.anim-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: var(--text-1);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
}
.anim-trigger:hover {
  background: var(--bg-hover);
}
.anim-current {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.anim-count {
  flex-shrink: 0;
  margin-right: 4px;
}
.anim-count :deep(.el-badge__content) {
  font-size: 11px;
  background: var(--bg-mute);
  color: var(--text-3);
  border: none;
}
.anim-caret {
  flex-shrink: 0;
  transition: transform 0.18s;
  color: var(--text-3);
}
.anim-caret.open {
  transform: rotate(180deg);
}
/* 下拉列表 */
.anim-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  bottom: calc(100% + 4px);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  backdrop-filter: blur(10px);
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  z-index: 10;
}
.anim-dropdown::-webkit-scrollbar {
  width: 6px;
}
.anim-dropdown::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
.anim-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.anim-option:hover {
  background: var(--bg-hover);
  color: var(--text-1);
}
.anim-option.active {
  background: var(--primary-soft);
  color: var(--primary);
}
.anim-option .anim-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: none;
}
.anim-option .anim-dur {
  opacity: 0.55;
  font-size: 10px;
  flex-shrink: 0;
}
.anim-icon {
  flex-shrink: 0;
}
/* 下拉过渡动画 */
.anim-drop-enter-active,
.anim-drop-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}
.anim-drop-enter-from,
.anim-drop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
.viewer-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--bg-panel);
  color: var(--text-2);
  font-size: 14px;
}
.viewer-error {
  color: var(--danger);
}
.viewer-error .error-alert {
  max-width: 80%;
}
.spinner {
  color: var(--primary);
  font-size: 32px;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>

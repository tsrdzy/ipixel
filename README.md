# ipixel

基于 Electron + Vue 3 开发的本地资源管理工具，帮助设计师和开发者高效管理本地3D模型、图片、音频和字体资源。

## 功能对比

| | 模型资源库 | 图片资源库 | 音频资源库 | 字体资源库 |
|---|---|---|---|---|
| 功能 | 单个上传、批量上传、重复检测、拖拽旋转视角、自定义封面、辅助文件管理 | 单个上传、批量上传、颜色筛选、图片分割 | 单个上传、批量上传、波形播放、音量控制、倍速播放、循环播放 | 单个上传、批量上传、字体预览 |
| 支持格式 | GLB、GLTF、OBJ、STL、JSON、FBX | PNG、JPG、JPEG、BMP、WebP、GIF、TGA | MP3、WAV、OGG、FLAC、M4A | TTF、OTF、WOFF、WOFF2 |

## 工具

| 工具名称 | 描述 |
|---|---|
| 图片分割工具 | 自动或手动分割精灵图，支持背景色过滤、无用区域过滤 |
| 图片合并工具 | 支持水平、垂直、网格三种合并模式，可自定义间距和背景色 |

## 数据储存方式

所有数据本地存储，隐私安全。

- 元数据：使用 SQLite 数据库（imodel.db）存储资源元信息
- 文件存储：按 SHA256 哈希值分片存储在 models/XX/ 和 images/XX/ 目录下（XX 为哈希前两位，00-ff）
- 资源ID：使用文件 SHA256 哈希值确保唯一性
- 资源库配置：library.json 存储资源库基本信息

## 项目目录

```
ipixel/
├── src/
│   ├── main/                      # 主进程代码
│   │   ├── index.js               # 主进程入口
│   │   ├── lib/                   # 主进程模块
│   │   │   ├── db.js              # 数据库操作
│   │   │   ├── store.js           # 模型资源存储
│   │   │   ├── imageStore.js      # 图片资源存储
│   │   │   ├── imageIpc.js        # 图片IPC通信
│   │   │   ├── audioIpc.js        # 音频IPC通信
│   │   │   ├── fontIpc.js         # 字体IPC通信
│   │   │   └── ipc.js             # 通用IPC通信
│   │   └── preload/               # 预加载脚本
│   └── renderer/                  # 渲染进程代码
│       ├── src/
│       │   ├── assets/            # 静态资源
│       │   ├── components/        # 公共组件
│       │   │   ├── ModelCard.vue  # 模型卡片
│       │   │   ├── ModelViewer.vue# 3D模型预览
│       │   │   └── TagInput.vue   # 标签输入
│       │   ├── composables/       # 组合式函数
│       │   ├── i18n/              # 国际化配置
│       │   ├── iconfont/          # 图标字体
│       │   ├── router/            # 路由配置
│       │   ├── stores/            # Pinia状态管理
│       │   ├── views/             # 页面视图
│       │   │   ├── tools/         # 工具页面
│       │   │   │   ├── ImageSplitTool.vue
│       │   │   │   └── ImageMergeTool.vue
│       │   │   ├── ModelLayout.vue
│       │   │   ├── ImageLayout.vue
│       │   │   ├── AudioLayout.vue
│       │   │   ├── FontLayout.vue
│       │   │   ├── SettingsView.vue
│       │   │   └── ToolView.vue
│       │   ├── App.vue            # 根组件
│       │   └── main.js            # 渲染进程入口
│       └── index.html             # HTML模板
├── resources/                     # 应用资源
├── package.json                   # 项目配置
└── vite.config.js                 # Vite配置
```

## 系统要求

- Windows 10+ / macOS 10.15+ / Linux
- Node.js 18+

## 使用指南

1. 首次启动：选择"创建新资源库"创建空库，或"打开资源库"选择已有库
2. 上传资源：点击"上传"按钮，支持单个上传（可编辑详情）或批量上传
3. 预览资源：点击资源卡片进入详情页查看
4. 编辑信息：在详情页修改名称、简介、标签
5. 搜索筛选：使用顶部搜索框和标签/格式筛选器快速定位资源
6. 切换资源类型：使用左侧边栏切换模型、图片、音频、字体库
# ipixel

<div align="right">
  <a href="#english">English</a> | <a href="#中文">中文</a>
</div>

## 软件介绍
iPixel 是一款专注于本地素材管理的桌面应用，为设计师、创作者和开发者提供高效、安全的数字资源管理解决方案。支持图片、音频、字体、3D模型等多种素材类型，数据本地存储，保护隐私安全。

## 图片预览
![alt text](README/image.png)

![alt text](README/image-1.png)

## 适用人群

设计师、艺术家、影音设计工作者、内容创作者、游戏开发者、UI/UX 设计师等需要管理大量数字素材的专业人士。

## 产品特点

- 每种素材类型提供专属的预览和管理功能
- 图片资源库，模型资源库，字体资源库，音频资源库独立分模块储存，更快定位整理资源
- 标签系统，快速标记和检索
- 自定义显示字段，按需展示素材信息
- 详细信息面板，展示文件元数据
- 支持按名称、标签、格式等维度筛选
- 快速定位目标素材
- 深色/浅色主题切换，适配不同使用场景
- 多语言支持
- 自定义显示字段，个性化界面布局
- 完整的操作日志记录，支持详情查看
- 设备信息监控，一键查看 CPU、内存、系统版本等信息
- 所有数据存储在本地，无需联网即可使用
- 不收集用户数据，高度重视隐私保护

## 支持格式

图片	PNG、JPG、JPEG、BMP、WebP、GIF、TGA
音频	MP3, WAV, OGG, FLAC, AAC, M4A
字体	TTF, OTF, WOFF, WOFF2
模型	GLB、GLTF、OBJ、STL、JSON、FBX

- 元数据：使用 SQLite 数据库（imodel.db）存储资源元信息
- 文件存储：按 SHA256 哈希值分片存储在 models/XX/ 和 images/XX/ 目录下（XX 为哈希前两位，00-ff）
- 资源ID：使用文件 SHA256 哈希值确保唯一性
- 资源库配置：library.json 存储资源库基本信息

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

---

## English

## About

iPixel is a desktop application focused on local asset management, providing efficient and secure digital resource management solutions for designers, creators, and developers. It supports multiple asset types including images, audio, fonts, and 3D models, with all data stored locally to protect privacy.

## Screenshots
![alt text](README/image.png)

![alt text](README/image-1.png)

## Target Users

Designers, artists, video/audio designers, content creators, game developers, UI/UX designers, and other professionals who need to manage large volumes of digital assets.

## Features

- Dedicated preview and management features for each asset type
- Independent storage modules for image, model, font, and audio libraries for faster resource organization
- Tag system for quick marking and retrieval
- Customizable display fields to show asset information on demand
- Detailed information panel showing file metadata
- Filter by name, tag, format, and other dimensions
- Quick locate target assets
- Dark/light theme switching for different usage scenarios
- Multi-language support
- Customizable display fields for personalized interface layout
- Complete operation log recording with detailed viewing support
- Device information monitoring for one-click viewing of CPU, memory, system version, etc.
- All data stored locally, no internet connection required
- No user data collection, high priority on privacy protection

## Supported Formats

Images: PNG, JPG, JPEG, BMP, WebP, GIF, TGA
Audio: MP3, WAV, OGG, FLAC, AAC, M4A
Fonts: TTF, OTF, WOFF, WOFF2
Models: GLB, GLTF, OBJ, STL, JSON, FBX

- Metadata: SQLite database (imodel.db) for storing resource metadata
- File storage: Sharded storage by SHA256 hash value in models/XX/ and images/XX/ directories (XX is the first two hash characters, 00-ff)
- Resource ID: SHA256 hash value ensures uniqueness
- Library configuration: library.json stores basic library information

## System Requirements

- Windows 10+ / macOS 10.15+ / Linux
- Node.js 18+

## Usage Guide

1. First launch: Select "Create New Library" to create an empty library, or "Open Library" to select an existing one
2. Upload resources: Click the "Upload" button, supporting single upload (with detailed editing) or batch upload
3. Preview resources: Click on resource cards to enter the detail page
4. Edit information: Modify name, description, and tags on the detail page
5. Search and filter: Use the top search box and tag/format filters to quickly locate resources
6. Switch resource types: Use the left sidebar to switch between model, image, audio, and font libraries
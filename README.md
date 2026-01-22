# iPixel

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=OPPOSans&weight=700&size=32&duration=3000&pause=1000&color=4FC08D&width=435&lines=强大的素材管理库与工具;支持多种格式资源管理;Electron+Vue3跨平台应用" alt="Typing SVG" />
</p>

## 🌐 语言切换

**中文** | [English](README.en.md)

一个功能强大的素材管理库与工具，支持多种格式资源管理，附带资源处理功能，基于 Electron + Vue 3 构建的跨平台桌面应用。

## 📊 GitHub 数据

<p align="center">
  <img src="https://img.shields.io/github/stars/tsrdzy/ipixel?style=social" alt="GitHub Stars" />
  <img src="https://img.shields.io/github/forks/tsrdzy/ipixel?style=social" alt="GitHub Forks" />
  <img src="https://img.shields.io/github/issues/tsrdzy/ipixel" alt="GitHub Issues" />
  <img src="https://img.shields.io/github/license/tsrdzy/ipixel" alt="GitHub License" />
  <img src="https://img.shields.io/github/commit-activity/m/tsrdzy/ipixel" alt="GitHub Commit Activity" />
</p>

## ✨ 功能特性

### 📁 素材资源管理
- **多格式支持**：支持图片、视频、文档、字体、3D模型等多种格式
- **本地资源管理**：本地资源文件的高效管理与组织
- **资源分类与标签**：灵活的分类体系和标签系统
- **资源预览与搜索**：便捷的预览功能和强大的搜索能力
- **资源导入导出**：支持批量导入和导出资源
- **元数据管理**：完善的资源元数据记录与管理

### 🔧 资源处理工具
- **图片处理**：图片转像素图、格式转换、ICO图标转换、图片压缩
- **视频处理**：视频格式转换、剪辑、压缩
- **音频处理**：音频格式转换、剪辑、压缩
- **模型处理**：3D模型格式转换、预览

### 🌐 资源商店
- 在线资源浏览与下载
- 资源分类与推荐
- 资源上传与分享

### 🌍 多语言支持
- 支持多种语言切换
- 轻松扩展新语言

### 📱 跨平台支持
- Windows 10+
- macOS 10.15+
- Linux

### 🔌 插件系统
- 计划支持


## 📋 支持的格式

> **注意**：允许导入任意文件格式，下表列出了具有特殊支持的格式

<div style="overflow-x: auto; width: 100%;">

| 类别 | 格式 | 封面 | 预览 | 编辑 |
|------|------|------|------|------|
| **常见图片格式** | jpg、png、jpeg、xpm、xcf、xbm、x3f、wpg、wbmp、tiff、tga、RAF、SVG、SGI、RW2、RAS、PSD、PPM、PNM、WEBP、PICT、PICON、PGM、PFM、PEF、PCX、PCD、PBM、PAM、ORF、NRW、NEF、MNG、JPS、JPE、JP2、JFIF、ICO、HEIF、HEIC、HDR、GIF、EXR、CR2、DNG、DDS、CUR、BMP | ✅ | ✅ | |
| **常见视频格式** | mp4、ts、vob、rm、ogv、mxf、mts、mpg、mpeg、mjpeg、m4v、m2v、m2ts、hevc、f4v、wtv、asf、3gp、flv、avi、mkv、mov、wmv、webm | ✅ | ✅ | |
| **常见文档格式** | PDF | ✅ | ✅ | |
| **常见字体格式** | woff，ttf，sfd，ps，pfb，otf，dfont | ✅ | | |
| **常见3D格式** | obj、3ds、stl、ply、gltf、glb、off、3dm、fbx、dae、wrl、3mf、IFC、BREP、step、IGES、FCSTD、BIM | ✅ | ✅ | |

</div>

## 📖 使用指南

### 素材资源管理
1. 打开应用后，点击左侧导航栏的「本地」进入资源管理界面
2. 点击「导入」按钮或拖拽文件，批量导入资源
3. 使用分类和标签功能对资源进行组织
4. 使用搜索框快速查找所需资源
5. 点击资源即可预览详细信息

### 资源处理工具
1. 点击左侧导航栏的「工具」进入工具界面
2. 选择需要使用的工具类型（图片处理、视频处理等）
3. 按照工具界面提示上传文件并设置参数
4. 执行处理操作，查看处理结果并保存

### 资源商店
1. 点击左侧导航栏的「商店」进入资源商店
2. 浏览或搜索所需资源
3. 点击下载按钮获取资源到本地库


## 🎯 技术栈

<p align="center">
  <img src="https://img.shields.io/badge/Electron-2B2E3A?style=for-the-badge&logo=electron&logoColor=9FEAF9" alt="Electron" />
  <img src="https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white" alt="Vue.js" />
  <img src="https://img.shields.io/badge/Element%20Plus-E33332?style=for-the-badge&logo=element-plus&logoColor=white" alt="Element Plus" />
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Sharp-000000?style=for-the-badge&logo=sharp&logoColor=white" alt="Sharp" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
</p>

## 🚀 快速开始

### 系统要求
- Windows 10+ / macOS 10.15+ / Linux
- Node.js 18+ / npm 9+

### 安装方式

#### 从源码构建

1. 克隆仓库
```bash
git clone https://github.com/tsrdzy/ipixel.git
cd ipixel
```

2. 安装依赖
```bash
npm install
```

3. 启动开发模式
```bash
npm run dev
```

4. 构建生产版本
```bash
# 构建Windows版本
npm run build:win

# 构建macOS版本
npm run build:mac

# 构建Linux版本
npm run build:linux
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 仓库
2. 创建功能分支 `git checkout -b feature/AmazingFeature`
3. 提交更改 `git commit -m 'Add some AmazingFeature'`
4. 推送到分支 `git push origin feature/AmazingFeature`
5. 打开 Pull Request

### 代码规范
- 遵循 ESLint 和 Prettier 配置
- 运行 `npm run lint` 检查代码质量
- 运行 `npm run format` 格式化代码

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系方式

- QQ群： [1073110911](https://qun.qq.com/universal-share/share?ac=1&authKey=UJo%2Fqof5MPO8zKt4uciOyuPx%2BL69bgD%2FFNTVGe3KL77KPEMFYEG1SJLyoBic9SNl&busi_data=eyJncm91cENvZGUiOiIxMDczMTEwOTExIiwidG9rZW4iOiI3eVJ5REVtUzhBcGRVU0t2dkg3NTlCYndWQXN5YzQrRGZ5Vk5rMURBVERrQ1FsNTkrSjZ4cUwzZEFwVStwZlgzIiwidWluIjoiMjIyNzg5OTI4NSJ9&data=cPZ_MxCgDYHYEUVyW17fj6cldEhcOY-Soxu8Ffb5i6MygWq7eE9X5Cotkta5vxrNA6_bN_3vYQdK5JEJe7qWMg&svctype=4&tempid=h5_group_info)
- 项目地址：[https://github.com/tsrdzy/ipixel](https://github.com/tsrdzy/ipixel)
- 提交 Issue：[https://github.com/tsrdzy/ipixel/issues](https://github.com/tsrdzy/ipixel/issues)

## 📊 版本更新

更新日志：
- [GitHub Releases](https://github.com/tsrdzy/ipixel/releases)

正式版:
- 暂无

## 🙏 致谢

感谢所有为项目做出贡献的开发者！

---

**iPixel** - 让素材管理更高效！
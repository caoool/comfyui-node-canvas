# GitHub Promotion Kit

## Short Pitch

ComfyUI Node Builder is a local AI-powered GUI app for building, editing, validating, deploying, and testing custom ComfyUI nodes and full node packs.

## Long Pitch

ComfyUI Node Builder helps ComfyUI users move from a plain-language node idea to a working custom node pack. It combines a visual node contract editor, editable generated Python files, AI-assisted authoring, validation, ZIP export, and managed deployment into a local ComfyUI installation.

## Good GitHub Topics

`comfyui`, `custom-nodes`, `comfyui-custom-node`, `node-builder`, `ai-tools`, `generative-ai`, `gui`, `node-editor`, `python`, `vue`, `developer-tools`

## Suggested Social Post

I built ComfyUI Node Builder: a local GUI app that lets AI help create, edit, validate, deploy, and test custom ComfyUI node packs.

Demo: user prompt in, AI-created node pack out, then deploy and test in ComfyUI.

GitHub: https://github.com/caoool/comfyui-node-canvas
Landing page: https://caoool.github.io/comfyui-node-canvas/

## Launch Links

- GitHub: https://github.com/caoool/comfyui-node-canvas
- Landing page: https://caoool.github.io/comfyui-node-canvas/
- Quick Start: https://github.com/caoool/comfyui-node-canvas#quick-start
- Wiki: https://github.com/caoool/comfyui-node-canvas/blob/main/docs/wiki/index.md
- Node idea issue: https://github.com/caoool/comfyui-node-canvas/issues/new?template=node_idea.yml
- Launch feedback issue: https://github.com/caoool/comfyui-node-canvas/issues/2

## Media Assets

- Demo GIF: `demo-ai-node-workflow.gif`
- AI Builder screenshot: `ai-builder.png`
- AI settings screenshot: `ai-settings.png`
- Social preview source: `docs/promo/github-social-preview.svg`
- Landing page: `site/index.html`

## Media Export Commands

Install `ffmpeg` before exporting social video assets.

```bash
ffmpeg -y -i demo-ai-node-workflow.gif -movflags faststart -pix_fmt yuv420p docs/promo/demo-ai-node-workflow.mp4
```

Install ImageMagick or Inkscape before exporting the social preview PNG.

```bash
magick docs/promo/github-social-preview.svg docs/promo/github-social-preview.png
```

```bash
inkscape docs/promo/github-social-preview.svg --export-type=png --export-filename=docs/promo/github-social-preview.png
```

Keep the X/Twitter video under 60 seconds when possible so it loops in the feed.

## Suggested Chinese Post

我做了一个 ComfyUI Node Builder：本地 GUI 应用，用 AI 辅助创建、修改、验证、部署和测试 ComfyUI 自定义节点包。

它不是单纯的聊天框，而是可视化节点接口 + 可编辑 Python 文件 + AI Builder + 部署验证流程。

GitHub: https://github.com/caoool/comfyui-node-canvas
项目主页: https://caoool.github.io/comfyui-node-canvas/

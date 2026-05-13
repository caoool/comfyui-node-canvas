# Reddit And Hacker News Posts

## Reddit Post

Title:

```text
I built a local GUI + AI builder for creating ComfyUI custom node packs
```

Body:

```text
I’ve been working on ComfyUI Node Builder, a local app for building custom ComfyUI nodes without hand-writing all the boilerplate every time.

The demo shows:

1. user describes a node idea
2. AI creates the node contract and Python
3. dependencies/files are updated
4. the pack is deployed and tested in ComfyUI

It is open-source and local. The AI Builder can create nodes, edit generated files, explain validation errors, run checks, and request deploy only when deploy permission is enabled.

GitHub:
https://github.com/caoool/comfyui-node-canvas

Landing page:
https://caoool.github.io/comfyui-node-canvas/

Node ideas and feedback:
https://github.com/caoool/comfyui-node-canvas/issues/2

I’d especially like feedback from people who build custom nodes: what node authoring workflow should this support next?
```

Attach: `demo-ai-node-workflow.gif` or `docs/promo/demo-ai-node-workflow.mp4`.

Rules:

- Use one subreddit first.
- Do not post duplicate links across many communities on the same day.
- Reply to every serious question.
- Ask for node ideas and workflow pain points.

## Hacker News Show HN

Title:

```text
Show HN: ComfyUI Node Builder - AI GUI for building custom nodes
```

URL:

```text
https://github.com/caoool/comfyui-node-canvas
```

First comment:

```text
I built ComfyUI Node Builder, a local GUI app for creating ComfyUI custom nodes and full node packs.

The main workflow is: describe a node idea, let AI generate/edit the node contract and Python, validate the generated pack, deploy it into ComfyUI, then test it in a workflow.

It is aimed at ComfyUI node authors and workflow builders who want to prototype custom nodes without rewriting the same boilerplate every time.

Landing page:
https://caoool.github.io/comfyui-node-canvas/

Node ideas and feedback:
https://github.com/caoool/comfyui-node-canvas/issues/2

I’d especially value feedback on:
- whether the generated pack structure matches how ComfyUI node authors work
- what validation/testing should catch before deploy
- what example nodes would make the project easier to evaluate
```

HN response themes:

- Local app, not hosted service.
- Deploy is gated by explicit permission.
- Generated files remain visible and editable.
- AI can request actions, but validation and deployment remain inspectable.

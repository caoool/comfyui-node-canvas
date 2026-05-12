# Contributing

Thanks for helping improve ComfyUI Node Builder.

## Good First Contributions

- Share a node idea through the `Node idea` issue template.
- Improve docs, screenshots, or examples.
- Report AI Builder prompts that fail or produce weak node code.
- Add focused tests for validation, generated pack files, or deployment behavior.

## Development

```bash
npm install
npm run dev
npm run test
npm run build
```

## Pull Requests

- Keep changes focused.
- Include reproduction steps for bugs.
- Update docs when behavior changes.
- Run relevant tests before opening the PR.
- Avoid committing local settings, generated scratch files, or unrelated draft docs.

## AI Builder Changes

When changing AI actions, include at least one realistic prompt and note whether the change affects file edits, validation, terminal checks, dependency updates, or deployment.

# Troubleshooting

Use this guide when setup, validation, deploy, restart, dependency installation, terminal commands, or AI actions do not behave as expected.

## The App Does Not Start

Run:

```bash
npm install
npm run dev
```

If the helper server fails immediately, check your Node.js version. Node.js 22 or newer is recommended because the server command uses Node's TypeScript strip-types support:

```bash
node --experimental-strip-types --watch server/index.ts
```

If the frontend port is busy, Vite prints the actual URL in the terminal. Open that URL instead of assuming `5173`.

## Settings Cannot Find `custom_nodes`

The **ComfyUI Install Path** should be the ComfyUI root folder, not the `custom_nodes` folder.

Correct:

```text
/home/you/ComfyUI
```

Incorrect:

```text
/home/you/ComfyUI/custom_nodes
```

The builder validates by checking for:

```text
<install path>/custom_nodes
```

## ComfyUI Is Not Reachable

Use **Check ComfyUI** in Settings.

Common causes:

- ComfyUI is not running.
- The URL uses the wrong port.
- The URL is not loopback.
- ComfyUI is still restarting.
- A firewall or local environment blocks the request.

Typical local URL:

```text
http://127.0.0.1:8188
```

The helper pings ComfyUI through `/system_stats`.

## Export Or Deploy Is Disabled

Export and deploy are blocked when validation errors exist.

Check:

- duplicate node names
- invalid Python class names
- invalid input or output names
- duplicate generated file names
- mismatched return metadata
- missing required deploy settings

Open notifications or hover the disabled action to see the first validation messages.

## Deploy Wrote Files But Nodes Do Not Appear

ComfyUI needs to reload Python custom nodes.

Try:

1. Restart ComfyUI manually.
2. Refresh the ComfyUI browser tab.
3. Search for the node display name.
4. Search for the node category.
5. Inspect the ComfyUI terminal for import errors.

If the node import failed, ComfyUI usually logs a Python traceback. Fix the Python source, deploy again, and restart.

## Restart Status Is Unknown

The builder requests restart through ComfyUI Extension Manager support. If that endpoint is unavailable or times out, the builder can report that deploy completed but restart status is unknown.

That means file writing may have succeeded. Check the notification details for:

- deploy path
- files written
- generated node count
- dependency result
- restart response

Then restart ComfyUI manually.

## Dependency Installation Fails

Dependency installation can fail for reasons outside the builder:

- package does not support your Python version
- no compatible wheel for your platform
- compiler or system library missing
- network unavailable
- package conflicts with ComfyUI's environment
- install script failed

Open **Builder Output** in the terminal panel and read stdout/stderr. If the failure is from a package install, test the command directly in the ComfyUI Python environment.

## A Managed Pack Will Not Load

Load and import require a valid builder metadata file:

```text
builder.project.json
```

If the file is missing, the pack was probably not deployed by this builder or was manually copied without metadata.

If the file exists but load fails, it may not match the expected builder identifier or schema version. The app rejects metadata that is not owned by ComfyUI Node Builder.

## A Custom File Cannot Be Created

Custom files must use safe relative paths.

Allowed:

```text
helpers.py
web/shared.js
data/config.json
```

Rejected:

```text
../outside.py
/absolute/path.py
NodeName.py
__init__.py
builder.project.json
```

Generated and reserved files are controlled by the builder.

## Python Source Shows Sync Issues

The code workspace can sync supported node Python edits back into the visual contract. It is not a full Python parser for every possible manual rewrite.

If sync issues appear:

1. Read the issue line and message.
2. Keep generated class structure recognizable.
3. Avoid moving generated mapping declarations into authored code sections.
4. Prefer editing the node contract for ports, widgets, outputs, and Return UI.
5. Use authored Python for imports, helper functions, and execute behavior.

## Terminal Commands Fail

The terminal runs in a generated pack workspace through the helper server. It is intended for lightweight checks.

If a command fails:

- verify the selected node and generated files
- check stdout/stderr in the terminal panel
- try a simple command such as `python -V`
- run the same command in your system terminal if the failure looks environment-specific

## AI Builder Cannot Fetch Models

Check:

- provider selection
- API key
- base URL
- network access
- provider availability
- local Ollama server for Ollama models

The Local Codex provider uses your installed `codex` CLI and does not require an API key. Use **Check Codex** in AI Settings to verify the target machine can run `codex exec --version` and load the local model/effort catalog. If Local Codex fails, run `codex login` or `codex exec --version` in the same shell that starts the helper server.

Open the AI activity panel for provider responses and errors. For OpenAI-compatible providers, confirm the base URL points to the `/v1` API root expected by that server.

## AI Builder Requested Deploy But Nothing Happened

Deployment from AI actions is gated. Turn on **Allow deploy** in the AI Builder panel before asking it to deploy. This keeps AI-assisted edits separate from file-system writes unless you explicitly enable the deploy path.

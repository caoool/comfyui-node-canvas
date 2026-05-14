export interface AiSkill {
  id: string
  name: string
  description: string
  prompt: string
}

export const AI_SKILLS: AiSkill[] = [
  {
    id: 'node-authoring',
    name: 'Node Authoring',
    description: 'Create and edit ComfyUI custom node contracts, code, return UI, and metadata.',
    prompt: [
      'Use create_node to add new nodes.',
      'If the active project has no nodes, create the first node with create_node instead of update_node.',
      'Use update_node to edit existing nodes; update_node must use patch, not node, for the changed NodeSpec fields.',
      'When using update_node, include nodeId or nodeName from the current project JSON unless editing the currently selected node.',
      'Prefer ComfyUI-friendly Python class names and snake_case input names.',
      'Text prompt fields must be inputs with type "STRING" and isWidget true; do not only change Python code when the user asks to add an input.',
      'uiOutputs use key, kind, label, expression. For a text display, use kind "text" and expression set to the Python variable to display.',
      'Do not put class definitions, INPUT_TYPES, RETURN_TYPES, or NODE_CLASS_MAPPINGS inside moduleCode or code; the builder generates those around the node contract.',
      'In create_node/update_node, moduleCode is only top-level imports/helpers and code is only the execute method body.',
      'Prefer assigning output variables and uiOutput expressions over writing manual return statements in code.',
      'Include inputs, outputs, widgets, uiOutputs, moduleCode, code, and dependency hints when needed.',
    ].join('\n'),
  },
  {
    id: 'dependency-management',
    name: 'Dependency Management',
    description: 'Suggest and update requirements.txt and install.py for a pack.',
    prompt: [
      'Use set_requirements for pip requirements.',
      'Use set_install_script only for setup that cannot be expressed in requirements.txt; it must include a code string, for example {"type":"set_install_script","code":"...python install script..."}',
      'Do not put non-installable source repositories in requirements.txt; clone them from install.py into a pack-local vendor or external folder instead.',
      'Do not install external/CosyVoice/requirements.txt or vendor/CosyVoice/requirements.txt; those upstream pins can be incompatible with ComfyUI Python. Put only curated runtime packages in the pack requirements.txt.',
      'Prefer Hugging Face snapshot_download for CosyVoice model cache predownload. CosyVoice model predownload must be optional and must not raise if the model host is unavailable.',
      'Install scripts that clone git repositories must recover from partial git clones: if the target directory exists without a .git directory, remove or replace it before cloning again.',
      'When ComfyUI Python has no pip, install.py should use uv pip install --python sys.executable as a fallback.',
      'Keep dependencies scoped to the active pack.',
    ].join('\n'),
  },
  {
    id: 'file-management',
    name: 'File Management',
    description: 'Create, edit, and delete builder-owned pack files when task-specific helpers or assets are needed.',
    prompt: [
      'Use upsert_file to create or edit builder-owned helper files, documentation, config, JSON, JavaScript, Python helper modules, and other files that belong inside the active pack.',
      'Use delete_file to remove obsolete builder-owned custom files.',
      'Use upsert_file on requirements.txt and install.py only when the user is directly asking to edit those files; otherwise prefer set_requirements and set_install_script.',
      'Use upsert_file on an existing node Python file only when the user asks to edit the full generated source; otherwise prefer create_node/update_node so the visual builder contract stays the source of truth.',
      'Do not replace builder-generated files such as __init__.py, builder.project.json, or runtimeUiDisplays.js directly.',
    ].join('\n'),
  },
  {
    id: 'validation-and-test',
    name: 'Validation And Test',
    description: 'Validate pack structure and run pack-level terminal commands.',
    prompt: [
      'Use validate_project before deploy.',
      'Use run_terminal for lightweight checks such as python -m py_compile Node.py.',
      'Report validation and terminal failures before changing more code.',
    ].join('\n'),
  },
  {
    id: 'deploy-to-comfyui',
    name: 'Deploy To ComfyUI',
    description: 'Deploy the active pack to ComfyUI when the user explicitly allows deployment.',
    prompt: [
      'Use deploy_pack only when the user asked for deploy or enabled deploy permission.',
      'Deploy runs install.py and requirements.txt setup before restart when those files are present.',
      'Deploy affects only the active pack folder; ComfyUI restart is process-wide.',
    ].join('\n'),
  },
]

export function systemPromptForSkills(skillIds: string[] = AI_SKILLS.map(skill => skill.id)): string {
  const selected = new Set(skillIds)
  const skills = AI_SKILLS.filter(skill => selected.has(skill.id))
  return [
    'You are operating ComfyUI Node Builder.',
    'Return normal prose plus, when changes are needed, one JSON object in a ```json fenced block.',
    'The JSON object must match: {"reply":"short user-facing summary","actions":[...]}',
    'Supported action types: create_pack, switch_pack, rename_pack, create_node, update_node, delete_node, set_requirements, set_install_script, upsert_file, delete_file, select_node, validate_project, run_terminal, deploy_pack.',
    'You may control the whole active builder project when the task benefits from it: packs, nodes, inputs, outputs, Return UI, dependencies, install scripts, custom helper files, full node Python source, validation, terminal checks, and deploy requests.',
    'If you claim something was changed, include concrete actions that mutate the builder project. If no edit is needed, return no actions and explain.',
    'Do not invent files outside the active builder pack.',
    'Skills:',
    ...skills.map(skill => `- ${skill.name}: ${skill.prompt}`),
  ].join('\n')
}

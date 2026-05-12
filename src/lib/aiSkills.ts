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
      'Use update_node to edit existing nodes; update_node must use patch, not node, for the changed NodeSpec fields.',
      'Prefer ComfyUI-friendly Python class names and snake_case input names.',
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
      'Use set_install_script only for setup that cannot be expressed in requirements.txt.',
      'Keep dependencies scoped to the active pack.',
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
    'Do not invent files outside the active builder pack.',
    'Skills:',
    ...skills.map(skill => `- ${skill.name}: ${skill.prompt}`),
  ].join('\n')
}

import { describe, expect, it } from 'vitest'
import { AI_SKILLS, systemPromptForSkills } from '../../src/lib/aiSkills'
import { parseAiActionPlan } from '../../src/lib/aiActionPlan'

describe('aiActionPlan', () => {
  it('parses fenced JSON action plans from assistant text', () => {
    const parsed = parseAiActionPlan(`
Here is the plan.

\`\`\`json
{
  "reply": "Created the node.",
  "actions": [
    { "type": "create_pack", "name": "Text Tools", "packFolderName": "TextTools" },
    { "type": "validate_project" }
  ]
}
\`\`\`
`)

    expect(parsed.reply).toBe('Created the node.')
    expect(parsed.actions).toEqual([
      { type: 'create_pack', name: 'Text Tools', packFolderName: 'TextTools' },
      { type: 'validate_project' },
    ])
  })

  it('returns plain assistant text when no action JSON is present', () => {
    expect(parseAiActionPlan('I need more details.')).toEqual({
      reply: 'I need more details.',
      actions: [],
    })
  })

  it('parses builder file actions for creating, editing, and deleting files', () => {
    const parsed = parseAiActionPlan(`
\`\`\`json
{
  "reply": "Added shared helpers.",
  "actions": [
    { "type": "upsert_file", "relativePath": "helpers/text_utils.py", "content": "def clean(value):\\n    return str(value).strip()\\n" },
    { "type": "delete_file", "relativePath": "old_helpers.py" }
  ]
}
\`\`\`
`)

    expect(parsed.actions).toEqual([
      { type: 'upsert_file', relativePath: 'helpers/text_utils.py', content: 'def clean(value):\n    return str(value).strip()\n' },
      { type: 'delete_file', relativePath: 'old_helpers.py' },
    ])
  })

  it('normalizes common AI action aliases before applying builder actions', () => {
    const parsed = parseAiActionPlan(`
\`\`\`json
{
  "reply": "Added setup.",
  "actions": [
    { "type": "set_install_script", "script": "print('install')" },
    { "type": "upsert_file", "path": "helpers/setup.py", "code": "VALUE = 1\\n" }
  ]
}
\`\`\`
`)

    expect(parsed.actions).toEqual([
      { type: 'set_install_script', script: "print('install')", code: "print('install')" },
      { type: 'upsert_file', path: 'helpers/setup.py', code: 'VALUE = 1\n', relativePath: 'helpers/setup.py', content: 'VALUE = 1\n' },
    ])
  })

  it('exposes builder skills for node authoring, dependencies, validation, and deploy', () => {
    expect(AI_SKILLS.map(skill => skill.id)).toEqual(expect.arrayContaining([
      'node-authoring',
      'file-management',
      'dependency-management',
      'validation-and-test',
      'deploy-to-comfyui',
    ]))
    expect(systemPromptForSkills(['node-authoring', 'deploy-to-comfyui'])).toContain('create_node')
    expect(systemPromptForSkills(['node-authoring', 'deploy-to-comfyui'])).toContain('deploy_pack')
    expect(systemPromptForSkills(['node-authoring'])).toContain('If the active project has no nodes, create the first node with create_node instead of update_node')
    expect(systemPromptForSkills(['node-authoring'])).toContain('update_node must use patch')
    expect(systemPromptForSkills(['node-authoring'])).toContain('include nodeId or nodeName from the current project JSON')
    expect(systemPromptForSkills(['node-authoring'])).toContain('uiOutputs use key, kind, label, expression')
    expect(systemPromptForSkills(['node-authoring'])).toContain('Text prompt fields must be inputs with type "STRING" and isWidget true')
    expect(systemPromptForSkills(['node-authoring'])).toContain('Do not put class definitions, INPUT_TYPES, RETURN_TYPES, or NODE_CLASS_MAPPINGS inside moduleCode or code')
    expect(systemPromptForSkills(['file-management'])).toContain('Use upsert_file to create or edit builder-owned helper files')
    expect(systemPromptForSkills(['file-management'])).toContain('delete_file')
    expect(systemPromptForSkills(['file-management'])).toContain('requirements.txt and install.py')
    expect(systemPromptForSkills(['dependency-management'])).toContain('set_install_script')
    expect(systemPromptForSkills(['dependency-management'])).toContain('code string')
    expect(systemPromptForSkills(['dependency-management'])).toContain('recover from partial git clones')
    expect(systemPromptForSkills(['dependency-management'])).toContain('Do not put non-installable source repositories in requirements.txt')
    expect(systemPromptForSkills(['dependency-management'])).toContain('Do not install external/CosyVoice/requirements.txt')
    expect(systemPromptForSkills(['dependency-management'])).toContain('Prefer Hugging Face snapshot_download')
    expect(systemPromptForSkills(['dependency-management'])).toContain('model predownload must be optional')
    expect(systemPromptForSkills(['deploy-to-comfyui'])).toContain('runs install.py and requirements.txt setup before restart')
  })
})

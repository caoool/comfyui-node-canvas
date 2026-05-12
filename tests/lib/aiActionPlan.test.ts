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

  it('exposes builder skills for node authoring, dependencies, validation, and deploy', () => {
    expect(AI_SKILLS.map(skill => skill.id)).toEqual(expect.arrayContaining([
      'node-authoring',
      'dependency-management',
      'validation-and-test',
      'deploy-to-comfyui',
    ]))
    expect(systemPromptForSkills(['node-authoring', 'deploy-to-comfyui'])).toContain('create_node')
    expect(systemPromptForSkills(['node-authoring', 'deploy-to-comfyui'])).toContain('deploy_pack')
    expect(systemPromptForSkills(['node-authoring'])).toContain('update_node must use patch')
    expect(systemPromptForSkills(['node-authoring'])).toContain('uiOutputs use key, kind, label, expression')
    expect(systemPromptForSkills(['node-authoring'])).toContain('Do not put class definitions, INPUT_TYPES, RETURN_TYPES, or NODE_CLASS_MAPPINGS inside moduleCode or code')
  })
})

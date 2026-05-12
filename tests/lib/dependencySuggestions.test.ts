import { describe, expect, it } from 'vitest'
import { extractPythonImportRoots, suggestPythonRequirementsFromCode } from '../../src/lib/dependencySuggestions'

describe('dependencySuggestions', () => {
  it('extracts top-level imports from import and from statements', () => {
    expect(extractPythonImportRoots(`
import os
import cv2, numpy as np
from PIL import Image
from sklearn.model_selection import train_test_split
from .local import helper
# import ignored
    `)).toEqual(['os', 'cv2', 'numpy', 'PIL', 'sklearn'])
  })

  it('suggests pip package names while ignoring stdlib, ComfyUI internals, and existing requirements', () => {
    const suggestions = suggestPythonRequirementsFromCode(
      'import os\nimport cv2\nfrom PIL import Image\nimport folder_paths',
      'import numpy as np\nimport x_transformers\nimport torch',
      ['numpy>=2'],
    )

    expect(suggestions).toEqual([
      { importName: 'cv2', requirement: 'opencv-python', reason: 'cv2 is usually installed from opencv-python' },
      { importName: 'PIL', requirement: 'Pillow', reason: 'PIL is usually installed from Pillow' },
      { importName: 'x_transformers', requirement: 'x-transformers', reason: 'x_transformers is usually installed from x-transformers' },
    ])
  })
})

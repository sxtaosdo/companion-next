import type { AiResourceView } from '../../src/domain/ai-resource-read'
const id = '0123456789abcdef'
export function resourceView(projectId = id): AiResourceView {
  const config = { schemaVersion: 'project-resource-config-v2' as const, projectId, version: 1, designResolution: { width: 720, height: 1280 }, orientation: 'portrait' as const, iconSize: { width: 256, height: 256 }, style: { description: '明亮卡通', references: ['art/reference/a.png'] }, background: { format: 'png' as const, transparent: true, color: '#ffffff' }, composition: { centered: true as const, paddingPercent: 10 }, destination: { directory: 'assets/icons', exportDirectory: 'art/final/icons', naming: 'kebab-case' as const } }
  return { schemaVersion: 'companion-icons-v1', projectId, state: 'valid', version: 1, hash: 'a'.repeat(64), relativePath: `${projectId}.ai-icons.json`, migrationRequired: false, config, draft: structuredClone(config), issues: [], detected: { designResolution: { width: 720, height: 1280 }, designSource: 'settings/v2/packages/project.json', resourceDirectories: ['assets/icons'] }, capabilities: { outputPixels: { width: 1024, height: 1024 }, format: 'png', overwrite: false, referencesAsModelInput: false } }
}

export const referencePreview = { base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', sha256: '4ff6ab670a58c14270e034e2090d9a432caa263a14e0a25785386b0c12f880b5', width: 1, height: 1, mimeType: 'image/png' as const }

import type { ProjectSpec } from './contracts'
export function createDefaultSpec(): ProjectSpec {
  return { schemaVersion: 1, version: '草稿 v0.1', width: 941, height: 1672, safeHorizontal: 32, safeVertical: 48,
    spacing: '8 / 16 / 24 / 32', styleName: '', styleKeywords: '', fontFamily: '待确认授权字体', bodySize: 28,
    headingSize: 40, buttonHeight: 88, buttonStates: '默认 / 按下 / 禁用 / 选中 / 加载',
    overlayPolicy: '基础页面 → 面板 → 弹窗 → 提示；同层互斥', pivot: '中心 · (0.5, 0.5)',
    bundle: '按页面分组 · UI bundle', panelPolicy: '九切片 · 逐资源确认边界', sizePolicy: 'single-master' }
}
/** Full runtime validation: stored/browser data is not trusted merely by a TS cast. */
export function validateSpec(input: unknown): string[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['规范必须是结构化对象']
  const spec = input as Record<string, unknown>
  const errors: string[] = []
  if (spec.schemaVersion !== 1) errors.push('不支持的规范 schemaVersion')
  for (const [key, label, min, max] of [['width','画布宽度',64,8192],['height','画布高度',64,8192],['safeHorizontal','水平安全边距',0,2048],['safeVertical','垂直安全边距',0,2048],['bodySize','正文字号',8,256],['headingSize','标题字号',8,512],['buttonHeight','按钮高度',16,1024]] as const) {
    const value = spec[key]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) errors.push(`${label}须为 ${min}–${max} 的整数`)
  }
  if (typeof spec.safeHorizontal === 'number' && typeof spec.width === 'number' && typeof spec.safeVertical === 'number' && typeof spec.height === 'number' && (spec.safeHorizontal * 2 >= spec.width || spec.safeVertical * 2 >= spec.height)) errors.push('安全边距必须小于画布尺寸的一半')
  for (const [key, label, max, required] of [['version','草稿版本',60,true],['spacing','基础间距',100,true],['styleName','风格样板名称',100,true],['styleKeywords','风格关键词',500,false],['fontFamily','字体说明',160,true],['buttonStates','按钮状态',200,true],['overlayPolicy','弹窗层级',500,true],['pivot','默认 pivot',100,true],['bundle','图集分组',160,true],['panelPolicy','面板规则',160,true]] as const) {
    const value = spec[key]
    if (typeof value !== 'string') errors.push(`${label}必须是文本`)
    else if (required && !value.trim()) errors.push(`请填写${label}`)
    else if (value.length > max) errors.push(`${label}不得超过 ${max} 字符`)
    else if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) errors.push(`${label}含不允许的控制字符`)
  }
  if (spec.sizePolicy !== 'single-master') errors.push('本阶段仅支持每资源一个默认尺寸')
  const allowed = new Set(Object.keys(createDefaultSpec()))
  if (Object.keys(spec).some((key) => !allowed.has(key))) errors.push('规范包含未知字段')
  return errors
}

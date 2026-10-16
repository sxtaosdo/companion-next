/** Picker v16 address-list boundary. Parsing never loads an image or calls a service. */
export interface PickerCandidate {
  image_url: string
  source_page: string
  title?: string
  candidate_kind?: string
  discovery_method?: string
}
export interface PickerFilterPolicy {
  min_width: number
  min_height: number
  exclude_formats: Array<'svg' | 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | 'bmp'>
}
export interface PickerImport {
  schema_version: 1
  images: PickerCandidate[]
  filter_policy?: PickerFilterPolicy
}
export const PICKER_IMPORT_MAX_BYTES = 256 * 1024
function object(value: unknown, required: string[], optional: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}须为对象`)
  const result = value as Record<string, unknown>
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(result, key)) || Object.keys(result).some((key) => ![...required, ...optional].includes(key))) throw new Error(`${label}包含未知或缺失字段`)
  return result
}
function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new Error(`${label}文本无效`)
  return value
}
export function publicAddress(value: unknown, label: string): string {
  const raw = text(value, label, 4096)
  let url: URL
  try { url = new URL(raw) } catch { throw new Error(`${label}不是有效地址`) }
  const host = url.hostname.toLowerCase().replace(/\.+$/, '')
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.includes(':') || host.startsWith('[') || !host.includes('.')) throw new Error(`${label}仅接受无凭据的公开 HTTP(S) 地址`)
  // Reject literal non-public IPv4. DNS, redirects and actual content must be checked by the local service.
  if (/^\d+(\.\d+){3}$/.test(host)) {
    const [a,b,c] = host.split('.').map(Number) as [number, number, number]
    if ([0,10,127].includes(a) || a>=224 || (a===100&&b>=64&&b<=127) || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168||(b===0&&[0,2].includes(c)))) || (a===198&&([18,19].includes(b)||(b===51&&c===100))) || (a===203&&b===0&&c===113)) throw new Error(`${label}不能指向本地或保留网络`)
  }
  return raw
}
export function parsePickerImport(contents: string): PickerImport {
  if (new TextEncoder().encode(contents).byteLength > PICKER_IMPORT_MAX_BYTES) throw new Error('Picker 清单超过 256 KiB 上限')
  let input: unknown
  try { input = JSON.parse(contents) } catch { throw new Error('Picker 清单不是有效 JSON') }
  const root = object(input, ['schema_version','images'], ['filter_policy'], 'Picker 清单')
  if (root.schema_version !== 1 || !Array.isArray(root.images) || root.images.length<1 || root.images.length>30) throw new Error('仅接受 schema_version 1、1–30 张图片的清单')
  const images = root.images.map((entry): PickerCandidate => {
    const item = object(entry, ['image_url','source_page'], ['title','candidate_kind','discovery_method'], '候选图片')
    const result: PickerCandidate = { image_url: publicAddress(item.image_url,'图片地址'), source_page: publicAddress(item.source_page,'来源页面') }
    for (const field of ['title','candidate_kind','discovery_method'] as const) if (Object.prototype.hasOwnProperty.call(item,field)) result[field] = text(item[field],field,field==='title'?500:100)
    return result
  })
  const result: PickerImport = { schema_version:1, images }
  if (Object.prototype.hasOwnProperty.call(root,'filter_policy')) {
    const policy = object(root.filter_policy,['min_width','min_height','exclude_formats'],[],'过滤策略')
    for (const key of ['min_width','min_height']) if (!Number.isInteger(policy[key]) || (policy[key] as number)<0 || (policy[key] as number)>4096) throw new Error('最小宽高须为 0–4096 的整数')
    const formats = policy.exclude_formats
    if (!Array.isArray(formats) || formats.length>7 || new Set(formats).size!==formats.length || formats.some((format)=>!['svg','png','jpeg','webp','gif','avif','bmp'].includes(format as string))) throw new Error('排除格式须为不重复的受支持格式')
    result.filter_policy = { min_width:policy.min_width as number, min_height:policy.min_height as number, exclude_formats:[...formats] as PickerFilterPolicy['exclude_formats'] }
  }
  return result
}

// Reused from cocos-mcp/web/src/icon-reference-editor.ts (Companion upstream).
// Local pixels only; server remains authoritative for saved receipt and EXIF coordinates.
export type CropRoi = { x: number; y: number; width: number; height: number };
export type CropRequest = { base64: string; sourceSha256: string; width: number; height: number; roi: CropRoi; approved: true };
type Options = { root: HTMLElement; fileInput: HTMLInputElement; context: () => string; approved: () => boolean;
  changed: () => void; notice: (message: string) => void; save: (input: CropRequest, cropId: string) => Promise<void> };
const digest = async (bytes: BufferSource) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), value => value.toString(16).padStart(2, "0")).join("");

/** Local preview only. Persisted pixels and coordinates are validated separately by the server. */
export class IconReferenceEditor {
  private bitmap: ImageBitmap | undefined;
  private bytes: ArrayBuffer | undefined;
  private sourceSha256 = "";
  private roi: CropRoi = { x: 0, y: 0, width: 0, height: 0 };
  private serial = 0;
  private loading = false;
  private blocked = true;
  private drag: { x: number; y: number; pointerId: number } | undefined;
  private readonly canvas: HTMLCanvasElement;
  private readonly subject: HTMLCanvasElement;
  private readonly saveButton: HTMLButtonElement;
  private readonly fields: Record<keyof CropRoi, HTMLInputElement>;
  constructor(private readonly options: Options) {
    const q = <T extends Element>(selector: string) => options.root.querySelector<T>(selector)!;
    this.canvas = q('[data-icon-crop-canvas]'); this.subject = q('[data-icon-crop-subject]'); this.saveButton = q('[data-icon-crop-save]');
    this.fields = { x: q('[data-icon-crop-x]'), y: q('[data-icon-crop-y]'), width: q('[data-icon-crop-width]'), height: q('[data-icon-crop-height]') };
    options.fileInput.addEventListener("change", () => { void this.preview(); });
    for (const field of Object.values(this.fields)) field.addEventListener("input", () => {
      if (this.blocked) return;
      this.roi = { x: Number(this.fields.x.value), y: Number(this.fields.y.value), width: Number(this.fields.width.value), height: Number(this.fields.height.value) };
      this.options.changed(); this.draw();
    });
    this.canvas.addEventListener("pointerdown", event => {
      if (this.blocked || !this.bitmap || event.button !== 0) return;
      const point = this.point(event); this.drag = { x: Math.min(point.x,this.bitmap.width-1), y: Math.min(point.y,this.bitmap.height-1), pointerId: event.pointerId };
      this.canvas.setPointerCapture(event.pointerId); this.selectPoint(event);
    });
    this.canvas.addEventListener("pointermove", event => { if (this.drag?.pointerId === event.pointerId) this.selectPoint(event); });
    this.canvas.addEventListener("pointerup", event => { if (this.drag?.pointerId === event.pointerId) this.selectPoint(event); this.drag = undefined; });
    for (const name of ["pointercancel", "lostpointercapture"]) this.canvas.addEventListener(name, () => { this.drag = undefined; });
    this.saveButton.addEventListener("click", () => { void this.save(); });
  }
  reset(): void {
    this.serial++; this.bitmap?.close(); this.bitmap = undefined; this.bytes = undefined; this.sourceSha256 = "";
    this.loading = false; this.drag = undefined; this.options.root.hidden = true; this.saveButton.disabled = true;
  }
  setBlocked(value: boolean): void { this.blocked = value; this.saveButton.disabled = value || this.loading || !this.valid(); }
  private valid(): boolean {
    return Boolean(this.bitmap && this.bytes && this.sourceSha256 && Object.values(this.roi).every(Number.isInteger)
      && this.roi.x >= 0 && this.roi.y >= 0 && this.roi.width >= 1 && this.roi.height >= 1
      && this.roi.x + this.roi.width <= this.bitmap.width && this.roi.y + this.roi.height <= this.bitmap.height);
  }
  private async preview(): Promise<void> {
    this.reset(); const serial = this.serial, context = this.options.context(), file = this.options.fileInput.files?.[0];
    this.options.changed();
    if (!file) return;
    if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size < 1 || file.size > 4*1024*1024) { this.options.notice("请选择不超过 4 MiB 的 PNG、JPEG 或 WebP"); return; }
    this.loading = true;
    let decoded: ImageBitmap | undefined;
    try {
      const bytes = await file.arrayBuffer(), bitmap = await createImageBitmap(file);
      decoded = bitmap;
      if (serial !== this.serial || context !== this.options.context()) { bitmap.close(); return; }
      if (bitmap.width < 1 || bitmap.height < 1 || bitmap.width > 4096 || bitmap.height > 4096 || bitmap.width*bitmap.height > 16_000_000) { bitmap.close(); throw new Error("参考图每边不得超过 4096 像素，最多 1600 万像素"); }
      const sourceSha256 = await digest(bytes);
      if (serial !== this.serial || context !== this.options.context()) { bitmap.close(); return; }
      this.bitmap = bitmap; this.bytes = bytes; this.sourceSha256 = sourceSha256;
      decoded = undefined;
      this.roi = { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
      this.options.root.hidden = false; this.writeFields(); this.draw();
    } catch (error) { if (serial === this.serial) this.options.notice(error instanceof Error ? error.message : "参考图预览不可用"); }
    finally { decoded?.close(); if (serial === this.serial) { this.loading = false; this.options.changed(); this.draw(); } }
  }
  private point(event: PointerEvent): {x:number;y:number} {
    const rect = this.canvas.getBoundingClientRect(), bitmap = this.bitmap!;
    return { x: Math.max(0,Math.min(bitmap.width,Math.round((event.clientX-rect.left)/rect.width*bitmap.width))),
      y: Math.max(0,Math.min(bitmap.height,Math.round((event.clientY-rect.top)/rect.height*bitmap.height))) };
  }
  private selectPoint(event: PointerEvent): void {
    if (!this.drag || this.blocked || !this.bitmap) return;
    const point = this.point(event), x = Math.min(this.drag.x,point.x), y = Math.min(this.drag.y,point.y);
    this.roi = { x, y, width: Math.min(this.bitmap.width-x,Math.max(1,Math.abs(point.x-this.drag.x))),
      height: Math.min(this.bitmap.height-y,Math.max(1,Math.abs(point.y-this.drag.y))) };
    this.writeFields(); this.options.changed(); this.draw();
  }
  private writeFields(): void { for (const key of ["x","y","width","height"] as const) this.fields[key].value = String(this.roi[key]); }
  private draw(): void {
    this.saveButton.disabled = this.blocked || this.loading || !this.valid();
    if (!this.bitmap) return;
    this.canvas.width = this.bitmap.width; this.canvas.height = this.bitmap.height;
    this.canvas.style.width = `${Math.min(640,360*this.bitmap.width/this.bitmap.height)}px`;
    const context = this.canvas.getContext("2d"); if (!context) return;
    context.drawImage(this.bitmap,0,0);
    const label = this.options.root.querySelector<HTMLElement>('[data-icon-crop-size]')!;
    if (!this.valid()) { label.textContent = "请填写图片范围内的整数坐标和主体尺寸"; this.subject.hidden = true; return; }
    context.strokeStyle = "#ff2848"; context.lineWidth = Math.max(1,Math.min(this.bitmap.width,this.bitmap.height)/150);
    context.strokeRect(this.roi.x,this.roi.y,this.roi.width,this.roi.height);
    this.subject.hidden = false; this.subject.width = this.roi.width; this.subject.height = this.roi.height;
    this.subject.style.width = `${Math.min(240,180*this.roi.width/this.roi.height)}px`;
    this.subject.getContext("2d")?.drawImage(this.bitmap,this.roi.x,this.roi.y,this.roi.width,this.roi.height,0,0,this.roi.width,this.roi.height);
    label.textContent = `全图 ${this.bitmap.width} × ${this.bitmap.height} · 主体 ${this.roi.width} × ${this.roi.height}。坐标从显示朝向后的左上角计算；不缩放主体。`;
  }
  private async save(): Promise<void> {
    if (this.blocked || this.loading || !this.valid()) return;
    if (!this.options.approved()) { this.options.notice("请单独批准将本次全图与主体保存到当前工程"); return; }
    const serial = this.serial, context = this.options.context(), roi = { ...this.roi }, bitmap = this.bitmap!;
    try {
    const identity = { sourceSha256: this.sourceSha256, width: bitmap.width, height: bitmap.height, roi };
    const cropId = await digest(new TextEncoder().encode(JSON.stringify(identity)));
    if (serial !== this.serial || context !== this.options.context() || this.blocked || !this.options.approved()
      || JSON.stringify(roi) !== JSON.stringify(this.roi)) return;
    let binary = ""; for (const byte of new Uint8Array(this.bytes!)) binary += String.fromCharCode(byte);
    await this.options.save({ ...identity, base64: btoa(binary), approved: true }, cropId);
    } catch { if (serial === this.serial && context === this.options.context()) this.options.notice("裁剪保存未确认，请保留原请求并查询结果"); }
  }
}

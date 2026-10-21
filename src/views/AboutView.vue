<script setup lang="ts">
import { computed, ref } from 'vue'
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { frontendIdentity, legacyReference, backendVersionInformation } from '../domain/product-information'
import legacyIcon from '../assets/legacy-v148/about-icon.svg'
import InfoTip from '../components/InfoTip.vue'
import donationQr from '../assets/legacy-v148/donation-qr.png'
import { useCompanionBrowserStore } from '../stores/companion-browser'
import { companionBrowserProvider } from '../companion-browser-integration'
const directory = useCompanionBrowserStore()
const connected = computed(() => directory.connected && directory.provider === companionBrowserProvider.value)
// Only the original numeric Creator version shape belongs in a copied support
// summary. Arbitrary backend text must not carry a path or diagnostic secret.
const creatorVersions = computed(() => connected.value ? [...new Set(directory.statuses.flatMap(status => typeof status.creatorVersion === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(status.creatorVersion) ? [status.creatorVersion] : []))].join('、') : '')
const message = ref('')
const versionInfo = computed(() => `${frontendIdentity.name} ${frontendIdentity.version}\n前端产品版本：${frontendIdentity.version}\n后端产品版本：${backendVersionInformation.label}\n前端版本，非 daemon / Creator 版本\n版本构建基线：${frontendIdentity.hostBase} + Next ${frontendIdentity.nextRevision}\n原 UI 参考：${legacyReference.inspectedVersion}\n工程接口：${connected.value ? '已取得真实读取结果' : '未取得当前来源的有效响应'}\nCreator 已返回版本：${creatorVersions.value || '未读取'}\n未包含工程路径、token 或图片内容`)
async function copyVersion() {
  message.value = ''
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText(versionInfo.value)
    ElMessage.success('版本信息已复制')
  } catch { ElMessage.warning('复制未完成，请重试') }
}
async function copyFeedback() {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
    await navigator.clipboard.writeText('332725585@qq.com'); message.value = '旧版反馈地址已复制；未发送邮件。'
  } catch { message.value = '浏览器未能复制，可手动选择下方反馈地址。' }
}
</script>
<template>
  <section class="panel information-card about-identity-next">
    <header class="about-product-heading"><img :src="legacyIcon" alt="Creator AI Companion 原图标" width="48" height="48"/><div><span class="section-kicker">ABOUT</span><h2>Creator AI Companion</h2><p>{{ frontendIdentity.name }} · <strong>前端 v{{ frontendIdentity.version }}</strong><el-tooltip content="复制版本信息" placement="top"><el-button class="version-copy" text size="small" :icon="CopyDocument" aria-label="复制版本信息" title="复制版本信息" @click="copyVersion" @keydown.enter.prevent.stop="copyVersion" @keydown.space.prevent.stop="copyVersion"/></el-tooltip></p><p class="backend-version" :title="backendVersionInformation.detail">后端：{{ backendVersionInformation.label }}</p></div></header>
    <p>Cocos 工程、知识库、模型服务与游戏资源的工作区。</p>

    <div class="information-actions"><RouterLink to="/changelog" class="information-link">查看更新记录</RouterLink><RouterLink to="/migration" class="information-link">查看功能支持范围</RouterLink><RouterLink to="/history" class="information-link">查看版本与连接记录</RouterLink><RouterLink to="/help" class="information-link">阅读使用帮助 →</RouterLink></div>
    <div class="legacy-about"><div><dl class="information-definitions"><div><dt>问题反馈</dt><dd><a href="mailto:332725585@qq.com">332725585@qq.com</a><el-button text @click="copyFeedback">复制反馈地址</el-button></dd></div><div><dt>原版声明</dt><dd>本工具永久免费 · 禁止二次售卖。Creator AI Companion 永久免费提供，禁止任何个人或组织以任何形式二次售卖。</dd></div><div><dt>原版下载入口</dt><dd><a href="https://gitee.com/sxtao_admin/cocos-mcp" target="_blank" rel="noopener noreferrer">前往 Gitee 下载 ↗</a></dd></div></dl><p>Scene、Prefab 与 Meta 始终由 Creator 生成和序列化；写入操作受工程身份与版本校验保护。</p></div><figure class="legacy-donation"><h3>支持开发</h3><img :src="donationQr" alt="原版微信收款二维码" width="220" height="220"/><figcaption>微信扫码支持开发</figcaption></figure></div>
  </section>
  <section class="panel information-card"><h3>版本与服务身份</h3><dl class="information-definitions"><div><dt>本页面</dt><dd>Companion Next v{{ frontendIdentity.version }}</dd></div><div><dt>版本构建基线</dt><dd>{{ frontendIdentity.hostBase }} + Next {{ frontendIdentity.nextRevision }}，非实时宿主版本</dd></div><div><dt>已核旧 UI 源码</dt><dd>v{{ legacyReference.inspectedVersion }}</dd></div><div><dt>后端产品版本</dt><dd>{{ backendVersionInformation.label }}<InfoTip label="后端版本说明" :text="backendVersionInformation.detail"/></dd></div><div><dt>Bridge 协议参考</dt><dd>{{ legacyReference.bridgeProtocol }}</dd></div></dl><p v-if="message" role="status" class="form-help">{{ message }}</p></section>
</template>
<style scoped>
.backend-version{font-size:12px;color:var(--el-text-color-secondary);margin-top:5px!important}.version-copy{margin-left:6px;vertical-align:middle}.version-copy:focus-visible{outline:2px solid var(--el-color-primary);outline-offset:2px}.about-product-heading{display:flex;align-items:center;gap:12px}.about-product-heading h2{margin:4px 0}.about-product-heading p{margin:0}.about-identity-next>.legacy-about{margin-top:22px}.about-product-heading>div{min-width:0;overflow-wrap:anywhere}
</style>

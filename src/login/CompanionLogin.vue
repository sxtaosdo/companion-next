<!-- Adapted from Cool-admin Vue 8.x modules/base/pages/login/index.vue, MIT.
Source: https://github.com/cool-team-official/cool-admin-vue/tree/8.x
Reuses layout, mandatory fields, Enter submission and failed-login captcha refresh.
Companion uses its own same-origin authentication adapter and HttpOnly Cookie, never Cool token storage.
See COOL-ADMIN-LICENSE.txt. -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import PicCaptcha from './PicCaptcha.vue'
import { finishLogin, loginError, LoginFailure, readCaptcha, readLoginConfig, submitLogin, verifyLoginSession } from './auth'
const phase = ref<'checking' | 'ready' | 'blocked' | 'complete'>('checking')
const saving = ref(false)
const captchaLoading = ref(false)
const captchaImage = ref('')
const error = ref('')
const form = reactive({ username: '', password: '', captchaId: '', verifyCode: '' })
let active = true, revision = 0
async function refreshCaptcha() {
  if (!active || saving.value || captchaLoading.value || phase.value !== 'ready') return
  const current = ++revision
  captchaLoading.value = true
  form.captchaId = ''; form.verifyCode = ''; captchaImage.value = ''
  try {
    const data = await readCaptcha(window.fetch.bind(window))
    if (active && current === revision) { form.captchaId = data.captchaId; captchaImage.value = data.image }
  } catch (failure) { if (active && current === revision) error.value = loginError(failure) }
  finally { if (active && current === revision) captchaLoading.value = false }
}
async function initialize() {
  if (saving.value || phase.value === 'checking' && captchaLoading.value) return
  phase.value = 'checking'; error.value = ''
  try {
    const config = await readLoginConfig(window.fetch.bind(window))
    if (!active) return
    if (!config.configured || !config.available) {
      phase.value = 'blocked'; error.value = loginError(new LoginFailure(!config.configured ? 'AUTH_NOT_CONFIGURED' : 'AUTH_PROVIDER_UNAVAILABLE')); return
    }
    phase.value = 'ready'; await refreshCaptcha()
  } catch (failure) { if (active) { phase.value = 'blocked'; error.value = loginError(failure) } }
}
async function toLogin() {
  if (!active || saving.value || captchaLoading.value || phase.value !== 'ready') return
  error.value = ''
  if (!form.username.trim()) { error.value = '用户名不能为空。'; return }
  if (!form.password) { error.value = '密码不能为空。'; return }
  if (!form.verifyCode.trim()) { error.value = '图片验证码不能为空。'; return }
  if (!form.captchaId) { error.value = '请先刷新图片验证码。'; return }
  saving.value = true
  let refresh = false
  try {
    await submitLogin(window.fetch.bind(window), form)
    form.password = ''
    if (!active) return
    await verifyLoginSession(window.fetch.bind(window))
    if (!active) return
    phase.value = 'complete'
    finishLogin(window.location.search, window.location.origin, window.parent === window ? null : window.parent, target => window.location.replace(target), window.location.hash)
  } catch (failure) {
    if (!active) return
    error.value = loginError(failure)
    if (failure instanceof LoginFailure && failure.code === 'AUTH_NOT_CONFIGURED') phase.value = 'blocked'
    refresh = true
  } finally {
    form.password = ''
    saving.value = false
    if (active && refresh) await refreshCaptcha()
  }
}
onMounted(initialize)
onBeforeUnmount(() => { active = false; revision++; form.password = ''; form.verifyCode = ''; form.captchaId = '' })
</script>
<template>
  <main class="page-login" :class="{ embedded: true }">
    <section class="box" aria-labelledby="login-title">
      <div class="logo"><span class="icon" aria-hidden="true">C</span><h1 id="login-title">Companion</h1></div>
      <p class="desc">开发者后台登录</p>
      <p v-if="phase === 'checking'" role="status">正在检查登录服务…</p>
      <p v-if="phase === 'complete'" role="status">登录成功，正在返回。</p>
      <p v-if="error" class="login-error" role="alert">{{ error }}</p>
      <el-button v-if="phase === 'blocked'" @click="initialize">重试连接</el-button>
      <el-form v-if="phase === 'ready'" class="form" label-position="top" :disabled="saving" @submit.prevent="toLogin">
        <el-form-item label="用户名"><el-input v-model="form.username" aria-label="用户名" placeholder="请输入用户名" maxlength="128" autocomplete="username" :disabled="saving"/></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" aria-label="密码" type="password" placeholder="请输入密码" show-password autocomplete="off" :disabled="saving"/></el-form-item>
        <el-form-item label="验证码"><div class="captcha-row"><el-input v-model="form.verifyCode" aria-label="验证码" placeholder="图片验证码" maxlength="8" autocomplete="off" :disabled="saving || captchaLoading" @keyup.enter="toLogin"/><PicCaptcha :image="captchaImage" :loading="captchaLoading" :disabled="saving" @refresh="refreshCaptcha"/></div></el-form-item>
        <div class="op"><el-button native-type="submit" type="primary" :loading="saving" :disabled="saving || captchaLoading || !form.captchaId">登录</el-button></div>
      </el-form>
    </section>
  </main>
</template>
<style scoped>
.page-login { min-height:100vh; display:flex; align-items:center; justify-content:center; box-sizing:border-box; padding:28px 20px; color:#2c3142; background:#f5f7fb; }
.box { width:100%; max-width:340px; }
.logo { display:flex; justify-content:center; align-items:center; gap:10px; margin-bottom:10px; }
.logo .icon { display:grid; place-items:center; width:38px; height:38px; border-radius:8px; background:#7660bf; color:#fff; font-weight:700; font-size:28px; }
h1 { font-size:30px; margin:0; letter-spacing:1px; }
.desc { text-align:center; color:#637187; margin:0 0 24px; }
.form { width:100%; }
.form :deep(.el-input__inner) { height:43px; }
.form :deep(.el-form-item) { margin-bottom:18px; }
.form :deep(.el-form-item__label) { color:#637187; }
.captcha-row { display:flex; gap:10px; width:100%; align-items:center; }
.op { display:flex; margin-top:24px; }
.op .el-button { width:100%; height:44px; font-size:16px; }
.login-error { color:#a52d3a; line-height:1.6; margin:0 0 16px; }
@media(max-width:480px) { .page-login { padding:20px 16px; align-items:flex-start; } .desc { margin-bottom:16px; } }
</style>

import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import CompanionLogin from './login/CompanionLogin.vue'
createApp(CompanionLogin).use(ElementPlus, { locale: zhCn }).mount('#login-app')

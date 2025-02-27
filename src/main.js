import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import App from './App.vue'
import Login from './views/Login.vue'

// 创建路由实例
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/',
      name: 'home',
      component: () => import('./views/Home.vue'),
      meta: { requiresAuth: true }
    }
  ]
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  // 检查是否需要初始化管理员账户
  try {
    const response = await fetch('http://localhost:3000/api/admin/check-init')
    const data = await response.json()
    if (data.needInit) {
      if (to.path !== '/login') {
        return next('/login')
      }
      return next()
    }
  } catch (error) {
    console.error('检查初始化状态失败:', error)
    return next('/login')
  }

  // 检查登录状态
  const token = localStorage.getItem('token')
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!token) {
      return next('/login')
    }
    next()
  } else {
    if (token && to.path === '/login') {
      next('/')
    } else {
      next()
    }
  }
})

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})

app.mount('#app')

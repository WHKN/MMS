<template>
  <div class="login-container">
    <el-card class="login-card">
      <template #header>
        <h2 class="login-title">会员储值消费系统</h2>
      </template>
      
      <el-form
        ref="loginForm"
        :model="loginData"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleLogin"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="loginData.username"
            placeholder="请输入用户名"
            prefix-icon="User"
          />
        </el-form-item>
        
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="loginData.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" native-type="submit" :loading="loading" class="login-button">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <!-- 首次使用提示 -->
    <el-dialog
      v-model="showInitDialog"
      title="系统初始化"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      width="30%"
      class="init-dialog"
    >
      <el-form
        ref="initForm"
        :model="initData"
        :rules="initRules"
        label-position="top"
      >
        <el-form-item label="设置管理员用户名" prop="username">
          <el-input v-model="initData.username" placeholder="请输入管理员用户名" />
        </el-form-item>
        
        <el-form-item label="设置管理员密码" prop="password">
          <el-input
            v-model="initData.password"
            type="password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>
        
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="initData.confirmPassword"
            type="password"
            placeholder="请再次输入密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="handleInitSubmit" :loading="initLoading">
          创建管理员账户
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'

const router = useRouter()

const loginData = ref({
  username: '',
  password: ''
})

const loading = ref(false)
const showInitDialog = ref(false)
const initLoading = ref(false)

const initData = ref({
  username: '',
  password: '',
  confirmPassword: ''
})

// 登录表单验证规则
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

// 初始化表单验证规则
const initRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== initData.value.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 检查是否需要初始化管理员账户
const checkInitStatus = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/admin/check-init')
    const data = await response.json()
    if (data.needInit) {
      showInitDialog.value = true
      ElMessage.warning('系统需要初始化管理员账户')
    }
  } catch (error) {
    ElMessage.error('系统初始化检查失败')
  }
}

// 处理登录
const handleLogin = async () => {
  loading.value = true
  try {
    const response = await fetch('http://localhost:3000/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData.value)
    })

    if (response.ok) {
      const data = await response.json()
      localStorage.setItem('token', data.token)
      router.push('/')
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '登录失败')
    }
  } catch (error) {
    ElMessage.error('登录请求失败')
  } finally {
    loading.value = false
  }
}

// 处理初始化提交
const handleInitSubmit = async () => {
  initLoading.value = true
  try {
    const response = await fetch('http://localhost:3000/api/admin/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: initData.value.username,
        password: initData.value.password
      })
    })

    if (response.ok) {
      ElMessage.success('管理员账户创建成功')
      showInitDialog.value = false
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '创建管理员账户失败')
    }
  } catch (error) {
    ElMessage.error('创建管理员账户请求失败')
  } finally {
    initLoading.value = false
  }
}

onMounted(() => {
  checkInitStatus()
})
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #1890ff 0%, #36cfc9 100%);
  transition: background 0.3s ease;
}

.login-card {
  width: 400px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
  background: rgba(255, 255, 255, 0.95);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15);
}

.login-title {
  text-align: center;
  margin: 0;
  color: #1890ff;
  font-size: 24px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.login-button {
  width: 100%;
  margin-top: 20px;
  height: 40px;
  font-size: 16px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #1890ff;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #1890ff;
}

.el-dialog {
  border-radius: 12px;
  overflow: hidden;
}

:deep(.el-dialog__header) {
  background: #1890ff;
  margin: 0;
  padding: 20px;
}

:deep(.el-dialog__title) {
  color: white;
  font-weight: 600;
}

:deep(.el-dialog__body) {
  padding: 30px 20px;
}

:deep(.el-dialog__footer) {
  padding: 10px 20px 20px;
  text-align: center;
}
.init-dialog {
  margin: 0;
}

:deep(.el-dialog) {
  margin: 15vh auto !important;
  max-width: 500px;
}
</style>
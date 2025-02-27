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

      <!-- 首次使用提示 -->
      <el-dialog
        v-model="showInitDialog"
        title="系统初始化"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="false"
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
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

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
    showInitDialog.value = data.needInit
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
      window.location.href = '/'
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
  background-color: #f5f7fa;
}

.login-card {
  width: 400px;
}

.login-title {
  text-align: center;
  margin: 0;
  color: #303133;
}

.login-button {
  width: 100%;
  margin-top: 20px;
}
</style>
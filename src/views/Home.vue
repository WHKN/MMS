<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
const addMemberForm = ref({
  name: '',
  phone: '',
  initialBalance: 0,
  bonusAmount: 0,
  selectedTypes: []
})
const addMemberFormRef = ref(null)

const transactionFormRules = {
  memberTypeId: [
    { required: true, message: '请选择会员类型', trigger: 'change' }
  ],
  amount: [
    { required: true, message: '请输入充值金额', trigger: 'blur', type: 'number' },
    { type: 'number', min: 0, message: '金额必须大于等于0', trigger: 'blur' }
  ],
  duration_days: [
    {
      required: true,
      validator: (rule, value, callback) => {
        const type = memberTypes.value.find(t => t.id === rechargeForm.memberTypeId)?.type
        if (['year', 'season', 'month'].includes(type) && (value === null || value <= 0)) {
          callback(new Error('请输入有效天数'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  times: [
    {
      required: true,
      validator: (rule, value, callback) => {
        const type = memberTypes.value.find(t => t.id === rechargeForm.memberTypeId)?.type
        if (type === 'times' && (value === null || value <= 0 || value % 1 !== 0)) {
          callback(new Error('请输入有效次数'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  times: [
    {
      required: true,
      validator: (rule, value, callback) => {
        const type = memberTypes.value.find(t => t.id === rechargeForm.memberTypeId)?.type
        if (type === 'times') {
          if (value === null || value <= 0) {
            callback(new Error('请输入有效的充值次数'))
            return
          }
          if (value % 1 !== 0) {
            callback(new Error('次数必须为整数'))
            return
          }
        }
        callback()
      },
      trigger: 'blur'
    }
  ]
}

const memberFormRules = {
  name: [
    { required: true, message: '请输入会员姓名', trigger: 'blur' },
    { min: 2, max: 10, message: '姓名长度在2到10个字符', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号码', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码格式', trigger: 'blur' }
  ],
  selectedTypes: [
    { required: true, message: '请选择至少一个会员类型', trigger: 'change' }
  ]
}
const router = useRouter()

// 数据状态
const members = ref([])
const searchQuery = ref('')
const currentMonth = ref(new Date().toISOString().slice(0, 7))
const monthlyStats = ref(null)
const recentTransactions = ref([])
const currentMember = ref(null)
const memberTransactions = ref([])
const memberTypes = ref([])
const pointLevels = ref([])

// 充值表单数据
const rechargeForm = ref({
  amount: 0,
  description: ''
})

// 消费表单数据
const consumeForm = ref({
  amount: 0,
  description: '',
  memberTypeId: null,
  discountedAmount: 0
})

// 添加会员等级表单数据
const pointLevelForm = ref({
  name: '',
  min_points: 0,
  discount: 1
})

// 添加对话框显示状态控制变量
const showAddMemberDialog = ref(false)
const showEditDialog = ref(false)
const showRechargeDialog = ref(false)
const showConsumeDialog = ref(false)
const showMemberDetailsDialog = ref(false)
const showMemberTypesDialog = ref(false)
const showPointLevelsDialog = ref(false)

// 添加过滤后的会员列表计算属性
const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value
  const query = searchQuery.value.toLowerCase()
  return members.value.filter(member => 
    member.name.toLowerCase().includes(query) ||
    member.phone.toLowerCase().includes(query)
  )
})

const editMemberForm = ref({
  name: '',
  phone: '',
  selectedTypes: []
})
const openEditDialog = (member) => {
  currentMember.value = member
  editMemberForm.value = {
    name: member.name,
    phone: member.phone,
    selectedTypes: (member.memberTypes || []).map(t => t.id)
  }
  showEditDialog.value = true
}

const handleEditMember = async () => {
  try {
    if (!editMemberForm.value.selectedTypes || editMemberForm.value.selectedTypes.length === 0) {
      ElMessage.error('请选择至少一个会员类型')
      return
    }

    // 验证所选会员类型是否有效
    const invalidTypes = editMemberForm.value.selectedTypes.filter(id => 
      !memberTypes.value.find(t => t.id === id)
    )
    if (invalidTypes.length > 0) {
      ElMessage.error('包含无效的会员类型选择')
      return
    }

    const response = await fetch(`http://localhost:3000/api/members/${currentMember.value.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...editMemberForm.value,
        memberTypes: editMemberForm.value.selectedTypes.map(id => {
          const memberType = memberTypes.value.find(t => t.id === id)
          return {
            id: id,
            type: memberType.type,
            name: memberType.name,
            duration_days: memberType.duration_days,
            total_times: memberType.total_times
          }
        })
      })
    })

    if (response.ok) {
      ElMessage.success('更新会员信息成功')
      showEditDialog.value = false
      await fetchMembers()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '更新会员信息失败')
    }
  } catch (error) {
    console.error('编辑会员失败:', error)
    ElMessage.error('更新会员信息失败')
  }
}
const fetchMembers = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/members', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      members.value = (await response.json()).map(member => ({
        ...member,
        memberTypes: member.memberTypes || []
      }))
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '获取会员列表失败')
    }
  } catch (error) {
    ElMessage.error('获取会员列表失败')
  }
}
const handleAddMember = async () => {
  if (!addMemberFormRef.value) return
  try {
    await addMemberFormRef.value.validate()
    const response = await fetch('http://localhost:3000/api/members', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...addMemberForm.value,
        memberTypes: addMemberForm.value.selectedTypes.map(id => ({
          id: id,
          type: memberTypes.value.find(t => t.id === id)?.type
        }))
      })
    })
    if (response.ok) {
      ElMessage.success('添加会员成功')
      showAddMemberDialog.value = false
      addMemberForm.value = {
        name: '',
        phone: '',
        initialBalance: 0,
        bonusAmount: 0,
        selectedTypes: []
      }
      await fetchMembers()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '添加会员失败')
    }
  } catch (error) {
    ElMessage.error('添加会员失败')
  }
}
const handleDeleteMember = async (member) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该会员吗？删除后将无法恢复。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await fetch(`http://localhost:3000/api/members/${member.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      ElMessage.success('删除会员成功')
      await fetchMembers()
      await fetchMonthlyReport()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '删除会员失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除会员失败')
    }
  }
}

const openRechargeDialog = (member) => {
  currentMember.value = {
    ...member,
    memberTypes: Array.isArray(member.memberTypes) ? member.memberTypes : []
  }
  rechargeForm.value = { 
  amount: 0, 
  description: '',
  duration_days: null,
  times: null
}
  showRechargeDialog.value = true
}

const openConsumeDialog = (member) => {
  currentMember.value = member
  consumeForm.value = {
    amount: 0,
    description: '',
    memberTypeId: null,
    discountedAmount: 0
  }
  showConsumeDialog.value = true
}

const handleMemberTypeChange = (typeId) => {
  const selectedType = memberTypes.value.find(t => t.id === typeId)
  if (selectedType) {
    rechargeForm.value = {
      ...rechargeForm.value,
      duration_days: selectedType.duration_days || 365,
      times: selectedType.total_times || 365
    }
  }
}

const handleRecharge = async () => {
  try {
    // 表单验证
    const selectedType = memberTypes.value.find(t => t.id === rechargeForm.value.memberTypeId)
    if (!selectedType) {
      ElMessage.error('请选择会员类型')
      return
    }
    if (!rechargeForm.value.amount || rechargeForm.value.amount <= 0) {
      ElMessage.error('请输入有效的充值金额')
      return
    }

    // 检查会员是否已有该类型，若没有则自动添加
    const hasType = currentMember.value.memberTypes.some(t => t.id === rechargeForm.value.memberTypeId)
    if (!hasType) {
      await fetch(`http://localhost:3000/api/members/${currentMember.value.id}/types`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type_id: rechargeForm.value.memberTypeId
        })
      })
    }
    // 将充值金额转换为积分，1元=10积分
    // 仅普通储值计入可消费余额
// 积分计算
const points = Math.floor(rechargeForm.value.amount * 10);
rechargeForm.value.points = points;

// 余额处理
if (selectedType.type === 'stored') {
  rechargeForm.value.balance = rechargeForm.value.amount;
}

    // 设置开始日期
    const startDate = new Date().toISOString().slice(0, 10);

    // 确认充值操作
    await ElMessageBox.confirm(
      `确定为会员 ${currentMember.value.name} 充值 ${rechargeForm.value.amount} 元吗？`,
      '充值确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    // 创建交易
    const rechargeResponse = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...rechargeForm.value,
        start_date: startDate
      })
    });

    const response = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        member_id: currentMember.value.id,
        type: 'recharge',
        member_type_id: rechargeForm.value.memberTypeId,
        amount: rechargeForm.value.amount,
        duration_days: rechargeForm.value.duration_days,
        times: rechargeForm.value.times,
        description: rechargeForm.value.description || 
          (rechargeForm.value.memberTypeId 
            ? `${memberTypes.value.find(t => t.id === rechargeForm.value.memberTypeId)?.name}充值` 
            : `会员储值 ${rechargeForm.value.amount} 元`)
      })
    })

    if (response.ok) {
      ElMessage.success('储值成功')
      showRechargeDialog.value = false
      await Promise.all([
        fetchMembers(),
        fetchMonthlyReport()
      ])
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '储值失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('储值操作失败')
      console.error('储值错误:', error)
    }
  }
}

const handleConsume = async () => {
  try {
    // 表单验证
    if (!consumeForm.value.amount || consumeForm.value.amount <= 0) {
      ElMessage.error('请输入有效的消费金额')
      return
    }

    // 如果选择了会员类型，验证是否为有效选择
    if (consumeForm.value.memberTypeId && !memberTypes.value.find(type => type.id === consumeForm.value.memberTypeId)) {
      ElMessage.error('请选择有效的会员类型')
      return
    }

    // 确认消费操作
    await ElMessageBox.confirm(
      `确定为会员 ${currentMember.value.name} 消费 ${consumeForm.value.amount} 元吗？`,
      '消费确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        member_id: currentMember.value.id,
        type: 'consume',
        amount: consumeForm.value.amount,
        description: consumeForm.value.description || `会员消费 ${consumeForm.value.amount} 元`,
        member_type_id: consumeForm.value.memberTypeId
      })
    })
    if (response.ok) {
      ElMessage.success('消费成功')
      showConsumeDialog.value = false
      consumeForm.value = {
        amount: 0,
        description: '',
        memberTypeId: null,
        discountedAmount: 0
      }
      await Promise.all([
        fetchMembers(),
        fetchMonthlyReport(),
        fetchRecentTransactions()
      ])
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '消费失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('消费操作失败')
      console.error('消费错误:', error)
    }
  }
}
const showMemberDetails = async (member) => {
  currentMember.value = member
  showMemberDetailsDialog.value = true
  try {
    const response = await fetch(`http://localhost:3000/api/transactions/${member.id}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      memberTransactions.value = await response.json()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '获取交易记录失败')
    }
  } catch (error) {
    ElMessage.error('获取交易记录失败')
  }
}

const fetchMonthlyReport = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/monthly-report?month=${currentMonth.value}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      monthlyStats.value = await response.json()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '获取月度报表失败')
    }
  } catch (error) {
    ElMessage.error('获取月度报表失败')
  }
}

const handleSearch = () => {
  // 在这里实现搜索逻辑
  // 可以根据searchQuery过滤members列表
  if (!searchQuery.value) {
    fetchMembers()
    return
  }
  
  const query = searchQuery.value.toLowerCase()
  members.value = members.value.filter(member => 
    member.name.toLowerCase().includes(query) ||
    member.phone.toLowerCase().includes(query)
  )
}

const handleLogout = () => {
  localStorage.removeItem('token')
  router.push('/login')
}

const fetchMemberTypes = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/member-types', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      memberTypes.value = await response.json()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '获取会员类型失败')
    }
  } catch (error) {
    ElMessage.error('获取会员类型失败')
  }
}

const fetchPointLevels = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/point-levels', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      pointLevels.value = await response.json()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '获取积分等级失败')
    }
  } catch (error) {
    ElMessage.error('获取积分等级失败')
  }
}

// 添加会员类型
const memberTypeForm = ref({
  name: '',
  type: '',
  duration_days: null,
  total_times: null,
  price: 0,
  description: ''
})

const memberTypeFormRef = ref(null)

const memberTypeFormRules = {
  name: [
    { required: true, message: '请输入会员类型名称', trigger: 'blur' },
    { min: 2, max: 20, message: '长度在 2 到 20 个字符', trigger: 'blur' }
  ],
  type: [
    { required: true, message: '请选择会员类型', trigger: 'change' }
  ],
  duration_days: [
    { required: true, message: '请输入有效期天数', trigger: 'blur', type: 'number' }
  ],
  total_times: [
    { required: true, message: '请输入使用次数', trigger: 'blur', type: 'number' }
  ],
  price: [
    { required: true, message: '请输入价格', trigger: 'blur', type: 'number' },
    { type: 'number', min: 0, message: '价格必须大于等于0', trigger: 'blur' }
  ]
}

const resetMemberTypeForm = () => {
  memberTypeForm.value = {
    name: '',
    type: '',
    duration_days: null,
    total_times: null,
    price: 0,
    description: ''
  }
  if (memberTypeFormRef.value) {
    memberTypeFormRef.value.resetFields()
  }
}

const handleAddMemberType = async () => {
  if (!memberTypeFormRef.value) return
  try {
    await memberTypeFormRef.value.validate()
    const response = await fetch('http://localhost:3000/api/member-types', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(memberTypeForm.value)
    })

    if (response.ok) {
      ElMessage.success('添加会员类型成功')
      resetMemberTypeForm()
      await fetchMemberTypes()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '添加会员类型失败')
    }
  } catch (error) {
    if (error.name === 'ValidationError') {
      ElMessage.error('请填写必要的会员类型信息')
    } else {
      ElMessage.error('添加会员类型失败')
      console.error('添加会员类型错误:', error)
    }
  }
}

// 删除会员类型
const handleDeleteMemberType = async (memberType) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该会员类型吗？删除后将无法恢复。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await fetch(`http://localhost:3000/api/member-types/${memberType.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      ElMessage.success('删除会员类型成功')
      await fetchMemberTypes()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '删除会员类型失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除会员类型失败')
    }
  }
}

// 添加会员等级
const handleAddPointLevel = async () => {
  try {
    // 表单验证
    if (!pointLevelForm.value.name || pointLevelForm.value.min_points === undefined || pointLevelForm.value.min_points === null || pointLevelForm.value.discount === null) {
      ElMessage.error('请填写完整的会员等级信息')
      return
    }

    // 确保min_points不为空且为非负数
    if (pointLevelForm.value.min_points < 0) {
      ElMessage.error('最小积分不能小于0')
      return
    }
    const response = await fetch('http://localhost:3000/api/point-levels', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pointLevelForm.value)
    })
    if (response.ok) {
      ElMessage.success('添加会员等级成功')
      pointLevelForm.value = { name: '', min_points: 0, discount: 1 }
      await fetchPointLevels()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '添加会员等级失败')
    }
  } catch (error) {
    ElMessage.error('添加会员等级失败')
  }
}

// 删除会员等级
const handleDeletePointLevel = async (pointLevel) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除该会员等级吗？删除后将无法恢复。',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await fetch(`http://localhost:3000/api/point-levels/${pointLevel.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      ElMessage.success('删除会员等级成功')
      await fetchPointLevels()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '删除会员等级失败')
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除会员等级失败')
    }
  }
}

onMounted(async () => {
  await Promise.all([
    fetchMembers(),
    fetchMonthlyReport(),
    fetchMemberTypes(),
    fetchPointLevels()
  ])
})
</script>

<template>
  <div class="home-container">
    <el-container>
      <el-header class="header">
        <div class="header-content">
          <h2>会员储值消费系统</h2>
          <div class="header-buttons">
            <el-button type="primary" @click="showMemberTypesDialog = true">会员类型管理</el-button>
            <el-button type="primary" @click="showPointLevelsDialog = true">会员等级管理</el-button>
            <el-button type="danger" @click="handleLogout">退出登录</el-button>
          </div>
        </div>
      </el-header>

      <el-main style="height: calc(100vh - 60px); padding: 20px; overflow: hidden;">
        <el-row :gutter="20" style="height: 100%;">
          <!-- 月度统计卡片 -->
          <el-col :span="24" :lg="6" style="height: 100%;">
            <el-card class="full-height-card">
              <template #header>
                <div class="card-header">
                  <span>月度统计</span>
                  <el-date-picker
                    v-model="currentMonth"
                    type="month"
                    placeholder="选择月份"
                    format="YYYY-MM"
                    value-format="YYYY-MM"
                    @change="fetchMonthlyReport"
                  />
                </div>
              </template>
              <div class="scrollable-content">
                <div v-if="monthlyStats">
                  <p>当月实收充值金额：<span class="amount-plus">¥{{ monthlyStats.totalRecharge || 0 }}</span></p>
                  <p>总会员可用余额(含赠费)：<span class="amount-plus">¥{{ monthlyStats.totalRechargeWithBonus || 0 }}</span></p>
                  <p>当月总消费金额：<span class="amount-minus">¥{{ monthlyStats.totalConsume || 0 }}</span></p>
                  <p>会员总数：{{ monthlyStats.totalMembers || 0 }}</p>
                  <p>有效会员数：{{ monthlyStats.validMembers || 0 }}</p>
                </div>
                <h4>最近交易记录</h4>
                <div v-for="transaction in recentTransactions" :key="transaction.id" class="transaction-item">
                  <div>
                    <div class="transaction-header">
                      <span class="member-name">{{ transaction.member_name }}</span>
                      <div class="transaction-desc">{{ transaction.description }}</div>
                    </div>
                  </div>
                  <div class="transaction-amount">
                    <span :class="transaction.type === 'consume' ? 'amount-minus' : 'amount-plus'">
                      {{ transaction.type === 'consume' ? '-' : '+' }}¥{{ transaction.amount }}
                    </span>
                    <span class="transaction-time">{{ new Date(transaction.created_at).toLocaleString() }}</span>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
          <!-- 会员列表卡片 -->
          <el-col :span="24" :lg="18" style="height: 100%;">
            <el-card class="full-height-card">
              <template #header>
                <div class="card-header">
                  <span>会员管理</span>
                  <el-button type="primary" @click="showAddMemberDialog = true">添加会员</el-button>
                </div>
              </template>
              <div class="scrollable-content">
                <div class="search-bar">
                  <el-input
                    v-model="searchQuery"
                    placeholder="搜索会员姓名或手机号"
                    class="search-input"
                    :prefix-icon="Search"
                    clearable
                    @input="handleSearch"
                  />
                </div>

                <el-table :data="filteredMembers" style="width: 100%">
                  <el-table-column prop="name" label="姓名" align="center" header-align="center" />
                  <el-table-column prop="phone" label="手机号" align="center" header-align="center" />
                  <el-table-column prop="memberTypes" label="会员类型" align="center" header-align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.memberTypes" type="success" effect="plain">{{ row.memberTypes }}</el-tag>
                      <el-tag v-else type="info" effect="plain">普通会员</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="会员等级" align="center" header-align="center">
                    <template #default="{ row }">
                      <el-tag v-if="row.levelName" type="warning" effect="plain">
                        {{ row.levelName }} ({{ (row.levelDiscount * 10).toFixed(1) }}折)
                      </el-tag>
                      <el-tag v-else type="info" effect="plain">普通会员</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="余额" align="center" header-align="center">
                    <template #default="{ row }">
                      <span :class="row.totalBalance > 0 ? 'amount-plus' : 'amount-minus'">¥{{ row.totalBalance }}</span>
                    </template>
                  </el-table-column>
                  
                  <el-table-column label="操作" min-width="150%" align="center" header-align="center" >
                    <template #default="{ row }">
                      <el-button-group>
                        <el-button type="primary" @click="openRechargeDialog(row)">充值</el-button>
                        <el-button type="warning" @click="openConsumeDialog(row)">消费</el-button>
                        <el-button type="info" @click="showMemberDetails(row)">明细</el-button>
                        <el-button type="success" @click="openEditDialog(row)">编辑</el-button>
                        <el-button type="danger" @click="handleDeleteMember(row)">删除</el-button>
                      </el-button-group>
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </el-card>
          </el-col>
        </el-row>
      </el-main>
    </el-container>

    <!-- 添加会员对话框 -->
    <el-dialog
      v-model="showAddMemberDialog"
      title="添加会员"
      width="30%"
    >
      <el-form
        ref="addMemberFormRef"
        :model="addMemberForm"
        :rules="memberFormRules"
        label-width="100px"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="addMemberForm.name" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="addMemberForm.phone" />
        </el-form-item>
        <el-form-item label="充值金额" prop="initialBalance">
          <el-input-number v-model="addMemberForm.initialBalance" :min="0" />
        </el-form-item>
        <el-form-item label="赠费金额" prop="bonusAmount">
          <el-input-number v-model="addMemberForm.bonusAmount" :min="0" />
        </el-form-item>
        <el-form-item label="会员类型" prop="selectedTypes">
          <el-select v-model="addMemberForm.selectedTypes" multiple placeholder="请选择会员类型">
            <el-option
              v-for="type in memberTypes"
              :key="type.id"
              :label="type.name"
              :value="type.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddMemberDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddMember">确定</el-button>
      </template>
    </el-dialog>

    <!-- 编辑会员对话框 -->
    <el-dialog
      v-model="showEditDialog"
      title="编辑会员信息"
      width="30%"
    >
      <el-form
        ref="editMemberFormRef"
        :model="editMemberForm"
        :rules="memberFormRules"
        label-width="100px"
      >
        <el-form-item label="姓名" prop="name">
          <el-input v-model="editMemberForm.name" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="editMemberForm.phone" />
        </el-form-item>
        <el-form-item label="会员类型" prop="selectedTypes">
          <el-select v-model="editMemberForm.selectedTypes" multiple placeholder="请选择会员类型">
            <el-option
              v-for="type in memberTypes"
              :key="type.id"
              :label="type.name"
              :value="type.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleEditMember">确定</el-button>
      </template>
    </el-dialog>

    <!-- 充值对话框 -->
    <el-dialog
      v-model="showRechargeDialog"
      title="会员充值"
      width="30%"
    >
      <el-form
        ref="rechargeFormRef"
        :model="rechargeForm"
        :rules="transactionFormRules"
        label-width="100px"
      >
        <el-form-item label="会员类型" prop="memberTypeId" key="memberType">
          <el-select 
            v-model="rechargeForm.memberTypeId" 
            @change="handleMemberTypeChange"
            placeholder="请选择会员类型">
            <el-option
              v-for="type in memberTypes"
              :key="type.id"
              :label="type.name"
              :value="type.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="充值金额" prop="amount">
          <el-input-number v-model="rechargeForm.amount" :min="0" />
        </el-form-item>
        <el-form-item label="续期天数" prop="duration_days" v-if="rechargeForm.memberTypeId && ['year', 'season', 'month'].includes(memberTypes.find(t => t.id === rechargeForm.memberTypeId)?.type)">
          <el-input-number v-model="rechargeForm.duration_days" :min="1" />
        </el-form-item>
        <el-form-item label="充值次数" prop="times" v-if="rechargeForm.memberTypeId && memberTypes.find(t => t.id === rechargeForm.memberTypeId)?.type === 'times'">
          <el-input-number v-model="rechargeForm.times" :min="1" />
        </el-form-item>
        <el-form-item label="备注" prop="description">
          <el-input v-model="rechargeForm.description" type="textarea" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRechargeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRecharge">确定</el-button>
      </template>
    </el-dialog>

    <!-- 消费对话框 -->
    <el-dialog
      v-model="showConsumeDialog"
      title="会员消费"
      width="30%"
    >
      <el-form
        ref="consumeFormRef"
        :model="consumeForm"
        :rules="transactionFormRules"
        label-width="100px"
      >
        <div class="member-balance-info">
          <p>当前余额：<span :class="currentMember?.totalBalance > 0 ? 'amount-plus' : 'amount-minus'">¥{{ currentMember?.totalBalance }}</span></p>
          <p v-if="currentMember?.levelName">会员等级：<el-tag type="warning" effect="plain">{{ currentMember.levelName }} ({{ (currentMember.levelDiscount * 10).toFixed(1) }}折)</el-tag></p>
        </div>
        <el-form-item label="消费金额" prop="amount">
          <el-input-number v-model="consumeForm.amount" :min="0" />
          <span v-if="consumeForm.discountedAmount !== consumeForm.amount" class="discount-tip">
            折后金额：<span class="amount-minus">¥{{ consumeForm.discountedAmount }}</span>
          </span>
        </el-form-item>
        <el-form-item label="备注" prop="description">
          <el-input v-model="consumeForm.description" type="textarea" />
        </el-form-item>
        <el-form-item label="会员类型" prop="memberTypeId">
          <el-select v-model="consumeForm.memberTypeId" clearable placeholder="请选择消费类型">
            <el-option
              v-for="type in currentMember?.memberTypes || []"
              :key="type.id"
              :label="type.name"
              :value="type.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConsumeDialog = false">取消</el-button>
        <el-button type="primary" @click="handleConsume">确定</el-button>
      </template>
    </el-dialog>

    <!-- 会员明细对话框 -->
    <el-dialog
      v-model="showMemberDetailsDialog"
      title="交易明细"
      width="50%"
    >
      <template v-if="currentMember">
        <h3>{{ currentMember.name }} 的交易记录</h3>
        <el-table :data="memberTransactions" style="width: 100%">
          <el-table-column prop="created_at" label="时间" width="180">
            <template #default="{ row }">
              {{ new Date(row.created_at).toLocaleString() }}
            </template>
          </el-table-column>
          <el-table-column prop="type" label="类型" width="100">
            <template #default="{ row }">
              <el-tag :type="row.type === 'consume' ? 'danger' : 'success'">
                {{ row.type === 'recharge' ? '充值' : (row.type === 'bonus' ? '赠费' : '消费') }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额">
            <template #default="{ row }">
              <span :class="row.type === 'consume' ? 'amount-minus' : 'amount-plus'">
                {{ row.type === 'consume' ? '-' : '+' }}¥{{ row.amount }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="备注" />
        </el-table>
      </template>
    </el-dialog>

    <!-- 会员类型管理对话框 -->
    <el-dialog
      v-model="showMemberTypesDialog"
      title="会员类型管理"
      width="50%"
    >
      <div class="dialog-content">
        <el-form
          ref="memberTypeFormRef"
          :model="memberTypeForm"
          :rules="memberTypeFormRules"
          label-width="100px"
          class="member-type-form"
        >
          <el-form-item label="类型名称" prop="name">
            <el-input v-model="memberTypeForm.name" placeholder="请输入会员类型名称" />
          </el-form-item>
          <el-form-item label="会员类型" prop="type">
            <el-select v-model="memberTypeForm.type" placeholder="请选择会员类型">
              <el-option label="储值会员" value="stored" />
              <el-option label="年卡会员" value="year" />
              <el-option label="季卡会员" value="season" />
              <el-option label="月卡会员" value="month" />
              <el-option label="次卡会员" value="times" />
              <el-option label="自定义会员" value="custom" />
            </el-select>
          </el-form-item>
          <el-form-item label="有效期(天)" prop="duration_days" v-if="['year', 'season', 'month'].includes(memberTypeForm.type)">
            <el-input-number v-model="memberTypeForm.duration_days" :min="1" />
          </el-form-item>
          <el-form-item label="使用次数" prop="total_times" v-if="memberTypeForm.type === 'times'">
            <el-input-number v-model="memberTypeForm.total_times" :min="1" />
          </el-form-item>
          <el-form-item label="价格" prop="price">
            <el-input-number v-model="memberTypeForm.price" :min="0" :precision="2" />
          </el-form-item>
          <el-form-item label="类型描述" prop="description">
            <el-input
              v-model="memberTypeForm.description"
              type="textarea"
              placeholder="请输入会员类型描述"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleAddMemberType">添加类型</el-button>
            <el-button @click="resetMemberTypeForm">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="memberTypes" style="width: 100%">
          <el-table-column prop="name" label="类型名称" />
          <el-table-column prop="type" label="会员类型">
            <template #default="{ row }">
              {{ {
                stored: '储值会员',
                year: '年卡会员',
                season: '季卡会员',
                month: '月卡会员',
                times: '次卡会员',
                custom: '自定义会员'
              }[row.type] }}
            </template>
          </el-table-column>
          <el-table-column prop="price" label="价格">
            <template #default="{ row }">
              ¥{{ row.price }}
            </template>
          </el-table-column>
          <el-table-column prop="description" label="描述" />
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button type="danger" size="small" @click="handleDeleteMemberType(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 会员等级管理对话框 -->
    <el-dialog
      v-model="showPointLevelsDialog"
      title="会员等级管理"
      width="50%"
    >
      <div class="dialog-content">
        <el-form
          :model="pointLevelForm"
          label-width="100px"
          class="point-level-form"
        >
          <el-form-item label="等级名称" prop="name">
            <el-input v-model="pointLevelForm.name" placeholder="请输入等级名称" />
          </el-form-item>
          <el-form-item label="所需积分" prop="min_points">
            <el-input-number v-model="pointLevelForm.min_points" :min="0" />
          </el-form-item>
          <el-form-item label="折扣比例" prop="discount">
            <el-input-number
              v-model="pointLevelForm.discount"
              :min="0"
              :max="1"
              :step="0.1"
              :precision="2"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleAddPointLevel">添加等级</el-button>
          </el-form-item>
        </el-form>

        <el-table :data="pointLevels" style="width: 100%">
          <el-table-column prop="name" label="等级名称" />
          <el-table-column prop="min_points" label="所需积分" />
          <el-table-column label="折扣">
            <template #default="{ row }">
              {{ (row.discount * 10).toFixed(1) }}折
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button type="danger" size="small" @click="handleDeletePointLevel(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.home-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f0f7ff 0%, #e6fffb 100%);
  transition: background 0.3s ease;
}

.header {
  background-color: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  border-radius: 0 0 12px 12px;
  transition: box-shadow 0.3s ease;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  padding: 0 20px;
}

.header-content h2 {
  margin: 0;
  line-height: 60px;
  color: #1890ff;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

:deep(.el-card) {
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  border: none;
  overflow: hidden;
}

:deep(.el-card:hover) {
  transform: translateY(-5px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

:deep(.el-card__header) {
  border-bottom: 1px solid #f0f0f0;
  padding: 16px 20px;
  background: #fafafa;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-bar {
  margin-bottom: 20px;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #1890ff;
}

:deep(.el-button) {
  border-radius: 8px;
  transition: all 0.3s ease;
}

:deep(.el-button:not(.is-text):hover) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.3);
}

:deep(.el-table) {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

:deep(.el-table th) {
  background-color: #fafafa;
  font-weight: 600;
  color: #1890ff;
}

:deep(.el-pagination) {
  margin-top: 20px;
  justify-content: center;
}
.full-height-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.el-card__body) {
  flex: 1;
  padding: 0;
  overflow: hidden;
}

.scrollable-content {
  height: 100%;
  padding: 20px;
  overflow-y: auto;
  box-sizing: border-box;
}
.transaction-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}
.transaction-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.member-name {
  font-weight: bold;
  color: #333;
}
.transaction-desc {
  color: #666;
  font-size: 14px;
  margin: 4px 0;
}
.transaction-amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.transaction-time {
  color: #999;
  font-size: 12px;
}
.amount-plus {
  color: #67c23a;
  background-color: #f0f9eb;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 15px;
  font-weight: bold;
}
.amount-minus {
  color: #f56c6c;
  background-color: #fef0f0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 15px;
  font-weight: bold;
}

.member-balance-info {
  background-color: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.member-balance-info p {
  margin: 8px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.discount-tip {
  margin-left: 12px;
  font-size: 14px;
  color: #666;
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-tag) {
  margin: 0 4px;
}

.header-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.member-type-form,
.point-level-form {
  background-color: #f8f9fa;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}
</style>
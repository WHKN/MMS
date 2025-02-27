<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const router = useRouter()

// 数据状态
const members = ref([])
const searchQuery = ref('')
const currentMonth = ref(new Date().toISOString().slice(0, 7))
const monthlyStats = ref(null)
const recentTransactions = ref([])
const currentMember = ref(null)
const memberTransactions = ref([])

// 对话框状态
const showAddMemberDialog = ref(false)
const showEditDialog = ref(false)
const showRechargeDialog = ref(false)
const showConsumeDialog = ref(false)
const showMemberDetailsDialog = ref(false)

// 表单数据
const addMemberForm = ref({
  name: '',
  phone: '',
  initialBalance: 0
})

const editMemberForm = ref({
  name: '',
  phone: ''
})

const rechargeForm = ref({
  amount: 0,
  description: ''
})

const consumeForm = ref({
  amount: 0,
  description: ''
})

// 表单验证规则
const memberFormRules = {
  name: [
    { required: true, message: '请输入会员姓名', trigger: 'blur' }
  ],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^\d{11}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

const transactionFormRules = {
  amount: [
    { required: true, message: '请输入金额', trigger: 'blur' },
    { type: 'number', min: 0, message: '金额必须大于0', trigger: 'blur' }
  ]
}

// 计算属性
const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value
  const query = searchQuery.value.toLowerCase()
  return members.value.filter(member =>
    member.name.toLowerCase().includes(query) ||
    member.phone.includes(query)
  )
})

// 方法
const handleSearch = () => {
  // 搜索功能已通过计算属性实现
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
      members.value = await response.json()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '获取会员列表失败')
    }
  } catch (error) {
    ElMessage.error('获取会员列表失败')
  }
}

const fetchMonthlyReport = async () => {
  if (!currentMonth.value) return
  const [year, month] = currentMonth.value.split('-')
  try {
    const response = await fetch(`http://localhost:3000/api/reports/monthly/${year}/${month}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    })
    if (response.ok) {
      const data = await response.json()
      monthlyStats.value = data
      recentTransactions.value = data.transactions
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '获取月度报表失败')
    }
  } catch (error) {
    ElMessage.error('获取月度报表失败')
  }
}

const handleAddMember = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/members', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(addMemberForm.value)
    })
    if (response.ok) {
      ElMessage.success('添加会员成功')
      showAddMemberDialog.value = false
      addMemberForm.value = { name: '', phone: '', initialBalance: 0 }
      await fetchMembers()
      await fetchMonthlyReport()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '添加会员失败')
    }
  } catch (error) {
    ElMessage.error('添加会员失败')
  }
}

const openEditDialog = (member) => {
  currentMember.value = member
  editMemberForm.value = {
    name: member.name,
    phone: member.phone
  }
  showEditDialog.value = true
}

const handleEditMember = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/members/${currentMember.value.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editMemberForm.value)
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
    ElMessage.error('更新会员信息失败')
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
  currentMember.value = member
  rechargeForm.value = { amount: 0, description: '' }
  showRechargeDialog.value = true
}

const handleRecharge = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        member_id: currentMember.value.id,
        type: 'recharge',
        amount: rechargeForm.value.amount,
        description: rechargeForm.value.description
      })
    })
    if (response.ok) {
      ElMessage.success('充值成功')
      showRechargeDialog.value = false
      await fetchMembers()
      await fetchMonthlyReport()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '充值失败')
    }
  } catch (error) {
    ElMessage.error('充值失败')
  }
}

const openConsumeDialog = (member) => {
  currentMember.value = member
  consumeForm.value = { amount: 0, description: '' }
  showConsumeDialog.value = true
}

const handleConsume = async () => {
  try {
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
        description: consumeForm.value.description
      })
    })
    if (response.ok) {
      ElMessage.success('消费成功')
      showConsumeDialog.value = false
      await fetchMembers()
      await fetchMonthlyReport()
    } else {
      const error = await response.json()
      ElMessage.error(error.error || '消费失败')
    }
  } catch (error) {
    ElMessage.error('消费失败')
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

const handleLogout = () => {
  localStorage.removeItem('token')
  router.push('/login')
}

onMounted(async () => {
  await fetchMembers()
  await fetchMonthlyReport()
})
</script>

<template>
  <div class="home-container">
    <el-container>
      <el-header class="header">
        <div class="header-content">
          <h2>会员储值消费系统</h2>
          <el-button type="danger" @click="handleLogout">退出登录</el-button>
        </div>
      </el-header>

      <el-main style="height: calc(100vh - 60px); padding: 20px; overflow: hidden;">
        <el-row :gutter="20" style="height: 100%;">
          <!-- 月度统计卡片 -->
          <el-col :span="24" :lg="8" style="height: 100%;">
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
                  <p>总充值金额：<span class="amount-plus">¥{{ monthlyStats.totalRecharge || 0 }}</span></p>
                  <p>总消费金额：<span class="amount-minus">¥{{ monthlyStats.totalConsume || 0 }}</span></p>
                  <p>会员总数：{{ monthlyStats.totalMembers || 0 }}</p>
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
                    <span :class="transaction.type === 'recharge' ? 'amount-plus' : 'amount-minus'">
                      {{ transaction.type === 'recharge' ? '+' : '-' }}¥{{ transaction.amount }}
                    </span>
                    <span class="transaction-time">{{ new Date(transaction.created_at).toLocaleString() }}</span>
                  </div>
                </div>
              </div>
            </el-card>
          </el-col>
          <!-- 会员列表卡片 -->
          <el-col :span="24" :lg="16" style="height: 100%;">
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
                  <el-table-column prop="name" label="姓名" width="300" />
                  <el-table-column prop="phone" label="手机号" width="300" />
                  <el-table-column prop="balance" label="余额" width="300">
                    <template #default="{ row }">
                      <span :class="row.balance > 0 ? 'amount-plus' : 'amount-minus'">¥{{ row.balance }}</span>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" min-width="380">
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
        <el-form-item label="初始余额" prop="initialBalance">
          <el-input-number v-model="addMemberForm.initialBalance" :min="0" />
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
        <el-form-item label="充值金额" prop="amount">
          <el-input-number v-model="rechargeForm.amount" :min="0" />
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
          <p>当前余额：<span :class="currentMember?.balance > 0 ? 'amount-plus' : 'amount-minus'">¥{{ currentMember?.balance }}</span></p>
        </div>
        <el-form-item label="消费金额" prop="amount">
          <el-input-number v-model="consumeForm.amount" :min="0" :max="currentMember?.balance || 0" />
        </el-form-item>
        <el-form-item label="备注" prop="description">
          <el-input v-model="consumeForm.description" type="textarea" />
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
              <el-tag :type="row.type === 'recharge' ? 'success' : 'danger'">
                {{ row.type === 'recharge' ? '充值' : '消费' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额">
            <template #default="{ row }">
              <span :class="row.type === 'recharge' ? 'amount-plus' : 'amount-minus'">
                {{ row.type === 'recharge' ? '+' : '-' }}¥{{ row.amount }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="备注" />
        </el-table>
      </template>
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
</style>
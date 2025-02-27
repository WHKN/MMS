<template>
  <router-view v-if="$route.path === '/login'"></router-view>
  <el-container v-else class="app-container">
    <el-header>
      <h1>会员储值消费系统</h1>
    </el-header>
    <el-main>
      <el-row :gutter="20">
        <!-- 会员管理部分 -->
        <el-col :span="12">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>会员管理</span>
                <el-button-group>
                  <el-button type="primary" @click="showAddMemberDialog">添加会员</el-button>
                  <el-button type="success" @click="showMonthlyReport">月度报表</el-button>
                </el-button-group>
              </div>
            </template>
            <!-- 搜索栏 -->
            <div class="search-bar">
              <el-input
                v-model="searchQuery"
                placeholder="输入姓名或电话搜索"
                class="search-input"
                clearable
                @input="handleSearch"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>
            <el-table :data="filteredMembers" style="width: 100%">
              <el-table-column prop="id" label="ID" width="50" />
              <el-table-column prop="name" label="姓名" width="120" />
              <el-table-column prop="phone" label="电话" width="120" />
              <el-table-column prop="balance" label="余额" width="120">
                <template #default="scope">
                  ¥{{ scope.row.balance.toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column label="操作">
                <template #default="scope">
                  <el-button-group>
                    <el-button type="primary" @click="showRechargeDialog(scope.row)">储值</el-button>
                    <el-button type="success" @click="showConsumeDialog(scope.row)">消费</el-button>
                    <el-button type="info" @click="showTransactions(scope.row)">明细</el-button>
                    <el-button type="warning" @click="showEditMemberDialog(scope.row)">编辑</el-button>
                    <el-button type="danger" @click="confirmDeleteMember(scope.row)">删除</el-button>
                  </el-button-group>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>

        <!-- 交易记录部分 -->
        <el-col :span="12" v-if="selectedMember">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>{{ selectedMember.name }}的交易记录</span>
              </div>
            </template>
            <el-table :data="transactions" style="width: 100%">
              <el-table-column prop="created_at" label="时间" width="180" />
              <el-table-column prop="type" label="类型" width="80">
                <template #default="scope">
                  <el-tag :type="scope.row.type === 'recharge' ? 'success' : 'danger'">
                    {{ scope.row.type === 'recharge' ? '储值' : '消费' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="amount" label="金额" width="120">
                <template #default="scope">
                  {{ scope.row.type === 'recharge' ? '+' : '-' }}¥{{ scope.row.amount.toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="description" label="描述" />
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 添加会员对话框 -->
      <el-dialog v-model="addMemberDialogVisible" title="添加会员">
        <el-form :model="newMember" label-width="80px">
          <el-form-item label="姓名">
            <el-input v-model="newMember.name" />
          </el-form-item>
          <el-form-item label="电话">
            <el-input v-model="newMember.phone" />
          </el-form-item>
          <el-form-item label="初始储值">
            <el-input-number v-model="newMember.initialBalance" :min="0" :precision="2" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="addMemberDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="addMember">确定</el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 编辑会员对话框 -->
      <el-dialog v-model="editMemberDialogVisible" title="编辑会员">
        <el-form :model="editingMember" label-width="80px">
          <el-form-item label="姓名">
            <el-input v-model="editingMember.name" />
          </el-form-item>
          <el-form-item label="电话">
            <el-input v-model="editingMember.phone" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="editMemberDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="updateMember">确定</el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 储值对话框 -->
      <el-dialog v-model="rechargeDialogVisible" title="会员储值">
        <el-form :model="transaction" label-width="80px">
          <el-form-item label="金额">
            <el-input-number v-model="transaction.amount" :min="0" :precision="2" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="transaction.description" type="textarea" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="rechargeDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="recharge">确定</el-button>
          </span>
        </template>
      </el-dialog>

      <!-- 消费对话框 -->
      <el-dialog v-model="consumeDialogVisible" title="会员消费">
        <el-form :model="transaction" label-width="80px">
          <el-form-item label="金额">
            <el-input-number v-model="transaction.amount" :min="0" :precision="2" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="transaction.description" type="textarea" />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="consumeDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="consume">确定</el-button>
          </span>
        </template>
      </el-dialog>
    </el-main>
  </el-container>
      <!-- 月度报表对话框 -->
      <el-dialog v-model="monthlyReportVisible" title="月度报表" width="80%">
        <div v-if="monthlyStats">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-card>
                <template #header>
                  <div class="card-header">
                    <span>月度统计</span>
                    <el-date-picker
                      v-model="currentMonth"
                      type="month"
                      format="YYYY年MM月"
                      @change="showMonthlyReport"
                    />
                  </div>
                </template>
                <el-descriptions :column="1" border>
                  <el-descriptions-item label="总储值金额">¥{{ monthlyStats.totalRecharge?.toFixed(2) || '0.00' }}</el-descriptions-item>
                  <el-descriptions-item label="总消费金额">¥{{ monthlyStats.totalConsume?.toFixed(2) || '0.00' }}</el-descriptions-item>
                  <el-descriptions-item label="储值笔数">{{ monthlyStats.rechargeCount || 0 }}笔</el-descriptions-item>
                  <el-descriptions-item label="消费笔数">{{ monthlyStats.consumeCount || 0 }}笔</el-descriptions-item>
                  <el-descriptions-item label="活跃会员数">{{ monthlyStats.activeMembers || 0 }}人</el-descriptions-item>
                </el-descriptions>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card>
                <template #header>
                  <div class="card-header">
                    <span>交易记录</span>
                  </div>
                </template>
                <el-table :data="monthlyStats.transactions" height="400">
                  <el-table-column prop="created_at" label="时间" width="180" />
                  <el-table-column prop="member_name" label="会员" width="100" />
                  <el-table-column prop="type" label="类型" width="80">
                    <template #default="scope">
                      <el-tag :type="scope.row.type === 'recharge' ? 'success' : 'danger'">
                        {{ scope.row.type === 'recharge' ? '储值' : '消费' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="amount" label="金额" width="120">
                    <template #default="scope">
                      {{ scope.row.type === 'recharge' ? '+' : '-' }}¥{{ scope.row.amount.toFixed(2) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="description" label="描述" />
                </el-table>
              </el-card>
            </el-col>
          </el-row>
        </div>
      </el-dialog>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 数据
const members = ref([])
const transactions = ref([])
const selectedMember = ref(null)
const searchQuery = ref('')
const monthlyReportVisible = ref(false)
const currentMonth = ref(new Date())
const monthlyStats = ref(null)

// 对话框显示状态
const addMemberDialogVisible = ref(false)
const rechargeDialogVisible = ref(false)
const consumeDialogVisible = ref(false)
const editMemberDialogVisible = ref(false)

// 搜索和过滤
const filteredMembers = computed(() => {
  if (!searchQuery.value) return members.value
  const query = searchQuery.value.toLowerCase()
  return members.value.filter(member => 
    member.name.toLowerCase().includes(query) ||
    member.phone.includes(query)
  )
})

// 处理搜索
const handleSearch = () => {
  // 实时搜索，不需要额外处理
}

// 显示月度报表
const showMonthlyReport = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/reports/monthly/${currentMonth.value.getFullYear()}/${currentMonth.value.getMonth() + 1}`)
    if (response.ok) {
      monthlyStats.value = await response.json()
      monthlyReportVisible.value = true
    } else {
      throw new Error('获取月度报表失败')
    }
  } catch (error) {
    ElMessage.error(error.message)
  }
}

// 表单数据
const newMember = ref({
  name: '',
  phone: '',
  initialBalance: 0
})

const editingMember = ref({
  id: null,
  name: '',
  phone: ''
})

const transaction = ref({
  amount: 0,
  description: ''
})

// 获取所有会员
const fetchMembers = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/members')
    members.value = await response.json()
  } catch (error) {
    ElMessage.error('获取会员列表失败')
  }
}

// 获取会员交易记录
const fetchTransactions = async (memberId) => {
  try {
    const response = await fetch(`http://localhost:3000/api/transactions/${memberId}`)
    transactions.value = await response.json()
  } catch (error) {
    ElMessage.error('获取交易记录失败')
  }
}

// 显示添加会员对话框
const showAddMemberDialog = () => {
  newMember.value = { name: '', phone: '', initialBalance: 0 }
  addMemberDialogVisible.value = true
}

// 显示编辑会员对话框
const showEditMemberDialog = (member) => {
  editingMember.value = { ...member }
  editMemberDialogVisible.value = true
}

// 更新会员信息
const updateMember = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/members/${editingMember.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingMember.value.name,
        phone: editingMember.value.phone
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '更新失败');
    }

    ElMessage.success('更新会员信息成功');
    editMemberDialogVisible.value = false;
    await fetchMembers();
  } catch (error) {
    ElMessage.error(error.message || '更新会员信息失败');
  }
};

// 添加会员
const addMember = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMember.value)
    })
    
    if (response.ok) {
      ElMessage.success('添加会员成功')
      addMemberDialogVisible.value = false
      await fetchMembers()
    } else {
      const error = await response.json()
      throw new Error(error.error)
    }
  } catch (error) {
    ElMessage.error(error.message || '添加会员失败')
  }
}

// 显示储值对话框
const showRechargeDialog = (member) => {
  selectedMember.value = member
  transaction.value = { amount: 0, description: '' }
  rechargeDialogVisible.value = true
}

// 储值操作
const recharge = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: selectedMember.value.id,
        type: 'recharge',
        amount: transaction.value.amount,
        description: transaction.value.description
      })
    })
    
    if (response.ok) {
      ElMessage.success('储值成功')
      rechargeDialogVisible.value = false
      await fetchMembers()
      await fetchTransactions(selectedMember.value.id)
    } else {
      const error = await response.json()
      throw new Error(error.error)
    }
  } catch (error) {
    ElMessage.error(error.message || '储值失败')
  }
}

// 显示消费对话框
const showConsumeDialog = (member) => {
  selectedMember.value = member
  transaction.value = { amount: 0, description: '' }
  consumeDialogVisible.value = true
}

// 消费操作
const consume = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: selectedMember.value.id,
        type: 'consume',
        amount: transaction.value.amount,
        description: transaction.value.description
      })
    })
    
    if (response.ok) {
      ElMessage.success('消费成功')
      consumeDialogVisible.value = false
      await fetchMembers()
      await fetchTransactions(selectedMember.value.id)
    } else {
      const error = await response.json()
      throw new Error(error.error)
    }
  } catch (error) {
    ElMessage.error(error.message || '消费失败')
  }
}

// 显示交易记录
const showTransactions = async (member) => {
  selectedMember.value = member
  await fetchTransactions(member.id)
}

// 删除会员
const confirmDeleteMember = (member) => {
  ElMessageBox.confirm(
    '确定要删除该会员吗？删除后将无法恢复，且会删除所有相关的交易记录。',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/members/${member.id}`, {
          method: 'DELETE',
        })
        
        if (response.ok) {
          ElMessage.success('删除会员成功')
          if (selectedMember.value?.id === member.id) {
            selectedMember.value = null
          }
          await fetchMembers()
        } else {
          const error = await response.json()
          throw new Error(error.error)
        }
      } catch (error) {
        ElMessage.error(error.message || '删除会员失败')
      }
    })
    .catch(() => {
      // 用户点击取消，不做任何操作
    })
}

// 页面加载时获取会员列表
onMounted(() => {
  fetchMembers()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
}

.el-header {
  background-color: #409EFF;
  color: white;
  height: 100px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.el-main {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.el-card {
  margin-bottom: 20px;
}

.search-bar {
  margin-bottom: 20px;
}

.search-input {
  width: 100%;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>

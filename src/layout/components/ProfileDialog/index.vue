<template>
  <el-dialog
    v-model="visible"
    title="账号管理"
    width="50%"
    destroy-on-close
    @open="onDialogOpen"
    @close="onDialogClose"
  >
    <el-skeleton v-if="loading" :rows="6" animated />
    <div v-else-if="profile" class="pure-account-settings profile-dialog-body">
      <!-- 左侧：头像+用户名 + 菜单（参考 vue-pure-admin account-settings） -->
      <div class="profile-dialog-left">
        <div class="profile-dialog-avatar-wrap">
          <img :src="userAvatar" class="profile-dialog-avatar" alt="头像" />
        </div>
        <div class="profile-dialog-user-name">{{ profile.username }}</div>
        <div class="profile-dialog-menu">
          <div
            class="profile-dialog-menu-item"
            :class="{ 'is-active': !showPasswordForm }"
            @click="onMenuSelect('profile')"
          >
            <IconifyIconOffline :icon="UserLine" class="profile-dialog-menu-icon" />
            <span>个人信息</span>
          </div>
          <div
            class="profile-dialog-menu-item"
            :class="{ 'is-active': showPasswordForm }"
            @click="onMenuSelect('changePassword')"
          >
            <IconifyIconOffline :icon="LockPasswordLine" class="profile-dialog-menu-icon" />
            <span>修改密码</span>
          </div>
        </div>
      </div>
      <!-- 右侧：个人信息 或 修改密码表单 -->
      <div class="profile-dialog-right">
        <template v-if="!showPasswordForm">
          <el-descriptions class="profile-dialog-desc" :column="1" border :label-width="labelWidth">
            <el-descriptions-item label="用户账号">{{ profile.username }}</el-descriptions-item>
            <el-descriptions-item label="用户邮箱">
              <template v-if="editingField === 'email'">
                <div class="profile-dialog-inline-edit">
                  <el-input
                    v-model="editValue"
                    size="small"
                    placeholder="请输入邮箱"
                    class="profile-dialog-inline-input"
                    @keyup.enter="submitProfileField('email')"
                  />
                  <div class="profile-dialog-inline-btns">
                    <el-button size="small" type="primary" :loading="profileSubmitting" @click="submitProfileField('email')">确定</el-button>
                    <el-button size="small" @click="cancelEdit">取消</el-button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="profile-dialog-desc-cell">
                  <span>{{ profile.email || '-' }}</span>
                  <el-button link type="primary" size="small" @click="startEdit('email', profile.email)">修改</el-button>
                </div>
              </template>
            </el-descriptions-item>
            <el-descriptions-item label="手机号码">
              <template v-if="editingField === 'phone'">
                <div class="profile-dialog-inline-edit">
                  <el-input
                    v-model="editValue"
                    size="small"
                    placeholder="请输入手机号"
                    class="profile-dialog-inline-input"
                    @keyup.enter="submitProfileField('phone')"
                  />
                  <div class="profile-dialog-inline-btns">
                    <el-button size="small" type="primary" :loading="profileSubmitting" @click="submitProfileField('phone')">确定</el-button>
                    <el-button size="small" @click="cancelEdit">取消</el-button>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="profile-dialog-desc-cell">
                  <span>{{ profile.phone || '-' }}</span>
                  <el-button link type="primary" size="small" @click="startEdit('phone', profile.phone)">修改</el-button>
                </div>
              </template>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatDate(profile.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="最后登录">{{ formatDate(profile.lastLogin) }}</el-descriptions-item>
            <el-descriptions-item label="用户角色">
              <template v-if="!(profile.roles?.length)">
                -
              </template>
              <el-tag v-else v-for="r in profile.roles" :key="r" size="small" style="margin: 0 4px 4px 0">{{ r }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </template>
        <div v-else class="profile-dialog-pwd-form-wrap">
          <el-form
            ref="pwdFormRef"
            :model="pwdForm"
            :rules="pwdRules"
            label-width="80px"
            class="profile-dialog-pwd-form"
          >
            <el-form-item label="旧密码" prop="oldPassword">
              <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入旧密码" />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码" />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="pwdSubmitting" @click="submitChangePassword">确认</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { isAllEmpty } from '@pureadmin/utils'
import { getProfile, updateProfile, userChangePassword, type MeProfile } from '@/api/authn'
import { formatDate } from '@/utils/date'
import { message } from '@/utils/message'
import { useUserStoreHook } from '@/store/modules/user'
import Avatar from '@/assets/user.jpg'
import UserLine from '~icons/ri/user-line'
import LockPasswordLine from '~icons/ri/lock-password-line'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

const userAvatar = computed(() =>
  isAllEmpty(useUserStoreHook()?.avatar) ? Avatar : useUserStoreHook()?.avatar
)

const loading = ref(false)
const profile = ref<MeProfile | null>(null)
const showPasswordForm = ref(false)
const pwdFormRef = ref<FormInstance>()
const pwdSubmitting = ref(false)
const editingField = ref<'email' | 'phone' | null>(null)
const editValue = ref('')
const profileSubmitting = ref(false)
const labelWidth = 120

const pwdForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (_rule: any, value: string, callback: (e?: Error) => void) => {
  if (value !== pwdForm.value.newPassword) {
    callback(new Error('两次输入的新密码不一致'))
  } else {
    callback()
  }
}

const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '新密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

function onDialogOpen() {
  showPasswordForm.value = false
  pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  fetchProfile()
}

function onDialogClose() {
  profile.value = null
  showPasswordForm.value = false
  editingField.value = null
  editValue.value = ''
}

function startEdit(field: 'email' | 'phone', current: string | undefined) {
  editingField.value = field
  editValue.value = current ?? ''
}

function cancelEdit() {
  editingField.value = null
  editValue.value = ''
}

async function submitProfileField(field: 'email' | 'phone') {
  profileSubmitting.value = true
  try {
    await updateProfile(field === 'email' ? { email: editValue.value } : { phone: editValue.value })
    message('修改成功', { type: 'success' })
    editingField.value = null
    editValue.value = ''
    await fetchProfile()
  } catch (e) {
    const res = e as { response?: { data?: { msg?: string } }; message?: string }
    message(res?.response?.data?.msg || res?.message || '修改失败', { type: 'error' })
  } finally {
    profileSubmitting.value = false
  }
}

function onMenuSelect(index: string) {
  showPasswordForm.value = index === 'changePassword'
}

async function fetchProfile() {
  loading.value = true
  profile.value = null
  try {
    const res = await getProfile() as { data?: MeProfile }
    profile.value = res?.data ?? null
  } catch (e) {
    message((e as Error)?.message || '获取账号信息失败', { type: 'error' })
  } finally {
    loading.value = false
  }
}

async function submitChangePassword() {
  if (!pwdFormRef.value) return
  const valid = await pwdFormRef.value.validate().catch(() => false)
  if (!valid) return
  pwdSubmitting.value = true
  try {
    await userChangePassword({
      oldPassword: pwdForm.value.oldPassword,
      newPassword: pwdForm.value.newPassword
    })
    message('密码修改成功', { type: 'success' })
    showPasswordForm.value = false
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (e) {
    const res = e as { response?: { data?: { msg?: string } }; message?: string }
    message(res?.response?.data?.msg || res?.message || '修改失败', { type: 'error' })
  } finally {
    pwdSubmitting.value = false
  }
}
</script>

<style scoped lang="scss">
/* 参考 vue-pure-admin account-settings 容器与左侧菜单样式 */
.pure-account-settings {
  background: var(--pure-theme-menu-bg) !important;
  border-radius: 8px;
  overflow: hidden;
}

.profile-dialog-body {
  display: flex;
  align-items: stretch;
  min-height: 320px;
}

.profile-dialog-left {
  flex-shrink: 0;
  width: 200px;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.profile-dialog-avatar-wrap {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--el-fill-color-light);
}

.profile-dialog-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.profile-dialog-user-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--pure-theme-menu-text);
  padding: 0 12px;
  text-align: center;
  word-break: break-all;
}

/* 与右上角 el-dropdown-menu 一致的项样式：无蓝色激活态，仅 hover 与当前项背景 */
.profile-dialog-menu {
  width: 100%;
}

.profile-dialog-menu-item {
  display: flex;
  align-items: center;
  min-width: 100%;
  height: 40px;
  padding: 0 16px;
  font-size: 14px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background-color 0.2s;

  .profile-dialog-menu-icon {
    margin-right: 8px;
    font-size: 16px;
  }

  &:hover {
    background-color: var(--el-fill-color-light);
  }

  &.is-active {
    background-color: var(--el-fill-color);
  }
}

.profile-dialog-right {
  flex: 1;
  min-width: 0;
  padding: 16px 24px;
  background: var(--el-bg-color);
}

.profile-dialog-desc {
  border-radius: 4px;
  overflow: hidden;

  :deep(.el-descriptions__label) {
    width: 120px;
    min-width: 120px;
  }
}

.profile-dialog-desc-cell {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.profile-dialog-inline-edit {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 8px;

  .profile-dialog-inline-input {
    flex: 1;
    min-width: 0;
  }

  .profile-dialog-inline-btns {
    display: flex;
    align-items: center;

    :deep(.el-button) {
      margin-left: 0 !important;
    }
    :deep(.el-button + .el-button) {
      margin-left: 6px !important;
    }
  }
}

.profile-dialog-pwd-form-wrap {
  width: 100%;
}

.profile-dialog-pwd-form {
  margin-bottom: 0;
  max-width: 100%;
}
</style>

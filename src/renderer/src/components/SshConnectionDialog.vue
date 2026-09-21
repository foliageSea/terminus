<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { KeyRound, LoaderCircle, LockKeyhole, Server, ShieldCheck } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import type { SshConnectionProfile } from '../types/terminal'

const props = defineProps<{
  open: boolean
  profile?: SshConnectionProfile
  mode: 'edit' | 'connect'
}>()

const emit = defineEmits<{
  'update:open': [open: boolean]
  save: [profile: SshConnectionProfile]
  connected: [profile: SshConnectionProfile, connectionId: string, fingerprint: string]
}>()

const form = reactive<SshConnectionProfile>({
  id: '',
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  privateKeyPath: '',
  hostKeyFingerprint: ''
})
const password = ref('')
const passphrase = ref('')
const trustHostKey = ref(false)
const pendingFingerprint = ref('')
const connecting = ref(false)
const selectingPrivateKey = ref(false)
const errorMessage = ref('')

const dialogTitle = computed(() => (props.mode === 'edit' ? 'SSH 连接配置' : '连接 SSH'))
const canSave = computed(
  () =>
    Boolean(form.name.trim() && form.host.trim() && form.username.trim()) &&
    Number.isInteger(Number(form.port)) &&
    Number(form.port) > 0 &&
    Number(form.port) <= 65535
)
const canConnect = computed(
  () => Boolean(form.host.trim() && form.username.trim()) && !connecting.value
)

watch(
  () => props.open,
  (open) => {
    if (!open) return

    Object.assign(form, {
      id: props.profile?.id || `ssh-${Date.now()}`,
      name: props.profile?.name || '',
      host: props.profile?.host || '',
      port: props.profile?.port || 22,
      username: props.profile?.username || '',
      authType: props.profile?.authType || 'password',
      privateKeyPath: props.profile?.privateKeyPath || '',
      hostKeyFingerprint: props.profile?.hostKeyFingerprint || ''
    })
    password.value = ''
    passphrase.value = ''
    trustHostKey.value = false
    pendingFingerprint.value = ''
    errorMessage.value = ''
  },
  { immediate: true }
)

function closeDialog(): void {
  emit('update:open', false)
}

function saveProfile(): void {
  if (!canSave.value) return

  emit('save', {
    ...form,
    name: form.name.trim(),
    host: form.host.trim(),
    port: Math.round(Number(form.port)),
    username: form.username.trim(),
    privateKeyPath: form.authType === 'privateKey' ? form.privateKeyPath.trim() : '',
    hostKeyFingerprint: form.hostKeyFingerprint.trim()
  })
  closeDialog()
}

async function selectPrivateKey(): Promise<void> {
  if (selectingPrivateKey.value) return

  selectingPrivateKey.value = true
  try {
    const path = await window.api.ssh.selectPrivateKey()
    if (path) form.privateKeyPath = path
  } finally {
    selectingPrivateKey.value = false
  }
}

async function connect(): Promise<void> {
  if (!canConnect.value) return

  connecting.value = true
  errorMessage.value = ''
  try {
    const result = await window.api.ssh.connect({
      profile: {
        ...form,
        name: form.name.trim() || form.host.trim(),
        host: form.host.trim(),
        port: Math.round(Number(form.port)),
        username: form.username.trim()
      },
      password: password.value,
      passphrase: passphrase.value,
      trustHostKey: trustHostKey.value
    })

    if (result.ok) {
      emit(
        'connected',
        { ...form, hostKeyFingerprint: result.hostKeyFingerprint },
        result.connectionId,
        result.hostKeyFingerprint
      )
      closeDialog()
      return
    }

    if (result.code === 'HOST_KEY_UNKNOWN' && result.hostKeyFingerprint) {
      pendingFingerprint.value = result.hostKeyFingerprint
      errorMessage.value = '这是首次连接该主机，请核对指纹后继续。'
      return
    }

    errorMessage.value =
      result.code === 'HOST_KEY_MISMATCH'
        ? '主机密钥与已保存的指纹不一致，连接已阻止。'
        : result.message
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'SSH 连接失败'
  } finally {
    connecting.value = false
  }
}

async function trustAndConnect(): Promise<void> {
  trustHostKey.value = true
  await connect()
}

function submitConnect(): void {
  if (pendingFingerprint.value) {
    void trustAndConnect()
    return
  }
  void connect()
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="ssh-connection-dialog">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
      </DialogHeader>

      <div class="ssh-form">
        <Field v-if="mode === 'edit'" class="ssh-field">
          <FieldLabel for="ssh-profile-name" class="ssh-label">名称</FieldLabel>
          <Input
            id="ssh-profile-name"
            v-model="form.name"
            autofocus
            placeholder="例如：生产服务器"
          />
        </Field>

        <div v-else class="ssh-target-summary">
          <Server :size="16" aria-hidden="true" />
          <span>{{ form.name || form.host }}</span>
          <small>{{ form.username }}@{{ form.host }}:{{ form.port }}</small>
        </div>

        <div v-if="mode === 'edit'" class="ssh-field-row">
          <Field class="ssh-field ssh-field-grow">
            <FieldLabel for="ssh-profile-host" class="ssh-label">主机</FieldLabel>
            <Input id="ssh-profile-host" v-model="form.host" placeholder="hostname 或 IP" />
          </Field>
          <Field class="ssh-field ssh-field-port">
            <FieldLabel for="ssh-profile-port" class="ssh-label">端口</FieldLabel>
            <Input id="ssh-profile-port" v-model="form.port" type="number" min="1" max="65535" />
          </Field>
        </div>

        <Field v-if="mode === 'edit'" class="ssh-field">
          <FieldLabel for="ssh-profile-username" class="ssh-label">用户名</FieldLabel>
          <Input id="ssh-profile-username" v-model="form.username" placeholder="root" />
        </Field>

        <Field v-if="mode === 'edit'" class="ssh-field">
          <FieldLabel for="ssh-profile-auth-type" class="ssh-label">认证方式</FieldLabel>
          <Select v-model="form.authType">
            <SelectTrigger id="ssh-profile-auth-type">
              <SelectValue placeholder="选择认证方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="password">密码</SelectItem>
                <SelectItem value="privateKey">私钥</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field v-if="mode === 'edit' && form.authType === 'privateKey'" class="ssh-field">
          <FieldLabel for="ssh-private-key-picker" class="ssh-label">私钥文件</FieldLabel>
          <Button
            id="ssh-private-key-picker"
            variant="outline"
            class="ssh-key-picker"
            type="button"
            @click="selectPrivateKey"
          >
            <KeyRound :size="16" aria-hidden="true" />
            <span>{{ form.privateKeyPath || '选择 OpenSSH 私钥文件' }}</span>
          </Button>
        </Field>

        <Field v-if="mode === 'connect' && form.authType === 'password'" class="ssh-field">
          <FieldLabel for="ssh-password" class="ssh-label">密码</FieldLabel>
          <div class="ssh-secret-input">
            <LockKeyhole :size="15" aria-hidden="true" />
            <Input
              id="ssh-password"
              v-model="password"
              type="password"
              autofocus
              placeholder="连接时输入，不会保存"
              @keydown.enter.prevent="submitConnect"
            />
          </div>
        </Field>

        <Field v-if="mode === 'connect' && form.authType === 'privateKey'" class="ssh-field">
          <FieldLabel for="ssh-passphrase" class="ssh-label">私钥口令（可选）</FieldLabel>
          <div class="ssh-secret-input">
            <KeyRound :size="15" aria-hidden="true" />
            <Input
              id="ssh-passphrase"
              v-model="passphrase"
              type="password"
              autofocus
              placeholder="私钥未加密可留空"
              @keydown.enter.prevent="submitConnect"
            />
          </div>
        </Field>

        <div v-if="form.hostKeyFingerprint" class="ssh-fingerprint">
          <ShieldCheck :size="14" aria-hidden="true" />
          <span :title="form.hostKeyFingerprint">已信任指纹：{{ form.hostKeyFingerprint }}</span>
        </div>

        <div v-if="pendingFingerprint" class="ssh-host-key-confirm">
          <ShieldCheck :size="16" aria-hidden="true" />
          <div>
            <strong>首次连接主机</strong>
            <code>{{ pendingFingerprint }}</code>
          </div>
        </div>

        <p v-if="errorMessage" class="ssh-error">{{ errorMessage }}</p>
      </div>

      <DialogFooter>
        <DialogClose as-child>
          <Button variant="secondary" @click="closeDialog">取消</Button>
        </DialogClose>
        <Button v-if="mode === 'edit'" :disabled="!canSave" @click="saveProfile">保存</Button>
        <Button v-else-if="pendingFingerprint" :disabled="connecting" @click="trustAndConnect">
          信任并连接
        </Button>
        <Button v-else :disabled="!canConnect" @click="connect">
          <LoaderCircle v-if="connecting" :size="14" class="animate-spin" aria-hidden="true" />
          连接
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.ssh-connection-dialog {
  width: min(480px, calc(100vw - 32px));
}

.ssh-form {
  display: grid;
  gap: 14px;
}

.ssh-field,
.ssh-field-row {
  display: grid;
  gap: 7px;
}

.ssh-field-row {
  grid-template-columns: minmax(0, 1fr) 92px;
}

.ssh-field-grow,
.ssh-field-port {
  min-width: 0;
}

.ssh-label {
  color: rgba(255, 255, 255, 0.78);
  font-size: 12px;
  font-weight: 650;
}

.ssh-key-picker {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 36px;
  padding: 0 11px;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.ssh-key-picker span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ssh-key-picker:hover {
  border-color: var(--terminal-active-color);
  color: rgba(255, 255, 255, 0.94);
}

.ssh-secret-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 11px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  color: rgba(255, 255, 255, 0.45);
  background: rgba(255, 255, 255, 0.045);
}

.ssh-secret-input:focus-within {
  border-color: var(--terminal-active-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--terminal-active-color) 22%, transparent);
}

.ssh-secret-input :deep(.ui-input) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.ssh-target-summary {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.9);
}

.ssh-target-summary span {
  font-weight: 650;
}

.ssh-target-summary small {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.45);
  font-family: monospace;
}

.ssh-fingerprint {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: rgba(255, 255, 255, 0.48);
  font-size: 11px;
  line-height: 1.45;
  white-space: nowrap;
}

.ssh-fingerprint svg {
  flex-shrink: 0;
}

.ssh-fingerprint span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ssh-host-key-confirm {
  display: flex;
  gap: 10px;
  padding: 11px;
  border: 1px solid rgba(250, 204, 21, 0.32);
  border-radius: 8px;
  background: rgba(250, 204, 21, 0.08);
  color: #fde68a;
}

.ssh-host-key-confirm div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ssh-host-key-confirm code {
  overflow-wrap: anywhere;
  color: rgba(255, 255, 255, 0.75);
  font-size: 11px;
}

.ssh-error {
  margin: 0;
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.45;
}
</style>

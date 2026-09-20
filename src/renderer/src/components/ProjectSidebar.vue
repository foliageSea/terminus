<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  FolderOpen,
  FolderPlus,
  FolderTree,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Server,
  Settings,
  SquareTerminal,
  Trash2
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Project, SshConnectionProfile } from '../types/terminal'

const props = defineProps<{
  projects: Project[]
  sshProfiles: SshConnectionProfile[]
  activeProjectId?: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  toggleCollapse: []
  newTerminal: []
  openSettings: []
  createProject: [name: string, path: string]
  openProject: [project: Project]
  requestDeleteProject: [project: Project]
  createSshProfile: []
  editSshProfile: [profile: SshConnectionProfile]
  deleteSshProfile: [profile: SshConnectionProfile]
  openSshTerminal: [profile: SshConnectionProfile]
  openSftp: [profile: SshConnectionProfile]
}>()

const createDialogVisible = ref(false)
const projectName = ref('')
const projectPath = ref('')
const selectingDirectory = ref(false)

function normalizePath(path: string): string {
  return path.trim().replace(/[\\/]+$/, '')
}

function getPathKey(path: string): string {
  const normalizedPath = normalizePath(path).replace(/\\/g, '/')
  return /^[a-z]:\//i.test(normalizedPath) || normalizedPath.startsWith('//')
    ? normalizedPath.toLowerCase()
    : normalizedPath
}

function getDirectoryName(path: string): string {
  return normalizePath(path).split(/[\\/]/).filter(Boolean).pop() || path
}

const duplicateProject = computed(() => {
  const pathKey = getPathKey(projectPath.value)
  if (!pathKey) return false
  return props.projects.some((project) => getPathKey(project.path) === pathKey)
})

const canCreateProject = computed(
  () => Boolean(projectName.value.trim() && projectPath.value.trim()) && !duplicateProject.value
)

function openCreateDialog(): void {
  projectName.value = ''
  projectPath.value = ''
  createDialogVisible.value = true
}

function closeCreateDialog(): void {
  createDialogVisible.value = false
}

async function selectProjectDirectory(): Promise<void> {
  if (selectingDirectory.value) return

  selectingDirectory.value = true
  try {
    const path = await window.api.settings.selectProjectDirectory()
    if (!path) return

    projectPath.value = path
    if (!projectName.value.trim()) projectName.value = getDirectoryName(path)
  } finally {
    selectingDirectory.value = false
  }
}

function createProject(): void {
  if (!canCreateProject.value) return

  emit('createProject', projectName.value.trim(), normalizePath(projectPath.value))
  closeCreateDialog()
}
</script>

<template>
  <aside
    class="project-sidebar"
    :class="{ collapsed }"
    aria-label="项目管理"
    :aria-expanded="!collapsed"
  >
    <div class="project-sidebar-titlebar">
      <div class="project-sidebar-window-controls">
        <slot name="window-controls" />
      </div>
      <div class="project-sidebar-titlebar-actions">
        <Button
          class="project-sidebar-add"
          size="icon"
          variant="ghost"
          title="新建项目"
          aria-label="新建项目"
          @click="openCreateDialog"
        >
          <FolderPlus :size="16" aria-hidden="true" />
        </Button>
        <Button
          class="project-sidebar-toggle"
          size="icon"
          variant="ghost"
          :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
          :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="emit('toggleCollapse')"
        >
          <PanelLeftOpen v-if="collapsed" :size="16" aria-hidden="true" />
          <PanelLeftClose v-else :size="16" aria-hidden="true" />
        </Button>
      </div>
    </div>

    <div class="project-sidebar-brand">
      <span class="project-sidebar-brand-label">Terminus</span>
    </div>

    <nav class="project-sidebar-nav" aria-label="主导航">
      <button
        class="project-sidebar-nav-item"
        type="button"
        title="新建终端"
        @click="emit('newTerminal')"
      >
        <SquareTerminal :size="16" aria-hidden="true" />
        <span class="project-sidebar-nav-label">新建终端</span>
      </button>
      <button
        class="project-sidebar-nav-item"
        type="button"
        title="设置"
        @click="emit('openSettings')"
      >
        <Settings :size="16" aria-hidden="true" />
        <span class="project-sidebar-nav-label">设置</span>
      </button>
    </nav>

    <section class="project-sidebar-section" aria-labelledby="project-section-title">
      <div class="project-sidebar-section-header">
        <span id="project-section-title" class="project-sidebar-section-title">项目</span>
        <button
          class="project-sidebar-section-add"
          type="button"
          title="新建项目"
          aria-label="新建项目"
          @click="openCreateDialog"
        >
          <Plus :size="15" aria-hidden="true" />
        </button>
      </div>

      <div v-if="projects.length" class="project-sidebar-list">
        <div
          v-for="project in projects"
          :key="project.id"
          class="project-sidebar-row"
          :class="{ active: project.id === activeProjectId }"
        >
          <button
            class="project-sidebar-project"
            type="button"
            :title="collapsed ? project.name : project.path"
            @click="emit('openProject', project)"
          >
            <FolderOpen :size="16" aria-hidden="true" />
            <span class="project-sidebar-project-label">{{ project.name }}</span>
          </button>
          <button
            class="project-sidebar-delete"
            type="button"
            title="从项目列表移除"
            :aria-label="`从项目列表移除 ${project.name}`"
            @click.stop="emit('requestDeleteProject', project)"
          >
            <Trash2 :size="14" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div v-else class="project-sidebar-empty">
        <FolderOpen :size="22" aria-hidden="true" />
        <span class="project-sidebar-empty-label">暂无项目</span>
        <small class="project-sidebar-empty-hint">添加常用目录，点击即可打开终端</small>
      </div>
    </section>

    <section class="project-sidebar-section" aria-labelledby="ssh-section-title">
      <div class="project-sidebar-section-header">
        <span id="ssh-section-title" class="project-sidebar-section-title">SSH</span>
        <Button
          class="project-sidebar-section-add"
          size="icon"
          variant="ghost"
          type="button"
          title="新建 SSH 连接"
          aria-label="新建 SSH 连接"
          @click="emit('createSshProfile')"
        >
          <Plus :size="15" aria-hidden="true" />
        </Button>
      </div>

      <div v-if="sshProfiles.length" class="project-sidebar-list">
        <div v-for="profile in sshProfiles" :key="profile.id" class="ssh-profile-row">
          <Button
            class="ssh-profile-main"
            variant="ghost"
            type="button"
            :title="
              collapsed ? profile.name : `${profile.username}@${profile.host}:${profile.port}`
            "
            @click="emit('openSshTerminal', profile)"
          >
            <Server :size="16" aria-hidden="true" />
            <span class="ssh-profile-label">{{ profile.name }}</span>
          </Button>
          <div class="ssh-profile-actions">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="打开 SFTP"
              :aria-label="`打开 ${profile.name} 的 SFTP`"
              @click.stop="emit('openSftp', profile)"
            >
              <FolderTree :size="14" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              title="编辑连接"
              :aria-label="`编辑 ${profile.name}`"
              @click.stop="emit('editSshProfile', profile)"
            >
              <Pencil :size="13" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="destructive"
              title="删除连接"
              :aria-label="`删除 ${profile.name}`"
              @click.stop="emit('deleteSshProfile', profile)"
            >
              <Trash2 :size="13" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
      <div v-else class="project-sidebar-empty ssh-empty">
        <Server :size="22" aria-hidden="true" />
        <span class="project-sidebar-empty-label">暂无 SSH 连接</span>
        <small class="project-sidebar-empty-hint">保存主机配置，打开远程终端或 SFTP</small>
      </div>
    </section>

    <div class="project-sidebar-footer">
      <span class="project-sidebar-footer-label">{{ projects.length }} 个项目</span>
    </div>

    <Dialog :open="createDialogVisible" @update:open="!$event && closeCreateDialog()">
      <DialogContent class="create-project-dialog">
        <DialogHeader>
          <DialogTitle>创建项目</DialogTitle>
        </DialogHeader>

        <div class="create-project-form">
          <label class="create-project-field">
            <span class="create-project-label">项目名称</span>
            <div class="create-project-input-wrap">
              <FolderOpen :size="16" aria-hidden="true" />
              <Input
                v-model="projectName"
                autofocus
                placeholder="项目名称"
                @keydown.enter.prevent="createProject"
              />
            </div>
          </label>

          <div class="create-project-field">
            <span class="create-project-label">源文件夹</span>
            <button
              class="create-project-folder"
              :class="{ selected: projectPath }"
              type="button"
              :disabled="selectingDirectory"
              @click="selectProjectDirectory"
            >
              <FolderOpen :size="18" aria-hidden="true" />
              <span class="create-project-folder-text">
                <span>{{
                  projectPath ? getDirectoryName(projectPath) : '在此电脑上添加文件夹'
                }}</span>
                <small>{{ projectPath || '选择一个目录作为项目根目录' }}</small>
              </span>
              <Plus :size="16" aria-hidden="true" />
            </button>
          </div>

          <p v-if="duplicateProject" class="create-project-error">该目录已添加为项目</p>
        </div>

        <DialogFooter>
          <DialogClose as-child>
            <Button variant="secondary" @click="closeCreateDialog">取消</Button>
          </DialogClose>
          <Button :disabled="!canCreateProject" @click="createProject">创建项目</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </aside>
</template>

<style>
.project-sidebar {
  position: relative;
  z-index: 3;
  display: flex;
  flex: 0 0 244px;
  flex-direction: column;
  width: 244px;
  min-width: 0;
  min-height: 0;
  padding: 8px;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(12, 12, 13, 0.42);
  box-shadow: 12px 0 28px rgba(0, 0, 0, 0.12);

  opacity: 1;
  transform: translateX(0);
  -webkit-app-region: drag;
  transition:
    flex-basis 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    width 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    padding 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    border-color 180ms ease,
    background-color 180ms ease,
    box-shadow 180ms ease,
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.project-sidebar.collapsed {
  flex-basis: 0;
  width: 0;
  padding: 0;
  border-right-color: transparent;
  box-shadow: none;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-16px);
}

.project-sidebar button,
.project-sidebar input {
  -webkit-app-region: no-drag;
}

.project-sidebar-titlebar {
  display: flex;
  flex: 0 0 36px;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 4px;
  transition:
    gap 220ms ease,
    padding 220ms ease;
}

.project-sidebar-window-controls {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  margin-right: 8px;
}

.project-sidebar-window-controls:empty {
  display: none;
}

.project-sidebar-titlebar-actions {
  display: flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  min-width: 0;
  transition: margin-left 220ms ease;
}

.project-sidebar-brand {
  display: flex;
  flex: 0 0 34px;
  align-items: center;
  width: 100%;
  min-width: 0;
  padding: 0 8px;
  color: rgba(255, 255, 255, 0.94);
  font-size: 16px;
  font-weight: 900;
}

.project-sidebar-titlebar .ui-button {
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
}

.project-sidebar-add {
  overflow: hidden;
  transition:
    width 180ms ease,
    opacity 140ms ease,
    transform 180ms ease;
}

.project-sidebar.collapsed .project-sidebar-titlebar {
  gap: 4px;
  padding: 0;
}

.project-sidebar.collapsed .project-sidebar-brand {
  gap: 0;
}

.project-sidebar.collapsed .project-sidebar-titlebar-actions {
  gap: 0;
  margin-left: 0;
}

.project-sidebar.collapsed .project-sidebar-add {
  flex-basis: 0;
  width: 0;
  min-width: 0;
  padding: 0;
  opacity: 0;
  pointer-events: none;
  transform: scale(0.86);
}

.project-sidebar-brand-label,
.project-sidebar-nav-label,
.project-sidebar-section-title,
.project-sidebar-project-label,
.ssh-profile-label,
.project-sidebar-footer-label {
  display: inline-block;
  max-width: 180px;
  overflow: hidden;
  opacity: 1;
  transform: translateX(0);
  transition:
    max-width 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 140ms ease,
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
  white-space: nowrap;
}

.project-sidebar.collapsed .project-sidebar-brand-label,
.project-sidebar.collapsed .project-sidebar-nav-label,
.project-sidebar.collapsed .project-sidebar-section-title,
.project-sidebar.collapsed .project-sidebar-project-label,
.project-sidebar.collapsed .ssh-profile-label,
.project-sidebar.collapsed .project-sidebar-footer-label {
  max-width: 0;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-5px);
}

.project-sidebar-nav {
  display: grid;
  gap: 3px;
  margin-top: 6px;
}

.project-sidebar.collapsed .project-sidebar-nav-item {
  justify-content: center;
  gap: 0;
  padding: 0;
}

.project-sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 34px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.66);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  text-align: left;
  transition:
    background-color 150ms ease,
    color 150ms ease;
}

.project-sidebar-nav-item:hover {
  background: rgba(255, 255, 255, 0.065);
  color: rgba(255, 255, 255, 0.92);
}

.project-sidebar-section {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  margin-top: 20px;
}

.project-sidebar-section-header {
  display: flex;
  flex: 0 0 28px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 0 5px 0 9px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 12px;
  font-weight: 650;
  transition: padding 220ms ease;
}

.project-sidebar.collapsed .project-sidebar-section-header {
  justify-content: center;
  padding: 0;
}

.project-sidebar.collapsed .project-sidebar-section-add {
  display: none;
}

.project-sidebar-section-header button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.48);
  cursor: pointer;
}

.project-sidebar-section-header button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.project-sidebar-list {
  display: grid;
  gap: 3px;
  min-height: 0;
  padding-right: 2px;
  overflow-y: auto;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  scrollbar-width: thin;
}

.project-sidebar-row {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  transition:
    background-color 150ms ease,
    border-color 150ms ease;
}

.project-sidebar-row:hover {
  background: rgba(255, 255, 255, 0.055);
}

.project-sidebar-row.active {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.105);
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.14);
}

.project-sidebar-project {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 9px;
  min-width: 0;
  height: 36px;
  padding: 0 34px 0 9px;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    gap 220ms ease,
    padding 220ms ease,
    color 140ms ease;
}

.project-sidebar.collapsed .project-sidebar-project {
  justify-content: center;
  gap: 0;
  padding: 0;
}

.project-sidebar.collapsed .project-sidebar-delete {
  display: none;
}

.project-sidebar-row.active .project-sidebar-project,
.project-sidebar-project:hover {
  color: rgba(255, 255, 255, 0.96);
}

.project-sidebar-project span {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-sidebar-delete {
  position: absolute;
  right: 5px;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.42);
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 120ms ease,
    background-color 120ms ease,
    color 120ms ease;
}

.project-sidebar-row:hover .project-sidebar-delete,
.project-sidebar-delete:focus-visible {
  opacity: 1;
}

.project-sidebar-delete:hover {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.ssh-profile-row {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: background-color 150ms ease;
}

.ssh-profile-row:hover {
  background: rgba(255, 255, 255, 0.055);
}

.ssh-profile-main {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 9px;
  min-width: 0;
  height: 36px;
  padding: 0 92px 0 9px;
  border: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    gap 220ms ease,
    padding 220ms ease,
    color 140ms ease;
}

.ssh-profile-main:hover {
  color: rgba(255, 255, 255, 0.96);
}

.ssh-profile-label {
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ssh-profile-actions {
  position: absolute;
  right: 4px;
  display: flex;
  gap: 1px;
  opacity: 0;
  transition: opacity 120ms ease;
}

.ssh-profile-row:hover .ssh-profile-actions,
.ssh-profile-actions:focus-within {
  opacity: 1;
}

.ssh-profile-actions button {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.48);
  cursor: pointer;
}

.ssh-profile-actions button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.95);
}

.ssh-profile-actions button:last-child:hover {
  background: rgba(239, 68, 68, 0.16);
  color: #fca5a5;
}

.project-sidebar.collapsed .ssh-profile-main {
  justify-content: center;
  gap: 0;
  padding: 0;
}

.project-sidebar.collapsed .ssh-profile-actions {
  display: none;
}

.project-sidebar-section + .project-sidebar-section {
  flex: 0 1 auto;
  max-height: 42%;
}

.project-sidebar-empty {
  display: grid;
  place-items: center;
  gap: 5px;
  margin: 4px 5px;
  padding: 24px 12px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.38);
  text-align: center;
  transition:
    gap 180ms ease,
    margin 220ms ease,
    padding 220ms ease,
    border-color 180ms ease;
}

.project-sidebar.collapsed .project-sidebar-empty {
  gap: 0;
  margin: 4px 0;
  padding: 14px 0;
  border-color: transparent;
}

.project-sidebar.collapsed .project-sidebar-empty-label,
.project-sidebar.collapsed .project-sidebar-empty-hint {
  display: none;
}

.project-sidebar-empty span {
  color: rgba(255, 255, 255, 0.58);
  font-size: 13px;
}

.project-sidebar-empty small {
  font-size: 11px;
  line-height: 1.45;
}

.project-sidebar-footer {
  display: flex;
  flex: 0 0 28px;
  align-items: center;
  min-width: 0;
  padding: 0 9px;
  color: rgba(255, 255, 255, 0.32);
  font-size: 11px;
  transition: padding 220ms ease;
}

.project-sidebar.collapsed .project-sidebar-footer {
  justify-content: center;
  padding: 0;
}

.create-project-dialog {
  width: min(460px, calc(100vw - 32px));
}

.create-project-form {
  display: grid;
  gap: 16px;
}

.create-project-field {
  display: grid;
  gap: 8px;
}

.create-project-label {
  color: rgba(255, 255, 255, 0.88);
  font-size: 13px;
  font-weight: 650;
}

.create-project-input-wrap {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-left: 11px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.48);
  background: rgba(255, 255, 255, 0.045);
}

.create-project-input-wrap:focus-within {
  border-color: var(--terminal-active-color);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--terminal-active-color) 22%, transparent);
}

.create-project-input-wrap .ui-input {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.create-project-input-wrap .ui-input:focus {
  border: 0;
  box-shadow: none;
}

.create-project-folder {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 11px;
  width: 100%;
  min-height: 72px;
  padding: 13px 14px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.025);
  color: rgba(255, 255, 255, 0.52);
  cursor: pointer;
  font: inherit;
  text-align: left;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    color 150ms ease;
}

.create-project-folder:hover,
.create-project-folder.selected {
  border-color: color-mix(in srgb, var(--terminal-active-color) 52%, rgba(255, 255, 255, 0.16));
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.9);
}

.create-project-folder:disabled {
  cursor: wait;
  opacity: 0.65;
}

.create-project-folder-text {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.create-project-folder-text span,
.create-project-folder-text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-project-folder-text span {
  color: rgba(255, 255, 255, 0.86);
  font-size: 13px;
  font-weight: 650;
}

.create-project-folder-text small {
  color: rgba(255, 255, 255, 0.44);
  font-size: 11px;
}

.create-project-error {
  margin: -6px 0 0;
  color: #fca5a5;
  font-size: 12px;
}

@media (max-width: 760px) {
  .project-sidebar {
    flex-basis: 208px;
    width: 208px;
  }

  .project-sidebar.collapsed {
    flex-basis: 0;
    width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-sidebar,
  .project-sidebar *,
  .project-sidebar *::before,
  .project-sidebar *::after {
    transition-duration: 0.01ms !important;
  }
}
</style>

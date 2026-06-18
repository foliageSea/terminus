<script setup lang="ts">
import { NButton, NIcon, NPopover } from 'naive-ui'
import { QuestionCircle20Regular } from '@vicons/fluent'
</script>

<template>
  <NPopover trigger="click" placement="bottom-end">
    <template #trigger>
      <NButton class="shortcut-help-button" size="small" secondary circle>
        <template #icon>
          <NIcon>
            <QuestionCircle20Regular />
          </NIcon>
        </template>
      </NButton>
    </template>

    <div class="shortcut-popover" aria-label="快捷键列表">
      <div class="shortcut-section-title">快捷键</div>
      <div class="shortcut-row"><span>新建 Tab</span><kbd>Ctrl</kbd><kbd>T</kbd></div>
      <div class="shortcut-row"><span>下一个 Tab</span><kbd>Ctrl</kbd><kbd>Tab</kbd></div>
      <div class="shortcut-row">
        <span>上一个 Tab</span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>Tab</kbd>
      </div>
      <div class="shortcut-row"><span>切换分屏焦点</span><kbd>Ctrl</kbd><kbd>`</kbd></div>
      <div class="shortcut-row"><span>分屏方向选择</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
      <div class="shortcut-row"><span>关闭当前分屏</span><kbd>Ctrl</kbd><kbd>W</kbd></div>
      <div class="shortcut-row"><span>最小化窗口</span><kbd>Alt</kbd><kbd>H</kbd></div>
      <div class="shortcut-row"><span>复制选中文本</span><kbd>Alt</kbd><kbd>C</kbd></div>
      <div class="shortcut-row"><span>粘贴</span><kbd>Ctrl</kbd><kbd>V</kbd></div>
    </div>
  </NPopover>
</template>

<style scoped>
.shortcut-popover {
  display: grid;
  gap: 8px;
  width: 240px;
  padding: 4px;
}

.shortcut-section-title {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
}

.shortcut-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(4, auto);
  align-items: center;
  gap: 5px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
}

.shortcut-row kbd {
  min-width: 20px;
  padding: 1px 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.86);
  font-family: inherit;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
}
</style>

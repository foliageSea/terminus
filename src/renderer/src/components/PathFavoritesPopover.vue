<script setup lang="ts">
import { NButton, NIcon, NInput, NPopover } from 'naive-ui'
import {
  Delete20Regular,
  FolderOpenVertical20Regular,
  ReOrderDotsVertical20Regular,
  Search20Regular
} from '@vicons/fluent'
import type { PathFavorite } from '../types/terminal'

defineProps<{
  search: string
  favorites: PathFavorite[]
  filteredFavorites: PathFavorite[]
  canFavoriteActivePath: boolean
  draggingFavoriteId?: string
  dragOverFavoriteId?: string
  dragOverFavoriteSide: 'before' | 'after'
  themeStyle: Record<string, string>
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  addCurrent: []
  open: [favorite: PathFavorite]
  remove: [id: string]
  dragstart: [event: DragEvent, id: string]
  dragover: [event: DragEvent, id: string]
  dragend: []
  drop: [event: DragEvent, id: string]
}>()
</script>

<template>
  <NPopover trigger="click" placement="bottom-end">
    <template #trigger>
      <NButton class="path-favorites-button" size="small" secondary circle>
        <template #icon>
          <NIcon>
            <FolderOpenVertical20Regular />
          </NIcon>
        </template>
      </NButton>
    </template>

    <div class="path-favorites-popover" :style="themeStyle" aria-label="路径收藏">
      <div class="path-favorites-header">
        <div>
          <div class="path-favorites-title">路径收藏</div>
          <div class="path-favorites-subtitle">点击打开，拖拽排序</div>
        </div>
        <NButton size="tiny" secondary :disabled="!canFavoriteActivePath" @click="emit('addCurrent')">
          收藏当前
        </NButton>
      </div>

      <NInput
        :value="search"
        class="path-favorites-search"
        size="small"
        clearable
        placeholder="搜索名称或路径"
        @update:value="emit('update:search', $event)"
      >
        <template #prefix>
          <NIcon>
            <Search20Regular />
          </NIcon>
        </template>
      </NInput>

      <div v-if="filteredFavorites.length" class="path-favorites-list">
        <div
          v-for="favorite in filteredFavorites"
          :key="favorite.id"
          class="path-favorite-row"
          @dragover="emit('dragover', $event, favorite.id)"
          @drop="emit('drop', $event, favorite.id)"
        >
          <span
            v-if="dragOverFavoriteId === favorite.id && dragOverFavoriteSide === 'before'"
            class="path-favorite-drop-line"
            aria-hidden="true"
          />
          <button
            :class="[
              'path-favorite-item',
              { 'path-favorite-dragging': draggingFavoriteId === favorite.id }
            ]"
            type="button"
            @click="emit('open', favorite)"
          >
            <span
              class="path-favorite-drag-handle"
              draggable="true"
              title="拖拽排序"
              aria-label="拖拽排序"
              @click.stop
              @dragstart="emit('dragstart', $event, favorite.id)"
              @dragend="emit('dragend')"
            >
              <NIcon>
                <ReOrderDotsVertical20Regular />
              </NIcon>
            </span>
            <span class="path-favorite-text">
              <span class="path-favorite-name">{{ favorite.name }}</span>
              <span class="path-favorite-path">{{ favorite.path }}</span>
            </span>
            <NButton size="tiny" quaternary type="error" @click.stop="emit('remove', favorite.id)">
              <template #icon>
                <NIcon>
                  <Delete20Regular />
                </NIcon>
              </template>
            </NButton>
          </button>
          <span
            v-if="dragOverFavoriteId === favorite.id && dragOverFavoriteSide === 'after'"
            class="path-favorite-drop-line"
            aria-hidden="true"
          />
        </div>
      </div>
      <div v-else class="path-favorites-empty">
        {{ favorites.length ? '未找到匹配路径' : '暂无收藏路径' }}
      </div>
    </div>
  </NPopover>
</template>

<style scoped>
.path-favorites-button {
  margin-left: 6px;
}

.path-favorites-popover {
  display: grid;
  gap: 10px;
  width: 340px;
  padding: 4px;
}

.path-favorites-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.path-favorites-title {
  color: rgba(255, 255, 255, 0.9);
  font-weight: 700;
}

.path-favorites-subtitle {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.path-favorites-search {
  --n-border: 1px solid rgba(255, 255, 255, 0.1) !important;
  --n-border-hover: 1px solid rgba(255, 255, 255, 0.18) !important;
  --n-border-focus: 1px solid var(--terminal-active-color) !important;
  --n-color: rgba(255, 255, 255, 0.05) !important;
  --n-color-focus: rgba(255, 255, 255, 0.07) !important;
}

.path-favorites-list {
  display: grid;
  gap: 6px;
  max-height: 320px;
  padding-right: 4px;
  overflow-y: auto;
  scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.path-favorites-list::-webkit-scrollbar {
  width: 8px;
}

.path-favorites-list::-webkit-scrollbar-track {
  background: transparent;
}

.path-favorites-list::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.2);
  background-clip: content-box;
}

.path-favorites-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.34);
  background-clip: content-box;
}

.path-favorite-row {
  display: grid;
  gap: 3px;
}

.path-favorite-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease,
    transform 0.18s ease;
}

.path-favorite-item:hover {
  border-color: rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
}

.path-favorite-drag-handle {
  display: grid;
  place-items: center;
  width: 22px;
  height: 34px;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.38);
  cursor: grab;
  transition:
    background 0.18s ease,
    color 0.18s ease;
}

.path-favorite-drag-handle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
}

.path-favorite-drag-handle:active {
  cursor: grabbing;
}

.path-favorite-dragging {
  border-color: rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.02);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
  opacity: 0.52;
  transform: scale(0.985);
}

.path-favorite-drop-line {
  position: relative;
  width: calc(100% - 16px);
  height: 8px;
  margin: 1px 8px;
  pointer-events: none;
}

.path-favorite-drop-line::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 2px;
  border-radius: 999px;
  background: var(--terminal-active-color);
  box-shadow: 0 0 10px color-mix(in srgb, var(--terminal-active-color) 50%, transparent);
  transform: translateY(-50%);
  content: '';
}

.path-favorite-drop-line::after {
  position: absolute;
  top: 50%;
  left: 0;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--terminal-active-color);
  box-shadow: 0 0 8px color-mix(in srgb, var(--terminal-active-color) 50%, transparent);
  transform: translateY(-50%);
  content: '';
}

.path-favorite-text {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.path-favorite-name,
.path-favorite-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-favorite-name {
  color: rgba(255, 255, 255, 0.88);
  font-weight: 650;
}

.path-favorite-path {
  color: rgba(255, 255, 255, 0.52);
  font-size: 12px;
}

.path-favorites-empty {
  padding: 18px 8px;
  color: rgba(255, 255, 255, 0.48);
  font-size: 13px;
  text-align: center;
}
</style>

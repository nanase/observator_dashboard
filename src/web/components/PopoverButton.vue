<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

defineProps<{ label: string; align?: 'start' | 'end' }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function onPointerDown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}

watch(open, (value) => {
  if (value) {
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
  } else {
    document.removeEventListener('pointerdown', onPointerDown);
    document.removeEventListener('keydown', onKeyDown);
  }
});
onBeforeUnmount(() => {
  open.value = false;
});
</script>

<template>
  <span ref="root" class="popover-root">
    <button type="button" class="popover-trigger" :aria-label="label" :aria-expanded="open" @click="open = !open">
      <slot name="trigger" />
    </button>
    <span v-if="open" class="popover" :class="align ?? 'end'" role="dialog" :aria-label="label">
      <slot />
    </span>
  </span>
</template>

<style scoped>
.popover-root {
  position: relative;
  display: inline-flex;
}
.popover-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  padding: 4px 6px;
  margin: -4px -6px;
  border-radius: 8px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}
.popover-trigger:hover {
  background: var(--state-hover);
}
.popover {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 20;
  width: max-content;
  max-width: min(280px, 80vw);
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--tooltip-bg);
  color: var(--tooltip-fg);
  box-shadow: var(--shadow-high);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  white-space: normal;
  text-align: left;
}
.popover.end {
  right: 0;
}
.popover.start {
  left: 0;
}
</style>

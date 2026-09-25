<script setup lang="ts">
// 最終受信からの経過時間。押すと受信時刻と、途絶していればその旨をポップアップで出す
import { computed } from 'vue';
import { useNow } from '../composables/useNow';
import { formatAgo, formatDateLong, formatTime } from '../lib/format';
import { icons } from '../lib/icons';
import { freshness, STALE_SECONDS } from '../lib/status';
import PopoverButton from './PopoverButton.vue';

const props = defineProps<{ lastSeenAt: number; variant?: 'text' | 'icon' }>();

const now = useNow();
const age = computed(() => now.value - props.lastSeenAt);
const state = computed(() => freshness(age.value));
const stale = computed(() => age.value > STALE_SECONDS);
</script>

<template>
  <PopoverButton
    v-if="variant !== 'icon' || stale"
    :label="stale ? '受信が途絶えています' : '最終受信'"
    :class="['reception', { stale, 'icon-only': variant === 'icon' }]"
  >
    <template #trigger>
      <template v-if="variant === 'icon'">
        <component :is="icons.warning" class="warn-icon" />
      </template>
      <template v-else>
        <i class="dot" :class="state === 'ok' ? '' : state" aria-hidden="true"></i>
        <span>{{ formatAgo(age) }}</span>
      </template>
    </template>
    <template v-if="stale">
      <strong class="title">{{ formatAgo(age) }}から受信がありません</strong>
      表示中の値は {{ formatDateLong(lastSeenAt) }} {{ formatTime(lastSeenAt) }} に受け取ったものです。
    </template>
    <template v-else>最終受信 {{ formatDateLong(lastSeenAt) }} {{ formatTime(lastSeenAt, true) }}</template>
  </PopoverButton>
</template>

<style scoped>
.reception {
  font-size: 13px;
  color: var(--on-surface-variant);
  white-space: nowrap;
}
.reception.stale {
  color: var(--error);
  font-weight: 500;
}
.warn-icon {
  font-size: 20px;
  color: var(--error);
}
.title {
  display: block;
  font-weight: 500;
  margin-bottom: 2px;
}
</style>

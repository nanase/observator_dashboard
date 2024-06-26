<script setup lang="ts">
import { ref, watch, computed } from 'vue';

import { definePeriodicCall } from '@/lib/vue';
import dayjs, { Dayjs } from '@/lib/dayjs';

const {
  time,
  updateInterval = 1,
  suffix = ['s', 'm', 'h', 'd'],
} = defineProps<{
  time: Dayjs;
  updateInterval?: number;
  suffix?: string[];
}>();

const elapsedTime = ref<number>(Number.NaN);
const readableElapsedTime = computed(() => {
  if (elapsedTime.value >= 60 * 60 * 100) return `${Math.floor(elapsedTime.value / (60 * 60 * 24))}${suffix[3]}`;
  else if (elapsedTime.value >= 60 * 100) return `${Math.floor(elapsedTime.value / (60 * 60))}${suffix[2]}`;
  else if (elapsedTime.value >= 60) return `${Math.floor(elapsedTime.value / 60)}${suffix[1]}`;
  else return `${elapsedTime.value}${suffix[0]}`;
});

async function updateElapsedTime() {
  elapsedTime.value = dayjs().diff(time, 's');
  return updateInterval;
}

definePeriodicCall(updateElapsedTime);
watch(() => time, updateElapsedTime);
</script>

<template>
  <span v-if="time.isValid() && !Number.isNaN(elapsedTime)">
    {{ readableElapsedTime }}
  </span>
</template>

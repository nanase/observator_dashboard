<script setup lang="ts">
import { ref, watch, computed } from 'vue';

import { definePeriodicCall } from '@/lib/vue';
import dayjs, { Dayjs } from '@/lib/dayjs';

const { time, updateInterval = 0.2 } = defineProps<{
  time: Dayjs;
  updateInterval?: number;
}>();

const elapsedTime = ref<number>(Number.NaN);

async function updateElapsedTime() {
  elapsedTime.value = dayjs().diff(time, 's');
  return updateInterval;
}

definePeriodicCall(updateElapsedTime);
watch(() => time, updateElapsedTime);

function circleColor(): string {
  if (elapsedTime.value < 60) {
    return 'green-darken-2';
  }

  if (elapsedTime.value < 60 * 5) {
    return 'yellow-darken-3';
  }

  return 'red-darken-3';
}

function circleProgress(): number {
  if (elapsedTime.value < 60) {
    return elapsedTime.value * (100 / 60);
  }

  if (elapsedTime.value < 60 * 5) {
    return 100 - (elapsedTime.value - 60) * (100 / 240);
  }

  return 100;
}
</script>

<template>
  <v-progress-circular :color="circleColor()" :model-value="circleProgress()" :size="12" :width="6" />
</template>

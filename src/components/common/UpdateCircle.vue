<script setup lang="ts">
import { Dayjs } from '@nanase/alnilam/dayjs';
import { useElapsedTime } from '@nanase/alnilam/use';

const { time, updateInterval = 2000 } = defineProps<{
  time: Dayjs;
  updateInterval?: number;
}>();

const elapsedTime = useElapsedTime(
  () => time,
  () => updateInterval,
);

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

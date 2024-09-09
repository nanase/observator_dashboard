<script setup lang="ts">
import { computed } from 'vue';
import { Dayjs } from '@nanase/alnilam/dayjs';
import { useElapsedTime } from '@nanase/alnilam/use';

const {
  time,
  updateInterval = 1000,
  suffix = ['s', 'm', 'h', 'd'],
} = defineProps<{
  time: Dayjs;
  updateInterval?: number;
  suffix?: string[];
}>();

const elapsedTime = useElapsedTime(
  () => time,
  () => updateInterval,
);
const readableElapsedTime = computed(() => {
  if (elapsedTime.value >= 60 * 60 * 100) return `${Math.floor(elapsedTime.value / (60 * 60 * 24))}${suffix[3]}`;
  else if (elapsedTime.value >= 60 * 100) return `${Math.floor(elapsedTime.value / (60 * 60))}${suffix[2]}`;
  else if (elapsedTime.value >= 60) return `${Math.floor(elapsedTime.value / 60)}${suffix[1]}`;
  else return `${elapsedTime.value}${suffix[0]}`;
});
</script>

<template>
  <span v-if="time.isValid() && !Number.isNaN(elapsedTime)">
    {{ readableElapsedTime }}
  </span>
</template>

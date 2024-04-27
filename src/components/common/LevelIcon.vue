<script setup lang="ts">
const {
  icon,
  level,
  converter = (x) => `-${x}`,
  size = 'default',
  color = undefined,
} = defineProps<{
  icon: string;
  level: number;
  converter?: (level: number) => string;
  size?: string;
  color?: string;
}>();
</script>

<template>
  <v-icon :icon="`${icon}${converter(level)}`" :size="size" :color="color" />
</template>

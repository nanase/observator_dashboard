<script setup lang="ts">
import { ref } from 'vue';

import { definePeriodicCall } from '@/lib/vue';
import dayjs, { Dayjs } from '@/lib/dayjs';

const time = ref<Dayjs>(dayjs());

definePeriodicCall(async () => {
  time.value = dayjs();
  return 0.2;
});
</script>

<template>
  <div class="animated-clock">
    <div class="date">
      <div class="timezone">JST</div>
      <div>{{ time.format('YYYY-MM-DD') }}</div>
    </div>
    <span class="time">
      <span>{{ time.format('HH') }}</span>
      <span :style="`visibility:${time.millisecond() < 666 ? 'visible' : 'hidden'}`">:</span>
      <span>{{ time.format('mm') }}</span>
      <span :style="`visibility:${time.millisecond() < 666 ? 'visible' : 'hidden'}`">:</span>
      <span>{{ time.format('ss') }}</span>
    </span>
  </div>
</template>

<style lang="scss">
.animated-clock {
  padding: 0 1rem;

  .date {
    display: inline-block;
    font-size: 75%;
    line-height: 85%;
    padding-right: 0.5rem;

    .timezone {
      opacity: 0.5;
    }
  }

  .time {
    font-size: 110%;
  }
}
</style>

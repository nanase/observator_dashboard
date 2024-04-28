<script setup lang="ts">
import { JST } from '@/lib/dayjs';

import type { ObservatorESP32Central } from '@/type/observator';
import UpdateCircle from '@/components/common/UpdateCircle.vue';
import UpdateTime from '@/components/common/UpdateTime.vue';

const { observator, name } = defineProps<{
  observator: ObservatorESP32Central;
  name: string;
}>();

function fill(text: string, filler: string): string {
  return text.length === 0 ? filler : text;
}

function calcSeaPressure(): number {
  const z = Number(import.meta.env.VITE_DASHBOARD_SENSOR_ALTITUDE);
  return (
    observator.sensor[2].value * Math.pow(1 - (0.0065 * z) / (observator.sensor[0].value + 0.0065 * z + 273.15), -5.257)
  );
}
</script>

<template>
  <v-row no-gutters class="h-100" justify="start">
    <v-col cols="12" class="align-self-start">
      <div class="text-green-darken-2 queued">
        <span class="text-h5 font-weight-bold">{{ observator.sensor[0].value.toFixed(2) ?? '--' }}</span>
        <span class="font-weight-bold">℃</span>
      </div>
      <div class="text-blue-darken-2 queued">
        <span class="text-h5 font-weight-bold">{{ observator.sensor[1].value.toFixed(1) ?? '--' }}</span>
        <span class="font-weight-bold">%</span>
      </div>
      <div class="text-red-darken-3 queued">
        <span class="text-h5 font-weight-bold">{{ calcSeaPressure().toFixed(1) ?? '--' }}</span>
        <span class="font-weight-bold">hPa</span>
      </div>
      <div class="text-yellow-darken-3 queued">
        <span class="text-h5 font-weight-bold">{{ observator.sensor[3].value ?? '--' }}</span>
        <span class="font-weight-bold">ppm</span>
      </div>
      <div>{{ fill(name, '(no name)') }}</div>
    </v-col>
    <v-col cols="12" class="align-self-end">
      <div class="queued">
        <v-tooltip location="bottom">
          <template v-slot:activator="{ props }">
            <UpdateCircle v-bind="props" :time="JST(observator.fetchedAt * 1000)" />
          </template>
          <p>Sequence #{{ observator.sequence }}</p>
          <p>Fetched At {{ JST(observator.fetchedAt * 1000).format('YYYY-MM-DD h:mm:ss') }}</p>
        </v-tooltip>
        {{}}
        <UpdateTime :time="JST(observator.fetchedAt * 1000)" :update-interval="5" />
      </div>
    </v-col>
  </v-row>
</template>

<style lang="scss" scoped>
.queued {
  display: inline-block;

  &:not(:last-child) {
    padding-right: 0.5rem;
  }
}
</style>

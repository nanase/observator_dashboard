<script setup lang="ts">
import type { ObservatorESP32Central } from '@/type/observator';
import CardBase from './CardBase.vue';
import LevelIcon from '@/components/common/LevelIcon.vue';

import { convertRSSILevel } from '@/components/observation/converter';

const { observator, name, hidden } = defineProps<{
  observator: ObservatorESP32Central;
  name: string;
  hidden?: boolean;
}>();

function calcSeaPressure(): number {
  const z = Number(import.meta.env.VITE_DASHBOARD_SENSOR_ALTITUDE);
  return (
    observator.sensor[2].value * Math.pow(1 - (0.0065 * z) / (observator.sensor[0].value + 0.0065 * z + 273.15), -5.257)
  );
}
</script>

<template>
  <CardBase :observator :name :hidden>
    <template #sensors>
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
    </template>
    <template #status>
      <div class="queued">
        <LevelIcon
          icon="mdi-network-strength"
          :level="observator.sensor[4].value ?? -127"
          :converter="convertRSSILevel"
          size="xsmall"
        />
        {{ observator.sensor[4].value }}
        dBm
      </div>
    </template>
  </CardBase>
</template>

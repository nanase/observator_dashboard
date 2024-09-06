<script setup lang="ts">
import type { ObservatorW3200010 } from '@/type/observator';
import CardBase from './CardBase.vue';
import LevelIcon from '@/components/common/LevelIcon.vue';

import { convertRSSILevel, convertBatteryLevel, fill } from '@/components/observation/converter';

const { observator, name, hidden } = defineProps<{
  observator: ObservatorW3200010;
  name: string;
  hidden?: boolean;
}>();
</script>

<template>
  <CardBase :observator :name :hidden>
    <template #sensors>
      <div class="text-green-darken-2 queued">
        <span class="text-h4 font-weight-bold">{{ observator.sensor[0].value.toFixed(1) ?? '--' }}</span>
        <span class="font-weight-bold">℃</span>
      </div>
      <div class="text-blue-darken-2 queued">
        <span class="text-h4 font-weight-bold">{{ observator.sensor[1].value ?? '--' }}</span>
        <span class="font-weight-bold">%</span>
      </div>
    </template>
    <template #status>
      <div class="queued">
        <LevelIcon
          icon="mdi-network-strength"
          :level="observator.sensor[3].value ?? -127"
          :converter="convertRSSILevel"
          size="xsmall"
        />
        {{ observator.sensor[3].value }}
        dBm
      </div>
      <div class="queued">
        <LevelIcon
          icon="mdi-battery"
          :level="observator.sensor[2].value ?? 0"
          :converter="convertBatteryLevel"
          size="xsmall"
        />
        {{ observator.sensor[2].value }}
        %
      </div>
    </template>
  </CardBase>
</template>

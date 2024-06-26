<script setup lang="ts">
import { JST } from '@/lib/dayjs';

import type { ObservatorW3200010 } from '@/type/observator';
import UpdateCircle from '@/components/common/UpdateCircle.vue';
import UpdateTime from '@/components/common/UpdateTime.vue';
import LevelIcon from '@/components/common/LevelIcon.vue';

import { convertRSSILevel, convertBatteryLevel, fill } from '@/components/observation/converter';

const { observator, name } = defineProps<{
  observator: ObservatorW3200010;
  name: string;
}>();
</script>

<template>
  <v-row no-gutters class="h-100" justify="start">
    <v-col cols="12" class="align-self-start">
      <div class="text-green-darken-2 queued">
        <span class="text-h4 font-weight-bold">{{ observator.sensor[0].value.toFixed(1) ?? '--' }}</span>
        <span class="font-weight-bold">℃</span>
      </div>
      <div class="text-blue-darken-2 queued">
        <span class="text-h4 font-weight-bold">{{ observator.sensor[1].value ?? '--' }}</span>
        <span class="font-weight-bold">%</span>
      </div>
      <div>{{ fill(name, '(no name)') }}</div>
    </v-col>
    <v-col cols="12" class="align-self-end">
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

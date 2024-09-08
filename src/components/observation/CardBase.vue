<script setup lang="ts">
import { fromLocale } from '@nanase/alnilam/dayjs';

import UpdateCircle from '@/components/common/UpdateCircle.vue';
import UpdateTime from '@/components/common/UpdateTime.vue';

import { fill } from '@/components/observation/converter';
import type { Observator } from '@/type/observator';

const { observator, name, hidden } = defineProps<{
  observator: Observator;
  name: string;
  hidden?: boolean;
}>();
</script>

<template>
  <v-row no-gutters class="h-100 card-base" justify="start">
    <v-col cols="12" class="align-self-start">
      <slot name="sensors"></slot>
      <div>{{ fill(name, '(no name)') }}</div>
    </v-col>
    <v-col cols="12" class="align-self-end" v-if="hidden">
      <v-icon icon="mdi-eye-off" size="xsmall" />
      Hidden
    </v-col>
    <v-col cols="12" class="align-self-end">
      <slot name="status"></slot>
      <div class="queued">
        <v-tooltip location="bottom">
          <template v-slot:activator="{ props }">
            <UpdateCircle v-bind="props" :time="fromLocale('ja-JP', observator.fetchedAt * 1000)" />
          </template>
          <p>Sequence #{{ observator.sequence }}</p>
          <p>Fetched At {{ fromLocale('ja-JP', observator.fetchedAt * 1000).format('YYYY-MM-DD h:mm:ss') }}</p>
        </v-tooltip>
        {{}}
        <UpdateTime :time="fromLocale('ja-JP', observator.fetchedAt * 1000)" :update-interval="5" />
      </div>
    </v-col>
  </v-row>
</template>

<style lang="scss" scoped>
.card-base :deep(.queued) {
  display: inline-block;

  &:not(:last-child) {
    padding-right: 0.5rem;
  }
}
</style>

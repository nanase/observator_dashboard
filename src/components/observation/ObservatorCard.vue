<script setup lang="ts">
import { ref } from 'vue';
import dayjs, { Dayjs, fromLocale } from '@nanase/alnilam/dayjs';
import { useIntervalFn } from '@vueuse/core';

import type {
  ObservatorItem,
  ObservatorW3200010,
  ObservatorESP32Central,
  Observator,
  ObservatorType,
} from '@/type/observator';
import W3200010Card from './W3200010Card.vue';
import ESP32Card from './ESP32CentralCard.vue';

import { fill } from './converter';

const { observator, showMoveAbove, showMoveBelow } = defineProps<{
  observator: ObservatorItem;
  showMoveAbove: boolean;
  showMoveBelow: boolean;
}>();
const emit = defineEmits(['renameDialogClosed', 'moveAboveClicked', 'moveBelowClicked']);
const renameDialog = ref<boolean>();
const detailDialog = ref<boolean>();
const now = ref<Dayjs>(dayjs());

useIntervalFn(() => {
  now.value = dayjs();
}, 1000);

function is<T extends Observator>(observator: Observator | undefined, targetType: ObservatorType): observator is T {
  return observator?.type === targetType;
}
</script>

<template>
  <v-menu>
    <template v-slot:activator="{ props }">
      <v-card :variant="observator.hidden ? 'outlined' : 'elevated'" v-bind="props" class="h-100">
        <v-card-text class="h-100">
          <W3200010Card
            v-if="is<ObservatorW3200010>(observator.result, 'W3200010')"
            :observator="observator.result"
            :name="observator.name"
            :hidden="observator.hidden"
          />
          <ESP32Card
            v-if="is<ObservatorESP32Central>(observator.result, 'ESP32-Central')"
            :observator="observator.result"
            :name="observator.name"
            :hidden="observator.hidden"
          />
        </v-card-text>
      </v-card>
    </template>

    <v-list>
      <template v-if="observator.result">
        <v-list-item
          :title="`Sequence #${observator.result.sequence}`"
          :subtitle="`Fetched at ${fromLocale('ja-JP', observator.result.fetchedAt * 1000).format('YYYY-MM-DD H:mm:ss')}`"
        />
        <v-divider />
      </template>

      <v-dialog v-model="detailDialog" max-width="600">
        <template v-slot:activator="{ props: activatorProps }">
          <v-list-item v-bind="activatorProps" title="Details..." prepend-icon="mdi-card-bulleted-outline" />
        </template>

        <v-card prepend-icon="mdi-cellphone-wireless" title="Details">
          <v-card-text>
            <v-row no-gutters>
              <v-col cols="4">Name</v-col>
              <v-col>{{ fill(observator.name, '(no name)') }}</v-col>
            </v-row>
            <v-row no-gutters>
              <v-col cols="4">Address</v-col>
              <v-col>{{ observator.address }}</v-col>
            </v-row>
            <template v-if="observator.result">
              <v-row no-gutters>
                <v-col cols="4">Type</v-col>
                <v-col>{{ observator.result.type }}</v-col>
              </v-row>
              <v-row no-gutters>
                <v-col cols="4">Last sequence</v-col>
                <v-col>#{{ observator.result.sequence }}</v-col>
              </v-row>
              <v-row no-gutters>
                <v-col cols="4">Last fetched at</v-col>
                <v-col>
                  {{ fromLocale('ja-JP', observator.result.fetchedAt * 1000).format('YYYY-MM-DD H:mm:ss') }}
                  ({{ now.diff(fromLocale('ja-JP', observator.result.fetchedAt * 1000), 's') }}s ago)
                </v-col>
              </v-row>
              <template v-for="(sensor, index) in observator.result.sensor">
                <v-divider class="py-1"></v-divider>
                <h4>Sensor #{{ index }}</h4>
                <v-col>
                  <v-row no-gutters>
                    <v-col cols="4">Type</v-col>
                    <v-col>{{ sensor.type }}</v-col>
                  </v-row>
                  <v-row no-gutters v-if="sensor.name">
                    <v-col cols="4">Name</v-col>
                    <v-col>{{ fill(sensor.name, '(no name)') }}</v-col>
                  </v-row>
                  <v-row no-gutters>
                    <v-col cols="4">Raw value</v-col>
                    <v-col>{{ sensor.value }}</v-col>
                  </v-row>
                  <v-row no-gutters>
                    <v-col cols="4">Unit</v-col>
                    <v-col>{{ sensor.unit }}</v-col>
                  </v-row>
                  <v-row no-gutters>
                    <v-col cols="4">Precision</v-col>
                    <v-col>{{ sensor.precision }}</v-col>
                  </v-row>
                </v-col>
              </template>
            </template>
          </v-card-text>
          <v-divider></v-divider>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text="Close" variant="plain" @click="detailDialog = false"></v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
      <v-divider />

      <v-list-item title="Show" v-if="observator.hidden" @click="observator.hidden = false" prepend-icon="mdi-eye" />
      <v-list-item title="Hide" v-else @click="observator.hidden = true" prepend-icon="mdi-eye-off" />

      <v-dialog
        v-model="renameDialog"
        max-width="600"
        @update:modelValue="!renameDialog ? emit('renameDialogClosed') : ''"
      >
        <template v-slot:activator="{ props: activatorProps }">
          <v-list-item v-bind="activatorProps" title="Rename..." prepend-icon="mdi-rename" />
        </template>

        <v-card prepend-icon="mdi-cellphone-wireless" :title="`Observator (${observator.address})`">
          <v-card-text>
            <v-row dense>
              <v-col cols="12">
                <v-text-field label="name" v-model="observator.name" clearable></v-text-field>
              </v-col>
            </v-row>
          </v-card-text>
          <v-divider></v-divider>
          <v-card-actions>
            <v-spacer></v-spacer>
            <v-btn text="Close" variant="plain" @click="(renameDialog = false), emit('renameDialogClosed')"></v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-divider v-if="showMoveAbove || showMoveBelow" />
      <v-list-item
        title="Move above"
        v-if="showMoveAbove"
        @click="emit('moveAboveClicked')"
        prepend-icon="mdi-arrow-up"
      />
      <v-list-item
        title="Move below"
        v-if="showMoveBelow"
        @click="emit('moveBelowClicked')"
        prepend-icon="mdi-arrow-down"
      />
    </v-list>
  </v-menu>
</template>

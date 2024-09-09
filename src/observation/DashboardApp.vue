<script setup lang="ts">
import { ref, computed, useTemplateRef, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { AppBase, AnimatedClock } from '@nanase/alnilam/components';
import { computedJSON, useIntervalFetch } from '@nanase/alnilam/use';
import { fromLocale } from '@nanase/alnilam/dayjs';
import { moveAbove, moveBelow } from '@nanase/alnilam/array';

import type { ObservationResultContainer, ObservatorItem } from '@/type/observator';
import UpdateTime from '@/components/common/UpdateTime.vue';
import UpdateCircle from '@/components/common/UpdateCircle.vue';
import ObservatorCard from '@/components/observation/ObservatorCard.vue';

const appBase = useTemplateRef('appBase');
const importDialog = ref<boolean>();
const showHiddenObservator = ref<boolean>();
const observationSequence = ref<number>();
const observators = useStorage<ObservatorItem[]>('observator', []);
const shownObservator = computed<ObservatorItem[]>(() => observators.value.filter((o) => !o.hidden));
const fetchInterval = ref<number>(10 * 1000);
const savedObservatorJson = computedJSON(observators);
const { fetchedAt, onFetchResponse, onFetchError, json } = useIntervalFetch(
  import.meta.env.VITE_DASHBOARD_RESULT_URL,
  fetchInterval,
);

onFetchResponse(() => {
  appBase.value?.closeErrorSnackbar();
  fetchInterval.value = 10 * 1000;
});

onFetchError((error) => {
  console.error(`Fetching error. Retrying in 1 minute: ${error}`);
  appBase.value?.showErrorSnackbar();
  fetchInterval.value = 60 * 1000;
});

watch(
  () => json<ObservationResultContainer>()?.data.value,
  (container) => {
    if (container && container.sequence != observationSequence.value) {
      observationSequence.value = container.sequence;

      for (const result of container.result) {
        const knownObservator = observators.value.find((o) => o.address === result.address);

        if (knownObservator) {
          knownObservator.result = result;
        } else {
          observators.value.push({
            address: result.address,
            name: result.address,
            result,
          });
        }
      }
    }
  },
);
</script>

<template>
  <AppBase ref="appBase" toolbarTitle="Observation Dashboard">
    <template #toolbarPrepend>
      <AnimatedClock />
    </template>
    <template #toolbarAppend>
      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn icon v-bind="props">
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>

        <v-list>
          <v-dialog v-model="importDialog" max-width="600">
            <template v-slot:activator="{ props: activatorProps }">
              <v-list-item v-bind="activatorProps" title="Export / Import" prepend-icon="mdi-export" />
            </template>

            <v-card prepend-icon="mdi-export" title="Export / Import">
              <v-card-text>
                <v-row dense>
                  <v-col cols="12">
                    <v-textarea v-model="savedObservatorJson" style="font-family: monospace"></v-textarea>
                  </v-col>
                </v-row>
              </v-card-text>
              <v-divider></v-divider>
              <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn text="Close" variant="plain" @click="importDialog = false"></v-btn>
              </v-card-actions>
            </v-card>
          </v-dialog>

          <v-list-item
            v-if="showHiddenObservator"
            title="Hide hidden observator"
            prepend-icon="mdi-eye-off"
            @click="showHiddenObservator = false"
          />
          <v-list-item
            v-else
            title="Show hidden observator"
            prepend-icon="mdi-eye"
            @click="showHiddenObservator = true"
          />
        </v-list>
      </v-menu>
    </template>

    <v-row class="d-flex" height="100" v-if="shownObservator.length > 0">
      <v-col
        cols="6"
        md="4"
        lg="3"
        xl="2"
        v-for="(observator, index) in showHiddenObservator ? observators : shownObservator"
        :key="observator.address"
        class="align-self-stretch"
      >
        <ObservatorCard
          :observator="observator"
          is-saved
          :showMoveAbove="observators.length > 1 && index > 0"
          :showMoveBelow="observators.length > 1 && index < observators.length - 1"
          @move-above-clicked="moveAbove(observators, observator)"
          @move-below-clicked="moveBelow(observators, observator)"
        />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" class="text-right">
        <v-card variant="plain">
          <v-tooltip v-if="fetchedAt.isValid()" location="bottom">
            <template v-slot:activator="{ props }">
              <UpdateCircle v-bind="props" :time="fetchedAt" />
            </template>
            <p>Sequence #{{ observationSequence ?? '--' }}</p>
            <p>Fetched At {{ fetchedAt.format('YYYY-MM-DD h:mm:ss') }}</p>
          </v-tooltip>
          {{ ' ' }}
          <UpdateTime :time="fromLocale('ja-JP', fetchedAt)" :update-interval="5000" />
        </v-card>
      </v-col>
    </v-row>
  </AppBase>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue';
import axios from '@/lib/axios';
import dayjs, { Dayjs, JST } from '@/lib/dayjs';

import { definePeriodicCall } from '@/lib/vue';
import type { ObservationResultContainer, ObservatorItem } from '@/type/observator';
import ThemeToggleButton from '@/components/common/ThemeToggleButton.vue';
import UpdateTime from '@/components/common/UpdateTime.vue';
import AnimatedClock from '@/components/common/AnimatedClock.vue';
import ObservatorCard from '@/components/observation/ObservatorCard.vue';

const errorSnackbar = ref<boolean>();
const observationSequence = ref<number>();
const fetchedAt = ref<Dayjs>(dayjs(null));
const savedObservator = ref<ObservatorItem[]>([]);
const unsavedObservator = ref<ObservatorItem[]>([]);

onMounted(() => {
  savedObservator.value = loadObservator();
  window.addEventListener('beforeunload', saveObservator);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', saveObservator);
});

definePeriodicCall(
  async () => {
    errorSnackbar.value = false;
    const container = (await axios.get<ObservationResultContainer>(import.meta.env.VITE_DASHBOARD_RESULT_URL)).data;
    fetchedAt.value = dayjs();

    if (container.sequence != observationSequence.value) {
      observationSequence.value = container.sequence;

      for (const result of container.result) {
        const indexInSaved = savedObservator.value.findIndex((o) => o.address === result.address);

        if (indexInSaved > -1) {
          savedObservator.value[indexInSaved].result = result;
          continue;
        }

        const indexInUnSaved = unsavedObservator.value.findIndex((o) => o.address === result.address);

        if (indexInUnSaved > -1) {
          unsavedObservator.value[indexInUnSaved].result = result;
        } else {
          unsavedObservator.value.push({
            address: result.address,
            name: result.address,
            result,
          });
        }
      }
    }

    return 10;
  },
  async (error) => {
    console.error(`Fetching error. Retrying in 1 minute: ${error}`);
    errorSnackbar.value = true;
    return 60;
  },
);

function saveStateChanged(observator: ObservatorItem) {
  const indexInSaved = savedObservator.value.findIndex((o) => o.address === observator.address);

  if (indexInSaved > -1) {
    savedObservator.value.splice(indexInSaved, 1);
    unsavedObservator.value.push(observator);
    saveObservator();
    return;
  }

  const indexInUnSaved = unsavedObservator.value.findIndex((o) => o.address === observator.address);

  if (indexInUnSaved > -1) {
    unsavedObservator.value.splice(indexInUnSaved, 1);
    savedObservator.value.push(observator);
    saveObservator();
  }
}

function saveObservator() {
  localStorage.setItem('observator', JSON.stringify(savedObservator.value));
  console.info('observator saved');
}

function loadObservator(): ObservatorItem[] {
  const observator: ObservatorItem[] = JSON.parse(localStorage.getItem('observator') ?? '[]');
  console.info('observator loaded');
  return observator;
}

function moveAboveElement(observators: ObservatorItem[], observatorItem: ObservatorItem) {
  const index = observators.indexOf(observatorItem);

  if (index > 0) {
    observators.splice(index, 1)[0];
    observators.splice(index - 1, 0, observatorItem);
  }
}

function moveBelowElement(observators: ObservatorItem[], observatorItem: ObservatorItem) {
  const index = observators.indexOf(observatorItem);

  if (index < observators.length - 1) {
    observators.splice(index, 1)[0];
    observators.splice(index + 1, 0, observatorItem);
  }
}
</script>

<template>
  <v-app>
    <v-main>
      <v-app-bar flat density="compact">
        <v-toolbar-title>Observation Dashboard</v-toolbar-title>

        <template v-slot:append>
          <AnimatedClock />
          <ThemeToggleButton />
        </template>
      </v-app-bar>

      <v-container>
        <v-row class="d-flex" height="100">
          <v-col
            cols="6"
            md="4"
            lg="3"
            xl="2"
            v-for="(observator, index) in savedObservator"
            :key="observator.address"
            class="align-self-stretch"
          >
            <ObservatorCard
              :observator="observator"
              is-saved
              :order="index === 0 ? 1 : index === unsavedObservator.length - 1 ? -1 : 0"
              @save-menu-clicked="saveStateChanged(observator)"
              @rename-dialog-closed="saveObservator"
              @move-above-clicked="moveAboveElement(savedObservator, observator)"
              @move-below-clicked="moveBelowElement(savedObservator, observator)"
            />
          </v-col>
        </v-row>
        <v-row v-if="unsavedObservator.length > 0">
          <v-col cols="12" class="pb-0">
            <h3>Unsaved Observator</h3>
          </v-col>
          <v-col
            cols="6"
            md="4"
            lg="3"
            xl="2"
            v-for="(observator, index) in unsavedObservator"
            :key="observator.address"
          >
            <ObservatorCard
              :observator="observator"
              :is-saved="false"
              :order="index === 0 ? 1 : index === unsavedObservator.length - 1 ? -1 : 0"
              @save-menu-clicked="saveStateChanged(observator)"
              @rename-dialog-closed="saveObservator"
              @move-above-clicked="moveAboveElement(unsavedObservator, observator)"
              @move-below-clicked="moveBelowElement(unsavedObservator, observator)"
            />
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12" class="text-right">
            <v-card variant="plain">
              <v-tooltip v-if="fetchedAt.isValid()" location="bottom">
                <template v-slot:activator="{ props }">
                  <v-icon v-bind="props" size="xsmall">mdi-clock-outline</v-icon>
                </template>
                <p>Sequence #{{ observationSequence ?? '--' }}</p>
                <p>Fetched At {{ fetchedAt.format('YYYY-MM-DD h:mm:ss') }}</p>
              </v-tooltip>
              {{ ' ' }}
              <UpdateTime :time="JST(fetchedAt)" :update-interval="5" />
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <v-snackbar v-model="errorSnackbar" timeout="10000">
        データの読み込みができませんでした。しばらくしてから再読み込みしてください。
        <template v-slot:actions>
          <v-btn color="red-lighten-2" variant="text" @click="errorSnackbar = false">閉じる</v-btn>
        </template>
      </v-snackbar>
    </v-main>
  </v-app>
</template>

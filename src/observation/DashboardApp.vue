<script setup lang="ts">
import { ref, computed } from 'vue';
import { useIntervalFn, useStorage } from '@vueuse/core';
import axios from '@/lib/axios';
import dayjs, { Dayjs, JST } from '@/lib/dayjs';

import type { ObservationResultContainer, ObservatorItem } from '@/type/observator';
import ThemeToggleButton from '@/components/common/ThemeToggleButton.vue';
import UpdateTime from '@/components/common/UpdateTime.vue';
import UpdateCircle from '@/components/common/UpdateCircle.vue';
import AnimatedClock from '@/components/common/AnimatedClock.vue';
import ObservatorCard from '@/components/observation/ObservatorCard.vue';

const errorSnackbar = ref<boolean>();
const importDialog = ref<boolean>();
const showHiddenObservator = ref<boolean>();
const observationSequence = ref<number>();
const fetchedAt = ref<Dayjs>(dayjs(null));
const savedObservator = useStorage<ObservatorItem[]>('observator', []);
const unsavedObservator = ref<ObservatorItem[]>([]);
const fetchInterval = ref<number>(0);

const savedObservatorJson = computed<string>({
  get: () => JSON.stringify(savedObservator.value),
  set: (value) => {
    try {
      savedObservator.value = JSON.parse(value);
    } catch {
      console.error('failed to import');
    }
  },
});

useIntervalFn(async () => {
  try {
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

    fetchInterval.value = 10 * 1000;
  } catch (error) {
    console.error(`Fetching error. Retrying in 1 minute: ${error}`);
    errorSnackbar.value = true;
    fetchInterval.value = 60 * 1000;
  }
});

function saveStateChanged(observator: ObservatorItem) {
  const indexInSaved = savedObservator.value.findIndex((o) => o.address === observator.address);

  if (indexInSaved > -1) {
    savedObservator.value.splice(indexInSaved, 1);
    unsavedObservator.value.push(observator);
    return;
  }

  const indexInUnSaved = unsavedObservator.value.findIndex((o) => o.address === observator.address);

  if (indexInUnSaved > -1) {
    unsavedObservator.value.splice(indexInUnSaved, 1);
    savedObservator.value.push(observator);
  }
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
      </v-app-bar>

      <v-container>
        <v-row class="d-flex" height="100">
          <v-col
            cols="6"
            md="4"
            lg="3"
            xl="2"
            v-for="(observator, index) in savedObservator.filter((observator) => !observator.hidden)"
            :key="observator.address"
            class="align-self-stretch"
          >
            <ObservatorCard
              :observator="observator"
              is-saved
              :showMoveAbove="savedObservator.length > 1 && index > 0"
              :showMoveBelow="savedObservator.length > 1 && index < savedObservator.length - 1"
              @save-menu-clicked="saveStateChanged(observator)"
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
            v-for="(observator, index) in unsavedObservator.filter((observator) => !observator.hidden)"
            :key="observator.address"
          >
            <ObservatorCard
              :observator="observator"
              :is-saved="false"
              :showMoveAbove="unsavedObservator.length > 1 && index > 0"
              :showMoveBelow="unsavedObservator.length > 1 && index < unsavedObservator.length - 1"
              @save-menu-clicked="saveStateChanged(observator)"
              @move-above-clicked="moveAboveElement(unsavedObservator, observator)"
              @move-below-clicked="moveBelowElement(unsavedObservator, observator)"
            />
          </v-col>
        </v-row>
        <v-row
          v-if="
            showHiddenObservator &&
            (savedObservator.filter((observator) => observator.hidden).length ||
              unsavedObservator.filter((observator) => observator.hidden).length)
          "
        >
          <v-col cols="12" class="pb-0">
            <h3>Hidden Observator</h3>
          </v-col>
          <v-col
            cols="6"
            md="4"
            lg="3"
            xl="2"
            v-for="(observator, index) in savedObservator.filter((observator) => observator.hidden)"
            :key="observator.address"
          >
            <ObservatorCard
              :observator
              :is-saved="false"
              :showMoveAbove="savedObservator.length > 1 && index > 0"
              :showMoveBelow="savedObservator.length > 1 && index < savedObservator.length - 1"
              @save-menu-clicked="saveStateChanged(observator)"
              @move-above-clicked="moveAboveElement(savedObservator, observator)"
              @move-below-clicked="moveBelowElement(savedObservator, observator)"
            />
          </v-col>
          <v-col
            cols="6"
            md="4"
            lg="3"
            xl="2"
            v-for="(observator, index) in unsavedObservator.filter((observator) => observator.hidden)"
            :key="observator.address"
          >
            <ObservatorCard
              :observator
              :is-saved="false"
              :showMoveAbove="unsavedObservator.length > 1 && index > 0"
              :showMoveBelow="unsavedObservator.length > 1 && index < unsavedObservator.length - 1"
              @save-menu-clicked="saveStateChanged(observator)"
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
                  <UpdateCircle v-bind="props" :time="fetchedAt" />
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

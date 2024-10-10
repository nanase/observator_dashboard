<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AppBase, AnimatedClock } from '@nanase/alnilam/components';

import UpdateTime from '@/components/common/UpdateTime.vue';
import UpdateCircle from '@/components/common/UpdateCircle.vue';
import ObservatorCard from '@/components/observation/ObservatorCard.vue';
import ImportDialog from './ImportDialog.vue';
import { useObservationStore } from './store';

const observationStore = useObservationStore();
const showHiddenObservator = ref<boolean>();

onMounted(async () => await observationStore.startFetching());
</script>

<template>
  <AppBase toolbarTitle="Observation Dashboard" :error-snackbar-shown="observationStore.errorOccurred">
    <template #toolbarPrepend>
      <AnimatedClock />
    </template>
    <template #toolbarAppend>
      <v-menu>
        <template #activator="{ props }">
          <v-btn icon v-bind="props">
            <v-icon>mdi-dots-vertical</v-icon>
          </v-btn>
        </template>

        <v-list>
          <ImportDialog>
            <template #activator="{ props: activatorProps }">
              <v-list-item v-bind="activatorProps" title="Export / Import" prepend-icon="mdi-export" />
            </template>
          </ImportDialog>

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

    <v-row class="d-flex" height="100" v-if="observationStore.shownObservators.length > 0">
      <v-col
        cols="6"
        md="4"
        lg="3"
        xl="2"
        v-for="(observator, index) in showHiddenObservator
          ? observationStore.observators
          : observationStore.shownObservators"
        :key="observator.address"
        class="align-self-stretch"
      >
        <ObservatorCard
          :observator
          is-saved
          :showMoveAbove="observationStore.observators.length > 1 && index > 0"
          :showMoveBelow="observationStore.observators.length > 1 && index < observationStore.observators.length - 1"
          @move-above-clicked="observationStore.moveAboveObservator(observator)"
          @move-below-clicked="observationStore.moveBelowObservator(observator)"
        />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" class="text-right">
        <v-card variant="plain">
          <v-menu>
            <template #activator="{ props }">
              <UpdateCircle class="cursor-pointer" v-bind="props" :time="observationStore.fetchedAt" /> {{}}
              <UpdateTime
                class="cursor-pointer"
                v-bind="props"
                :time="observationStore.fetchedAt"
                :update-interval="5000"
              />
            </template>

            <v-list>
              <v-list-item
                :title="`Sequence #${observationStore.sequence ?? '--'}`"
                :subtitle="`Fetched at ${observationStore.fetchedAt.format('YYYY-MM-DD h:mm:ss')}`"
              />
            </v-list>
          </v-menu>
        </v-card>
      </v-col>
    </v-row>
  </AppBase>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useObservationStore } from './store';

const observationStore = useObservationStore();
const showing = defineModel<boolean>();
const code = ref<string>('');

onMounted(() => {
  code.value = JSON.stringify(observationStore.observators);
});

function onClickSaveButton() {
  observationStore.setObservators(JSON.parse(code.value));
  showing.value = false;
}
</script>

<template>
  <v-dialog v-model="showing" max-width="600">
    <template v-slot:activator="{ props: activatorProps }">
      <slot name="activator" :props="activatorProps"></slot>
    </template>

    <v-card prepend-icon="mdi-export" title="Export / Import">
      <v-card-text>
        <v-row dense>
          <v-col cols="12">
            <v-textarea v-model="code" style="font-family: monospace"></v-textarea>
          </v-col>
        </v-row>
      </v-card-text>
      <v-divider></v-divider>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn text="Save and Close" variant="plain" @click="onClickSaveButton"></v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

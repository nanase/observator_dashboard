<script setup lang="ts">
import { ref, defineEmits } from 'vue';

import type {
  ObservatorItem,
  ObservatorW3200010,
  ObservatorESP32Central,
  Observator,
  ObservatorType,
} from '@/type/observator';
import W3200010Card from './W3200010Card.vue';
import ESP32Card from './ESP32CentralCard.vue';

const { observator, isSaved, order } = defineProps<{
  observator: ObservatorItem;
  isSaved: boolean;
  order: 1 | 0 | -1;
}>();
const emit = defineEmits(['saveMenuClicked', 'renameDialogClosed', 'moveAboveClicked', 'moveBelowClicked']);
const dialog = ref<boolean>();

function is<T extends Observator>(observator: Observator | undefined, targetType: ObservatorType): observator is T {
  return observator?.type === targetType;
}
</script>

<template>
  <v-menu>
    <template v-slot:activator="{ props }">
      <v-card variant="elevated" v-bind="props" class="h-100">
        <v-card-text class="h-100">
          <W3200010Card
            v-if="is<ObservatorW3200010>(observator.result, 'W3200010')"
            :observator="observator.result"
            :name="observator.name"
          />
          <ESP32Card
            v-if="is<ObservatorESP32Central>(observator.result, 'ESP32-Central')"
            :observator="observator.result"
            :name="observator.name"
          />
        </v-card-text>
      </v-card>
    </template>

    <v-list>
      <v-list-item title="Unsave" v-if="isSaved" @click="emit('saveMenuClicked')" prepend-icon="mdi-content-save-off" />
      <v-list-item title="Save" v-else @click="emit('saveMenuClicked')" prepend-icon="mdi-content-save" />

      <v-dialog v-model="dialog" max-width="600" @update:modelValue="!dialog ? emit('renameDialogClosed') : ''">
        <template v-slot:activator="{ props: activatorProps }">
          <v-list-item v-bind="activatorProps" title="Rename" prepend-icon="mdi-rename" />
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
            <v-btn text="Close" variant="plain" @click="(dialog = false), emit('renameDialogClosed')"></v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-divider />
      <v-list-item
        title="Move above"
        v-if="order !== 1"
        @click="emit('moveAboveClicked')"
        prepend-icon="mdi-arrow-up"
      />
      <v-list-item
        title="Move below"
        v-if="order !== -1"
        @click="emit('moveBelowClicked')"
        prepend-icon="mdi-arrow-down"
      />
    </v-list>
  </v-menu>
</template>

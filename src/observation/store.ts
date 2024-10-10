import { defineStore } from 'pinia';
import dayjs, { type Dayjs, fromLocale } from '@nanase/alnilam/dayjs';
import { useStorage, type RemovableRef } from '@vueuse/core';

import type { ObservationResultContainer, ObservatorItem } from '@/type/observator';

type TimeoutIdType = ReturnType<typeof setTimeout>;

export interface State {
  container: ObservationResultContainer | undefined;
  observators: RemovableRef<ObservatorItem[]>;
  fetchedAt: Dayjs;
  sequence: number | undefined;
  timeoutId: TimeoutIdType | undefined;
  fetchInterval: number;
  error: any;
}

export const useObservationStore = defineStore('observation', {
  state: (): State => ({
    container: undefined,
    observators: useStorage<ObservatorItem[]>('observator', []),
    fetchedAt: dayjs(null),
    sequence: undefined,
    timeoutId: undefined,
    fetchInterval: 10 * 1000,
    error: undefined,
  }),
  getters: {
    shownObservators(): ObservatorItem[] {
      return this.observators.filter((o) => !o.hidden);
    },
    errorOccurred(): boolean {
      return typeof this.error !== 'undefined';
    },
  },
  actions: {
    async fetchContainer() {
      try {
        const response = await fetch(import.meta.env.VITE_DASHBOARD_RESULT_URL);
        const container = (await response.json()) as ObservationResultContainer;

        this.error = undefined;
        this.fetchInterval = 10 * 1000;

        if (this.sequence !== container.sequence) {
          this.sequence = container.sequence;
          this.container = container;
          this.fetchedAt = fromLocale('ja-JP', dayjs());

          for (const result of container.result) {
            const knownObservator = this.observators.find((o) => o.address === result.address);

            if (knownObservator) {
              knownObservator.result = result;
            } else {
              this.observators.push({
                address: result.address,
                name: result.address,
                result,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Fetching error. Retrying in 1 minute: ${error}`);
        this.error = error;
        this.fetchInterval = 60 * 1000;
      }
    },
    async startFetching() {
      if (typeof this.timeoutId !== 'undefined') {
        return;
      }

      await this.fetchContainer();

      this.timeoutId = setTimeout(async () => {
        this.timeoutId = undefined;
        await this.startFetching();
      }, this.fetchInterval);
    },
    stopFetching() {
      if (typeof this.timeoutId !== 'undefined') {
        clearInterval(this.timeoutId);
        this.timeoutId = undefined;
      }
    },
    setObservators(observators: ObservatorItem[]) {
      this.observators = observators;
    },
  },
});

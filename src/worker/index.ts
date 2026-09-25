import { createApp } from './app';
import { processRollups, purgeExpired } from './rollup';
import { nowSeconds } from './time';

const CRON_ROLLUP = '*/5 * * * *';
const CRON_PURGE = '0 19 * * *';

const app = createApp();

export default {
  fetch: app.fetch,

  async scheduled(controller, env) {
    const now = nowSeconds();
    switch (controller.cron) {
      case CRON_ROLLUP:
        console.log('rollup', await processRollups(env.DB, now));
        break;
      case CRON_PURGE:
        await purgeExpired(env.DB, now);
        break;
      default:
        console.error(`unknown cron: ${controller.cron}`);
    }
  },
} satisfies ExportedHandler<Env>;

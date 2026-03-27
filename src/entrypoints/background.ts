import { defineBackground } from 'wxt/utils/define-background';
import { APP_NAME } from '../shared/constants';
import { registerMessageRouter } from '../background/message-router';

export default defineBackground(() => {
  console.info(`${APP_NAME}: background service worker started`);
  registerMessageRouter();
});

import { APP_NAME } from '../shared/constants';
import { registerMessageRouter } from './message-router';

console.info(`${APP_NAME}: background worker loaded`);

registerMessageRouter();

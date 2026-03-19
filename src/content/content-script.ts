import { APP_NAME } from '../shared/constants';
import { fetchAuthStatus } from './auth-status';

console.info(`${APP_NAME}: content script loaded`);

fetchAuthStatus().catch((err: unknown) => {
  console.warn(`${APP_NAME}: could not fetch auth status`, err);
});

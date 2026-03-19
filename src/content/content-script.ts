import { APP_NAME } from '../shared/constants';
import { fetchAuthStatus } from './auth-status';

console.info(`${APP_NAME}: content script loaded`);

void fetchAuthStatus();

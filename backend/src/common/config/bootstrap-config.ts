import 'dotenv/config';
import { loadRuntimeConfig } from './runtime-config';

// Import this module before application modules so invalid settings fail
// before database pools, authentication instances, or mail transports exist.
export const runtimeConfig = loadRuntimeConfig(process.env);

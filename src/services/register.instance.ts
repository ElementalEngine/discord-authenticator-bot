import client from '../client.js';
import { RegisterService } from './register.service.js';
import { RegistrationSessionWatchService } from './registration-session-watch.service.js';

// Single shared instances. RegisterService is stateless (its api/roleSync/logs
// sub-services hold no per-call state), and the watch service's active-watch map is
// static (class-level), so one instance of each serves every command and interaction.
export const registerService = new RegisterService(client);
export const registrationWatchService = new RegistrationSessionWatchService(registerService);

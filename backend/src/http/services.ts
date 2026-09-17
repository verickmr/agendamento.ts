import type { AuthService } from '../application/auth-service.js';
import type { ScheduleService } from '../application/schedule-service.js';

export type AuthenticationService = Pick<AuthService, 'login' | 'current'>;
export type AppointmentService = Pick<
  ScheduleService,
  'available' | 'list' | 'create' | 'update' | 'cancel'
>;
export type AvailabilityBlockService = Pick<
  ScheduleService,
  'listBlocks' | 'createBlock' | 'removeBlock'
>;

export interface HttpServices {
  auth: AuthenticationService;
  appointments: AppointmentService;
  blocks: AvailabilityBlockService;
  checkDatabase: () => Promise<void>;
}

import type { RequestHandler } from 'express';
import {
  cancelSchema,
  createSchema,
  dateQuerySchema,
  idSchema,
  listSchema,
  patchSchema,
} from '../../domain/schedule.js';
import type { AppointmentService } from '../services.js';

export class AppointmentController {
  constructor(private readonly appointments: AppointmentService) {}

  available: RequestHandler = async (request, response) => {
    const { date } = dateQuerySchema.parse(request.query);
    const availability = await this.appointments.available(date);
    response.json(availability);
  };

  create: RequestHandler = async (request, response) => {
    const input = createSchema.parse(request.body);
    const appointment = await this.appointments.create(input);
    response.status(201).json(appointment);
  };

  list: RequestHandler = async (request, response) => {
    const { date, status } = listSchema.parse(request.query);
    const appointments = await this.appointments.list(date, status);
    response.json(appointments);
  };

  update: RequestHandler = async (request, response) => {
    const id = idSchema.parse(request.params.id);
    const input = patchSchema.parse(request.body);
    const appointment = await this.appointments.update(id, input);
    response.json(appointment);
  };

  cancel: RequestHandler = async (request, response) => {
    const id = idSchema.parse(request.params.id);
    const { version } = cancelSchema.parse(request.body);
    const appointment = await this.appointments.cancel(id, version, response.locals.user.id);
    response.json(appointment);
  };
}

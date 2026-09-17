import type { RequestHandler } from 'express';
import { blockListSchema, blockSchema, idSchema } from '../../domain/schedule.js';
import type { AvailabilityBlockService } from '../services.js';

export class AvailabilityBlockController {
  constructor(private readonly blocks: AvailabilityBlockService) {}

  list: RequestHandler = async (request, response) => {
    const { date } = blockListSchema.parse(request.query);
    const blocks = await this.blocks.listBlocks(date);
    response.json(blocks);
  };

  create: RequestHandler = async (request, response) => {
    const input = blockSchema.parse(request.body);
    const block = await this.blocks.createBlock(input, response.locals.user.id);
    response.status(201).json(block);
  };

  remove: RequestHandler = async (request, response) => {
    const id = idSchema.parse(request.params.id);
    await this.blocks.removeBlock(id, response.locals.user.id);
    response.status(204).end();
  };
}

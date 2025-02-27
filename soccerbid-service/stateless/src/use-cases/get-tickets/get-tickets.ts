import { Ticket, Tickets } from '@dto/ticket';

import { config } from '@config';
import { list } from '@adapters/secondary/dynamodb-adapter';
import { logger } from '@shared';

const tableName = config.get('tableName');

export async function getTicketsUseCase(): Promise<Tickets> {
  const { items: tickets } = await list<Ticket>(tableName, 50);

  logger.info(`tickets retrieved: ${JSON.stringify(tickets)}`);

  return tickets;
}

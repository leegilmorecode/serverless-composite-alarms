import { Ticket, TicketResponses } from '@dto/ticket';
import { base64ToObject, delay, logger, objectToBase64 } from '@shared';

import { query } from '@adapters/secondary/dynamodb-adapter';
import { config } from '@config';

const tableName = config.get('tableName');
const typeIndex = config.get('typeIndex');
const addLatency = config.get('addLatency');

export async function getTicketsUseCase(
  nextToken?: string | null,
  ascending?: boolean,
): Promise<TicketResponses> {
  const nextTokenObject = nextToken
    ? base64ToObject<Record<string, any>>(nextToken)
    : undefined;

  const { items: tickets, lastEvaluatedKey } = await query<Ticket>({
    tableName: tableName,
    keyConditionExpression: '#type = :type',
    expressionAttributeValues: { ':type': 'TICKET' },
    expressionAttributeNames: { '#type': 'type' },
    indexName: typeIndex,
    limit: 50,
    scanIndexForward: ascending,
    lastEvaluatedKey: nextTokenObject,
  });

  logger.info(`Tickets retrieved: ${JSON.stringify(tickets)}`);

  // if there is a delay in the configuration, add a delay of 1.5 seconds
  if (addLatency === 'true') {
    await delay(1500);
    logger.debug('Delay added of 1500 ms');
  } else {
    logger.debug('No delay added');
  }

  return {
    items: tickets.map((ticket: Ticket) => ({
      id: ticket.id,
      created: ticket.created,
      updated: ticket.updated,
      eventName: ticket.eventName,
      sellerId: ticket.sellerId,
      price: ticket.price,
    })),
    nextToken: lastEvaluatedKey ? objectToBase64(lastEvaluatedKey) : undefined,
  };
}

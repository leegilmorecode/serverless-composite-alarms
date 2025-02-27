import { getById, upsert } from '@adapters/secondary/dynamodb-adapter';
import { Bid, BidResponse } from '@dto/bid';
import {
  delay,
  getCurrentEpochTime,
  getISOString,
  logger,
  schemaValidator,
} from '@shared';

import { config } from '@config';
import { PlaceBid } from '@dto/place-bid';
import { Ticket } from '@dto/ticket';
import { ResourceNotFoundError } from '@errors/resource-not-found-error';
import { ValidationError } from '@errors/validation-error';
import { schema } from '@schemas/bid';
import { v4 as uuid } from 'uuid';

const tableName = config.get('tableName');
const addLatency = config.get('addLatency');

export async function placeBidUseCase(bid: PlaceBid): Promise<BidResponse> {
  const createdDate = getISOString();
  const id = uuid();

  // get the ticket by ID
  const ticket = await getById<Ticket>(
    { pk: `TICKET#${bid.ticketId}`, sk: `TICKET#${bid.ticketId}` },
    tableName,
  );

  if (!ticket) {
    throw new ResourceNotFoundError(`Ticket with ID ${bid.ticketId} not found`);
  }

  // check if the ticket is locked for bids or not
  const currentTime = getCurrentEpochTime();

  const isLocked = currentTime > ticket.lockExpiry;

  if (isLocked) {
    logger.debug(
      `Current time: ${currentTime} > lock expiry of ticket: ${ticket.lockExpiry}`,
    );
    throw new ValidationError('Ticket is now locked for new bids');
  }

  // Ensure bid is not below the minimum ticket price which has been set
  if (bid.amount < ticket.price) {
    throw new ValidationError(`Bid amount must be at least ${ticket.price}.`);
  }

  const bidDto: Bid = {
    id,
    pk: `TICKET#${bid.ticketId}`,
    sk: `BID#${id}`,
    created: createdDate,
    type: 'BID',
    ...bid,
  };

  schemaValidator(schema, bidDto);

  // store bid in DynamoDB
  await upsert({ newItem: bidDto, tableName, id, preventOverwrite: true });

  logger.info(`Bid placed successfully: ${JSON.stringify(bidDto)}`);

  // if there is a delay in the configuration, add a delay of 1.5 seconds
  if (addLatency === 'true') {
    await delay(1500);
    logger.debug('Delay added of 1500 ms');
  } else {
    logger.debug('No delay added');
  }

  return {
    id: bidDto.id,
    created: bidDto.created,
    ticketId: bidDto.ticketId,
    bidderId: bidDto.bidderId,
    amount: bidDto.amount,
  };
}

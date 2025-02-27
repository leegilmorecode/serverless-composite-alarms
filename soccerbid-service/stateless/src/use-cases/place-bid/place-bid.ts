import { getById, upsert } from '@adapters/secondary/dynamodb-adapter';
import { getISOString, logger, schemaValidator } from '@shared';

import { Bid } from '@dto/bid';
import { ForbiddenError } from '@errors/forbidden-error';
import { PlaceBid } from '@dto/place-bid';
import { ResourceNotFoundError } from '@errors/resource-not-found-error';
import { Ticket } from '@dto/ticket';
import { config } from '@config';
import { schema } from '@schemas/bid';
import { v4 as uuid } from 'uuid';

const tableName = config.get('tableName');

export async function placeBidUseCase(bid: PlaceBid): Promise<Bid> {
  const createdDate = getISOString();
  const id = bid.id ? bid.id : uuid(); // create ID if not provided the first time

  // get the ticket by ID
  const ticket = await getById<Ticket>(
    { pk: `TICKET#${bid.ticketId}` },
    tableName,
  );

  if (!ticket) {
    throw new ResourceNotFoundError(`Ticket with ID ${bid.ticketId} not found`);
  }

  // check if the ticket is locked for bids or not
  const currentTime = Date.now();

  const lockExpiryTime = ticket.lockExpiry
    ? new Date(ticket.lockExpiry).getTime()
    : 0;

  const isLocked = lockExpiryTime > currentTime;

  if (isLocked) {
    throw new ForbiddenError(
      `Ticket is now locked for new bids since ${ticket.lockExpiry}.`,
    );
  }

  // Ensure bid is not below the minimum price
  if (bid.amount < ticket.price) {
    throw new ForbiddenError(`Bid amount must be at least ${ticket.price}.`);
  }

  const bidDto: Bid = {
    id,
    pk: `TICKET#${bid.ticketId}`,
    sk: `BID#${id}`,
    created: createdDate,
    type: 'BID',
    ...bid,
  };

  schemaValidator(schema, bid);

  // store bid in DynamoDB
  await upsert(bidDto, tableName, id);

  logger.info(`Bid placed successfully: ${JSON.stringify(bidDto)}`);

  return bidDto;
}

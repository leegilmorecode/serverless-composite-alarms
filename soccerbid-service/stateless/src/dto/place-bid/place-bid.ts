export const schema = {
  type: 'object',
  required: ['ticketId', 'bidderId', 'amount'],
  maxProperties: 4,
  minProperties: 3,
  properties: {
    id: { type: 'string', nullable: true },
    ticketId: { type: 'string', minLength: 1 },
    bidderId: { type: 'string', minLength: 1 },
    amount: { type: 'number', minimum: 0.01 },
  },
};

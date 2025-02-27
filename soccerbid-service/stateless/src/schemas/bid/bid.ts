export const schema = {
  type: 'object',
  required: [
    'id',
    'pk',
    'sk',
    'created',
    'type',
    'ticketId',
    'bidderId',
    'amount',
  ],
  maxProperties: 8,
  minProperties: 8,
  properties: {
    id: { type: 'string', minLength: 1 },
    pk: { type: 'string', pattern: '^TICKET#.+$' },
    sk: { type: 'string', pattern: '^BID#.+$' },
    created: { type: 'string', format: 'date-time' },
    type: { type: 'string', enum: ['BID'] },
    ticketId: { type: 'string', minLength: 1 },
    bidderId: { type: 'string', minLength: 1 },
    amount: { type: 'number', minimum: 0.01 },
  },
};

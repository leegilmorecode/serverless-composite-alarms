export const schema = {
  type: 'object',
  required: [
    'id',
    'pk',
    'sk',
    'created',
    'updated',
    'type',
    'eventName',
    'sellerId',
    'price',
  ],
  maxProperties: 10,
  minProperties: 10,
  properties: {
    id: { type: 'string' },
    pk: { type: 'string', pattern: '^TICKET#.*$' },
    sk: { type: 'string', pattern: '^TICKET#.*$' },
    created: { type: 'string', format: 'date-time' },
    updated: { type: 'string', format: 'date-time' },
    type: { type: 'string', enum: ['TICKET'] },
    eventName: { type: 'string', minLength: 1 },
    sellerId: { type: 'string', minLength: 1 },
    price: { type: 'number', minimum: 0 },
    lockExpiry: { type: 'number' },
  },
};

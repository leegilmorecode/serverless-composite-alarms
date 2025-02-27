export type Ticket = {
  id: string; // ticketId
  pk: string; // "TICKET#<id>"
  sk: string; // "TICKET#<id>"
  created: string;
  updated: string;
  type: 'TICKET';
  eventName: string;
  sellerId: string;
  price: number;
  currentBid?: number;
  lockExpiry?: string;
};

export type Tickets = Ticket[];

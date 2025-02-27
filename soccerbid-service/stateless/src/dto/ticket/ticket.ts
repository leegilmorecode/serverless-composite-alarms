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
  lockExpiry: number;
};

export type TicketResponse = {
  id: string; // ticketId
  created: string;
  updated: string;
  eventName: string;
  sellerId: string;
  price: number;
};

export type Tickets = Ticket[];

export type TicketResponses = { items: TicketResponse[]; nextToken?: string };

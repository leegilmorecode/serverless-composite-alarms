export type Bid = {
  id: string;
  pk: string; // "TICKET#<ticketId>"
  sk: string; // "BID#<bidId>"
  created: string;
  type: 'BID';
  ticketId: string;
  bidderId: string;
  amount: number;
};

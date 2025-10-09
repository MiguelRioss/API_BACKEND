export const emailObjectAfterValidation = {
  name: 'Miguel Rios',
  email: 'miguelangelorios5f@gmail.com',
  phone: '+351 928269577',
  amount_total: 35000,
  currency: 'EUR',
  payment_id: 'pi-100',
  items: [
    {
      id: 3,
      name: 'Ibotincture™ LUCIA (60 ml)',
      quantity: 1,
      unit_amount: 35000
    }
  ],
  status: {
    accepted: { status: false },
    in_transit: { status: false },
    delivered: { status: false },
    acceptedInCtt: { status: false },
    waiting_to_be_delivered: { status: false }
  },
  metadata: {
    payment_provider: 'revolut',
    billing_same_as_shipping: true,
    shipping_address: {
      name: 'Miguel Rios',
      line1: 'R. Carlos Mardel 59, 1900-118 Lisboa, Portugal',
      line2: 'Rua Cardel Mardel 59',
      city: 'Lisboa',
      postal_code: '1885-047',
      country: 'Portugal',
      phone: '+351 928269577',
      phone_prefix: '+351',
      phone_number: '928269577'
    },
    billing_address: {
      name: 'Miguel Rios',
      line1: 'R. Carlos Mardel 59, 1900-118 Lisboa, Portugal',
      line2: 'Rua Cardel Mardel 59',
      city: 'Lisboa',
      postal_code: '1885-047',
      country: 'Portugal',
      phone: '+351 928269577',
      phone_prefix: '+351',
      phone_number: '928269577'
    },
    shipping_cost_cents: 0
  },
  track_url: ''
};

export default emailObjectAfterValidation;

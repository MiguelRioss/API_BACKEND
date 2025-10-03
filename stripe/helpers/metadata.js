import { isPlainObject, toSafeString } from "./strings.js";

export function buildMetadata(session, defaults) {
  const metadata = {};

  if (isPlainObject(session.metadata)) {
    for (const [key, value] of Object.entries(session.metadata)) {
      metadata[key] = value;
    }
  }

  const shipping = session.shipping_details ?? {};
  const shippingAddress = shipping.address ?? {};
  const customer = session.customer_details ?? {};
  const customerAddress = customer.address ?? {};

  metadata.addr_line1 = toSafeString(shippingAddress.line1 ?? customerAddress.line1 ?? metadata.addr_line1);
  metadata.addr_line2 = toSafeString(shippingAddress.line2 ?? customerAddress.line2 ?? metadata.addr_line2);
  metadata.addr_city = toSafeString(shippingAddress.city ?? customerAddress.city ?? metadata.addr_city);
  metadata.addr_ctry = toSafeString(shippingAddress.country ?? customerAddress.country ?? metadata.addr_ctry);
  metadata.addr_zip = toSafeString(
    shippingAddress.postal_code ?? customerAddress.postal_code ?? metadata.addr_zip
  );
  metadata.full_name = toSafeString(shipping.name ?? customer.name ?? defaults.name);
  metadata.phone = toSafeString(shipping.phone ?? customer.phone ?? metadata.phone);
  metadata.stripe_session_id = toSafeString(session.id);
  metadata.payment_intent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : toSafeString(session.payment_intent?.id);
  metadata.customer_id = toSafeString(session.customer);
  metadata.client_reference_id = toSafeString(session.client_reference_id);
  metadata.checkout_status = toSafeString(session.status);
  metadata.checkout_mode = toSafeString(session.mode);

  return metadata;
}

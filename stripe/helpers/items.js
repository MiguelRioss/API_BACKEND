import { createHttpError } from "../erros/erros.js";
import { ensureNonEmpty } from "./strings.js";

export function buildItems(lineItems) {
  const items = lineItems.map((line, index) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw createHttpError(400, `Invalid quantity for line item at position ${index}`);
    }
    if (!Number.isInteger(line.amount_total) || line.amount_total < 0) {
      throw createHttpError(400, `Invalid amount_total for line item at position ${index}`);
    }

    const quantity = line.quantity;
    const lineTotal = line.amount_total;

    let unitAmount;
    if (lineTotal % quantity === 0) {
      unitAmount = lineTotal / quantity;
    } else if (line.price && Number.isInteger(line.price.unit_amount)) {
      unitAmount = line.price.unit_amount;
    } else {
      throw createHttpError(400, `Unable to derive unit_amount for line item at position ${index}`);
    }

    if (!Number.isInteger(unitAmount) || unitAmount < 0) {
      throw createHttpError(400, `Invalid unit amount for line item at position ${index}`);
    }

    const id = ensureNonEmpty(
      line.price?.product ?? line.price?.id ?? line.id,
      `Missing id for line item at position ${index}`
    );
    const name = ensureNonEmpty(
      line.description ?? line.price?.nickname ?? line.price?.product ?? line.id,
      `Missing name for line item at position ${index}`
    );

    return { id, name, quantity, unit_amount: unitAmount };
  });

  const amount_total = items.reduce((sum, item) => sum + item.quantity * item.unit_amount, 0);
  return { items, amount_total };
}

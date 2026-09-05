/**
 * All money in this app is integer cents. Never use floats for totals.
 */

export function formatMoney(cents, currency = 'cad') {
  const amount = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
}

export function toCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

/**
 * Apply a discount row to a subtotal, returning the discount amount in cents.
 * Never returns more than the subtotal.
 */
export function discountAmount(discount, subtotalCents) {
  if (!discount) return 0;

  const amount =
    discount.type === 'percent'
      ? Math.round((subtotalCents * discount.value) / 100)
      : discount.value;

  return Math.max(0, Math.min(amount, subtotalCents));
}

export function isDiscountUsable(discount, subtotalCents) {
  if (!discount || !discount.active) return 'That code is not available.';

  const now = new Date();
  if (discount.starts_at && new Date(`${discount.starts_at}Z`) > now) {
    return 'That code is not active yet.';
  }
  if (discount.ends_at && new Date(`${discount.ends_at}Z`) < now) {
    return 'That code has expired.';
  }
  if (discount.max_redemptions > 0 && discount.times_redeemed >= discount.max_redemptions) {
    return 'That code has reached its redemption limit.';
  }
  if (subtotalCents < discount.min_subtotal_cents) {
    return `That code needs a subtotal of at least ${formatMoney(discount.min_subtotal_cents)}.`;
  }
  return null;
}

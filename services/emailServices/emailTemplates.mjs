/**
 * Build a short thank-you email body for order confirmation.
 * @param {object} params
 * @param {object} params.order - order payload
 */
export function buildThankYouEmailHtml({ order }) {
  return `
    <div style="font-family:Helvetica,Arial,sans-serif; line-height:1.6; color:#222; font-size:14px;">
      <h2 style="color:#111;">Thank you for your order, ${order?.name || "Customer"}!</h2>
      <p>
        We’ve received your order and it’s now being processed.<br/>
        You’ll find your invoice attached to this email.
      </p>
      <p style="margin-top:12px;">
        <b>Order total:</b> ${(Number(order?.amount_total || 0) / 100).toFixed(2)} 
        ${String(order?.currency || "").toUpperCase()}
      </p>
      <p style="margin-top:20px;">
        With gratitude,<br/>
        <b>The Ibogenics Team</b><br/>
        <a href="https://mesodose.com" style="color:#b87333; text-decoration:none;">www.mesodose.com</a>
      </p>
    </div>
  `;
}

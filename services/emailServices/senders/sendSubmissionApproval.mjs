import { buildSubmissionApprovalTemplate } from "../templates/SubmissionApprovalTemplate.mjs";

export async function sendSubmissionApproval({
  transport,
  userEmail,
  userName,
  voucherCode,
  videoUrl,
}) {
  if (!userEmail) {
    throw new Error("userEmail is required for submission approval");
  }

  console.log("🔍 [sendSubmissionApproval] Starting approval email for:", userEmail);
  console.log("🔍 [sendSubmissionApproval] Voucher code:", voucherCode);
  console.log("🔍 [sendSubmissionApproval] User name:", userName);

  const { subject, html } = buildSubmissionApprovalTemplate({
    customerName: userName,
    voucherCode,
    videoUrl,
  });

  console.log("🔍 [sendSubmissionApproval] Subject:", subject);
  console.log("🔍 [sendSubmissionApproval] HTML length:", html.length);

  try {
    await transport.send({
      toEmail: userEmail,
      toName: userName || "Valued Customer",
      subject,
      html,
    });

    console.log("✅ [sendSubmissionApproval] Submission approval sent successfully to:", userEmail);
  } catch (error) {
    console.error("❌ [sendSubmissionApproval] Failed to send:", error);
    throw error;
  }
}

export default {
  sendSubmissionApproval,
};
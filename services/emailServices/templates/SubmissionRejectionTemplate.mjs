import { escapeHtml, normalizeString, firstNonEmpty } from "./templateUtils.mjs";

export function buildSubmissionRejectionTemplate({
  customerName,
  rejectionReason,
  resubmitUrl,
  rejectionNotes, // <-- NEW (optional free-text notes)
} = {}) {
  const firstName = extractFirstName(firstNonEmpty(customerName, "Customer"));
  const safeRejectionReason =
    normalizeString(rejectionReason) || "Content not suitable for publishing";
  const safeResubmitUrl =
    normalizeString(resubmitUrl) || "https://mesodose.com/mesobuzz/upload";

  // Preserve line breaks in notes while keeping it safe
  const rawNotes = typeof rejectionNotes === "string" ? rejectionNotes : "";
  const hasNotes = rawNotes.trim().length > 0;
  const notesHtml = hasNotes
    ? escapeHtml(rawNotes).replace(/\r?\n/g, "<br/>")
    : "";

  const subject = buildSubmissionRejectionSubject();

  return {
    subject,
    html: [
      '<div style="font-family:Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.6;">',
      `  <p style="margin:0 0 16px 0;">Hi ${escapeHtml(firstName)},</p>`,
      '  <p style="margin:0 0 16px 0;">Thank you for submitting your video to MESOBUZZ®. 🌿</p>',
      "  <p style=\"margin:0 0 16px 0;\">We've reviewed your submission, but unfortunately, it wasn't suitable for publishing this time.</p>",
      `  <p style="margin:16px 0; padding:12px; background-color:#f8f8f8; border-left:4px solid #b87333;"><strong>Reason:</strong> ${escapeHtml(
        safeRejectionReason
      )}</p>`,

      // ---- NEW: Notes block (conditional) ----
      ...(hasNotes
        ? [
            '  <div style="margin:12px 0 16px 0; padding:12px; background-color:#fff7ee; border:1px solid #f3c4a1; border-radius:6px;">',
            '    <div style="font-weight:700; margin-bottom:6px; color:#7a4b21;">Notes about rejection:</div>',
            `    <div style="color:#333;">${notesHtml}</div>`,
            "  </div>",
          ]
        : []),

      "  <p style=\"margin:0 0 16px 0;\">Don't worry — you can always try again. We'd love to feature your journey once the issue is resolved.</p>",
      '  <p style="margin:24px 0 8px 0;"><strong>✨ Tips for resubmission:</strong></p>',
      '  <ul style="margin:0 0 16px 16px;padding:0;">',
      "    <li style=\"margin:0 0 8px 0;\">Keep your phone steady and ensure good lighting</li>",
      "    <li style=\"margin:0 0 8px 0;\">Speak clearly or show your mesodose ritual in a way others can follow</li>",
      "    <li style=\"margin:0 0 8px 0;\">Keep it authentic — raw and real is perfect, but it still needs to be viewable</li>",
      "  </ul>",
      `  <p style="margin:0 0 16px 0;">Please resubmit your updated video here: <a href="${escapeHtml(
        safeResubmitUrl
      )}" style="color:#b87333;">${escapeHtml(safeResubmitUrl)}</a></p>`,
      '  <div style="text-align:center; margin:24px 0;">',
      `    <a href="${escapeHtml(
        safeResubmitUrl
      )}" style="background-color:#b87333; color:white; padding:12px 24px; text-decoration:none; border-radius:4px; display:inline-block;">Resubmit Video</a>`,
      "  </div>",
      "  <p style=\"margin:16px 0 0 0;\">We truly value your effort and look forward to sharing your story on MESOBUZZ®.</p>",
      '  <p style="margin:32px 0 0 0;">With appreciation,<br/><strong>The Mesodose® Team</strong></p>',
      "</div>",
    ].join("\n"),
  };
}

export function buildSubmissionRejectionSubject() {
  return "⚠️ Your MESOBUZZ® video couldn't be approved — here's why";
}

function extractFirstName(fullName) {
  if (!fullName) return "there";
  const normalized = normalizeString(fullName);
  const firstName = normalized.split(" ")[0];
  return firstName || "there";
}

export default {
  buildSubmissionRejectionTemplate,
  buildSubmissionRejectionSubject,
};

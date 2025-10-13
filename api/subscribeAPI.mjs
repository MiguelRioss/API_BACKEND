// api/subscribeAPI.mjs
import fetch from "node-fetch";

/**
 * Subscribe API
 * -------------
 * Receives POST /api/subscribe
 * Calls Brevo to add or update a contact.
 */
export default function createSubscribeAPI() {
  return {
    handleSubscribe,
  };

  async function handleSubscribe(req, res) {
    const { email, fullName, phone } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    try {
      const response = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": process.env.BREVO_API_KEY, // 🔐 secure in .env
        },
        body: JSON.stringify({
          email,
          attributes: {
            FIRSTNAME: fullName?.split(" ")[0] || "",
            LASTNAME: fullName?.split(" ").slice(1).join(" ") || "",
            PHONE: phone || "",
          },
          listIds: [Number(process.env.BREVO_LIST_ID) || 5],
          updateEnabled: true,
          tags: ["checkout_optin"],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ Brevo error:", data);
        return res.status(response.status).json(data);
      }

      console.log("✅ Added to Brevo:", data);
      res.status(200).json({ success: true, data });
    } catch (err) {
      console.error("❌ handleSubscribe error:", err);
      res.status(500).json({ error: err.message });
    }
  }
}

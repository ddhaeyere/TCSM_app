// Sends mail through Resend (https://resend.com). Without RESEND_API_KEY
// the app works as before, it just sends no mail.

// Placeholder addresses from the member list never get mail.
function isPlaceholder(email: string): boolean {
  return /@example\.(com|org|net)$/i.test(email);
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from || isPlaceholder(to)) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, text }),
    });
    if (!response.ok) console.error("Mail to", to, "failed:", await response.text());
  } catch (error) {
    // A mail that fails must never undo a registration.
    console.error("Mail to", to, "failed:", error);
  }
}

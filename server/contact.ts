import { sendEmail } from "./email";

export interface ContactMessageData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Send a contact form message via MailerSend.
 */
export async function sendContactMessage(data: ContactMessageData): Promise<boolean> {
  try {
    const { name, email, subject, message } = data;
    const contactEmail = process.env.CONTACT_EMAIL?.trim() || "communications@vfwharrisonoh.org";
    const fromEmail = process.env.DEFAULT_FROM_EMAIL?.trim() || contactEmail;

    const success = await sendEmail({
      to: contactEmail,
      from: fromEmail,
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
      html: `
<h2>New Contact Form Submission</h2>
<p><strong>From:</strong> ${name} (${email})</p>
<p><strong>Subject:</strong> ${subject}</p>
<h3>Message:</h3>
<p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    if (success) {
      console.log(`Sent contact form email from ${email}`);
      return true;
    }

    console.error("MailerSend contact form email error: sendEmail returned false");
    return false;
  } catch (error) {
    console.error("MailerSend contact form email error:", error);
    return false;
  }
}

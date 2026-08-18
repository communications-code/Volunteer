# Email API System Documentation

This document provides the complete email functionality from Christ's Loving Hands app that you can implement in other applications. It includes SendGrid integration, MailerLite integration, secure token generation, and comprehensive email templates.

## Core Dependencies

```bash
npm install @sendgrid/mail node-fetch
```

## Environment Variables Required

```env
SENDGRID_API_KEY=your_sendgrid_api_key_here
MAILERLITE_API_KEY=your_mailerlite_api_key_here
SESSION_SECRET=your_secure_session_secret_for_tokens
HOST_URL=https://yourdomain.com
```

## 1. SendGrid Email Service (email.ts)

### Basic Email Function
```typescript
import { MailService } from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import { createHmac } from 'crypto';

// Initialize SendGrid
const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY as string);

// Configuration
const DEFAULT_FROM_EMAIL = 'noreply@yourdomain.com';
const HOST_URL = process.env.HOST_URL || 'http://localhost:5000';
const CONTACT_EMAIL = 'contact@yourdomain.com';
const CONTACT_PHONE = '555-123-4567';

// Email parameters interface
interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

/**
 * Core email sending function using SendGrid
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    const mailData: MailDataRequired = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || params.text || '',
    };
    await mailService.send(mailData);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}
```

### Secure Token Generation for Email Actions
```typescript
/**
 * Generate secure tokens for email action links (like "mark as completed")
 * Tokens expire in 7 days and are cryptographically secure
 */
function generateSecureToken(itemId: number, action: string): string {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable must be set');
  }
  
  // Token expires in 7 days
  const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000);
  
  // Create payload with ID, action, and expiry
  const payload = `${itemId}:${action}:${expiryTime}`;
  
  // Create HMAC signature using session secret
  const hmac = createHmac('sha256', process.env.SESSION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  
  // Combine payload and signature, encode as base64
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

/**
 * Verify a secure token and extract its data
 */
function verifySecureToken(token: string): { itemId: number; action: string; valid: boolean } {
  try {
    if (!process.env.SESSION_SECRET) {
      return { itemId: 0, action: '', valid: false };
    }

    // Decode the token
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    
    if (parts.length !== 4) {
      return { itemId: 0, action: '', valid: false };
    }

    const [itemIdStr, action, expiryTimeStr, providedSignature] = parts;
    const itemId = parseInt(itemIdStr);
    const expiryTime = parseInt(expiryTimeStr);

    // Check if token has expired
    if (Date.now() > expiryTime) {
      return { itemId, action, valid: false };
    }

    // Verify signature
    const payload = `${itemId}:${action}:${expiryTime}`;
    const hmac = createHmac('sha256', process.env.SESSION_SECRET);
    hmac.update(payload);
    const calculatedSignature = hmac.digest('hex');

    const valid = calculatedSignature === providedSignature;
    return { itemId, action, valid };
  } catch (error) {
    return { itemId: 0, action: '', valid: false };
  }
}
```

### User Confirmation Email Template
```typescript
/**
 * Send confirmation email to user who submitted a response/pledge
 */
export async function sendUserConfirmation(
  item: any, // Your main item (need, request, etc.)
  userResponse: any // User's response/pledge
): Promise<boolean> {
  const subject = `Thank you for your response`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #d14633; margin-bottom: 5px;">Thank You for Your Response!</h1>
        <p style="color: #197991; font-size: 18px;">Your commitment makes a difference</p>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p>Dear ${userResponse.firstName},</p>
        <p>Thank you for your generous response! We appreciate your willingness to help.</p>
        <p>Someone from our team will be in touch with you within 2-3 business days to coordinate the details.</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #212421; margin-top: 0;">Item Details</h2>
        <p><strong>Title:</strong> ${item.title}</p>
        <p><strong>Category:</strong> ${item.category}</p>
        <p><strong>Description:</strong> ${item.description || 'No description provided'}</p>
        ${item.neededBy ? `<p><strong>Needed By:</strong> ${new Date(item.neededBy).toLocaleDateString()}</p>` : ''}
        ${item.estimatedCost ? `<p><strong>Estimated Cost:</strong> $${(item.estimatedCost / 100).toFixed(2)}</p>` : ''}
      </div>
      
      <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; border: 1px solid #197991;">
        <h2 style="color: #197991; margin-top: 0;">Your Response Details</h2>
        <p><strong>Name:</strong> ${userResponse.firstName} ${userResponse.lastName}</p>
        <p><strong>Email:</strong> ${userResponse.email}</p>
        ${userResponse.phone ? `<p><strong>Phone:</strong> ${userResponse.phone}</p>` : ''}
        <p><strong>Response Type:</strong> ${userResponse.responseType}</p>
        ${userResponse.notes ? `<p><strong>Notes:</strong> ${userResponse.notes}</p>` : ''}
      </div>
      
      <div style="margin-top: 30px;">
        <p>If you have any questions, please contact us:</p>
        <p>
          <strong>Email:</strong> <a href="mailto:${CONTACT_EMAIL}" style="color: #197991;">${CONTACT_EMAIL}</a><br>
          <strong>Phone:</strong> <a href="tel:${CONTACT_PHONE}" style="color: #197991;">${CONTACT_PHONE}</a>
        </p>
      </div>
      
      <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #e0e0e0;">
        <p style="color: #666;">Thank you again for your generosity!</p>
        <p style="color: #666; font-size: 14px;">This is an automated message.</p>
      </div>
    </div>
  `;
  
  const text = `
    THANK YOU FOR YOUR RESPONSE!
    
    Dear ${userResponse.firstName},
    
    Thank you for your generous response! We appreciate your willingness to help.
    Someone from our team will be in touch with you within 2-3 business days to coordinate the details.
    
    ITEM DETAILS
    Title: ${item.title}
    Category: ${item.category}
    ${item.description ? `Description: ${item.description}` : ''}
    ${item.neededBy ? `Needed By: ${new Date(item.neededBy).toLocaleDateString()}` : ''}
    ${item.estimatedCost ? `Estimated Cost: $${(item.estimatedCost / 100).toFixed(2)}` : ''}
    
    YOUR RESPONSE DETAILS
    Name: ${userResponse.firstName} ${userResponse.lastName}
    Email: ${userResponse.email}
    ${userResponse.phone ? `Phone: ${userResponse.phone}` : ''}
    Response Type: ${userResponse.responseType}
    ${userResponse.notes ? `Notes: ${userResponse.notes}` : ''}
    
    Contact us: ${CONTACT_EMAIL} | ${CONTACT_PHONE}
  `;
  
  return await sendEmail({
    to: userResponse.email,
    from: DEFAULT_FROM_EMAIL,
    subject,
    text,
    html,
  });
}
```

### Admin Notification Email Template
```typescript
/**
 * Send notification email to admin(s) when new response is received
 */
export async function sendAdminNotification(
  item: any,
  userResponse: any,
  adminEmails: string[] | string
): Promise<boolean> {
  const to = Array.isArray(adminEmails) ? adminEmails : [adminEmails];
  
  const subject = `[Your App] New Response for "${item.title}"`;
  
  // Generate secure token for completion action
  let completeToken = '';
  let completeLink = '';
  
  try {
    completeToken = generateSecureToken(item.id, 'complete');
    completeLink = `${HOST_URL}/complete?token=${completeToken}`;
  } catch (error) {
    console.error('Error generating token for email:', error);
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #d14633; margin-bottom: 5px;">New Response Received</h1>
        <p style="color: #197991; font-size: 18px;">Someone has responded to an item</p>
      </div>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h2 style="color: #212421; margin-top: 0;">Item Details</h2>
        <p><strong>Title:</strong> ${item.title}</p>
        <p><strong>Category:</strong> ${item.category}</p>
        <p><strong>Description:</strong> ${item.description || 'No description provided'}</p>
        ${item.neededBy ? `<p><strong>Needed By:</strong> ${new Date(item.neededBy).toLocaleDateString()}</p>` : ''}
        ${item.estimatedCost ? `<p><strong>Estimated Cost:</strong> $${(item.estimatedCost / 100).toFixed(2)}</p>` : ''}
      </div>
      
      <div style="background-color: #e6f7ff; padding: 15px; border-radius: 5px; border: 1px solid #197991;">
        <h2 style="color: #197991; margin-top: 0;">Response Contact Information</h2>
        <p><strong>Name:</strong> ${userResponse.firstName} ${userResponse.lastName}</p>
        <p><strong>Email:</strong> <a href="mailto:${userResponse.email}" style="color: #197991;">${userResponse.email}</a></p>
        ${userResponse.phone ? `<p><strong>Phone:</strong> <a href="tel:${userResponse.phone}" style="color: #197991;">${userResponse.phone}</a></p>` : ''}
        <p><strong>Response Type:</strong> ${userResponse.responseType}</p>
        ${userResponse.notes ? `<p><strong>Notes:</strong> ${userResponse.notes}</p>` : ''}
      </div>
      
      ${completeLink ? `
      <div style="text-align: center; margin-top: 30px; margin-bottom: 30px;">
        <p style="margin-bottom: 15px;"><strong>Once completed, click the button below:</strong></p>
        <a href="${completeLink}" style="background-color: #d14633; color: white; font-weight: bold; text-decoration: none; padding: 12px 30px; border-radius: 30px; display: inline-block;">Mark as Completed</a>
        <p style="font-size: 13px; color: #666; margin-top: 10px;">This link will expire in 7 days and can only be used once.</p>
      </div>
      ` : ''}
      
      <div style="margin-top: 20px; text-align: center; color: #666; font-size: 14px;">
        <p>Please reach out to coordinate completion of this item.</p>
        <p>This is an automated message.</p>
      </div>
    </div>
  `;
  
  const text = `
    NEW RESPONSE RECEIVED
    
    Someone has responded to an item
    
    ITEM DETAILS
    Title: ${item.title}
    Category: ${item.category}
    ${item.description ? `Description: ${item.description}` : ''}
    ${item.neededBy ? `Needed By: ${new Date(item.neededBy).toLocaleDateString()}` : ''}
    ${item.estimatedCost ? `Estimated Cost: $${(item.estimatedCost / 100).toFixed(2)}` : ''}
    
    RESPONSE CONTACT INFORMATION
    Name: ${userResponse.firstName} ${userResponse.lastName}
    Email: ${userResponse.email}
    ${userResponse.phone ? `Phone: ${userResponse.phone}` : ''}
    Response Type: ${userResponse.responseType}
    ${userResponse.notes ? `Notes: ${userResponse.notes}` : ''}
    
    ${completeLink ? `
    MARK AS COMPLETED
    Once completed, visit this link to update the status:
    ${completeLink}
    (This link will expire in 7 days and can only be used once)
    ` : ''}
    
    Please reach out to coordinate completion of this item.
  `;
  
  return await sendEmail({
    to: to.join(','),
    from: DEFAULT_FROM_EMAIL,
    subject,
    text,
    html,
  });
}
```

## 2. Contact Form Email Service (contact.ts)

```typescript
import { MailService } from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

export interface ContactMessageData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Send a contact form message via SendGrid
 */
export async function sendContactMessage(data: ContactMessageData): Promise<boolean> {
  try {
    const { name, email, subject, message } = data;
    
    const mailData: MailDataRequired = {
      to: 'admin@yourdomain.com',
      from: 'noreply@yourdomain.com', // Must be verified sender in SendGrid
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
    };
    
    await mailService.send(mailData);
    console.log(`Sent contact form email from ${email}`);
    return true;
  } catch (error) {
    console.error('SendGrid contact form email error:', error);
    return false;
  }
}
```

## 3. MailerLite Newsletter Integration (mailerlite.ts)

```typescript
import fetch from 'node-fetch';

// Your MailerLite group ID for subscribers
const MAILERLITE_GROUP_ID = 'your_group_id_here';

/**
 * Adds a subscriber to MailerLite service
 * Handles duplicate checking and group assignment
 */
export async function addSubscriber(email: string, firstName: string, lastName: string): Promise<boolean> {
  if (!process.env.MAILERLITE_API_KEY) {
    console.error('MAILERLITE_API_KEY environment variable is not set');
    return false;
  }

  try {
    // Check if subscriber already exists
    const checkResponse = await fetch(`https://api.mailerlite.com/api/v2/subscribers/${email}`, {
      method: 'GET',
      headers: {
        'X-MailerLite-ApiKey': process.env.MAILERLITE_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    // MailerLite returns 404 if subscriber doesn't exist
    let subscriberExists = checkResponse.status !== 404;
    
    // Create subscriber if they don't exist
    if (!subscriberExists) {
      const createResponse = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
        method: 'POST',
        headers: {
          'X-MailerLite-ApiKey': process.env.MAILERLITE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          name: `${firstName} ${lastName}`,
          fields: {
            name: firstName,
            last_name: lastName
          }
        })
      });

      if (!createResponse.ok) {
        console.error('Failed to create subscriber:', await createResponse.text());
        return false;
      }
    }

    // Add subscriber to specific group
    const groupResponse = await fetch(`https://api.mailerlite.com/api/v2/groups/${MAILERLITE_GROUP_ID}/subscribers`, {
      method: 'POST',
      headers: {
        'X-MailerLite-ApiKey': process.env.MAILERLITE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        name: `${firstName} ${lastName}`,
        fields: {
          name: firstName,
          last_name: lastName
        },
        resubscribe: true // Re-subscribe if previously unsubscribed
      })
    });

    if (!groupResponse.ok) {
      console.error('Failed to add subscriber to group:', await groupResponse.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error subscribing email to MailerLite:', error);
    return false;
  }
}
```

## 4. API Route Integration Examples

### Using in Express Routes
```typescript
// Example API route that sends emails when user submits response
app.post("/api/responses", async (req, res) => {
  try {
    // Validate and create response
    const response = await storage.createResponse(req.body);
    const item = await storage.getItem(req.body.itemId);
    
    // Send confirmation email to user
    await sendUserConfirmation(item, response);
    
    // Send notification to admins
    const adminEmails = ['admin1@domain.com', 'admin2@domain.com'];
    await sendAdminNotification(item, response, adminEmails);
    
    // Add to newsletter if they opted in
    if (response.subscribeToUpdates) {
      await addSubscriber(response.email, response.firstName, response.lastName);
    }
    
    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating response:", error);
    res.status(500).json({ message: "Failed to submit response" });
  }
});

// Handle secure token completion links
app.get("/complete", async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).send("Missing token");
    }
    
    // Verify the token
    const { itemId, action, valid } = verifySecureToken(token as string);
    
    if (!valid) {
      return res.status(400).send("Invalid or expired token");
    }
    
    if (action === 'complete') {
      // Update item status to completed
      await storage.updateItemStatus(itemId, 'COMPLETED');
      res.send("Item marked as completed successfully!");
    } else {
      res.status(400).send("Unknown action");
    }
  } catch (error) {
    console.error("Error processing completion:", error);
    res.status(500).send("Error processing request");
  }
});
```

## 5. SendGrid Setup Requirements

### Domain Authentication
1. In SendGrid dashboard, go to Settings → Sender Authentication
2. Authenticate your domain (yourdomain.com)
3. Add DNS records as instructed
4. Verify domain ownership

### Single Sender Verification (Alternative)
1. Go to Settings → Sender Authentication → Single Sender Verification
2. Add noreply@yourdomain.com
3. Verify via email link

## 6. MailerLite Setup

1. Create MailerLite account
2. Go to Subscribers → Groups
3. Create a group for your app subscribers
4. Copy the Group ID from the URL or API
5. Generate API key from Integrations → Developer API

## 7. Usage Patterns

### Basic Email Sending
```typescript
import { sendEmail } from './email';

// Simple email
await sendEmail({
  to: 'user@example.com',
  from: 'noreply@yourdomain.com',
  subject: 'Welcome!',
  text: 'Welcome to our service!',
  html: '<h1>Welcome to our service!</h1>'
});
```

### With Contact Form
```typescript
import { sendContactMessage } from './contact';

// Handle contact form submission
app.post('/api/contact', async (req, res) => {
  const success = await sendContactMessage(req.body);
  if (success) {
    res.json({ message: 'Message sent successfully' });
  } else {
    res.status(500).json({ message: 'Failed to send message' });
  }
});
```

### Newsletter Subscription
```typescript
import { addSubscriber } from './mailerlite';

// Add user to newsletter
if (userWantsNewsletter) {
  await addSubscriber(email, firstName, lastName);
}
```

This email system provides secure, professional communication with users, automated admin notifications, and newsletter integration. The secure token system ensures email links are tamper-proof and time-limited for security.
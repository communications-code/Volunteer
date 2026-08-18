import fetch from 'node-fetch';

// Default group ID for public "Get Email Updates" subscriptions.
const MAILERLITE_GROUP_ID = process.env.MAILERLITE_SUPPORTERS_GROUP_ID?.trim() || '';

interface AddSubscriberOptions {
  phone?: string;
  groupId?: string;
  groupName?: string;
  requireGroupMatch?: boolean;
}

interface MailerLiteGroup {
  id: number | string;
  name: string;
}

function getHeaders(apiKey: string) {
  return {
    'X-MailerLite-ApiKey': apiKey,
    'Content-Type': 'application/json',
  };
}

async function findGroupIdByName(apiKey: string, groupName: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.mailerlite.com/api/v2/groups?limit=100', {
      method: 'GET',
      headers: getHeaders(apiKey),
    });

    if (!response.ok) {
      console.warn('Unable to list MailerLite groups:', response.status, await response.text());
      return null;
    }

    const payload = (await response.json()) as unknown;
    const groups = Array.isArray(payload)
      ? (payload as MailerLiteGroup[])
      : (
          (payload as { data?: MailerLiteGroup[] })?.data &&
          Array.isArray((payload as { data?: MailerLiteGroup[] }).data)
            ? (payload as { data: MailerLiteGroup[] }).data
            : []
        );

    const target = groups.find(
      (group) => group?.name?.trim().toLowerCase() === groupName.trim().toLowerCase()
    );

    if (!target) {
      return null;
    }

    return String(target.id);
  } catch (error) {
    console.warn('Error resolving MailerLite group by name:', error);
    return null;
  }
}

/**
 * Adds a subscriber to the MailerLite service
 * 
 * @param email - The email address to subscribe
 * @param firstName - The subscriber's first name
 * @param lastName - The subscriber's last name
 * @returns A promise that resolves to a boolean indicating success
 */
export async function addSubscriber(
  email: string,
  firstName: string,
  lastName: string,
  options: AddSubscriberOptions = {},
): Promise<boolean> {
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.error('MAILERLITE_API_KEY environment variable is not set');
    return false;
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedPhone = options.phone?.trim();

    const payload = {
      email: trimmedEmail,
      name: trimmedFirstName,
      fields: {
        name: trimmedFirstName,
        last_name: trimmedLastName,
        ...(trimmedPhone ? { phone: trimmedPhone } : {}),
      },
    };

    // Upsert profile fields (prevents duplicates by email and updates name/phone if changed).
    const upsertResponse = await fetch('https://api.mailerlite.com/api/v2/subscribers', {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        ...payload,
        resubscribe: true,
      }),
    });

    if (!upsertResponse.ok) {
      console.error('Failed to upsert subscriber profile:', await upsertResponse.text());
      return false;
    }

    let targetGroupId: string | undefined = options.groupId?.trim();
    if (!targetGroupId && options.groupName) {
      const resolvedGroupId = await findGroupIdByName(apiKey, options.groupName);
      if (resolvedGroupId) {
        targetGroupId = resolvedGroupId;
      }
    }
    if (!targetGroupId && options.requireGroupMatch) {
      console.error(`Required MailerLite group not found: ${options.groupName || '(unspecified)'}`);
      return false;
    }
    if (!targetGroupId && MAILERLITE_GROUP_ID) {
      targetGroupId = MAILERLITE_GROUP_ID;
    }
    if (!targetGroupId) {
      console.error('MAILERLITE_SUPPORTERS_GROUP_ID is not set');
      return false;
    }

    // Ensure subscriber is in the requested group.
    const groupResponse = await fetch(`https://api.mailerlite.com/api/v2/groups/${targetGroupId}/subscribers`, {
      method: 'POST',
      headers: getHeaders(apiKey),
      body: JSON.stringify({
        ...payload,
        resubscribe: true // Re-subscribe if they previously unsubscribed
      })
    });

    if (!groupResponse.ok) {
      const raw = await groupResponse.text();
      const normalizedError = raw.toLowerCase();
      const alreadyMember =
        groupResponse.status === 409 ||
        /already subscribed|already a member|already exists|already in/i.test(normalizedError);

      if (alreadyMember) {
        return true;
      }

      console.error(`Failed to add subscriber to group ${targetGroupId}:`, raw);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error subscribing email to MailerLite:', error);
    return false;
  }
}

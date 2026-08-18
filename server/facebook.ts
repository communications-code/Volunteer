import fetch from 'node-fetch';
import type { Need } from '@shared/schema';

const GRAPH_API_VERSION = 'v18.0';

// Public-facing URL (the parent site that iframes the app)
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://vfwharrisonoh.org/serving-network/';

/**
 * Post a combined message to the Post Facebook Page listing all new needs.
 * One API call per day — not one per need.
 */
export async function postNeedsToFacebook(needs: Need[]): Promise<boolean> {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    console.error('FACEBOOK_PAGE_ID or FACEBOOK_PAGE_ACCESS_TOKEN not set');
    return false;
  }

  if (needs.length === 0) {
    console.log('No needs to post to Facebook');
    return true;
  }

  try {
    // Build the combined post message
    const needsList = needs
      .map((need) => `• ${need.title}\n  ${PUBLIC_URL}?need=${need.id}`)
      .join('\n\n');

    const message =
      `New needs have been listed on the VFW Post 7570 Serving Network.\n\n` +
      `${needsList}\n\n` +
      `View all needs and find ways to help:\n` +
      `${PUBLIC_URL}\n\n` +
      `#VFWPost7570 #ServingNetwork #HarrisonOH`;

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pageId}/feed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        access_token: accessToken,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Facebook API error:', response.status, errorBody);
      return false;
    }

    const result = (await response.json()) as { id?: string };
    console.log('Facebook post created:', result.id);
    return true;
  } catch (error) {
    console.error('Error posting to Facebook:', error);
    return false;
  }
}

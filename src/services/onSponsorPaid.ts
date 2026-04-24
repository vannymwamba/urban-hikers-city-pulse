import { Request, Response } from 'express';
import Stripe from 'stripe';
import { Firestore, FieldValue } from 'firebase-admin/firestore';

export const createSponsorCheckoutRoute = async (req: Request, res: Response) => {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return res.status(500).json({ error: "Stripe secret key missing" });
  }
  
  const stripe = new Stripe(stripeSecret);

  const { campaign_title, cover_url, cta_url, cta_label, location_label, tier } = req.body;
  const appUrl = process.env.APP_URL || `https://${req.get('host')}`;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Urban Hikers Flash Slot: ${campaign_title}`,
              description: '24-hour urban rotation sponsorship',
              images: [cover_url].filter(Boolean),
            },
            unit_amount: 4900, // $49.00
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      metadata: {
        type: 'sponsor_flash_slot',
        campaign_title,
        cover_url,
        cta_url,
        cta_label,
        location_label,
        tier
      },
      success_url: `${appUrl}/sponsor/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/sponsor/cancelled`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const handleSponsorWebhook = async (session: Stripe.Checkout.Session, db: Firestore) => {
  if (session.metadata?.type !== 'sponsor_flash_slot') return;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

  const flashSlot = {
    campaign_title: session.metadata.campaign_title,
    cover_url: session.metadata.cover_url,
    cta_url: session.metadata.cta_url,
    cta_label: session.metadata.cta_label,
    location_label: session.metadata.location_label,
    tier: session.metadata.tier || 'standard',
    is_civic: false,
    slot_priority: 50,
    status: 'active',
    starts_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    created_at: FieldValue.serverTimestamp(),
    stripe_session_id: session.id,
    impressions: 0,
    taps: 0
  };

  try {
    await db.collection('flash_rotation').add(flashSlot);
    console.log(`[SPONSOR] Activated new flash slot: ${session.metadata.campaign_title}`);
  } catch (err) {
    console.error('[SPONSOR] Error creating flash slot:', err);
  }
};

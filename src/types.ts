export type Vibe = 'chill' | 'buzzing' | 'packed';
export type HubType = 'street' | 'conference_center';
export enum BroadcastType {
  LIVE_EVENT = 'live_event',
  FOOD_TRUCK = 'food_truck',
  WALKING_EVENT = 'walking_event',
  FLASH_DEAL = 'flash_deal',
  MURAL = 'mural',
  STREET_ART = 'street_art',
  POP_UP = 'pop_up',
  CIVIC_EVENT = 'civic_event',
  CIVIC_FREE = 'civic_free',
  DONATION = 'donation'
}
export type UserRole = 'admin' | 'partner' | 'user' | 'partner_admin' | 'partner_viewer' | 'partner_content_editor' | 'super_admin' | 'hiker';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  partner_id?: string; // Link to partner entity if role is partner
  partnerId?: string; // Alias for camelCase
  session_uuid?: string;
  linked_session_uuid?: string;
}

export interface Node {
  id: string;
  name: string;
  type: HubType;
  address?: string;
  latitude: number;
  longitude: number;
  radius_limit: number;
  capacity?: number;
  imageUrl?: string;
  artist_id?: string;
  artistId?: string;
  partner_name?: string;
  partner_type?: 'walk_hq' | 'refuel' | 'civic' | 'anchor' | 'discovery' | 'creator' | 'wellness' | 'street';
  partner_initials?: string;
  partner_accent?: string;
  hub_tagline?: string;
  
  // Customizable design/media fields
  cover_image_url?: string;
  logo_url?: string;
  gallery_urls?: string[];
  founder_photo_url?: string;
  theme_mode?: 'light' | 'dark' | 'adaptive';
  logo_style?: 'circle' | 'rounded' | 'square';
  
  // Narratives & partner stories
  why_it_matters?: string;
  founder_story?: string;
  business_history?: string;
  community_impact?: string;
  recommended_experience?: string;
  
  // Custom reward system
  custom_reward?: string;
  
  // Community metrics
  metric_walkers?: number;
  metric_visits?: number;
  metric_events?: number;
  metric_miles?: number;
  metric_conversations?: number;
  metric_stories?: number;
  
  // Partner recognition logo URLs
  partner_logo_url?: string;
  sponsor_logo_url?: string;
  community_logo_url?: string;
}

export interface Broadcast {
  id: string;
  partner_id?: string;
  partnerId?: string; // Alias for camelCase
  node_id?: string;
  nodeId?: string; // Alias for camelCase
  sectorId?: string | null;
  title: string;
  type: BroadcastType;
  venue?: string | null;
  address?: string;
  latitude?: number;
  longitude?: number;
  coords?: { lat: number; lng: number } | null;
  starts_at: string;
  startsAt?: string; // Alias for camelCase
  startTime?: any;
  expires_at: string;
  expiresAt?: string; // Alias for camelCase
  current_vibe?: Vibe;
  currentVibe?: Vibe; // Alias for camelCase
  description?: string;
  sponsorId?: string; // Additional field
  source?: string;
  sourceHash?: string;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  cover_url?: string | null;
  is_sponsored?: boolean;
  sponsor_name?: string | null;
  ingestedAt?: any;
  active?: boolean;
  payment_type?: 'tip_jar' | 'stripe' | 'free' | 'admin_bypass';
  tip_url?: string | null;
  price?: number;
  stripe_price_id?: string;
  spots_remaining?: number;
  max_capacity?: number;
  departure_time?: string;
  meeting_point?: string;
  guide_name?: string;
  scope?: 'single_hub' | 'all_nodes' | 'specific_node' | 'multi_node';
  discount_value?: string;
  signal_location_source?: string;
  booking_type?: 'native' | 'partner' | null;
  last_spots_alert?: number;
  fcm_token?: string;
  artist?: string;
  artist_url?: string;
  booking_url?: string;
  node_ids?: string[];
  organizer_logo_url?: string;
  year_created?: number;
  deal_description?: string;
  partner_name?: string;
  sponsor_logo_url?: string;
  rotation_interval_seconds?: number;
  cross_connection_id?: string | null;
  taps?: number;
  impressions?: number;
  recurrence?: string;
  is_recurring?: boolean;
  recurring_days?: string[];
  recurring_times?: string[];
  duration_minutes?: number;
  recurring_frequency?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'one_time';
  recurring_week_of_month?: 1 | 2 | 3 | 4 | 5;
  rarity_weight?: number;   // 1–10; 1 = ultra rare, 10 = very common
  drop_eligible?: boolean;  // false = permanent/recurring, skip for drops
  created_at?: any;
}

export interface Partner {
  id: string;
  name: string;
  short_name?: string;
  logo_url?: string;
  logo_initials?: string;
  accent_color?: string;
  hub_id?: string;
  label?: string;
  active?: boolean;
  tier?: 'standard' | 'premium' | 'anchor';
  address?: string;
  latitude?: number;
  longitude?: number;
  ownerUid?: string;
  associated_owner_uid?: string;
  owner_email?: string;
  logo_updated_at?: string | any;
  brand_color?: string;
  deal_text?: string;
  sponsor_zones?: string[];
  role?: UserRole;
  is_verified?: boolean;
  // ... existing fields ...
  ownerEmail?: string;
  logoUrl?: string;
  logoUpdatedAt?: string | any;
  brandColor?: string;
  dealText?: string;
  sponsorZones?: string[];
}

export interface SignatureWalk {
  id: string;
  title: string;
  tag: string;
  distance: string;
  duration: string;
  schedule: string;
  featured?: boolean;
  bookingUrl?: string;
  hub_id: string;
  active: boolean;
}

export interface SponsorBadgeProps {
  partner: Partner | null;
  zone: 'A' | 'B' | 'C' | 'D' | 'E';
  compact?: boolean;
}

export interface VibeReport {
  id: string;
  broadcast_id: string;
  session_uuid: string;
  vibe: Vibe;
  reported_at: string;
  reportedAt?: string; // Alias for camelCase
  access_vector?: 'nfc' | 'direct' | 'qr';
}

export interface Tap {
  id?: string;
  node_id: string;
  session_uuid: string;
  access_vector: 'nfc' | 'direct' | 'qr';
  timestamp: any;
  client_timestamp?: string;
  uid?: string | null;
  consent_version?: string;
  artist_id?: string | null;
  value_score?: number;
  tab?: 'home' | 'feed' | 'explore' | 'wallet' | 'profile';
  sponsor_id?: string | null;
  walkId?: string | null;
  eventTag?: string | null;
}

export interface TabView {
  id: string;
  session_uuid: string;
  tab: 'home' | 'feed' | 'explore' | 'wallet' | 'profile';
  access_vector?: 'nfc' | 'direct' | 'qr';
  timestamp: string;
  sponsor_id?: string | null;
}

export interface Interaction {
  id: string;
  type: 'wallet_save' | 'share' | 'vibe_report' | 'login' | 'seed';
  session_uuid: string;
  access_vector: 'nfc' | 'direct' | 'qr';
  timestamp: string;
  node_id?: string;
  broadcast_id?: string;
  tab?: string;
}

export interface Route {
  id: string;
  name: string;
  type: 'hike' | 'bike' | 'run' | 'sponsored' | 'premium';
  distance: number;
  duration: number;
  durationMins?: number;
  difficulty: 'easy' | 'moderate' | 'hard';
  description?: string;
  start_node_id: string;
  end_node_id: string;
  points?: { lat: number; lng: number }[];
  guideId?: string;
  sponsorId?: string;
  partnerId?: string;
  endPartnerId?: string;
  imageUrl?: string;
  title?: string;
  price?: number;
  discountedPrice?: number;
  stops?: any[];
  rewardText?: string;
  remainingSpots?: number;
  capacity?: number;
}

export interface Guide {
  id: string;
  name: string;
  bio?: string;
  photo_url?: string;
  photoUrl?: string; // Alias for camelCase
  rating?: number;
  title?: string;
}

export interface Sponsor {
  id: string;
  name: string;
  logo_url?: string;
  brand_color?: string;
}

export interface Poi {
  id: string;
  name: string;
  artist: string;
  address: string;
  latitude: number;
  longitude: number;
  description: string;
  imageUrl: string;
  type: 'civic_mural';
  createdAt: string;
  active: boolean;
}

export interface LocalHub {
  id: string;
  name: string;
  offer?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  distance_mi?: number;
  tier: 'free' | 'paid' | 'premium';
  cover_url?: string;
  cta_url?: string;
  is_open?: boolean;
  operating_hours?: {
    [key: string]: { open: string; close: string; } | null;
  };
  is_live_deal?: boolean;
  is_active: boolean;
  created_at?: any;
}

export interface Booking {
  id: string;
  broadcastId: string;
  userId?: string;
  spots: number;
  status: 'pending' | 'confirmed' | 'failed';
  notifyToken?: string;
  price?: number;
  stripe_session_id?: string;
  confirmed_at?: any;
  created_at?: any;
  error?: string;
}

export interface LostFoundReport {
  id: string;
  node_id: string;
  type: 'lost' | 'found';
  category: string;
  description: string;
  location: string;
  contact: string;
  publicContact: boolean;
  status: 'open' | 'resolved';
  resolveCode: string;
  reportedAt: any; // Firestore Timestamp
}

export type DisplaySponsor = {
  name: string;
  logoUrl: string;
  link: string;
} | null;

export interface GlobalSponsors {
  hero?: DisplaySponsor;
  wayfinding?: DisplaySponsor;
  lostAndFound?: DisplaySponsor;
  footer?: DisplaySponsor;
}

export interface Artist {
  id?: string;
  artist_name: string;
  blink_artist_url: string;
  cover_art_url: string;
  nfc_destination: string;
  instagram_url: string;
  instagram_followers: number;
  artist_slug: string;
  nfc_id: string;
  instagram_last_updated: string;
  nfc_tap_count: number;
  sponsor_name?: string;
  sponsor_url?: string;
  sponsor_logo_url?: string;
  audioSponsor?: DisplaySponsor;
  nodeSponsor?: DisplaySponsor;

  // Design update fields
  hometown?: string;
  artwork_title?: string;
  artwork_year?: string;
  location_string?: string;
  latitude?: number;
  longitude?: number;
  instagram_handle?: string;
  
  audio_url?: string;
  audio_duration_str?: string;
  
  next_story_id?: string;
  next_story_name?: string;
  next_story_distance_mi?: number;
  next_story_time_mins?: number;
}

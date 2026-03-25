export type Vibe = 'chill' | 'buzzing' | 'packed';
export type HubType = 'street' | 'conference_center';
export type BroadcastType = 'flash_deal' | 'event' | 'conference_panel' | 'civic_free';
export type UserRole = 'admin' | 'partner' | 'user' | 'partner_admin' | 'partner_viewer' | 'partner_content_editor' | 'super_admin' | 'hiker';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  partner_id?: string; // Link to partner entity if role is partner
  partnerId?: string; // Alias for camelCase
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
}

export interface Broadcast {
  id: string;
  partner_id?: string;
  partnerId?: string; // Alias for camelCase
  node_id?: string;
  nodeId?: string; // Alias for camelCase
  title: string;
  type: BroadcastType;
  address?: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  startsAt?: string; // Alias for camelCase
  expires_at: string;
  expiresAt?: string; // Alias for camelCase
  current_vibe: Vibe;
  currentVibe?: Vibe; // Alias for camelCase
  description?: string;
  sponsorId?: string; // Additional field
}

export interface Partner {
  id: string;
  name: string;
  tier: 'standard' | 'premium' | 'anchor';
  address?: string;
  latitude: number;
  longitude: number;
  ownerUid?: string;
  ownerEmail?: string;
  logoUrl?: string;
  logoUpdatedAt?: string | any;
  brandColor?: string;
  dealText?: string;
  sponsorZones?: string[];
  role?: UserRole;
  // Backward compatibility
  owner_email?: string;
  logo_url?: string;
  logo_updated_at?: string | any;
  brand_color?: string;
  deal_text?: string;
  sponsor_zones?: string[];
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
  id: string;
  node_id: string;
  session_uuid: string;
  access_vector: 'nfc' | 'direct' | 'qr';
  timestamp: string;
  tab?: 'feed' | 'wallet' | 'map';
  sponsor_id?: string | null;
}

export interface TabView {
  id: string;
  session_uuid: string;
  tab: 'feed' | 'wallet' | 'map';
  timestamp: string;
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

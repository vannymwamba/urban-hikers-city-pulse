export type Vibe = 'chill' | 'buzzing' | 'packed';
export type HubType = 'street' | 'conference_center';
export type BroadcastType = 'flash_deal' | 'event' | 'conference_panel';
export type UserRole = 'admin' | 'partner' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  name?: string;
  partner_id?: string; // Link to partner entity if role is partner
}

export interface Node {
  id: string;
  name: string;
  type: HubType;
  address?: string;
  latitude: number;
  longitude: number;
  radius_limit: number;
}

export interface Broadcast {
  id: string;
  partner_id?: string;
  node_id?: string;
  title: string;
  type: BroadcastType;
  address?: string;
  latitude: number;
  longitude: number;
  starts_at: string;
  expires_at: string;
  current_vibe: Vibe;
}

export interface Partner {
  id: string;
  name: string;
  tier: 'standard' | 'premium' | 'anchor';
  address?: string;
  latitude: number;
  longitude: number;
  owner_uid?: string;
  owner_email?: string;
  logo_url?: string;
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
  access_vector?: 'nfc' | 'direct' | 'qr';
}

export interface Tap {
  id: string;
  node_id: string;
  session_uuid: string;
  access_vector: 'nfc' | 'direct' | 'qr';
  timestamp: string;
}

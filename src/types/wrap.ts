import { Timestamp } from 'firebase/firestore';

export interface WrapStats {
  vendorId: string;
  vendorName: string;
  season: string;
  computedAt: Timestamp;
  totalTaps: number;
  peakDayTaps: number;
  peakDayDate: string;
  uniqueLocations: number;
  topLocations: { name: string; taps: number }[];
  walkDrivenTaps: number;
  walkDrivenPct: number;
  walksConnected: number;
  topEventTag: string | null;
  eventsTagged: number;
  totalBoostSpend: number;
  totalBoostReach: number;
  boostRoiPerDollar: number;
  percentileRank: number | null;
  totalVendorsInSeason: number;
}

import React from 'react';
import { Broadcast, Tap, Partner, VibeReport, Interaction, Node } from '../types';
import { Activity, Zap, Users, Signal, Globe, Navigation, Clock, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

import { parseAnyTimestamp } from '../utils/dateUtils';

interface OverviewPanelProps {
  broadcasts: Broadcast[];
  taps: Tap[];
  partners: Partner[];
  vibeReports: VibeReport[];
  interactions: Interaction[];
  nodes: Node[];
  systemStatus: 'ok' | 'degraded';
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ 
  broadcasts = [], 
  taps = [], 
  partners = [], 
  vibeReports = [], 
  interactions = [], 
  nodes = [], 
  systemStatus = 'ok'
}) => {
  const now = new Date();
  
  // Guard against null props if they bypass default values
  const safeBroadcasts = broadcasts || [];
  const safeTaps = taps || [];
  const safePartners = partners || [];
  const safeVibeReports = vibeReports || [];
  const safeInteractions = interactions || [];
  const safeNodes = nodes || [];

  const parseDate = (val: any) => {
    if (!val) return new Date(0);
    if (val.toDate) return val.toDate();
    try {
      return new Date(val);
    } catch {
      return new Date(0);
    }
  };

  const activeSignals = safeBroadcasts.filter(b => b && parseDate(b.expires_at || b.expiresAt) > now).length;
  
  const last24h = (timestamp: any, clientTs?: any) => {
    if (!timestamp && !clientTs) return false;
    const date = parseAnyTimestamp(timestamp, clientTs);
    return now.getTime() - date.getTime() < 86400000;
  };

  const taps24h = safeTaps.filter(t => t && (t.timestamp || t.client_timestamp) && last24h(t.timestamp, t.client_timestamp)).length;
  const uniqueSessions24h = new Set(safeTaps.filter(t => t && (t.timestamp || t.client_timestamp) && last24h(t.timestamp, t.client_timestamp)).map(t => t.session_uuid)).size;
  const activePartners = safePartners.filter(p => p && (p.tier === 'premium' || p.tier === 'anchor')).length;

  const vectorStats = safeTaps.reduce((acc, tap) => {
    if (!tap) return acc;
    const vector = tap.access_vector || 'direct';
    acc[vector] = (acc[vector] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalTaps = safeTaps.length || 1;

  const combinedActivity = [
    ...safeTaps.map(t => ({ ...t, activityType: 'tap' as const })),
    ...safeVibeReports.map(v => ({ ...v, activityType: 'vibe' as const, timestamp: v?.reported_at || v?.reportedAt })),
    ...safeInteractions.map(i => ({ ...i, activityType: 'interaction' as const })),
  ].filter(item => item && (item.timestamp || (item as any).client_timestamp))
   .sort((a, b) => {
     const timeA = parseAnyTimestamp(a.timestamp, (a as any).client_timestamp).getTime();
     const timeB = parseAnyTimestamp(b.timestamp, (b as any).client_timestamp).getTime();
     return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
   })
   .slice(0, 15);

  const vibeTally = safeVibeReports.reduce((acc, report) => {
    if (!report || !report.vibe) return acc;
    acc[report.vibe] = (acc[report.vibe] || 0) + 1;
    return acc;
  }, { chill: 0, buzzing: 0, packed: 0 } as Record<string, number>);

  const totalVibes = safeVibeReports.length || 1;

  return (
    <div className="space-y-8 font-mono animate-in fade-in duration-500">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Sector Hubs', value: safeNodes.length, icon: MapPin, color: 'text-rose-500' },
          { label: 'Active Signals', value: activeSignals, icon: Signal, color: 'text-uh-yellow' },
          { label: '24h Taps', value: taps24h, icon: Zap, color: 'text-teal-500' },
          { label: 'Unique Users', value: uniqueSessions24h, icon: Users, color: 'text-blue-500' },
          { label: 'Elite Partners', value: activePartners, icon: Globe, color: 'text-amber-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-uh-gray-200 p-6 rounded-xl shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-uh-gray-400">{stat.label}</span>
              <stat.icon size={14} className={stat.color} />
            </div>
            <div className="text-3xl font-black tracking-tighter">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-uh-gray-200 p-4 rounded-xl flex items-center gap-4">
          <div className={`w-2 h-2 rounded-full ${systemStatus === 'ok' ? 'bg-teal-500 animate-pulse' : 'bg-rose-500'}`} />
          <div>
            <div className="text-[8px] font-bold text-uh-gray-400 uppercase tracking-widest">Firebase_Status</div>
            <div className="text-[10px] font-bold uppercase">{systemStatus === 'ok' ? 'Operational' : 'Degraded'}</div>
          </div>
        </div>
        <div className="bg-white border border-uh-gray-200 p-4 rounded-xl flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-uh-yellow" />
          <div>
            <div className="text-[8px] font-bold text-uh-gray-400 uppercase tracking-widest">Sector_Infrastructure</div>
            <div className="text-[10px] font-bold uppercase">{nodes.length} Hubs Synchronized</div>
          </div>
        </div>
        <div className="bg-white border border-uh-gray-200 p-4 rounded-xl flex items-center gap-4">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <div>
            <div className="text-[8px] font-bold text-uh-gray-400 uppercase tracking-widest">Civic_Ingestion</div>
            <div className="text-[10px] font-bold uppercase">Operational</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Access Vectors */}
        <div className="bg-white border border-uh-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-uh-gray-100 flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest">Access_Vector_Breakdown</h3>
            <Navigation size={12} className="text-uh-gray-300" />
          </div>
          <div className="p-6 space-y-6">
            {['nfc', 'qr', 'direct'].map(vector => {
              const count = vectorStats[vector] || 0;
              const percent = Math.round((count / totalTaps) * 100);
              return (
                <div key={vector}>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest">{vector}</span>
                    <span className="text-[10px] font-mono text-uh-gray-400">{count} ({percent}%)</span>
                  </div>
                  <div className="h-1 bg-uh-gray-50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      className={`h-full ${vector === 'nfc' ? 'bg-uh-yellow' : vector === 'qr' ? 'bg-teal-500' : 'bg-blue-500'}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sector Hub Monitoring */}
        <div className="bg-white border border-uh-gray-200 rounded-2xl overflow-hidden shadow-sm font-mono">
          <div className="px-6 py-4 border-b border-uh-gray-100 flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-widest">Active_Sector_Hubs_Live</h3>
            <MapPin size={12} className="text-uh-yellow" />
          </div>
          <div className="divide-y divide-uh-gray-50 max-h-[280px] overflow-y-auto">
            {nodes.sort((a,b) => a.name.localeCompare(b.name)).map(node => {
              const nodeTaps = taps.filter(t => t.node_id === node.id).length;
              const nodeVibes = vibeReports.filter(v => ((v as any).node_id || (v as any).nodeId) === node.id).length;
              return (
                <div key={node.id} className="px-6 py-3 flex items-center justify-between hover:bg-uh-gray-50 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                    <div className="text-[10px] font-black uppercase tracking-tighter truncate max-w-[140px]">{node.name}</div>
                  </div>
                  <div className="flex gap-4">
                    <div className="text-[8px] text-uh-gray-400 font-bold uppercase tracking-widest">
                      <span className="text-uh-yellow">{nodeTaps}</span> TAPS
                    </div>
                    <div className="text-[8px] text-uh-gray-400 font-bold uppercase tracking-widest">
                      <span className="text-uh-yellow">{nodeVibes}</span> VIBES
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live Activity Feed */}
      <div className="bg-white border border-uh-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-uh-gray-100 flex justify-between items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest">Live_Activity_Feed</h3>
          <Clock size={12} className="text-uh-gray-300" />
        </div>
        <div className="divide-y divide-uh-gray-50">
          {combinedActivity.map((item, idx) => (
            <div key={idx} className="px-6 py-3 flex items-center justify-between hover:bg-uh-gray-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  item.activityType === 'tap' ? 'bg-blue-500' : 
                  item.activityType === 'vibe' ? 'bg-rose-500' : 'bg-uh-yellow'
                }`} />
                <span className="text-[10px] font-bold uppercase">
                  {item.activityType === 'tap' ? `Tap @ Node_${(item as Tap).node_id?.slice(0,4)}` : 
                   item.activityType === 'vibe' ? `Vibe: ${(item as VibeReport).vibe}` : 
                   `Interaction: ${(item as Interaction).type}`}
                </span>
                <span className="text-[8px] text-uh-gray-300 uppercase tracking-widest">
                  Vector: {item.access_vector || 'N/A'}
                </span>
              </div>
              <span className="text-[9px] font-mono text-uh-gray-400">
                {parseAnyTimestamp(item.timestamp, (item as any).client_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

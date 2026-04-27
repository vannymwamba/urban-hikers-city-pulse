import React from 'react';
import { UserProfile } from '../types';
import { Database, Shield, Zap, Server, HardDrive, Cpu } from 'lucide-react';
import { motion } from 'motion/react';

interface SystemHealthPanelProps {
  userProfile: UserProfile | null;
  listenerHealth: Record<string, { count: number; lastUpdate: Date }>;
  systemHealth: { firebase: 'ok' | 'degraded'; swActive: boolean };
}

export const SystemHealthPanel: React.FC<SystemHealthPanelProps> = ({ 
  userProfile, listenerHealth, systemHealth 
}) => {
  return (
    <div className="space-y-8 font-mono animate-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Firestore Metrics */}
        <div className="bg-white border border-uh-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-uh-gray-100 flex justify-between items-center bg-uh-gray-50/50">
            <h3 className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <Database size={12} className="text-uh-yellow" />
              Listener_Status_Matrix
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-uh-gray-50 text-[8px] text-uh-gray-400 uppercase tracking-widest font-black">
                  <th className="px-6 py-4">Collection</th>
                  <th className="px-6 py-4 text-center">Docs</th>
                  <th className="px-6 py-4">Last_Update</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-uh-gray-50 text-[10px] font-bold">
                {Object.entries(listenerHealth).map(([col, data]) => (
                  <tr key={col} className="hover:bg-uh-gray-50/50 transition-colors">
                    <td className="px-6 py-4 uppercase">{col}</td>
                    <td className="px-6 py-4 text-center text-uh-gray-400">{data.count}</td>
                    <td className="px-6 py-4 font-mono text-[9px] text-uh-gray-400">
                      {data.lastUpdate.toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 text-right text-teal-500">OK</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Infrastructure Health */}
        <div className="space-y-4">
          <div className="bg-white border border-uh-gray-200 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-uh-yellow/10 flex items-center justify-center">
                  <Cpu size={16} className="text-uh-yellow" />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest">Environment_Stats</h3>
              </div>
              <span className="text-[10px] font-black text-teal-500 uppercase">Production</span>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-uh-gray-400 uppercase font-black tracking-widest">Firebase_Engine</span>
                <span className={systemHealth.firebase === 'ok' ? 'text-teal-500' : 'text-rose-500'}>
                  {systemHealth.firebase === 'ok' ? 'OPERATIONAL_V2' : 'DEGRADED_V2'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-uh-gray-400 uppercase font-black tracking-widest">Service_Worker</span>
                <span className={systemHealth.swActive ? 'text-teal-500' : 'text-amber-500'}>
                  {systemHealth.swActive ? 'READY_CACHE_O1' : 'WARMING_UP'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-uh-gray-400 uppercase font-black tracking-widest">Cache_Version</span>
                <span className="text-rose-500">UH-OS-CACHE-V1</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-uh-gray-200 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Shield size={16} className="text-blue-500" />
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest">Security_Context</h3>
            </div>
            <div className="space-y-4 font-mono text-[9px]">
              <div>
                <span className="text-uh-gray-400 uppercase font-black tracking-widest block mb-1">Authenticated_UID</span>
                <span className="text-rose-500 select-all">{userProfile?.uid}</span>
              </div>
              <div>
                <span className="text-uh-gray-400 uppercase font-black tracking-widest block mb-1">Access_Tier</span>
                <span className="bg-black text-uh-yellow px-2 py-0.5 rounded font-black uppercase">
                  {userProfile?.role}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quota Monitors */}
      <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
        <h3 className="text-[12px] font-black uppercase tracking-[0.3em] mb-8 text-center">Resource_Allocation_Snapshots</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { label: 'Firebase_Reads', value: listenerHealth['taps']?.count || 0, max: 10000, color: 'bg-blue-500' },
            { label: 'Network_Nodes', value: listenerHealth['nodes']?.count || 0, max: 50, color: 'bg-uh-yellow' },
            { label: 'Active_Signals', value: listenerHealth['broadcasts']?.count || 0, max: 500, color: 'bg-rose-500' },
          ].map((quota, i) => {
            const percent = Math.min((quota.value / quota.max) * 100, 100);
            return (
              <div key={i} className="space-y-3">
                <div className="flex justify-between items-end border-b border-uh-gray-100 pb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest">{quota.label}</span>
                  <span className="text-[9px] font-bold text-uh-gray-400">{quota.value} / {quota.max}</span>
                </div>
                <div className="h-2 bg-uh-gray-50 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    className={`h-full ${quota.color}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

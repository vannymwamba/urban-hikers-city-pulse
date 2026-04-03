import React from 'react';
import { motion } from 'motion/react';
import { MapPin, ArrowRight } from 'lucide-react';
import { Broadcast, Partner, Node } from '../types';

interface MuralCardProps {
  item: Broadcast;
  idx: number;
  currentNode: Node | null;
  onSelect: (broadcast: Broadcast) => void;
  partner: Partner | null;
}

export const MuralCard: React.FC<MuralCardProps> = ({
  item,
  idx,
  currentNode,
  onSelect,
  partner
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.1 }}
      onClick={() => onSelect(item)}
      className="relative w-[85%] h-[200px] rounded-[32px] overflow-hidden group cursor-pointer shadow-2xl flex-shrink-0 snap-start"
    >
      {/* Photo Background */}
      <img 
        src={item.imageUrl || `https://picsum.photos/seed/${item.id}/800/500`} 
        alt={item.title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      
      {/* Dark Gradient Overlay (bottom-weighted) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
      
      {/* Tags */}
      <div className="absolute top-4 left-4 flex gap-2">
        <span className="bg-uh-yellow text-uh-black text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest font-mono shadow-lg">
          ALWAYS ON
        </span>
        <span className="bg-white/20 backdrop-blur-md text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest font-mono">
          MURAL
        </span>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-uh-yellow text-[10px] font-black font-mono uppercase tracking-widest mb-1">
              {item.venue || 'UNKNOWN_ARTIST'}
            </span>
            <h3 className="text-white text-2xl font-black tracking-tighter uppercase leading-none mb-2">
              {item.title}
            </h3>
            <div className="flex items-center gap-2 text-white/60 text-[10px] font-bold font-sans uppercase tracking-wider">
              <MapPin size={12} className="text-uh-yellow" />
              {item.address?.split(',')[0] || 'LOCATION_PENDING'}
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-uh-yellow flex items-center justify-center shadow-lg shadow-uh-yellow/20 group-hover:scale-110 transition-transform">
            <ArrowRight size={20} className="text-uh-black" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

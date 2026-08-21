import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Key,
  Search,
  Wallet,
  Smartphone,
  CreditCard,
  PawPrint,
  Package,
  MapPin,
  Copy,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { LostFoundReport } from "../types";

const CATEGORIES = [
  { id: "keys", label: "Keys", icon: Key },
  { id: "wallet", label: "Wallet / Bag", icon: Wallet },
  { id: "phone", label: "Phone", icon: Smartphone },
  { id: "id", label: "ID / Cards", icon: CreditCard },
  { id: "pet", label: "Pet", icon: PawPrint },
  { id: "other", label: "Other", icon: Package },
];

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function timeAgo(ts: any) {
  if (!ts) return "Just now";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const m = Math.floor((Date.now() - date.getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

interface LostFoundBoardProps {
  nodeId?: string;
}

export function LostFoundBoard({ nodeId }: LostFoundBoardProps) {
  const navigate = useNavigate();
  const [utilOpen, setUtilOpen] = useState(false);
  const [formType, setFormType] = useState<'lost' | 'found' | null>(null);
  const [reports, setReports] = useState<LostFoundReport[]>([]);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [confirmation, setConfirmation] = useState<{ code: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [nodesList, setNodesList] = useState<{id: string, name: string}[]>([]);

  // Fetch all available nodes/artists for the dropdown
  useEffect(() => {
    async function fetchNodes() {
      try {
        const [artistsSnap, nodesSnap] = await Promise.all([
          getDocs(collection(db, "artists")),
          getDocs(collection(db, "nodes"))
        ]);
        
        const artists = artistsSnap.docs.map(d => ({ id: d.id, name: d.data().artist_name }));
        const nodes = nodesSnap.docs.map(d => ({ id: d.id, name: d.data().name }));
        
        // Remove duplicates if any ID overlaps
        const combined = [...artists, ...nodes];
        const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
        
        setNodesList(unique);
      } catch (err) {
        console.error("Error fetching locations for dropdown:", err);
      }
    }
    fetchNodes();
  }, []);

  useEffect(() => {
    if (!utilOpen) return;
    
    setStatus("loading");
    // Broadcast globally: Fetch ALL open reports across the city
    const q = query(
      collection(db, "lost_found"),
      where("status", "==", "open"),
      orderBy("reportedAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LostFoundReport[];
      setReports(data);
      setStatus("ready");
    }, (err) => {
      console.error("Error fetching lost/found reports:", err);
      setStatus("ready");
    });

    return () => unsubscribe();
  }, [utilOpen, nodeId]);

  async function submitReport(payload: any) {
    const code = makeCode();
    try {
      await addDoc(collection(db, "lost_found"), {
        ...payload,
        status: "open",
        resolveCode: code,
        reportedAt: serverTimestamp(),
      });
      setConfirmation({ code });
      setFormType(null);
    } catch (err) {
      console.error("Error submitting report:", err);
    }
  }

  return (
    <div className="w-full mt-8 flex flex-col items-center">
      <div className="h-[1px] w-full bg-white/10 mb-6" />
      <div className="text-[10px] font-mono tracking-[0.12em] text-[#8A928B] mb-4 text-center uppercase">
        ALSO AT THIS NODE
      </div>

      {!utilOpen ? (
        <button
          className="flex items-center justify-center gap-2 w-full bg-transparent border-[1.5px] border-white/10 text-[#8A928B] hover:text-white hover:border-white/20 rounded-full py-3 px-4 text-sm font-medium transition-colors"
          onClick={() => setUtilOpen(true)}
        >
          <Search size={14} />
          Lost or found something nearby?
        </button>
      ) : (
        <div className="w-full border-[1.5px] border-white/10 rounded-2xl p-4 bg-[#15171B] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center font-semibold text-sm mb-4">
            <span>Lost & Found</span>
            <button
              className="text-[#8A928B] hover:text-white transition-colors"
              onClick={() => setUtilOpen(false)}
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              className={`flex items-center justify-center gap-2 border-[1.5px] rounded-xl p-3 text-xs font-semibold transition-colors ${
                formType === "lost"
                  ? "border-[#E24A3B] bg-[#E24A3B]/10 text-white"
                  : "border-white/10 bg-[#1B1E23] text-white hover:border-white/20"
              }`}
              onClick={() => setFormType(formType === "lost" ? null : "lost")}
            >
              <Key size={16} /> I lost something
            </button>
            <button
              className={`flex items-center justify-center gap-2 border-[1.5px] rounded-xl p-3 text-xs font-semibold transition-colors ${
                formType === "found"
                  ? "border-[#3D8BFF] bg-[#3D8BFF]/10 text-white"
                  : "border-white/10 bg-[#1B1E23] text-white hover:border-white/20"
              }`}
              onClick={() => setFormType(formType === "found" ? null : "found")}
            >
              <Search size={16} /> I found something
            </button>
          </div>

          {formType && <ReportForm type={formType} onSubmit={submitReport} defaultNodeId={nodeId} nodesList={nodesList} />}

          {confirmation && (
            <div className="bg-[#B8E62E]/10 border border-dashed border-[#B8E62E] rounded-xl p-3 text-xs mb-4 flex items-center justify-between">
              <span>Save your code to resolve later:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold tracking-widest text-[#B8E62E]">{confirmation.code}</span>
                <button
                  className="bg-[#1B1E23] border border-white/10 rounded-md p-1.5 text-white hover:bg-[#2A2D33] transition-colors"
                  onClick={() => {
                    navigator.clipboard?.writeText(confirmation.code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1400);
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            </div>
          )}

          <div className="font-mono text-[9.5px] tracking-[0.1em] text-[#8A928B] mb-2 uppercase">
            OPEN REPORTS IN THE CITY
          </div>
          {status === "loading" && (
            <div className="text-[#8A928B] text-xs flex items-center gap-2 py-2">
              <Loader2 className="animate-spin" size={16} /> Loading…
            </div>
          )}
          {status === "ready" && reports.length === 0 && (
            <div className="text-[#8A928B] text-xs py-2">Nothing reported yet.</div>
          )}
          <div className="flex flex-col gap-2">
            {reports.slice(0, 4).map((r) => {
              const cat = CATEGORIES.find((c) => c.id === r.category) || CATEGORIES[5];
              const Icon = cat.icon;
              const locationName = nodesList.find(n => n.id === r.node_id)?.name || "Unknown Location";
              
              return (
                <div key={r.id} className="border-[1.5px] border-white/10 rounded-xl p-3 bg-[#1B1E23]">
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`font-mono text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                        r.type === "lost"
                          ? "bg-[#E24A3B]/20 text-[#FF8A78]"
                          : "bg-[#3D8BFF]/20 text-[#8AB8FF]"
                      }`}
                    >
                      {r.type === "lost" ? "LOST" : "FOUND"}
                    </span>
                    <span className="text-[#8A928B] text-[10.5px]">{timeAgo(r.reportedAt)}</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <div className="mt-0.5 text-[#8A928B]">
                      <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{r.description}</div>
                      <div className="flex items-center gap-1 text-[11px] text-[#8A928B] mt-0.5">
                        <MapPin size={11} /> {locationName} {r.location ? `• ${r.location}` : ""}
                      </div>
                    </div>
                  </div>
                  {r.publicContact || revealed[r.id] ? (
                    <div className="mt-2 font-mono text-[11.5px] text-[#B8E62E] font-medium break-all">
                      {r.contact}
                    </div>
                  ) : (
                    <button
                      className="mt-2 bg-transparent border border-white/10 text-[#8A928B] rounded-md px-2.5 py-1 text-[11px] hover:text-white hover:border-white/20 transition-colors"
                      onClick={() => setRevealed((p) => ({ ...p, [r.id]: true }))}
                    >
                      Reveal contact
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {reports.length > 0 && (
            <button
              onClick={() => navigate('/lost-and-found')}
              className="mt-3 w-full bg-transparent border border-white/10 text-[#8A928B] hover:text-white rounded-xl py-2.5 text-xs font-medium hover:border-white/20 hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
            >
              Browse All City Reports
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ReportForm({ type, onSubmit, defaultNodeId, nodesList }: { type: 'lost' | 'found', onSubmit: (data: any) => void, defaultNodeId?: string, nodesList: {id: string, name: string}[] }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(defaultNodeId || "");
  const [specificLocation, setSpecificLocation] = useState("");
  const [contact, setContact] = useState("");
  const [publicContact, setPublicContact] = useState(false);
  const valid = category && description.trim() && selectedNodeId && contact.trim();

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              className={`flex items-center gap-1.5 border-[1.5px] rounded-full px-2.5 py-1 text-[11.5px] transition-colors ${
                category === c.id
                  ? "border-[#B8E62E] text-[#B8E62E] bg-[#B8E62E]/5"
                  : "border-white/10 bg-[#1B1E23] text-[#8A928B] hover:border-white/20"
              }`}
              onClick={() => setCategory(c.id)}
            >
              <Icon size={13} /> {c.label}
            </button>
          );
        })}
      </div>
      <input
        className="bg-[#1B1E23] border-[1.5px] border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#B8E62E]/50 transition-colors"
        placeholder={type === "lost" ? "What was it?" : "What did you find?"}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      
      <select
        className="bg-[#1B1E23] border-[1.5px] border-white/10 rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-[#B8E62E]/50 transition-colors appearance-none"
        value={selectedNodeId}
        onChange={(e) => setSelectedNodeId(e.target.value)}
      >
        <option value="" disabled>Select the node / location...</option>
        {nodesList.map(n => (
          <option key={n.id} value={n.id}>{n.name}</option>
        ))}
      </select>

      <input
        className="bg-[#1B1E23] border-[1.5px] border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#B8E62E]/50 transition-colors"
        placeholder="Exact spot? (e.g., By the bench) - Optional"
        value={specificLocation}
        onChange={(e) => setSpecificLocation(e.target.value)}
      />
      
      <input
        className="bg-[#1B1E23] border-[1.5px] border-white/10 rounded-lg px-3 py-2 text-[13px] text-white placeholder-[#5C6068] focus:outline-none focus:border-[#B8E62E]/50 transition-colors"
        placeholder="Your phone or email"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      <label className="flex items-center gap-2 text-[11.5px] text-[#8A928B] cursor-pointer mt-1">
        <input
          type="checkbox"
          checked={publicContact}
          onChange={(e) => setPublicContact(e.target.checked)}
          className="accent-[#B8E62E] bg-[#1B1E23] border-white/10 rounded w-3.5 h-3.5 cursor-pointer"
        />
        Show contact publicly (off = tap to reveal)
      </label>
      <button
        className="bg-[#B8E62E] text-[#0C0F12] border-none rounded-lg p-2.5 font-bold text-[13px] cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed hover:bg-[#a6d129] transition-colors mt-1"
        disabled={!valid}
        onClick={() =>
          onSubmit({ 
            type, 
            category, 
            description: description.trim(), 
            node_id: selectedNodeId,
            location: specificLocation.trim(), 
            contact: contact.trim(), 
            publicContact 
          })
        }
      >
        Post to board
      </button>
    </div>
  );
}

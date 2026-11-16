import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import type { NodeProposal } from '../types';
import { MapPin, Check, X, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface AdminNodeProposalsPanelProps {
  setHudMessage: (msg: { text: string; type: 'info' | 'error' } | null) => void;
}

export function AdminNodeProposalsPanel({ setHudMessage }: AdminNodeProposalsPanelProps) {
  const [proposals, setProposals] = useState<NodeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'node_proposals'),
        where('status', '==', 'pending')
      );
      const snap = await getDocs(q);
      const toMillis = (val: any): number => {
        if (!val) return 0;
        if (typeof val.toMillis === 'function') return val.toMillis();
        if (typeof val.toDate === 'function') return val.toDate().getTime();
        if (typeof val.seconds === 'number') return val.seconds * 1000;
        const parsed = new Date(val).getTime();
        return Number.isNaN(parsed) ? 0 : parsed;
      };
      const items = snap.docs
        .map(d => ({ id: d.id, ...d.data() }) as NodeProposal)
        .sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
      setProposals(items);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'node_proposals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  const handleApprove = async (proposal: NodeProposal) => {
    if (!proposal.id) return;
    setProcessingId(proposal.id);
    try {
      const nodeRef = await addDoc(collection(db, 'nodes'), {
        name: proposal.name,
        type: 'street',
        address: proposal.address || null,
        latitude: proposal.latitude ?? 0,
        longitude: proposal.longitude ?? 0,
        radius_limit: 500,
        neighborhood: proposal.neighborhood || null,
      });
      await updateDoc(doc(db, 'node_proposals', proposal.id), {
        status: 'approved',
        reviewed_at: serverTimestamp(),
        promoted_node_id: nodeRef.id,
      });

      // Let the person who suggested this spot know — non-fatal if it fails,
      // the proposal itself is already approved either way.
      try {
        await addDoc(collection(db, 'users', proposal.proposed_by_uid, 'notifications'), {
          type: 'proposal_approved',
          title: 'Your spot is live!',
          body: `${proposal.name} is now a stop on the trail.`,
          read: false,
          created_at: serverTimestamp(),
          node_id: nodeRef.id,
          proposal_id: proposal.id,
        });
      } catch (notifyErr) {
        console.warn('Error writing proposal-approved notification:', notifyErr);
      }

      setHudMessage({ text: `NODE_CREATED_FROM_PROPOSAL: ${proposal.name}`, type: 'info' });
      await fetchProposals();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'node_proposals');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (proposal: NodeProposal) => {
    if (!proposal.id) return;
    setProcessingId(proposal.id);
    try {
      await updateDoc(doc(db, 'node_proposals', proposal.id), {
        status: 'rejected',
        reviewed_at: serverTimestamp(),
      });
      await fetchProposals();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'node_proposals');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-uh-gray-300">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-uh-gray-400">
        <MapPin size={32} className="mb-3 opacity-40" />
        <p className="text-sm font-bold">No pending suggestions</p>
        <p className="text-xs mt-1">Spots residents propose from the app will show up here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {proposals.map(proposal => (
        <div key={proposal.id} className="bg-white border border-[#e0e0e0] rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-black text-lg tracking-tight truncate">{proposal.name}</h4>
          </div>
          {proposal.address && (
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#999] mb-3">{proposal.address}</p>
          )}
          <p className="text-sm text-uh-gray-500 mb-4 leading-snug">{proposal.reason}</p>
          <div className="flex items-center justify-between text-[9px] text-uh-gray-300 font-bold uppercase tracking-widest mb-4">
            <span>{proposal.neighborhood || 'No neighborhood tag'}</span>
            <span>{proposal.latitude ? 'Has location' : 'No location'}</span>
          </div>
          {proposal.proposed_by_email && (
            <p className="text-[9px] text-uh-gray-300 mb-4 truncate">Proposed by {proposal.proposed_by_email}</p>
          )}
          <div className="flex gap-2">
            <button
              disabled={processingId === proposal.id}
              onClick={() => handleApprove(proposal)}
              className="flex-1 bg-black text-[#FFE01A] font-bold tracking-widest uppercase text-[10px] py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {processingId === proposal.id ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
              Approve
            </button>
            <button
              disabled={processingId === proposal.id}
              onClick={() => handleReject(proposal)}
              className="flex-1 bg-white border border-[#e0e0e0] text-uh-gray-500 font-bold tracking-widest uppercase text-[10px] py-3 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Artist } from '../types';
import { Plus, Trash2, Edit2, Instagram, Link as LinkIcon, Loader2 } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface AdminArtistsPanelProps {
  setHudMessage: (msg: { text: string; type: 'info' | 'error' } | null) => void;
}

export function AdminArtistsPanel({ setHudMessage }: AdminArtistsPanelProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    artist_name: '',
    artist_slug: '',
    cover_art_url: '',
    nfc_destination: '',
    instagram_url: '',
    instagram_followers: 0,
    blink_artist_url: '',
    nfc_id: '',
    sponsor_name: '',
    sponsor_url: '',
    nodeSponsor_name: '',
    nodeSponsor_logoUrl: '',
    nodeSponsor_link: '',
    audioSponsor_name: '',
    audioSponsor_logoUrl: '',
    audioSponsor_link: '',
    hometown: '',
    location_string: '',
    latitude: 0,
    longitude: 0,
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'artists'), (snap) => {
      setArtists(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Artist));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!formData.artist_name || !formData.artist_slug) {
      setHudMessage({ text: 'Name and slug are required.', type: 'error' });
      return;
    }
    setSubmitting(true);
    
    // Construct nested sponsor objects
    const nodeSponsor = formData.nodeSponsor_name ? {
      name: formData.nodeSponsor_name,
      logoUrl: formData.nodeSponsor_logoUrl,
      link: formData.nodeSponsor_link
    } : null;

    const audioSponsor = formData.audioSponsor_name ? {
      name: formData.audioSponsor_name,
      logoUrl: formData.audioSponsor_logoUrl,
      link: formData.audioSponsor_link
    } : null;

    // Destructure out the flat sponsor inputs so they don't pollute the document unnecessarily,
    // although keeping them is fine. Let's just create the final payload.
    const {
      nodeSponsor_name, nodeSponsor_logoUrl, nodeSponsor_link,
      audioSponsor_name, audioSponsor_logoUrl, audioSponsor_link,
      ...restFormData
    } = formData;

    const payload = {
      ...restFormData,
      nodeSponsor,
      audioSponsor,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'artists', editingId), payload);
        setHudMessage({ text: 'Artist updated successfully', type: 'info' });
      } else {
        await addDoc(collection(db, 'artists'), {
          ...payload,
          nfc_tap_count: 0,
          instagram_last_updated: new Date().toISOString(),
        });
        setHudMessage({ text: 'Artist added successfully', type: 'info' });
      }
      setShowAdd(false);
      setEditingId(null);
      resetForm();
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, 'artists');
      setHudMessage({ text: 'Failed to save artist', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this artist?')) return;
    try {
      await deleteDoc(doc(db, 'artists', id));
      setHudMessage({ text: 'Artist deleted', type: 'info' });
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.DELETE, 'artists');
      setHudMessage({ text: 'Failed to delete artist', type: 'error' });
    }
  };

  const editArtist = (artist: Artist) => {
    setFormData({
      artist_name: artist.artist_name || '',
      artist_slug: artist.artist_slug || '',
      cover_art_url: artist.cover_art_url || '',
      nfc_destination: artist.nfc_destination || '',
      instagram_url: artist.instagram_url || '',
      instagram_followers: artist.instagram_followers || 0,
      blink_artist_url: artist.blink_artist_url || '',
      nfc_id: artist.nfc_id || '',
      sponsor_name: artist.sponsor_name || '',
      sponsor_url: artist.sponsor_url || '',
      nodeSponsor_name: artist.nodeSponsor?.name || artist.sponsor_name || '',
      nodeSponsor_logoUrl: artist.nodeSponsor?.logoUrl || artist.sponsor_logo_url || '',
      nodeSponsor_link: artist.nodeSponsor?.link || artist.sponsor_url || '',
      audioSponsor_name: artist.audioSponsor?.name || '',
      audioSponsor_logoUrl: artist.audioSponsor?.logoUrl || '',
      audioSponsor_link: artist.audioSponsor?.link || '',
      hometown: artist.hometown || '',
      location_string: artist.location_string || '',
      latitude: artist.latitude || 0,
      longitude: artist.longitude || 0,
    });
    setEditingId(artist.id!);
    setShowAdd(true);
  };

  const resetForm = () => {
    setFormData({
      artist_name: '', artist_slug: '', cover_art_url: '',
      nfc_destination: '', instagram_url: '', instagram_followers: 0,
      blink_artist_url: '', nfc_id: '', sponsor_name: '', sponsor_url: '',
      nodeSponsor_name: '', nodeSponsor_logoUrl: '', nodeSponsor_link: '',
      audioSponsor_name: '', audioSponsor_logoUrl: '', audioSponsor_link: '',
      hometown: '', location_string: '', latitude: 0, longitude: 0
    });
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#999]" /></div>;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[12px] font-bold tracking-widest uppercase text-[#999]">ARTIST_REGISTRY</h3>
        <button 
          onClick={() => { setShowAdd(!showAdd); if(showAdd) { setEditingId(null); resetForm(); } }}
          className="flex items-center gap-2 px-4 py-2 bg-black text-[#FFE01A] text-[9px] font-black tracking-widest uppercase rounded-lg hover:scale-105 transition-all"
        >
          <Plus size={12} />
          {showAdd ? 'Cancel' : 'Register Artist'}
        </button>
      </div>

      {showAdd && (
        <div className="bg-white border border-[#e0e0e0] rounded-2xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Artist_Name</label>
              <input value={formData.artist_name} onChange={e => setFormData({...formData, artist_name: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. Greg Mike" />
            </div>
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">URL_Slug</label>
              <input value={formData.artist_slug} onChange={e => setFormData({...formData, artist_slug: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. greg-mike" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Cover_Art_URL</label>
              <input value={formData.cover_art_url} onChange={e => setFormData({...formData, cover_art_url: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">NFC_Destination_URL</label>
              <input value={formData.nfc_destination} onChange={e => setFormData({...formData, nfc_destination: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
            </div>
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Instagram_URL</label>
              <input value={formData.instagram_url} onChange={e => setFormData({...formData, instagram_url: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://instagram.com/..." />
            </div>
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Instagram_Followers</label>
              <input type="number" value={formData.instagram_followers} onChange={e => setFormData({...formData, instagram_followers: parseInt(e.target.value) || 0})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" />
            </div>
            <div className="md:col-span-2 mt-4 pt-4 border-t border-[#e0e0e0]">
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4">Node Sponsor (Supported By)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Name</label>
                  <input value={formData.nodeSponsor_name} onChange={e => setFormData({...formData, nodeSponsor_name: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. ArtsWave" />
                </div>
                <div>
                  <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Link</label>
                  <input value={formData.nodeSponsor_link} onChange={e => setFormData({...formData, nodeSponsor_link: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Logo URL</label>
                  <input value={formData.nodeSponsor_logoUrl} onChange={e => setFormData({...formData, nodeSponsor_logoUrl: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 mt-2 pt-4 border-t border-[#e0e0e0]">
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4">Audio Sponsor (Hear the Artist)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Name</label>
                  <input value={formData.audioSponsor_name} onChange={e => setFormData({...formData, audioSponsor_name: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. ArtsWave" />
                </div>
                <div>
                  <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Link</label>
                  <input value={formData.audioSponsor_link} onChange={e => setFormData({...formData, audioSponsor_link: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Logo URL</label>
                  <input value={formData.audioSponsor_logoUrl} onChange={e => setFormData({...formData, audioSponsor_logoUrl: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 mt-2 pt-4 border-t border-[#e0e0e0]">
              <h4 className="text-xs font-bold uppercase tracking-wider mb-4">Location Data</h4>
            </div>

            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Hometown / Origin</label>
              <input value={formData.hometown} onChange={e => setFormData({...formData, hometown: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. CINCINNATI, OH" />
            </div>

            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Address / Location Name</label>
              <input value={formData.location_string} onChange={e => setFormData({...formData, location_string: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. Walnut St + 13th St" />
            </div>
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Latitude, Longitude</label>
              <div className="flex gap-2">
                <input type="number" step="any" value={formData.latitude} onChange={e => setFormData({...formData, latitude: parseFloat(e.target.value) || 0})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="Lat" />
                <input type="number" step="any" value={formData.longitude} onChange={e => setFormData({...formData, longitude: parseFloat(e.target.value) || 0})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="Lng" />
              </div>
            </div>
          </div>
          <button disabled={submitting} onClick={handleSave} className="mt-6 w-full bg-black text-[#FFE01A] font-bold tracking-widest uppercase py-4 rounded-xl disabled:opacity-50">
            {submitting ? 'SAVING...' : 'SAVE_ARTIST'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artists.map(artist => (
          <div key={artist.id} className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden hover:border-[#ccc] transition-all">
            <div className="h-32 bg-[#f5f5f5] relative">
              {artist.cover_art_url ? (
                <img src={artist.cover_art_url} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-uh-gray-300">No Image</div>
              )}
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => editArtist(artist)} className="p-2 bg-black/50 hover:bg-black text-white rounded-full backdrop-blur-sm transition-all"><Edit2 size={12} /></button>
                <button onClick={() => handleDelete(artist.id!)} className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-all"><Trash2 size={12} /></button>
              </div>
            </div>
            <div className="p-5">
              <h4 className="font-black text-xl tracking-tight mb-1">{artist.artist_name}</h4>
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#999] mb-4">/{artist.artist_slug}</p>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs border-b border-[#f5f5f5] pb-2">
                  <span className="text-uh-gray-400 flex items-center gap-1"><Instagram size={12}/> Followers</span>
                  <span className="font-bold">{artist.instagram_followers?.toLocaleString() || 0}</span>
                </div>
                <div className="flex items-center justify-between text-xs border-b border-[#f5f5f5] pb-2">
                  <span className="text-uh-gray-400 flex items-center gap-1"><LinkIcon size={12}/> Taps</span>
                  <span className="font-bold">{artist.nfc_tap_count || 0}</span>
                </div>
                <div className="pt-2 text-[10px]">
                  <a href={`/artist/${artist.artist_slug}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">View Live Page →</a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

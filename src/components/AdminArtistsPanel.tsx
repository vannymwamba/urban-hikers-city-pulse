import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { Artist, ArtistSocialProfile } from '../types';
import { Plus, Trash2, Edit2, Instagram, Link as LinkIcon, Loader2, Users } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface AdminArtistsPanelProps {
  setHudMessage: (msg: { text: string; type: 'info' | 'error' } | null) => void;
}

const createEmptySocialProfile = (): ArtistSocialProfile => ({
  name: '',
  instagram_handle: '',
  instagram_url: '',
  instagram_followers: 0,
  hometown: '',
  role: '',
});

export function AdminArtistsPanel({ setHudMessage }: AdminArtistsPanelProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    artist_name: '',
    artist_slug: '',
    artwork_title: '',
    artwork_year: '',
    cover_art_url: '',
    nfc_destination: '',
    instagram_handle: '',
    instagram_url: '',
    instagram_followers: 0,
    featured_artists: [createEmptySocialProfile()] as ArtistSocialProfile[],
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

  const fetchArtists = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'artists'));
      setArtists(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Artist));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'artists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArtists();
  }, [fetchArtists]);

  const updateSocialProfile = (index: number, field: keyof ArtistSocialProfile, value: string | number) => {
    setFormData(prev => {
      const updated = [...prev.featured_artists];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      // Sync primary artist fields with index 0
      const primary = updated[0] || createEmptySocialProfile();
      return {
        ...prev,
        featured_artists: updated,
        instagram_handle: primary.instagram_handle,
        instagram_url: primary.instagram_url,
        instagram_followers: Number(primary.instagram_followers) || 0,
      };
    });
  };

  const addSocialProfile = () => {
    setFormData(prev => ({
      ...prev,
      featured_artists: [...prev.featured_artists, createEmptySocialProfile()],
    }));
  };

  const removeSocialProfile = (index: number) => {
    setFormData(prev => {
      if (prev.featured_artists.length <= 1) return prev;
      const updated = prev.featured_artists.filter((_, idx) => idx !== index);
      const primary = updated[0] || createEmptySocialProfile();
      return {
        ...prev,
        featured_artists: updated,
        instagram_handle: primary.instagram_handle,
        instagram_url: primary.instagram_url,
        instagram_followers: Number(primary.instagram_followers) || 0,
      };
    });
  };

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

    // Filter and normalize featured_artists entries without inventing default Instagram accounts
    const cleanedFeaturedArtists: ArtistSocialProfile[] = formData.featured_artists
      .filter((p, idx) => idx === 0 || p.name.trim() || p.instagram_handle.trim() || p.instagram_url.trim())
      .map((p, idx) => {
        const rawHandle = p.instagram_handle.trim();
        const rawUrl = p.instagram_url.trim();
        let handle = rawHandle ? (rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`) : '';

        if (!handle && rawUrl) {
          try {
            const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
            const segments = parsed.pathname.split('/').filter(Boolean);
            if (segments.length > 0 && segments[0] !== 'p' && segments[0] !== 'reel') {
              handle = `@${segments[0].replace(/^@/, '')}`;
            }
          } catch {
            // Leave handle empty if URL cannot be parsed
          }
        }

        const cleanUrl = rawUrl
          ? rawUrl
          : handle
          ? `https://instagram.com/${handle.replace(/^@/, '')}`
          : '';

        return {
          name: p.name.trim() || (idx === 0 ? formData.artist_name.trim() : ''),
          instagram_handle: handle,
          instagram_url: cleanUrl,
          instagram_followers: (handle || cleanUrl) ? (Number(p.instagram_followers) || 0) : 0,
          hometown: p.hometown?.trim() || '',
          role: p.role?.trim() || '',
        };
      })
      .filter(p => p.name || p.instagram_handle || p.instagram_url);

    const primaryEntry = cleanedFeaturedArtists[0];

    const {
      nodeSponsor_name, nodeSponsor_logoUrl, nodeSponsor_link,
      audioSponsor_name, audioSponsor_logoUrl, audioSponsor_link,
      ...restFormData
    } = formData;

    const payload = {
      ...restFormData,
      instagram_handle: primaryEntry?.instagram_handle || '',
      instagram_url: primaryEntry?.instagram_url || '',
      instagram_followers: primaryEntry ? primaryEntry.instagram_followers : 0,
      featured_artists: cleanedFeaturedArtists,
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
      await fetchArtists();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'artists');
      setHudMessage({ text: 'Failed to save artist', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'artists', id));
      setConfirmDeleteId(null);
      setHudMessage({ text: 'Artist deleted', type: 'info' });
      await fetchArtists();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'artists');
      setHudMessage({ text: 'Failed to delete artist', type: 'error' });
    }
  };

  const editArtist = (artist: Artist) => {
    const existingProfiles: ArtistSocialProfile[] =
      Array.isArray(artist.featured_artists) && artist.featured_artists.length > 0
        ? artist.featured_artists.map(p => ({
            name: p.name || '',
            instagram_handle: p.instagram_handle || '',
            instagram_url: p.instagram_url || '',
            instagram_followers: p.instagram_followers || 0,
            hometown: p.hometown || '',
            role: p.role || '',
          }))
        : [
            {
              name: artist.artist_name || '',
              instagram_handle: artist.instagram_handle || '',
              instagram_url: artist.instagram_url || '',
              instagram_followers: artist.instagram_followers || 0,
              hometown: artist.hometown || '',
              role: '',
            },
          ];

    setFormData({
      artist_name: artist.artist_name || '',
      artist_slug: artist.artist_slug || '',
      artwork_title: artist.artwork_title || '',
      artwork_year: artist.artwork_year || '',
      cover_art_url: artist.cover_art_url || '',
      nfc_destination: artist.nfc_destination || '',
      instagram_handle: artist.instagram_handle || '',
      instagram_url: artist.instagram_url || '',
      instagram_followers: artist.instagram_followers || 0,
      featured_artists: existingProfiles,
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
      artist_name: '',
      artist_slug: '',
      artwork_title: '',
      artwork_year: '',
      cover_art_url: '',
      nfc_destination: '',
      instagram_handle: '',
      instagram_url: '',
      instagram_followers: 0,
      featured_artists: [createEmptySocialProfile()],
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
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Primary_Artist_or_Collective_Name</label>
              <input value={formData.artist_name} onChange={e => setFormData({...formData, artist_name: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. Gee Gordon" />
            </div>
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">URL_Slug</label>
              <input value={formData.artist_slug} onChange={e => setFormData({...formData, artist_slug: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. gee-gordon" />
            </div>
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Artwork_Title</label>
              <input value={formData.artwork_title} onChange={e => setFormData({...formData, artwork_title: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. GROWING TOGETHER" />
            </div>
            <div>
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Artwork_Year</label>
              <input value={formData.artwork_year} onChange={e => setFormData({...formData, artwork_year: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="e.g. 2024" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Cover_Art_URL</label>
              <input value={formData.cover_art_url} onChange={e => setFormData({...formData, cover_art_url: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
            </div>
            <div className="md:col-span-2">
              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">NFC_Destination_URL</label>
              <input value={formData.nfc_destination} onChange={e => setFormData({...formData, nfc_destination: e.target.value})} className="w-full bg-[#f5f5f5] text-black border border-[#e0e0e0] rounded-lg px-4 py-3 text-sm" placeholder="https://..." />
            </div>

            {/* Multi-Artist & Instagram Roster Builder */}
            <div className="md:col-span-2 mt-2 pt-4 border-t border-[#e0e0e0]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Instagram size={14} /> Artists & Instagram Accounts ({formData.featured_artists.length})
                  </h4>
                  <p className="text-[11px] text-[#777] mt-0.5">
                    Add 1, 2, or more collaborating artists, each with their own Instagram handle and follower count.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSocialProfile}
                  className="flex items-center gap-1.5 px-3 py-2 bg-black text-[#FFE01A] text-[10px] font-black tracking-widest uppercase rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <Plus size={12} /> Add Artist Account
                </button>
              </div>

              <div className="space-y-3">
                {formData.featured_artists.map((profile, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-[#f9f9f9] border border-[#e5e5e5] rounded-xl flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#555]">
                        Artist #{idx + 1} {idx === 0 ? '(Primary)' : '(Collaborator)'}
                      </span>
                      {formData.featured_artists.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSocialProfile(idx)}
                          className="text-red-500 hover:text-red-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[9px] text-[#888] tracking-widest uppercase mb-1 block">Artist Name</label>
                        <input
                          value={profile.name}
                          onChange={e => updateSocialProfile(idx, 'name', e.target.value)}
                          className="w-full bg-white text-black border border-[#e0e0e0] rounded-lg px-3 py-2 text-xs"
                          placeholder={idx === 0 ? (formData.artist_name || 'e.g. Gee Gordon') : 'e.g. Jessica Watts'}
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#888] tracking-widest uppercase mb-1 block">Instagram Handle</label>
                        <input
                          value={profile.instagram_handle}
                          onChange={e => updateSocialProfile(idx, 'instagram_handle', e.target.value)}
                          className="w-full bg-white text-black border border-[#e0e0e0] rounded-lg px-3 py-2 text-xs"
                          placeholder="e.g. @gee-gordon"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#888] tracking-widest uppercase mb-1 block">Followers Count</label>
                        <input
                          type="number"
                          value={profile.instagram_followers}
                          onChange={e => updateSocialProfile(idx, 'instagram_followers', parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-white text-black border border-[#e0e0e0] rounded-lg px-3 py-2 text-xs"
                          placeholder="41238"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-[#888] tracking-widest uppercase mb-1 block">Role / Origin</label>
                        <input
                          value={profile.role || ''}
                          onChange={e => updateSocialProfile(idx, 'role', e.target.value)}
                          className="w-full bg-white text-black border border-[#e0e0e0] rounded-lg px-3 py-2 text-xs"
                          placeholder="e.g. Lead Artist / OTR"
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-[9px] text-[#888] tracking-widest uppercase mb-1 block">Instagram URL</label>
                        <input
                          value={profile.instagram_url}
                          onChange={e => updateSocialProfile(idx, 'instagram_url', e.target.value)}
                          className="w-full bg-white text-black border border-[#e0e0e0] rounded-lg px-3 py-2 text-xs"
                          placeholder="https://instagram.com/gee-gordon"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
        {artists.map(artist => {
          const profiles: ArtistSocialProfile[] =
            Array.isArray(artist.featured_artists) && artist.featured_artists.length > 0
              ? artist.featured_artists
              : [
                  {
                    name: artist.artist_name,
                    instagram_handle: artist.instagram_handle || '',
                    instagram_url: artist.instagram_url || '',
                    instagram_followers: artist.instagram_followers || 0,
                  },
                ];

          const instagramProfiles = profiles.filter(p => Boolean(p.instagram_handle || p.instagram_url));

          return (
            <div key={artist.id} className="bg-white border border-[#e0e0e0] rounded-2xl overflow-hidden hover:border-[#ccc] transition-all">
              <div className="h-32 bg-[#f5f5f5] relative">
                {artist.cover_art_url ? (
                  <img src={artist.cover_art_url} alt="Cover" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-uh-gray-300">No Image</div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <button onClick={() => editArtist(artist)} className="p-2 bg-black/50 hover:bg-black text-white rounded-full backdrop-blur-sm transition-all"><Edit2 size={12} /></button>
                  {confirmDeleteId === artist.id ? (
                    <button
                      onClick={() => handleDelete(artist.id!)}
                      className="px-2.5 py-1 bg-red-600 text-white text-[9px] font-bold uppercase rounded-full backdrop-blur-sm transition-all"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(artist.id!)}
                      className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full backdrop-blur-sm transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-black text-xl tracking-tight truncate">{artist.artist_name}</h4>
                  {profiles.length > 1 && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666] flex items-center gap-1 shrink-0">
                      <Users size={11} /> {profiles.length}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-[#999] mb-4">/{artist.artist_slug}</p>
                
                <div className="flex flex-col gap-2">
                  {instagramProfiles.length > 0 && (
                    <div className="border-b border-[#f5f5f5] pb-2 space-y-1.5">
                      {instagramProfiles.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-uh-gray-500 flex items-center gap-1.5 truncate">
                            <Instagram size={12} className="shrink-0" />
                            <span className="font-semibold text-black truncate">{p.instagram_handle || p.instagram_url}</span>
                          </span>
                          {Number(p.instagram_followers) > 0 && (
                            <span className="font-bold tabular-nums shrink-0">{Number(p.instagram_followers).toLocaleString()}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs border-b border-[#f5f5f5] pb-2">
                    <span className="text-uh-gray-400 flex items-center gap-1"><LinkIcon size={12}/> Taps</span>
                    <span className="font-bold tabular-nums">{artist.nfc_tap_count || 0}</span>
                  </div>
                  <div className="pt-2 text-[10px]">
                    <a href={`/artist/${artist.artist_slug}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">View Live Page →</a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

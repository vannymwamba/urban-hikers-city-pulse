import { db } from './firebase';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { addHours } from 'date-fns';

const seedData = async () => {
  console.log("SEEDING_URBAN_HIKERS_DATABASE...");

  try {
    // Seed Nodes
    const nodes = [
      { id: 'sector-alpha', name: 'ALPHA_PLAZA_HUB', type: 'street', address: 'Main St & E 13th St, Cincinnati, OH', latitude: 40.7128, longitude: -74.0060, radius_limit: 5000 },
      { id: 'sector-beta', name: 'BETA_CONCOURSE', type: 'conference_center', address: '525 Elm St, Cincinnati, OH', latitude: 40.7589, longitude: -73.9851, radius_limit: 2000 },
      { id: 'sector-gamma', name: 'GAMMA_GARDENS', type: 'street', address: '1230 Elm St, Cincinnati, OH', latitude: 40.7829, longitude: -73.9654, radius_limit: 3000 }
    ];

    for (const node of nodes) {
      await setDoc(doc(db, 'nodes', node.id), node);
      console.log(`NODE_INITIALIZED: ${node.id}`);
    }

    // Seed Broadcasts
    const broadcasts = [
      {
        node_id: 'sector-alpha',
        title: 'FLASH_TACO_DEAL_50%',
        type: 'flash_deal',
        address: '1401 Vine St, Cincinnati, OH',
        latitude: 40.7125,
        longitude: -74.0055,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 1).toISOString(),
        current_vibe: 'buzzing'
      },
      {
        node_id: 'sector-alpha',
        title: 'LIVE_JAZZ_QUARTET',
        type: 'event',
        address: '1230 Elm St, Cincinnati, OH',
        latitude: 40.7130,
        longitude: -74.0062,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 2).toISOString(),
        current_vibe: 'chill'
      },
      {
        node_id: 'sector-alpha',
        title: 'STREET_ART_EXPO',
        type: 'event',
        address: '1400 Vine St, Cincinnati, OH',
        latitude: 40.7135,
        longitude: -74.0065,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 4).toISOString(),
        current_vibe: 'packed'
      },
      {
        node_id: 'sector-alpha',
        title: 'BTW26_KEYNOTE_HALL_B',
        type: 'conference_panel',
        address: '525 Elm St, Cincinnati, OH',
        latitude: 40.7590,
        longitude: -73.9852,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 1.5).toISOString(),
        current_vibe: 'buzzing'
      }
    ];

    for (const broadcast of broadcasts) {
      const docRef = await addDoc(collection(db, 'broadcasts'), broadcast);
      console.log(`BROADCAST_IGNITED: ${broadcast.title}`);

      // Add some sample reports for the Jazz Quartet to show the trend
      if (broadcast.title === 'LIVE_JAZZ_QUARTET') {
        const vibes: ('chill' | 'buzzing' | 'packed')[] = ['chill', 'chill', 'buzzing', 'buzzing', 'chill', 'buzzing', 'packed', 'buzzing'];
        for (let i = 0; i < vibes.length; i++) {
          await addDoc(collection(db, 'vibe_reports'), {
            broadcast_id: docRef.id,
            vibe: vibes[i],
            reported_at: new Date(Date.now() - (vibes.length - i) * 10 * 60 * 1000).toISOString(),
            session_uuid: 'seed-session'
          });
        }
      }
    }

    // Seed Taps
    const sampleTaps = [
      { node_id: 'sector-alpha', session_uuid: 's1', access_vector: 'nfc', timestamp: new Date().toISOString() },
      { node_id: 'sector-alpha', session_uuid: 's2', access_vector: 'qr', timestamp: new Date().toISOString() },
      { node_id: 'sector-beta', session_uuid: 's3', access_vector: 'nfc', timestamp: new Date().toISOString() },
    ];

    for (const tap of sampleTaps) {
      await addDoc(collection(db, 'taps'), tap);
    }

    console.log("SEEDING_COMPLETE: SYSTEM_READY");
  } catch (err) {
    console.error("SEEDING_FAILURE:", err);
  }
};

// We'll export this and maybe call it from a button in the UI for demo purposes
export default seedData;

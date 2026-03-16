import { db } from './firebase';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { addHours } from 'date-fns';

const seedData = async () => {
  console.log("SEEDING_URBAN_HIKERS_DATABASE...");

  try {
    // Seed Nodes
    const nodes = [
      { id: 'sector-alpha', name: 'ALPHA_PLAZA_HUB', type: 'street', address: 'Main St & E 13th St, Cincinnati, OH', latitude: 39.1092, longitude: -84.5125, radius_limit: 5000 },
      { id: 'sector-beta', name: 'BETA_CONCOURSE', type: 'conference_center', address: '525 Elm St, Cincinnati, OH', latitude: 39.1015, longitude: -84.5165, radius_limit: 2000 },
      { id: 'sector-gamma', name: 'GAMMA_GARDENS', type: 'street', address: '1230 Elm St, Cincinnati, OH', latitude: 39.1115, longitude: -84.5185, radius_limit: 3000 }
    ];

    for (const node of nodes) {
      await setDoc(doc(db, 'nodes', node.id), node);
      console.log(`NODE_INITIALIZED: ${node.id}`);
    }

    // Seed Partners
    const partners = [
      {
        id: 'partner-kroger',
        name: 'KROGER_FRESH_MARKET',
        tier: 'anchor',
        address: '1401 Vine St, Cincinnati, OH',
        latitude: 39.1105,
        longitude: -84.5145,
        owner_email: 'vannymwamba@gmail.com',
        logo_url: 'https://picsum.photos/seed/kroger/200/200',
        brand_color: '#002D72',
        deal_text: 'Show NFC stamp — $2 off select items',
        sponsor_zones: ['A', 'D']
      },
      {
        id: 'partner-fotofocus',
        name: 'FOTOFOCUS_ARTS',
        tier: 'premium',
        address: '1230 Elm St, Cincinnati, OH',
        latitude: 39.1115,
        longitude: -84.5185,
        owner_email: 'arts@example.com',
        logo_url: 'https://picsum.photos/seed/arts/200/200',
        brand_color: '#1A1A2E',
        deal_text: 'Free Biennial Passport — tap 8 venues',
        sponsor_zones: ['A', 'B', 'D']
      }
    ];

    for (const partner of partners) {
      await setDoc(doc(db, 'partners', partner.id), partner);
      console.log(`PARTNER_INITIALIZED: ${partner.id}`);
    }

    // Seed Broadcasts
    const broadcasts = [
      {
        node_id: 'sector-alpha',
        partner_id: 'partner-kroger',
        title: 'FLASH_TACO_DEAL_50%',
        type: 'flash_deal',
        address: '1401 Vine St, Cincinnati, OH',
        latitude: 39.1105,
        longitude: -84.5145,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 1).toISOString(),
        current_vibe: 'buzzing',
        description: 'Exclusive flash deal for Urban Hikers! Get 50% off any taco order at Kroger Fresh Market. Just show your NFC stamp at the counter. Valid for the next hour only!'
      },
      {
        node_id: 'sector-alpha',
        partner_id: 'partner-fotofocus',
        title: 'LIVE_JAZZ_QUARTET',
        type: 'event',
        address: '1230 Elm St, Cincinnati, OH',
        latitude: 39.1115,
        longitude: -84.5185,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 2).toISOString(),
        current_vibe: 'chill',
        description: 'Enjoy a relaxing evening with the Blue Note Quartet. Live jazz performance in the heart of the city. Open to all, no tickets required. Grab a seat early!'
      },
      {
        node_id: 'sector-alpha',
        title: 'STREET_ART_EXPO',
        type: 'event',
        address: '1400 Vine St, Cincinnati, OH',
        latitude: 39.1100,
        longitude: -84.5150,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 4).toISOString(),
        current_vibe: 'packed',
        description: 'Local artists showcase their latest murals and installations. Interactive art walk through the Vine Street corridor. Meet the artists and discover the stories behind the walls.'
      },
      {
        node_id: 'sector-alpha',
        title: 'BTW26_KEYNOTE_HALL_B',
        type: 'conference_panel',
        address: '525 Elm St, Cincinnati, OH',
        latitude: 39.1016,
        longitude: -84.5166,
        starts_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 1.5).toISOString(),
        current_vibe: 'buzzing',
        description: 'The future of urban infrastructure and NFC technology. Join industry leaders for a deep dive into the BTW26 keynote session. Hall B, limited seating available.'
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

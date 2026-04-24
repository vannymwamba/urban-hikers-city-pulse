import { db, auth } from './firebase';
import { collection, addDoc, setDoc, doc, getDocFromServer } from 'firebase/firestore';
import { addHours } from 'date-fns';

const seedData = async () => {
  console.log("SEEDING_URBAN_HIKERS_DATABASE: STARTING...");

  try {
    // 0. Connection Test
    console.log("SEEDING: TESTING_CONNECTION...");
    try {
      await getDocFromServer(doc(db, 'nodes', 'connection-test'));
      console.log("SEEDING: CONNECTION_SUCCESS");
    } catch (connErr: any) {
      console.error("SEEDING: CONNECTION_FAILED", connErr);
      if (connErr.message?.includes('offline')) {
        throw new Error("FIREBASE_OFFLINE: Cannot seed while offline. Check your configuration.");
      }
    }

    // Seed Nodes
    const nodes = [
      { id: 'ALPHA_PLAZA_HUB', name: 'ALPHA_PLAZA_HUB', type: 'street', address: 'Main St & E 13th St, Cincinnati, OH', latitude: 39.1092, longitude: -84.5125, radius_limit: 5000 },
      { id: 'SECTOR-BETA', name: 'BETA_CONCOURSE', type: 'conference_center', address: '525 Elm St, Cincinnati, OH', latitude: 39.1015, longitude: -84.5165, radius_limit: 2000 },
      { id: 'SECTOR-GAMMA', name: 'GAMMA_GARDENS', type: 'street', address: '1230 Elm St, Cincinnati, OH', latitude: 39.1115, longitude: -84.5185, radius_limit: 3000 }
    ];

    console.log(`SEEDING: INITIALIZING_${nodes.length}_NODES...`);
    for (const node of nodes) {
      await setDoc(doc(db, 'nodes', node.id), node);
      console.log(`NODE_INITIALIZED: ${node.id}`);
    }

    // Seed Admins
    const adminEmail = 'vannymwamba@gmail.com';
    // We can't know the UID easily in a static seed, but we can set it when the user runs the seed if they are logged in
    // However, for rules, we can just seed a dummy doc or use the email check we added.
    // Better: If the user is logged in, we can get their UID.
    if (auth.currentUser && auth.currentUser.email === adminEmail) {
      await setDoc(doc(db, 'admins', auth.currentUser.uid), {
        email: adminEmail,
        role: 'super_admin',
        assignedAt: new Date().toISOString()
      });
      console.log(`ADMIN_INITIALIZED: ${auth.currentUser.uid}`);
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
        id: 'partner-allez',
        name: 'ALLEZ_BAKERY',
        tier: 'premium',
        address: '1208 Main St, Cincinnati, OH',
        latitude: 39.1085,
        longitude: -84.5120,
        owner_email: 'allez@example.com',
        logo_url: 'https://picsum.photos/seed/bakery/200/200',
        brand_color: '#F5DEB3',
        deal_text: 'Free pastry with Urban Hiker ticket',
        sponsor_zones: ['B', 'C']
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
      },
      {
        id: 'partner-music-hall',
        name: 'CINCINNATI_MUSIC_HALL',
        tier: 'anchor',
        address: '1241 Elm St, Cincinnati, OH',
        latitude: 39.1095,
        longitude: -84.5188,
        owner_email: 'musichall@example.com',
        logo_url: 'https://picsum.photos/seed/musichall/200/200',
        brand_color: '#8E1B1B',
        deal_text: 'Show NFC for 10% off concessions',
        sponsor_zones: ['A', 'B']
      },
      {
        id: 'partner-rhinegeist',
        name: 'RHINEGEIST_BREWERY',
        tier: 'premium',
        address: '1910 Elm St, Cincinnati, OH',
        latitude: 39.1172,
        longitude: -84.5191,
        owner_email: 'beer@example.com',
        logo_url: 'https://picsum.photos/seed/beer/200/200',
        brand_color: '#000000',
        deal_text: 'Happy Hour: $1 off all pints',
        sponsor_zones: ['C', 'D']
      },
      {
        id: 'partner-cac',
        name: 'CONTEMPORARY_ARTS_CENTER',
        tier: 'premium',
        address: '44 E 6th St, Cincinnati, OH',
        latitude: 39.1031,
        longitude: -84.5121,
        owner_email: 'cac@example.com',
        logo_url: 'https://picsum.photos/seed/cac/200/200',
        brand_color: '#FF3B30',
        deal_text: 'Free admission with NFC tap',
        sponsor_zones: ['B']
      },
      {
        id: 'partner-btw26',
        name: 'BTW26_CONFERENCE',
        tier: 'anchor',
        address: '525 Elm St, Cincinnati, OH',
        latitude: 39.1015,
        longitude: -84.5165,
        owner_email: 'btw26@example.com',
        logo_url: 'https://picsum.photos/seed/btw26/200/200',
        brand_color: '#5856D6',
        deal_text: 'Conference Pass: 50% off for locals',
        sponsor_zones: ['A', 'B', 'C', 'D']
      },
      {
        id: 'chpl',
        name: 'CINCINNATI_PUBLIC_LIBRARY',
        tier: 'anchor',
        address: '800 Vine St, Cincinnati, OH',
        latitude: 39.1064,
        longitude: -84.5125,
        owner_email: 'chpl@example.com',
        logo_url: 'https://picsum.photos/seed/library/200/200',
        brand_color: '#185FA5',
        deal_text: 'Free resources & community events',
        sponsor_zones: ['A', 'D']
      }
    ];

    for (const partner of partners) {
      await setDoc(doc(db, 'partners', partner.id), partner);
      console.log(`PARTNER_INITIALIZED: ${partner.id}`);
    }

    // Seed Guides
    const guides = [
      { id: 'guide-marcus', name: 'Marcus', title: 'Local Historian', bio: 'Expert in OTR architecture and history.', photoUrl: 'https://i.pravatar.cc/150?u=marcus' },
      { id: 'guide-sarah', name: 'Sarah', title: 'Street Artist', bio: 'Muralist and community art advocate.', photoUrl: 'https://i.pravatar.cc/150?u=sarah' }
    ];

    for (const guide of guides) {
      await setDoc(doc(db, 'guides', guide.id), guide);
      console.log(`GUIDE_INITIALIZED: ${guide.id}`);
    }

    // Seed Sponsors
    const sponsors = [
      { id: 'sponsor-kroger', name: 'KROGER', logoUrl: 'https://picsum.photos/seed/kroger/200/200', brandColor: '#002D72' },
      { id: 'sponsor-medpace', name: 'MEDPACE', logoUrl: 'https://picsum.photos/seed/medpace/200/200', brandColor: '#1A1A2E' }
    ];

    for (const sponsor of sponsors) {
      await setDoc(doc(db, 'sponsors', sponsor.id), sponsor);
      console.log(`SPONSOR_INITIALIZED: ${sponsor.id}`);
    }

    // Seed Broadcasts
    const broadcasts = [
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        partnerId: 'partner-kroger',
        partner_id: 'partner-kroger',
        title: 'FLASH_TACO_DEAL_50%',
        type: 'flash_deal',
        address: '1401 Vine St, Cincinnati, OH',
        latitude: 39.1105,
        longitude: -84.5145,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'buzzing',
        current_vibe: 'buzzing',
        active: true,
        description: 'Exclusive flash deal for Urban Hikers! Get 50% off any taco order at Kroger Fresh Market. Just show your NFC stamp at the counter. Valid for the next hour only!'
      },
      {
        nodeId: 'OTR-ALPHA-01',
        node_id: 'OTR-ALPHA-01',
        partnerId: 'partner-btw26',
        partner_id: 'partner-btw26',
        title: 'BTW26_FLASH_PASS_50%',
        type: 'flash_deal',
        address: '525 Elm St, Cincinnati, OH',
        latitude: 39.1015,
        longitude: -84.5165,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'packed',
        current_vibe: 'packed',
        active: true,
        description: 'LAST_CALL: Get 50% off your BTW26 Conference Pass. Limited quantity available for local residents. Tap in now to secure your spot at the future of urban tech.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        partnerId: 'partner-rhinegeist',
        partner_id: 'partner-rhinegeist',
        title: 'RHINEGEIST_HAPPY_HOUR',
        type: 'flash_deal',
        address: '1910 Elm St, Cincinnati, OH',
        latitude: 39.1172,
        longitude: -84.5191,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'buzzing',
        current_vibe: 'buzzing',
        active: true,
        description: 'Happy Hour is LIVE! $1 off all pints for Urban Hikers. Head to the taproom and show your signal. The perfect way to end your hike.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        partnerId: 'partner-music-hall',
        partner_id: 'partner-music-hall',
        title: 'LIVE_JAZZ_QUARTET',
        type: 'event',
        address: '1241 Elm St, Cincinnati, OH',
        latitude: 39.1095,
        longitude: -84.5188,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'chill',
        current_vibe: 'chill',
        active: true,
        description: 'Enjoy a relaxing evening with the Blue Note Quartet. Live jazz performance in the heart of the city. Open to all, no tickets required. Grab a seat early!'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        partnerId: 'partner-cac',
        partner_id: 'partner-cac',
        title: 'CAC_OPENING_NIGHT',
        type: 'event',
        address: '44 E 6th St, Cincinnati, OH',
        latitude: 39.1031,
        longitude: -84.5121,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'buzzing',
        current_vibe: 'buzzing',
        active: true,
        description: 'Join us for the opening night of our latest exhibition. Meet the artists, enjoy refreshments, and experience contemporary art like never before. Free for Urban Hikers.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        title: 'STREET_ART_EXPO',
        type: 'event',
        address: '1400 Vine St, Cincinnati, OH',
        latitude: 39.1100,
        longitude: -84.5150,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'packed',
        current_vibe: 'packed',
        active: true,
        description: 'Local artists showcase their latest murals and installations. Interactive art walk through the Vine Street corridor. Meet the artists and discover the stories behind the walls.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        partnerId: 'partner-btw26',
        partner_id: 'partner-btw26',
        title: 'BTW26_KEYNOTE_HALL_B',
        type: 'conference_panel',
        address: '525 Elm St, Cincinnati, OH',
        latitude: 39.1016,
        longitude: -84.5166,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'buzzing',
        current_vibe: 'buzzing',
        active: true,
        description: 'The future of urban infrastructure and NFC technology. Join industry leaders for a deep dive into the BTW26 keynote session. Hall B, limited seating available.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        partnerId: 'chpl',
        partner_id: 'chpl',
        title: 'STORYTIME_IN_THE_PARK',
        type: 'civic_free',
        address: '800 Vine St, Cincinnati, OH',
        latitude: 39.1064,
        longitude: -84.5125,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'chill',
        current_vibe: 'chill',
        active: true,
        description: 'Join the Cincinnati Public Library for an outdoor storytime session. Perfect for families and young hikers. Discover new stories and enjoy the fresh air.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        partnerId: 'chpl',
        partner_id: 'chpl',
        title: 'TECH_HELP_DESK',
        type: 'civic_free',
        address: '800 Vine St, Cincinnati, OH',
        latitude: 39.1064,
        longitude: -84.5125,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 168).toISOString(),
        expires_at: addHours(new Date(), 168).toISOString(),
        currentVibe: 'chill',
        current_vibe: 'chill',
        active: true,
        description: 'Need help with your device or the Urban Hikers app? Our tech volunteers are here to help. Drop by the library hub for one-on-one assistance.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        title: 'MR. DYNAMITE',
        type: 'mural',
        artist: 'JENNY USTICK',
        address: 'Vine & 14th St, Cincinnati, OH',
        latitude: 39.1105,
        longitude: -84.5145,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 8760).toISOString(),
        expires_at: addHours(new Date(), 8760).toISOString(),
        currentVibe: 'chill',
        current_vibe: 'chill',
        active: true,
        cover_url: 'https://picsum.photos/seed/dynamite/800/500',
        description: 'A tribute to the Godfather of Soul, James Brown. This vibrant mural captures the legendary energy of Mr. Dynamite in the heart of OTR.'
      },
      {
        nodeId: 'ALPHA_PLAZA_HUB',
        node_id: 'ALPHA_PLAZA_HUB',
        title: 'MT. LOOKOUT_WALK_PROTOCOL',
        type: 'walking_event',
        partner_id: 'partner-chpl',
        booking_url: 'https://eventbrite.com/e/mt-lookout-walk-123',
        address: 'Mt Lookout Square, Cincinnati, OH',
        latitude: 39.1100,
        longitude: -84.4100,
        startsAt: new Date().toISOString(),
        starts_at: new Date().toISOString(),
        expiresAt: addHours(new Date(), 72).toISOString(),
        expires_at: addHours(new Date(), 72).toISOString(),
        currentVibe: 'buzzing',
        current_vibe: 'buzzing',
        active: true,
        price: 15,
        description: 'Join the Cincinnati Walking Club for a technical scan of the Mt. Lookout corridor. Access through external protocol required.'
      }
    ];

    for (const broadcast of broadcasts) {
      const docRef = await addDoc(collection(db, 'broadcasts'), broadcast);
      console.log(`BROADCAST_IGNITED: ${broadcast.title}`);

      // Add some sample reports
      const vibes: ('chill' | 'buzzing' | 'packed')[] = ['chill', 'chill', 'buzzing', 'buzzing', 'chill', 'buzzing', 'packed', 'buzzing'];
      for (let i = 0; i < vibes.length; i++) {
        await addDoc(collection(db, 'vibe_reports'), {
          broadcast_id: docRef.id,
          vibe: vibes[i],
          reported_at: new Date(Date.now() - (vibes.length - i) * 10 * 60 * 1000).toISOString(),
          session_uuid: 'seed-session',
          sponsor_id: broadcast.partner_id || broadcast.partnerId || 'sponsor-kroger',
          access_vector: i % 2 === 0 ? 'nfc' : 'qr'
        });
      }
    }

    // Seed Taps
    const sampleTaps = [
      { node_id: 'ALPHA_PLAZA_HUB', session_uuid: 's1', access_vector: 'nfc', timestamp: new Date().toISOString(), sponsor_id: 'partner-kroger' },
      { node_id: 'ALPHA_PLAZA_HUB', session_uuid: 's2', access_vector: 'qr', timestamp: new Date().toISOString(), sponsor_id: 'partner-kroger' },
      { node_id: 'SECTOR-BETA', session_uuid: 's3', access_vector: 'nfc', timestamp: new Date().toISOString(), sponsor_id: 'partner-medpace' },
    ];

    for (const tap of sampleTaps) {
      await addDoc(collection(db, 'taps'), tap);
    }

    // Seed Interactions
    const sampleInteractions = [
      { type: 'share', session_uuid: 's1', access_vector: 'nfc', timestamp: new Date().toISOString(), sponsor_id: 'sponsor-kroger' },
      { type: 'wallet_save', session_uuid: 's2', access_vector: 'qr', timestamp: new Date().toISOString(), sponsor_id: 'sponsor-kroger' },
      { type: 'share', session_uuid: 's3', access_vector: 'nfc', timestamp: new Date().toISOString(), sponsor_id: 'sponsor-medpace' },
    ];

    for (const inter of sampleInteractions) {
      await addDoc(collection(db, 'interactions'), inter);
    }

    // Seed Tab Views
    const sampleViews = [
      { tab: 'feed', session_uuid: 's1', access_vector: 'nfc', timestamp: new Date().toISOString(), sponsor_id: 'sponsor-kroger' },
      { tab: 'wallet', session_uuid: 's2', access_vector: 'qr', timestamp: new Date().toISOString(), sponsor_id: 'sponsor-kroger' },
      { tab: 'map', session_uuid: 's3', access_vector: 'nfc', timestamp: new Date().toISOString(), sponsor_id: 'sponsor-medpace' },
    ];

    for (const view of sampleViews) {
      await addDoc(collection(db, 'tab_views'), view);
    }

    // Seed POIs (Murals/Public Art)
    const pois = [
      {
        id: 'mr-dynamite',
        name: 'MR. DYNAMITE',
        artist: 'JENNY USTICK',
        address: 'Vine & 14th St, Cincinnati, OH',
        latitude: 39.1105,
        longitude: -84.5145,
        description: 'A tribute to the Godfather of Soul, James Brown. This vibrant mural captures the legendary energy of Mr. Dynamite in the heart of OTR.',
        imageUrl: 'https://picsum.photos/seed/dynamite/800/500',
        type: 'civic_mural',
        createdAt: new Date().toISOString(),
        active: true
      },
      {
        id: 'singing-mural',
        name: 'THE_SINGING_MURAL',
        artist: 'C.F. PAYNE',
        address: '1223 Central Pkwy, Cincinnati, OH',
        latitude: 39.1090,
        longitude: -84.5190,
        description: 'Featuring local icons and choir members, this mural celebrates Cincinnati\'s rich choral tradition.',
        imageUrl: 'https://picsum.photos/seed/singing/800/500',
        type: 'civic_mural',
        createdAt: new Date().toISOString(),
        active: true
      },
      {
        id: 'say-their-names',
        name: 'SAY_THEIR_NAMES',
        artist: 'STREET_ART_DYNAMICS',
        address: '1400 Vine St, Cincinnati, OH',
        latitude: 39.1100,
        longitude: -84.5150,
        description: 'Powerful community art piece honoring social justice leaders and local activists.',
        imageUrl: 'https://picsum.photos/seed/names/800/500',
        type: 'civic_mural',
        createdAt: new Date().toISOString(),
        active: true
      }
    ];

    console.log(`SEEDING: INITIALIZING_${pois.length}_POIS...`);
    for (const poi of pois) {
      await setDoc(doc(db, 'pois', poi.id), poi);
      console.log(`POI_INITIALIZED: ${poi.id}`);
    }

    // Seed Flash Rotation Slots
    const flashSlots = [
      {
        tier: 'civic',
        is_civic: true,
        campaign_type: 'walk_sponsor',
        campaign_title: 'TEDWALK — Book your spot',
        cover_url: 'https://picsum.photos/seed/tedwalk/1200/800',
        cta_label: 'Book spot',
        cta_url: 'https://app.localpulses.com/walks/tedwalk',
        location_label: 'Vine St · OTR',
        distance_label: '0.3 mi',
        slot_priority: 99,
        status: 'active',
        expires_at: addHours(new Date(), 8760).toISOString(),
        starts_at: new Date().toISOString(),
        impressions: 0,
        taps: 0
      },
      {
        tier: 'civic',
        is_civic: true,
        campaign_type: 'donation',
        campaign_title: 'Support OTR murals — ArtWave',
        cover_url: 'https://picsum.photos/seed/muralart/1200/800',
        cta_label: 'Donate',
        cta_url: 'https://4agc.com/donation_pages/0785fa30-9065-400b-b54d-74458f2c9eb0',
        location_label: 'Over-the-Rhine',
        slot_priority: 100,
        status: 'active',
        expires_at: addHours(new Date(), 8760).toISOString(),
        starts_at: new Date().toISOString(),
        impressions: 0,
        taps: 0
      }
    ];

    for (const slot of flashSlots) {
      await addDoc(collection(db, 'flash_rotation'), slot);
      console.log(`FLASH_SLOT_INITIALIZED: ${slot.campaign_title}`);
    }

    // Seed Routes
    const routes = [
      {
        id: 'route-arch-sprint',
        title: 'THE ARCHITECTURE SPRINT',
        description: 'A high-energy walk through the historic architecture of OTR. Discover hidden gems and learn about the district\'s unique heritage.',
        durationMins: 45,
        price: 15.00,
        discountedPrice: 0,
        type: 'sponsored',
        partnerId: 'partner-kroger',
        guideId: 'guide-marcus',
        sponsorId: 'sponsor-kroger',
        endPartnerId: 'partner-allez',
        rewardText: 'Includes 1 Free Pastry',
        capacity: 20,
        remainingSpots: 3,
        startNodeId: 'ALPHA_PLAZA_HUB',
        stops: [
          { nodeId: 'ALPHA_PLAZA_HUB', name: 'Findlay Market Node', description: 'Meet at the north gate.' },
          { nodeId: 'partner-allez', name: 'Allez Bakery', description: 'End of the sprint and pastry pickup.' }
        ],
        imageUrl: 'https://picsum.photos/seed/arch/800/400'
      },
      {
        id: 'route-mural-expo',
        title: 'STREET ART EXPO WALK',
        description: 'A guided tour of the latest murals and street art installations in OTR. Meet the artists and learn about the stories behind the walls.',
        durationMins: 60,
        price: 20.00,
        discountedPrice: 0,
        type: 'sponsored',
        partnerId: 'partner-fotofocus',
        guideId: 'guide-sarah',
        sponsorId: 'sponsor-medpace',
        endPartnerId: 'partner-cac',
        rewardText: 'Includes Free Exhibition Entry',
        capacity: 15,
        remainingSpots: 5,
        startNodeId: 'ALPHA_PLAZA_HUB',
        stops: [
          { nodeId: 'ALPHA_PLAZA_HUB', name: 'Alpha Plaza Hub', description: 'Start at the main hub.' },
          { nodeId: 'partner-cac', name: 'Contemporary Arts Center', description: 'End at CAC for the exhibition.' }
        ],
        imageUrl: 'https://picsum.photos/seed/murals/800/400'
      },
      {
        id: 'route-brewery-walk',
        title: 'HISTORIC_BREWERY_WALK',
        description: 'A premium guided walk through the historic brewery district. Includes a tasting flight at Rhinegeist and a deep dive into the city\'s underground lagering tunnels.',
        durationMins: 90,
        price: 25.00,
        type: 'premium',
        partnerId: 'partner-rhinegeist',
        guideId: 'guide-marcus',
        capacity: 10,
        remainingSpots: 2,
        startNodeId: 'ALPHA_PLAZA_HUB',
        stops: [
          { nodeId: 'ALPHA_PLAZA_HUB', description: 'Start at Alpha Plaza' },
          { nodeId: 'partner-rhinegeist', description: 'Rhinegeist Taproom Tasting' }
        ],
        imageUrl: 'https://picsum.photos/seed/brewery/800/400'
      }
    ];

    for (const route of routes) {
      await setDoc(doc(db, 'routes', route.id), route);
      console.log(`ROUTE_INITIALIZED: ${route.id}`);
    }

    console.log("SEEDING_COMPLETE: SYSTEM_READY");
  } catch (err) {
    console.error("SEEDING_FAILURE:", err);
  }
};

// We'll export this and maybe call it from a button in the UI for demo purposes
export default seedData;

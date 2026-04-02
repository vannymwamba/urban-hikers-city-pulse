import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import Stripe from "stripe";
import { createCanvas, loadImage } from "canvas";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";
import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";
import cron from "node-cron";
import { runVisitCincyAgent } from "./agents/visitCincyAgent.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY) 
  : null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS for all origins and methods
  app.use(cors({
    origin: true, // Allow all origins
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
  }));

  // Explicitly handle OPTIONS preflight requests
  app.options('*', (req, res) => {
    res.sendStatus(200);
  });

  app.use(express.json());

  // Firebase initialization for server-side stats
  let db: any = null;
  try {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    
    // Load config to get database ID
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let databaseId = '(default)';
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      databaseId = config.firestoreDatabaseId || '(default)';
    }

    db = getFirestore(databaseId);
    console.log(`Firebase Admin SDK initialized successfully with DB: ${databaseId}`);
    
    // Test connection
    db.collection("nodes").limit(1).get()
      .then(() => console.log("Firebase Admin: Connection test SUCCESS"))
      .catch((err: any) => {
        console.error("Firebase Admin: Connection test FAILED", err);
        if (err.code === 7 || err.message?.includes('permission')) {
          console.warn("PERMISSION_DENIED: Attempting fallback to (default) database...");
          const fallbackDb = getFirestore('(default)');
          fallbackDb.collection("nodes").limit(1).get()
            .then(() => {
              console.log("Firebase Admin: Fallback (default) SUCCESS");
              db = fallbackDb;
            })
            .catch((fallbackErr: any) => console.error("Firebase Admin: Fallback (default) FAILED", fallbackErr));
        }
      });
  } catch (error) {
    console.error("Firebase Admin init error in server:", error);
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "URBAN HIKERS OS: ONLINE" });
  });

  app.get("/api/og", async (req, res) => {
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background (Urban Hikers Yellow)
    ctx.fillStyle = "#FFD700"; 
    ctx.fillRect(0, 0, width, height);

    // Fetch Tap Count
    let tapCount = 0;
    if (db) {
      try {
        const tapsSnapshot = await db.collection("taps").get();
        tapCount = tapsSnapshot.size;
      } catch (error) {
        console.error("Error fetching taps for OG:", error);
      }
    }

    // Draw stylized hiker figures (simple silhouettes)
    ctx.fillStyle = "#000000";
    const drawHiker = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y - 120, 40, 0, Math.PI * 2); // Head
      ctx.fill();
      ctx.fillRect(x - 20, y - 80, 40, 100); // Body
      ctx.fillRect(x - 40, y - 70, 20, 80); // Arm L
      ctx.fillRect(x + 20, y - 70, 20, 80); // Arm R
      ctx.fillRect(x - 20, y + 20, 15, 80); // Leg L
      ctx.fillRect(x + 5, y + 20, 15, 80); // Leg R
    };

    drawHiker(width / 2 - 250, height / 2 - 50);
    drawHiker(width / 2, height / 2 - 50);
    drawHiker(width / 2 + 250, height / 2 - 50);

    // Draw "URBAN HIKERS" text
    ctx.fillStyle = "#000000";
    ctx.font = "bold 100px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("URBAN HIKERS", width / 2, height / 2 + 150);

    // Draw Tap Count
    ctx.font = "bold 60px sans-serif";
    ctx.fillText(`PULSE: ${tapCount} TAPS`, width / 2, height / 2 + 250);

    res.setHeader("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);
  });

  // CHPL Library Ingestion Agent
  const syncLibraryEvents = async () => {
    if (!db) {
      console.error("Sync Error: Firebase DB not initialized");
      return { error: "Firebase DB not initialized" };
    }

    const CHPL_BRANCHES: Record<string, { lat: number, lng: number }> = {
      'Main Library': { lat: 39.1064, lng: -84.5125 },
      'Walnut Hills': { lat: 39.1287, lng: -84.4844 },
      'Corryville': { lat: 39.1333, lng: -84.5083 },
      'Northside': { lat: 39.1625, lng: -84.5375 },
      'Avondale': { lat: 39.1464, lng: -84.4925 },
      'Price Hill': { lat: 39.1089, lng: -84.5625 },
      'Westwood': { lat: 39.1467, lng: -84.5983 },
      'Hyde Park': { lat: 39.1414, lng: -84.4439 },
      'Oakley': { lat: 39.1539, lng: -84.4333 },
      'Pleasant Ridge': { lat: 39.1811, lng: -84.4267 },
      'Bond Hill': { lat: 39.1783, lng: -84.4683 },
      'Roselawn': { lat: 39.1911, lng: -84.4617 },
      'Hartwell': { lat: 39.2067, lng: -84.4750 },
      'College Hill': { lat: 39.2017, lng: -84.5450 },
      'Mt. Healthy': { lat: 39.2333, lng: -84.5500 },
      'Groesbeck': { lat: 39.2167, lng: -84.5917 },
      'Monfort Heights': { lat: 39.1833, lng: -84.6167 },
      'Cheviot': { lat: 39.1583, lng: -84.6133 },
      'Covedale': { lat: 39.1167, lng: -84.6083 },
      'Delhi Township': { lat: 39.0917, lng: -84.6167 },
      'Sayler Park': { lat: 39.1167, lng: -84.7000 },
      'Miami Township': { lat: 39.1667, lng: -84.7500 },
      'Harrison': { lat: 39.2667, lng: -84.8000 },
      'Green Township': { lat: 39.1583, lng: -84.6500 },
      'North Central': { lat: 39.2667, lng: -84.4500 },
      'Sharonville': { lat: 39.2667, lng: -84.4167 },
      'Blue Ash': { lat: 39.2333, lng: -84.3833 },
      'Deer Park': { lat: 39.2000, lng: -84.4000 },
      'Madeira': { lat: 39.1833, lng: -84.3667 },
      'Mariemont': { lat: 39.1417, lng: -84.3833 },
      'Anderson': { lat: 39.0667, lng: -84.3500 },
      'Mt. Washington': { lat: 39.0833, lng: -84.3833 },
      'Forest Park': { lat: 39.2500, lng: -84.5000 },
      'Greenhills': { lat: 39.2667, lng: -84.5167 },
      'Wyoming': { lat: 39.2250, lng: -84.4833 },
      'Reading': { lat: 39.2250, lng: -84.4417 },
      'St. Bernard': { lat: 39.1667, lng: -84.4917 },
      'Elmwood Place': { lat: 39.1833, lng: -84.4917 },
      'Norwood': { lat: 39.1583, lng: -84.4583 },
      'Madisonville': { lat: 39.1583, lng: -84.3917 },
      'Loveland': { lat: 39.2667, lng: -84.2500 },
      'Symmes Township': { lat: 39.2667, lng: -84.3167 },
    };

    const API_URL = 'https://cincinnatilibrary.bibliocommons.com/events/api/v1/events?limit=100';
    
    try {
      console.log(`Library Agent: Fetching events from ${API_URL}`);
      const response = await axios.get(API_URL, {
        headers: {
          'User-Agent': 'UrbanHikers/1.0 (https://www.urbanhikers.org)',
          'Accept': 'application/json'
        }
      });

      const events = response.data.events || [];
      console.log(`Library Agent: Received ${events.length} events from CHPL API`);
      
      const batch = db.batch();
      let count = 0;

      for (const evt of events) {
        if (!evt.id || !evt.title || !evt.start_datetime || !evt.end_datetime) continue;

        const branchName = evt.location?.name || 'Main Library';
        const coords = CHPL_BRANCHES[branchName] || CHPL_BRANCHES['Main Library'];
        const broadcastId = `chpl-${evt.id}`;
        const broadcastRef = db.collection("broadcasts").doc(broadcastId);
        
        const startsAt = new Date(evt.start_datetime);
        const expiresAt = new Date(evt.end_datetime);

        if (isNaN(startsAt.getTime()) || isNaN(expiresAt.getTime())) continue;
        if (expiresAt.getTime() < Date.now()) continue;

        batch.set(broadcastRef, {
          title: evt.title,
          description: evt.description || '',
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          current_vibe: 'chill',
          type: 'civic_free',
          partner_id: 'chpl',
          latitude: coords.lat,
          longitude: coords.lng,
          address: branchName,
          active: true,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        count++;
        if (count >= 500) break;
      }

      if (count > 0) {
        await batch.commit();
        console.log(`Library Agent: Ingest Success. ${count} events synced.`);
      }
      return { success: true, count };
    } catch (error) {
      console.error("Library Agent: Sync Error:", error);
      return { error: "Failed to sync library events", details: String(error) };
    }
  };

  // Creator Flash Node Ignite Endpoint
  app.post("/api/creator/ignite", async (req, res) => {
    const { nodeId, creatorName, performanceType, durationHours, tipUrl } = req.body;

    if (!nodeId || !creatorName || !performanceType || !durationHours) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!db) {
      return res.status(500).json({ error: "Database not initialized" });
    }

    try {
      // 1. Fetch Node Coordinates
      const nodeDoc = await db.collection("nodes").doc(nodeId).get();
      if (!nodeDoc.exists) {
        return res.status(404).json({ error: "Node not found" });
      }

      const nodeData = nodeDoc.data();
      const { latitude, longitude } = nodeData;

      // 2. Calculate Expiration
      const expiresAt = new Date(Date.now() + durationHours * 3600000).toISOString();

      // 3. Create Broadcast
      const broadcastData = {
        title: creatorName,
        type: "live_performance",
        performance_type: performanceType, // Extra metadata
        latitude,
        longitude,
        node_id: nodeId,
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        current_vibe: "chill",
        active: true,
        tip_url: tipUrl || null,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = await db.collection("broadcasts").add(broadcastData);
      
      console.log(`Creator Ignite: ${creatorName} at ${nodeId} for ${durationHours}h`);
      res.json({ success: true, id: docRef.id });
    } catch (error) {
      console.error("Creator Ignite Error:", error);
      res.status(500).json({ error: "Failed to ignite flash node", details: String(error) });
    }
  });

  // Manual trigger for library sync
  app.post("/api/admin/sync-library-events", async (req, res) => {
    const result = await syncLibraryEvents();
    if ('error' in result) {
      return res.status(500).json(result);
    }
    res.json(result);
  });

  // Visit Cincy Civic Ingestion Agent
  const syncCivicEvents = async () => {
    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsKey) {
      console.error("Sync Error: GOOGLE_MAPS_API_KEY not configured");
      return { error: "GOOGLE_MAPS_API_KEY not configured" };
    }

    if (!db) {
      console.error("Sync Error: Firebase DB not initialized");
      return { error: "Firebase DB not initialized" };
    }

    const mapsClient = new Client({});
    const batch = db.batch();

    try {
      console.log("Visit Cincy Agent: Starting autonomous sync...");
      
      const mockEvents = [
        {
          id: "vc-blink-01",
          title: "Blink Cincinnati Night 1",
          description: "The largest light, art, and projection mapping event in the nation.",
          address: "Washington Park, 1230 Elm St, Cincinnati, OH 45202",
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(), // 24h later
        },
        {
          id: "vc-findlay-01",
          title: "Findlay Market Spring Festival",
          description: "Celebrate the season with local vendors, food, and music.",
          address: "1801 Race St, Cincinnati, OH 45202",
          starts_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 172800000).toISOString(), // 48h later
        },
        {
          id: "vc-reds-01",
          title: "Reds Opening Day Parade",
          description: "The historic Findlay Market Opening Day Parade.",
          address: "Findlay Market, 1801 Race St, Cincinnati, OH 45202",
          starts_at: new Date(Date.now() + 86400000).toISOString(),
          expires_at: new Date(Date.now() + 100000000).toISOString(),
        }
      ];

      const results = [];

      for (const event of mockEvents) {
        // Step 3: Geocoding Engine
        console.log(`Visit Cincy Agent: Geocoding: ${event.address}`);
        const geoResponse = await mapsClient.geocode({
          params: {
            address: event.address,
            key: googleMapsKey,
          },
        });

        if (geoResponse.data.results.length > 0) {
          const { lat, lng } = geoResponse.data.results[0].geometry.location;

          // Step 4: Schema Mapping & Injection
          const broadcastRef = db.collection("broadcasts").doc(event.id);
          const broadcastData = {
            title: event.title.substring(0, 100),
            description: event.description,
            type: "civic_event",
            starts_at: event.starts_at,
            expires_at: event.expires_at,
            current_vibe: "chill",
            partner_id: "visit-cincy",
            latitude: lat,
            longitude: lng,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
          };

          batch.set(broadcastRef, broadcastData, { merge: true });
          results.push({ id: event.id, title: event.title, lat, lng });
        }
      }

      if (results.length > 0) {
        await batch.commit();
      }
      console.log(`Visit Cincy Agent: Sync Complete. Processed ${results.length} events.`);
      return { 
        status: "Sync Complete", 
        processed: results.length,
        events: results 
      };

    } catch (error) {
      console.error("Visit Cincy Agent: Sync Error:", error);
      return { error: "Failed to sync civic events", details: String(error) };
    }
  };

  // Manual trigger for admin
  app.post("/api/admin/sync-civic-events", async (req, res) => {
    const result = await syncCivicEvents();
    if ('error' in result) {
      return res.status(500).json(result);
    }
    res.json(result);
  });

  // Manual trigger for Visit Cincy sync
  app.post("/api/admin/sync/visit-cincy", async (req, res) => {
    try {
      const result = await runVisitCincyAgent();
      res.json(result);
    } catch (error) {
      console.error("Visit Cincy Agent: Sync Error:", error);
      res.status(500).json({ error: "Failed to sync Visit Cincy events", details: String(error) });
    }
  });

  // Step 1: Schedule: Run daily at 3:00 AM EST (0 3 * * *)
  // Note: Server time is UTC. 3:00 AM EST is 7:00 AM or 8:00 AM UTC.
  // We'll use the 'America/New_York' timezone if supported by node-cron, 
  // or calculate the UTC offset.
  cron.schedule('0 3 * * *', async () => {
    console.log("Visit Cincy Agent: Running scheduled 3:00 AM sync...");
    await syncCivicEvents();
  }, {
    timezone: "America/New_York"
  });

  // Library Agent Schedule: Run daily at 2:00 AM EST (0 2 * * *)
  cron.schedule('0 2 * * *', async () => {
    console.log("Library Agent: Running scheduled 2:00 AM sync...");
    await syncLibraryEvents();
  }, {
    timezone: "America/New_York"
  });

  // Visit Cincy Schedule: Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    console.log("Visit Cincy Agent: Running scheduled 6-hour sync...");
    await runVisitCincyAgent();
  }, {
    timezone: "America/New_York"
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const { routeId, sessionUuid, price, title } = req.body;
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: title,
                description: `Walking Tour: ${title}`,
              },
              unit_amount: Math.round(price * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        client_reference_id: sessionUuid,
        metadata: {
          routeId,
          sessionUuid,
        },
        success_url: `${appUrl}/tap/otr-alpha-01?sessionId=${sessionUuid}&status=success&routeId=${routeId}`,
        cancel_url: `${appUrl}/tap/otr-alpha-01?status=cancel`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Intercept index.html in dev to replace OG placeholder
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        
        const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
        const ogImageUrl = `${appUrl}/api/og`;
        template = template.replace(/__OG_IMAGE__/g, ogImageUrl);
        
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const ogImageUrl = `${appUrl}/api/og`;
      
      if (fs.existsSync(indexPath)) {
        let html = fs.readFileSync(indexPath, 'utf8');
        html = html.replace(/__OG_IMAGE__/g, ogImageUrl);
        res.send(html);
      } else {
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`URBAN HIKERS OS: LISTENING ON PORT ${PORT}`);
  });
}

startServer();

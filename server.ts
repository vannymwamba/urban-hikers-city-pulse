import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import Stripe from "stripe";
import { createCanvas, loadImage } from "canvas";
import { initializeApp } from "firebase/app";
import { getFirestore, serverTimestamp, collection, addDoc, getDocs, limit, query } from "firebase/firestore";
import dotenv from "dotenv";
import fs from "fs";
import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";
import cron from "node-cron";
import { runFixedCivicIngestion as runCivicIngestionEngine,
         runFixedLibraryIngestion as runLibraryIngestionAgent }
  from "./agents/agentDiagnostic.ts";
import { initializeScheduler } from "./src/cron/scheduler.ts";
import { createRateLimiter } from "./rateLimiter.ts";
import { createSponsorCheckoutRoute, handleSponsorWebhook } from "./src/services/onSponsorPaid.ts";

dotenv.config();

// In ESM, __dirname and __filename are not defined. We use process.cwd() as a reliable fallback
// since this server.ts is located in the project root.
const __dirname = process.cwd();

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY) 
  : null;

const igniteRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 5,
  message: 'Too many broadcasts from this IP. Please wait 60 seconds.',
});

async function startServer() {
  const app = express();
  const PORT = 3000;
  let db: any = null;

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

  // Stripe Webhook MUST go before express.json() to get the raw body
  app.post(
    '/api/stripe-webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      const sig = req.headers['stripe-signature'];
      let event;

      try {
        if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
          throw new Error('Stripe or Webhook Secret missing');
        }
        event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET);
      } catch (err: any) {
        console.error(`Webhook Verification Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        // Firebase might still be initializing, we'll check db existence inside or expect it's ready
        // since webhook happens well after startup
        if (db) {
          await handleSponsorWebhook(session, db);
        } else {
          console.error("[STRIPE] Firestore not initialized for webhook processing");
        }
      }

      res.json({ received: true });
    }
  );

  app.use(express.json());

    // Firebase initialization for server-side stats
    try {
      // Load config from file if possible
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      let firebaseConfig: any = {};
      if (fs.existsSync(configPath)) {
        firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }

      const projectId = firebaseConfig.projectId || "gen-lang-client-0752567409";
      const databaseId = firebaseConfig.firestoreDatabaseId || 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';

            const app = initializeApp(firebaseConfig);
      db = getFirestore(app, databaseId);
      
      // Quick test to verify connectivity and permissions
      try {
        const testSnapshot = await getDocs(query(collection(db, 'nodes'), limit(1)));
        console.log(`[FIREBASE] Admin connectivity verified for DB: ${databaseId}. Found ${testSnapshot.size} nodes.`);
      } catch (testError: any) {
        console.error(`[FIREBASE] Connection test failed for DB ${databaseId}:`, testError);
        console.warn("[FIREBASE] HINT: If PERMISSION_DENIED, ensure the database exists and the service account has access.");
      }
    } catch (error) {
      console.error("Firebase Admin init error in server:", error);
    }

  // Geocoding Proxy
  app.get("/api/geocode", async (req, res) => {
    const { address } = req.query;
    if (!address) return res.status(400).json({ error: "Address is required" });

    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsKey) return res.status(500).json({ error: "Google Maps API Key not configured" });

    try {
      const mapsClient = new Client({});
      const geoResponse = await mapsClient.geocode({
        params: {
          address: address as string,
          key: googleMapsKey,
        },
      });

      if (geoResponse.data.results.length > 0) {
        const loc = geoResponse.data.results[0].geometry.location;
        res.json({
          lat: loc.lat,
          lon: loc.lng,
          display_name: geoResponse.data.results[0].formatted_address
        });
      } else {
        res.status(404).json({ error: "Address not found" });
      }
    } catch (error) {
      console.error("Geocoding API Error:", error);
      res.status(500).json({ error: "Geocoding failed", details: String(error) });
    }
  });

  // Places Autocomplete Proxy
  app.get("/api/autocomplete", async (req, res) => {
    const { input } = req.query;
    if (!input) return res.status(400).json({ error: "Input is required" });

    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsKey) return res.status(500).json({ error: "Google Maps API Key not configured" });

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        params: {
          input: input as string,
          key: googleMapsKey,
          components: 'country:us',
          location: '39.1031,-84.5120',
          radius: 50000
        }
      });

      if (response.data.status === 'OK') {
        res.json(response.data.predictions.map((p: any) => ({
          description: p.description,
          place_id: p.place_id
        })));
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error("Autocomplete API Error:", error);
      res.status(500).json({ error: "Autocomplete failed" });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "URBAN HIKERS OS: ONLINE" });
  });

  app.get("/api/og", async (req, res) => {
    const { broadcastId, nodeId, title: qTitle, venue: qVenue } = req.query;
    
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    let title = (qTitle as string) || "LOCAL PULSE";
    let venue = (qVenue as string) || "OVER-THE-RHINE";
    let coverUrl = null;
    let type = "SYSTEM_SIGNAL";
    let vibe = "chill";

    // Fetch live data if IDs are provided
    if (broadcastId && db) {
      try {
        const doc = await db.collection("broadcasts").doc(broadcastId as string).get();
        if (doc.exists) {
          const data = doc.data();
          title = data.title || title;
          venue = data.venue || data.address || venue;
          coverUrl = data.cover_url || data.imageUrl || null;
          type = (data.type || "EVENT").toUpperCase();
          vibe = data.current_vibe || "chill";
        }
      } catch (err) {
        console.error("OG Data Fetch Error:", err);
      }
    } else if (nodeId && db) {
      try {
        const doc = await db.collection("nodes").doc(nodeId as string).get();
        if (doc.exists) {
          venue = doc.data().name || venue;
        }
      } catch (err) {}
    }

    // Background (Urban Hikers Black)
    ctx.fillStyle = "#0a0a0a"; 
    ctx.fillRect(0, 0, width, height);

    // If cover URL exists, draw it as background
    if (coverUrl) {
      try {
        const bgImg = await loadImage(coverUrl);
        
        // Center crop cover
        const imgAspect = bgImg.width / bgImg.height;
        const canvasAspect = width / height;
        let drawWidth, drawHeight, offsetX, offsetY;

        if (imgAspect > canvasAspect) {
          drawHeight = height;
          drawWidth = height * imgAspect;
          offsetX = (width - drawWidth) / 2;
          offsetY = 0;
        } else {
          drawWidth = width;
          drawHeight = width / imgAspect;
          offsetX = 0;
          offsetY = (height - drawHeight) / 2;
        }

        ctx.globalAlpha = 0.4; // Fade out background to make text readable
        ctx.drawImage(bgImg, offsetX, offsetY, drawWidth, drawHeight);
        ctx.globalAlpha = 1.0;
        
        // Add a dark overlay gradient to ensure text readability
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(10,10,10,0.95)');
        gradient.addColorStop(0.4, 'rgba(10,10,10,0.7)');
        gradient.addColorStop(1, 'rgba(10,10,10,0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      } catch (err) {
        console.error("OG Image BG Load Error:", err);
      }
    }

    // Draw Grid (Subtle)
    ctx.strokeStyle = "#FFE01A";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.08;
    for (let x = 0; x <= width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;

    // Draw Pulse Rings (Centered at 420, 315)
    const centerX = 420;
    const centerY = 315;
    
    ctx.strokeStyle = "#FFE01A";
    
    // Ring 4
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(centerX, centerY, 258, 0, Math.PI * 2); ctx.stroke();
    // Ring 3
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(centerX, centerY, 200, 0, Math.PI * 2); ctx.stroke();
    // Ring 2
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(centerX, centerY, 145, 0, Math.PI * 2); ctx.stroke();
    // Ring 1
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(centerX, centerY, 90, 0, Math.PI * 2); ctx.stroke();
    
    // Center Node
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = "#FFE01A";
    ctx.beginPath(); ctx.arc(centerX, centerY, 70, 0, Math.PI * 2); ctx.fill();

    // Draw NFC Arcs (Simplified for canvas)
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    // Focal dot
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath(); ctx.arc(centerX - 18, centerY, 5.5, 0, Math.PI * 2); ctx.fill();
    // Arcs
    const drawArc = (radius: number, span: number) => {
      ctx.beginPath();
      ctx.arc(centerX - 18, centerY, radius, -span, span);
      ctx.stroke();
    };
    drawArc(15, 0.8);
    drawArc(28, 0.85);
    drawArc(42, 0.9);
    drawArc(56, 1.0);

    // Specific Content Text
    ctx.textAlign = "left";
    
    // Type Tag
    ctx.fillStyle = "#FFE01A";
    ctx.globalAlpha = 0.9;
    ctx.font = "bold 18px monospace";
    ctx.fillText(type, 682, 190);
    ctx.globalAlpha = 1.0;

    // Pulse Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 56px sans-serif";
    const displayTitle = title.length > 25 ? title.substring(0, 22) + "..." : title;
    ctx.fillText(displayTitle.toUpperCase(), 680, 260);
    
    // Venue/Location
    ctx.fillStyle = "#FFE01A";
    ctx.font = "bold 32px sans-serif";
    const displayVenue = venue.length > 35 ? venue.substring(0, 32) + "..." : venue;
    ctx.fillText(displayVenue.toUpperCase(), 680, 315);

    // Brand Footnote
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.35;
    ctx.font = "14px monospace";
    ctx.fillText("URBAN HIKERS // LOCAL_PULSE_OS", 682, 380);
    ctx.globalAlpha = 1.0;
    
    ctx.fillStyle = "#888";
    ctx.font = "12px monospace";
    ctx.fillText("TAP THE CITY. FEEL WHAT'S NOW.", 682, 405);
    
    ctx.fillStyle = "#FFE01A";
    ctx.globalAlpha = 0.5;
    ctx.font = "11px monospace";
    ctx.fillText("BY_URBAN_HIKERS_CREATIVE_LAB", 682, 460);

    // Scanning label
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#141414";
    ctx.fillRect(680, 485, 220, 32);
    ctx.fillStyle = "#FFE01A";
    ctx.beginPath(); ctx.arc(698, 501, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#999";
    ctx.font = "9px monospace";
    ctx.fillText("LIVE_SIGNAL_DETECTED_", 710, 505);
    ctx.fillStyle = "#FFE01A";
    ctx.fillText("OK", 870, 505);

    ctx.globalAlpha = 0.15;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "9px monospace";
    ctx.fillText("SYSTEM_VERSION_4.2.0 // Cincinnati_HQ // DATA_ENCRYPTED", 600, 610);

    res.setHeader("Content-Type", "image/png");
    canvas.createPNGStream().pipe(res);
  });

  // Handle specific asset requests for scrapers if file is missing in public
  app.get("/og-pulse-v2.png", (req, res) => {
    const pngPath = path.join(process.cwd(), 'public', 'og-pulse-v2.png');
    if (fs.existsSync(pngPath)) {
      return res.sendFile(pngPath);
    }
    // Fallback: Redirect to the generator
    res.redirect("/api/og");
  });

  // Creator Flash Node Ignite Endpoint
  app.post("/api/creator/ignite", igniteRateLimiter, async (req, res) => {
    const { 
      nodeId, 
      creatorName, 
      performanceType, 
      durationHours, 
      tipUrl, 
      address, 
      latitude, 
      longitude,
      scope,
      cover_url,
      payment_type,
      price,
      walk_details
    } = req.body;

    // Validation: Must have a name, type, duration AND some form of location
    const hasLocation = nodeId || (latitude !== undefined && longitude !== undefined) || address;
    
    if (!creatorName || !performanceType || !durationHours || !hasLocation) {
      console.warn("Creator Ignite: Missing required fields", { creatorName, performanceType, durationHours, hasLocation });
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!db) {
      console.error("Creator Ignite: Database not initialized");
      return res.status(500).json({ error: "Database not initialized" });
    }

    try {
      const parseCoord = (val: any) => {
        if (val === undefined || val === null || val === '') return undefined;
        const parsed = parseFloat(val);
        return isNaN(parsed) ? undefined : parsed;
      };

      let finalLat = parseCoord(latitude);
      let finalLng = parseCoord(longitude);
      let finalAddress = address;

      console.log(`Creator Ignite: Processing request for ${creatorName}`, { nodeId, performanceType, durationHours });

      // 1. Resolve Coordinates
      if (nodeId) {
        let nodeDoc = await db.collection("nodes").doc(nodeId).get();
        
        // Casing and Name Fallback: Try lowercase, uppercase, and specific common HUB names
        if (!nodeDoc.exists) {
          nodeDoc = await db.collection("nodes").doc(nodeId.toLowerCase()).get();
          if (!nodeDoc.exists) {
            nodeDoc = await db.collection("nodes").doc(nodeId.toUpperCase()).get();
          }
        }

        // If still not found by ID, try searching by name field
        if (!nodeDoc.exists) {
          const nameQuery = await db.collection("nodes").where("name", "==", nodeId).limit(1).get();
          if (!nameQuery.empty) {
            nodeDoc = nameQuery.docs[0];
            console.log(`Creator Ignite: Found node by name field mapping for: ${nodeId}`);
          }
        }

        // Specific Hard-Mapping for the Alpha Plaza Hub if requested by its canonical name
        if (!nodeDoc.exists && (nodeId === 'ALPHA_PLAZA_HUB' || nodeId === 'ALPHA_PLAZA')) {
          const alphaQuery = await db.collection("nodes").where("name", "==", "ALPHA_PLAZA_HUB").limit(1).get();
          if (!alphaQuery.empty) {
            nodeDoc = alphaQuery.docs[0];
            console.log(`Creator Ignite: Found Alpha Plaza Hub via hard-mapping filter`);
          }
        }

        if (nodeDoc.exists) {
          const nodeData = nodeDoc.data();
          finalLat = nodeData.latitude;
          finalLng = nodeData.longitude;
          finalAddress = nodeData.name;
          console.log(`Creator Ignite: Resolved node ${nodeId} to ${finalLat}, ${finalLng}`);
        } else {
          console.warn(`Creator Ignite: Node ${nodeId} not found in database`);
        }
      } else if (address && (finalLat === undefined || finalLng === undefined)) {
        // Geocode address if coordinates not provided
        const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
        if (googleMapsKey) {
          console.log(`Creator Ignite: Geocoding address ${address}`);
          const mapsClient = new Client({});
          const geoResponse = await mapsClient.geocode({
            params: {
              address: address,
              key: googleMapsKey,
            },
          });
          if (geoResponse.data.results.length > 0) {
            const loc = geoResponse.data.results[0].geometry.location;
            finalLat = loc.lat;
            finalLng = loc.lng;
            console.log(`Creator Ignite: Geocoded ${address} to ${finalLat}, ${finalLng}`);
          }
        }
      }

      if (finalLat === undefined || finalLng === undefined) {
        console.warn("Creator Ignite: Location resolution failed", { finalLat, finalLng });
        return res.status(400).json({ error: "LOCATION_RESOLUTION_FAILED: Could not determine coordinates." });
      }

      // 2. Calculate Expiration
      const duration = parseFloat(durationHours) || 1;
      const expiresAt = new Date(Date.now() + duration * 3600000).toISOString();

      // 3. Create Broadcast
      const broadcastData: any = {
        title: creatorName,
        type: performanceType,
        performance_type: performanceType,
        latitude: finalLat,
        longitude: finalLng,
        address: finalAddress || "MOBILE_LOCATION",
        node_id: nodeId || null,
        starts_at: new Date().toISOString(),
        expires_at: expiresAt,
        current_vibe: "chill",
        active: true,
        tip_url: tipUrl || null,
        cover_url: cover_url || null,
        scope: scope || 'single_hub',
        payment_type: payment_type || 'free',
        price: parseFloat(price) || 0,
        created_at: serverTimestamp(),
      };

      if (performanceType === 'walking_event' && walk_details) {
        broadcastData.spots_remaining = parseInt(walk_details.capacity) || 20;
        broadcastData.max_capacity = parseInt(walk_details.capacity) || 20;
        broadcastData.departure_time = walk_details.departureTime;
        broadcastData.meeting_point = walk_details.meetingPoint;
        broadcastData.guide_name = walk_details.guideName;
      }

      console.log("Creator Ignite: Writing to Firestore", broadcastData);
      const docRef = await db.collection("broadcasts").add(broadcastData);
      
      console.log(`Creator Ignite SUCCESS: ${creatorName} (ID: ${docRef.id})`);
      res.json({ success: true, id: docRef.id });
    } catch (error) {
      console.error("Creator Ignite Error:", error);
      res.status(500).json({ 
        error: "Failed to ignite flash node", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Library Ingestion Agent Manual Sync
  app.post("/api/admin/sync-library-events", async (req, res) => {
    try {
      const result = await runLibraryIngestionAgent();
      res.json(result);
    } catch (error) {
      console.error("Library sync error:", error);
      res.status(500).json({ error: "Failed to sync", details: String(error) });
    }
  });

  // Civic Ingestion Agent Manual Sync
  app.post("/api/admin/sync-civic-events", async (req, res) => {
    try {
      const result = await runCivicIngestionEngine();
      res.json(result);
    } catch (error) {
      console.error("Civic sync error:", error);
      res.status(500).json({ error: "Failed to sync", details: String(error) });
    }
  });

  app.get('/api/admin/agent-health', async (req, res) => {
    try {
      const libraryResult = await runLibraryIngestionAgent();
      const civicResult = await runCivicIngestionEngine();
      res.json({
        library: libraryResult,
        civic: civicResult,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Agent Health Check Error:", error);
      res.status(500).json({ 
        error: "Failed to run health check", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Manual Trigger: All Ingestion Sync
  app.post('/api/admin/sync/all', async (req, res) => {
    try {
      console.log('AGENT: Manual sync triggered');
      const result = await runCivicIngestionEngine();
      res.json({
        success: true,
        message: 'Sync complete',
        ...result
      });
    } catch (err) {
      console.error('AGENT: Manual sync failed', err);
      res.status(500).json({ success: false, error: String(err) });
    }
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    const { type, amount, payload, broadcastId, title, price } = req.body;
    const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;

    try {
      let lineItems = [];
      let metadata: any = { type };

      if (type === 'broadcast_all') {
        lineItems = [{
          price_data: {
            currency: "usd",
            product_data: {
              name: "Broadcast to All Nodes",
              description: `Creator Broadcast: ${payload.creatorName}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        }];
        metadata.payload = JSON.stringify(payload);
      } else if (type === 'walking_event_booking') {
        lineItems = [{
          price_data: {
            currency: "usd",
            product_data: {
              name: `Booking: ${title}`,
              description: "Walking Event Spot",
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        }];
        metadata.broadcastId = broadcastId;
      } else if (type === 'walking_event_setup') {
        // Setup might be free or have a fee, for now let's assume it's a placeholder for creator setup
        // If it's free, we might not even need Stripe, but let's handle it if amount > 0
        if (amount > 0) {
          lineItems = [{
            price_data: {
              currency: "usd",
              product_data: {
                name: "Walking Event Setup Fee",
                description: payload.walk_details.title,
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          }];
          metadata.payload = JSON.stringify(payload);
        } else {
          // If free, just ignite directly (though the client should have handled this)
          return res.status(400).json({ error: "Free setup should use ignite endpoint" });
        }
      } else {
        // Fallback for existing route payment logic if any
        const { routeId, sessionUuid } = req.body;
        lineItems = [{
          price_data: {
            currency: "usd",
            product_data: {
              name: title || "Walking Tour",
              description: `Walking Tour: ${title}`,
            },
            unit_amount: Math.round((price || amount) * 100),
          },
          quantity: 1,
        }];
        metadata.routeId = routeId;
        metadata.sessionUuid = sessionUuid;
      }

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        metadata,
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/tap/otr-alpha-01?status=cancel`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/create-sponsor-checkout', createSponsorCheckoutRoute);

  app.get("/api/checkout/session/:sessionId", async (req, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe not configured" });
    try {
      const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/checkout/finalize", async (req, res) => {
    const { sessionId } = req.body;
    if (!stripe || !db) return res.status(500).json({ error: "System not ready" });

    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      const { type, payload: payloadStr, broadcastId } = session.metadata || {};

      if (type === 'broadcast_all' || type === 'walking_event_setup') {
        const payload = JSON.parse(payloadStr || '{}');
        const expiresAt = new Date(Date.now() + payload.durationHours * 3600000).toISOString();
        
        const broadcastData: any = {
          title: payload.creatorName,
          type: payload.performanceType,
          performance_type: payload.performanceType,
          latitude: payload.latitude,
          longitude: payload.longitude,
          address: payload.address || "MOBILE_LOCATION",
          node_id: payload.nodeId || null,
          starts_at: new Date().toISOString(),
          expires_at: expiresAt,
          current_vibe: "chill",
          active: true,
          tip_url: payload.tipUrl || null,
          cover_url: payload.cover_url || null,
          scope: payload.scope || 'single_hub',
          payment_type: payload.payment_type || 'free',
          price: payload.price || 0,
          created_at: serverTimestamp(),
          stripe_session_id: sessionId
        };

        if (payload.performanceType === 'walking_event' && payload.walk_details) {
          broadcastData.spots_remaining = parseInt(payload.walk_details.capacity) || 20;
          broadcastData.max_capacity = parseInt(payload.walk_details.capacity) || 20;
          broadcastData.departure_time = payload.walk_details.departureTime;
          broadcastData.meeting_point = payload.walk_details.meetingPoint;
          broadcastData.guide_name = payload.walk_details.guideName;
        }

        const docRef = await db.collection("broadcasts").add(broadcastData);
        return res.json({ success: true, type: 'broadcast', id: docRef.id });
      } else if (type === 'walking_event_booking') {
        // Decrement spots
        const broadcastRef = db.collection("broadcasts").doc(broadcastId);
        await db.runTransaction(async (transaction: any) => {
          const doc = await transaction.get(broadcastRef);
          if (!doc.exists) throw new Error("Broadcast not found");
          const data = doc.data();
          if (data.spots_remaining <= 0) throw new Error("No spots left");
          transaction.update(broadcastRef, {
            spots_remaining: data.spots_remaining - 1
          });
          
          // Create booking record
          const bookingRef = db.collection("bookings").doc();
          transaction.set(bookingRef, {
            broadcastId,
            status: 'confirmed',
            paid_amount: session.amount_total / 100,
            created_at: serverTimestamp(),
            stripe_session_id: sessionId
          });
        });
        return res.json({ success: true, type: 'booking' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Finalize error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Shared metadata logic
  const getDynamicMetadata = async (req: any) => {
    // Determine the base URL dynamically or from ENV
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['host'];
    
    // Fallback order: ENV -> Request Host -> Constants
    const appUrl = process.env.APP_URL || (host ? `${protocol}://${host}` : "https://app.localpulses.com");
    
    const ogUrl = `${appUrl}${req.originalUrl}`;
    let ogTitle = "Local Pulse — Map the City";
    let ogDesc = "Urban Hikers — Tap the city. Feel what's happening now.";
    let ogImageUrl = `${appUrl}/api/og`;

    const parsedUrl = new URL(req.originalUrl, appUrl);
    const pathParts = req.originalUrl.split('/');
    const isTapRoute = pathParts.includes('tap');
    const isSignalRoute = pathParts.includes('signal');
    
    const nId = isTapRoute ? pathParts[pathParts.indexOf('tap') + 1]?.split('?')[0] : null;
    const sId = isSignalRoute ? pathParts[pathParts.indexOf('signal') + 1]?.split('?')[0] : null;
    const bId = parsedUrl.searchParams.get('broadcastId') || sId;

    if (bId && db) {
      ogImageUrl += `?broadcastId=${bId}`;
      try {
        const doc = await db.collection("broadcasts").doc(bId).get();
        if (doc.exists) {
          const data = doc.data();
          ogTitle = `${data.title} @ ${data.venue || data.address || 'Cincinnati'}`;
          ogDesc = data.description ? data.description.substring(0, 160) : (data.offer ? `Live Deal: ${data.offer}` : ogDesc);
          if (ogDesc.length > 160) ogDesc = ogDesc.substring(0, 157) + "...";
        }
      } catch (err) {
        console.error("Metadata Fetch Error:", err);
      }
    } else if (nId && nId !== 'tap' && db) {
      ogImageUrl += `?nodeId=${nId}`;
      try {
        const doc = await db.collection("nodes").doc(nId).get();
        if (doc.exists) {
          const data = doc.data();
          ogTitle = `${data.name} | Local Pulse Hub`;
          ogDesc = `Real-time signals and vibe checks live now at ${data.name}.`;
        }
      } catch (err) {}
    }

    return { ogUrl, ogTitle, ogDesc, ogImageUrl };
  };

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
      
      // Skip catch-all for static assets, scripts, and API routes
      if (url.includes('.') || url.startsWith('/api')) {
        return next();
      }

      try {
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        
        const meta = await getDynamicMetadata(req);
        
        template = template.replace(/__OG_IMAGE__/g, meta.ogImageUrl);
        template = template.replace(/__OG_TITLE__/g, meta.ogTitle);
        template = template.replace(/__OG_DESCRIPTION__/g, meta.ogDesc);
        template = template.replace(/__OG_URL__/g, meta.ogUrl);
        
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', async (req, res, next) => {
      // Skip for static assets or API nodes
      if (req.originalUrl.includes('.') || req.originalUrl.startsWith('/api')) {
        return next();
      }

      const distPath = path.join(process.cwd(), 'dist');
      const indexPath = path.join(distPath, 'index.html');
      
      if (fs.existsSync(indexPath)) {
        const meta = await getDynamicMetadata(req);
        let html = fs.readFileSync(indexPath, 'utf8');
        
        html = html.replace(/__OG_IMAGE__/g, meta.ogImageUrl);
        html = html.replace(/__OG_TITLE__/g, meta.ogTitle);
        html = html.replace(/__OG_DESCRIPTION__/g, meta.ogDesc);
        html = html.replace(/__OG_URL__/g, meta.ogUrl);
        
        res.send(html);
      } else {
        res.sendFile(indexPath);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`URBAN HIKERS OS: LISTENING ON PORT ${PORT}`);
    initializeScheduler();
  });
}

startServer();

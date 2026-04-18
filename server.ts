import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import Stripe from "stripe";
import { createCanvas, loadImage } from "canvas";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";
import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";
import cron from "node-cron";
import { runCivicIngestionEngine } from "./agents/visitCincyAgent.ts";
import { runLibraryIngestionAgent } from "./agents/libraryAgent.ts";
import { initializeScheduler } from "./src/cron/scheduler.ts";

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
    // Load config to get database ID and project ID
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let databaseId = '(default)';
    let projectId = process.env.FIREBASE_PROJECT_ID;

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (!databaseId || databaseId === '(default)') {
        databaseId = config.firestoreDatabaseId || '(default)';
      }
      if (!projectId) {
        projectId = config.projectId;
      }
    }

    if (!admin.apps.length) {
      console.log(`Initializing Firebase Admin for Project: ${projectId}`);
      admin.initializeApp({
        projectId: projectId
      });
    }

    // Using specific database ID as requested to match data location
    db = getFirestore(databaseId);
    console.log(`Firebase Admin SDK initialized successfully with DB: ${databaseId}`);
    
    // We remove the async fallback loop to ensure the server remains locked 
    // to the correct tactical database instance.
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

  // Creator Flash Node Ignite Endpoint
  app.post("/api/creator/ignite", async (req, res) => {
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
        
        // Casing Fallback: Try lowercase and uppercase if the raw ID fails
        if (!nodeDoc.exists) {
          nodeDoc = await db.collection("nodes").doc(nodeId.toLowerCase()).get();
          if (!nodeDoc.exists) {
            nodeDoc = await db.collection("nodes").doc(nodeId.toUpperCase()).get();
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
        created_at: FieldValue.serverTimestamp(),
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
  app.post("/api/admin/agents/library-sync", async (req, res) => {
    try {
      console.log("Admin: Triggering Library Ingestion Agent...");
      const result = await runLibraryIngestionAgent();
      res.json(result);
    } catch (error) {
      console.error("Library Ingestion Agent: Sync Error:", error);
      res.status(500).json({ error: "Failed to sync Library events", details: String(error) });
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
          created_at: FieldValue.serverTimestamp(),
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
            created_at: FieldValue.serverTimestamp(),
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
    app.get('*', (req, res, next) => {
      // Skip for static assets or API nodes
      if (req.originalUrl.includes('.') || req.originalUrl.startsWith('/api')) {
        return next();
      }

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
    initializeScheduler();
  });
}

startServer();

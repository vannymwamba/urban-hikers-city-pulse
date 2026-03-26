import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import Stripe from "stripe";
import { createCanvas, loadImage } from "canvas";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, writeBatch, doc } from "firebase/firestore";
import dotenv from "dotenv";
import fs from "fs";
import { Client } from "@googlemaps/google-maps-services-js";
import axios from "axios";
import cron from "node-cron";

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
    const firebaseConfig = {
      apiKey: "AIzaSyCX-Zg48Ej5o62PvXGa3Eq5PWZKtOi9ETo",
      authDomain: "gen-lang-client-0404340863.firebaseapp.com",
      projectId: "gen-lang-client-0404340863",
      storageBucket: "gen-lang-client-0404340863.firebasestorage.app",
    };
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp, "ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a");
  } catch (error) {
    console.error("Firebase init error in server:", error);
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
        const tapsSnapshot = await getDocs(collection(db, "taps"));
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
    const batch = writeBatch(db);

    try {
      console.log("Visit Cincy Agent: Starting autonomous sync...");
      
      // Step 1: Fetch from Visit Cincy (Simulating Simpleview API call)
      // In a real scenario, we'd use the actual Simpleview endpoint:
      // https://www.visitcincy.com/includes/rest/v1/events/
      // For this implementation, we'll fetch a sample or mock the response
      // to ensure the schema mapping and geocoding logic is solid.
      
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
          const broadcastRef = doc(collection(db, "broadcasts"), event.id);
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
            created_at: new Date().toISOString(),
          };

          batch.set(broadcastRef, broadcastData);
          results.push({ id: event.id, title: event.title, lat, lng });
        }
      }

      await batch.commit();
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

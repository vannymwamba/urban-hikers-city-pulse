import cron from 'node-cron';
import { runLibraryIngestionAgent } from '../../agents/libraryAgent.ts';
import { runCivicIngestionEngine } from '../../agents/visitCincyAgent.ts';

/**
 * Urban Hikers: Centralized Cron Scheduler
 */
export function initializeScheduler() {
  console.log("URBAN HIKERS SCHEDULER: INITIALIZING_PROTOCOLS...");

  // 1. Library Agent: Sync daily at 6:00 AM EST
  // Cron: '0 6 * * *'
  cron.schedule('0 6 * * *', async () => {
    console.log("SCHEDULER: RUNNING_LIBRARY_INGESTION_6AM...");
    try {
      const result = await runLibraryIngestionAgent();
      console.log("SCHEDULER: LIBRARY_INGESTION_COMPLETE", result);
    } catch (error) {
      console.error("SCHEDULER: LIBRARY_INGESTION_FAILED", error);
    }
  }, {
    timezone: "America/New_York"
  });

  // 2. Civic Ingestion Engine (Visit Cincy): Run daily at 3:00 AM EST
  cron.schedule('0 3 * * *', async () => {
    console.log("SCHEDULER: RUNNING_CIVIC_INGESTION_3AM...");
    await runCivicIngestionEngine();
  }, {
    timezone: "America/New_York"
  });

  // 3. Civic Ingestion Engine: Run every 6 hours for high-frequency updates
  cron.schedule('0 */6 * * *', async () => {
    console.log("SCHEDULER: RUNNING_CIVIC_INGESTION_6HR...");
    await runCivicIngestionEngine();
  }, {
    timezone: "America/New_York"
  });

  console.log("URBAN HIKERS SCHEDULER: PROTOCOLS_LOCKED_AND_LOADED");
}

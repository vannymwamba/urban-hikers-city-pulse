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

  // 2. Civic Ingestion Engine: Run at specific intervals
  // RUN 1: Every morning at 6AM (timezone: America/New_York)
  cron.schedule('0 6 * * *', async () => {
    console.log("AGENT: Morning sync — 6:00 AM");
    try {
      const result = await runCivicIngestionEngine();
      console.log("AGENT: Morning sync complete", result);
    } catch (error) {
      console.error("AGENT: Morning sync failed", error);
    }
  }, {
    timezone: "America/New_York"
  });

  // RUN 2: Every afternoon at 1PM
  cron.schedule('0 13 * * *', async () => {
    console.log("AGENT: Afternoon sync — 1:00 PM");
    try {
      await runCivicIngestionEngine();
      console.log("AGENT: Afternoon sync complete");
    } catch (error) {
      console.error("AGENT: Afternoon sync failed", error);
    }
  }, {
    timezone: "America/New_York"
  });

  // RUN 3: Every Sunday at 8AM (Weekly refresh)
  cron.schedule('0 8 * * 0', async () => {
    console.log("AGENT: Weekly full refresh — Sunday 8AM");
    try {
      await runCivicIngestionEngine();
      console.log("AGENT: Weekly refresh complete");
    } catch (error) {
      console.error("AGENT: Weekly refresh failed", error);
    }
  }, {
    timezone: "America/New_York"
  });

  console.log("URBAN HIKERS SCHEDULER: PROTOCOLS_LOCKED_AND_LOADED");
}

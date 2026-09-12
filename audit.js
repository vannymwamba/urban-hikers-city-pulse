#!/usr/bin/env node
/**
 * Local Pulse OS - Firestore Security & User Role Audit Script
 * Target Project: gen-lang-client-0752567409
 * Named Database: ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a
 * 
 * Usage:
 *   node audit.js
 * 
 * If Cloud Shell fails with "Cannot create property 'refresh_token' on string ''",
 * run one of the following alternatives:
 * 
 *   Alternative A (Recommended): Refresh Application Default Credentials:
 *     gcloud auth application-default login
 * 
 *   Alternative B: Run using an active gcloud access token:
 *     ACCESS_TOKEN=$(gcloud auth print-access-token) node audit.js
 * 
 *   Alternative C: Use a dedicated Service Account key file:
 *     export GOOGLE_APPLICATION_CREDENTIALS="path/to/sa-key.json"
 *     node audit.js
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'gen-lang-client-0752567409';
const DATABASE_ID = 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';

async function runAudit() {
  console.log('====================================================');
  console.log('  Local Pulse OS - Firestore Audit Report');
  console.log(`  Project:  ${PROJECT_ID}`);
  console.log(`  Database: ${DATABASE_ID}`);
  console.log('====================================================\n');

  let app;
  try {
    const appOptions = { projectId: PROJECT_ID };
    
    // Bypass Cloud Shell ambient credential issues if ACCESS_TOKEN is supplied
    if (process.env.ACCESS_TOKEN) {
      appOptions.credential = {
        getAccessToken: () => Promise.resolve({
          access_token: process.env.ACCESS_TOKEN,
          expires_in: 3600
        })
      };
    }
    
    app = initializeApp(appOptions);
  } catch (initErr) {
    console.error('Failed to initialize Firebase Admin App:', initErr.message);
    process.exit(1);
  }

  const db = getFirestore(app, DATABASE_ID);

  try {
    // 1. Elevated User Roles
    console.log('1. USERS WITH ELEVATED ROLES');
    console.log('----------------------------------------------------');
    const elevatedRoles = ['admin', 'super_admin', 'partner', 'partner_admin', 'partner_content_editor'];
    const elevatedUsersSnap = await db.collection('users')
      .where('role', 'in', elevatedRoles)
      .get();

    if (elevatedUsersSnap.empty) {
      console.log('  No users found with elevated roles in users collection.\n');
    } else {
      elevatedUsersSnap.forEach((doc) => {
        const data = doc.data();
        const email = data.email || '(anon)';
        const role = data.role || '(none)';
        console.log(`  - Doc ID: ${doc.id}`);
        console.log(`    Role:   ${role}`);
        console.log(`    Email:  ${email}`);
        if (data.partnerId || data.partner_id) {
          console.log(`    Partner: ${data.partnerId || data.partner_id}`);
        }
      });
      console.log(`  Total elevated users: ${elevatedUsersSnap.size}\n`);
    }

    // 2. Users carrying partnerId or partner_id (via .orderBy key existence filter)
    console.log('2. USERS CARRYING PARTNER ATTRIBUTES (.orderBy existence check)');
    console.log('----------------------------------------------------');
    const partnerDocsMap = new Map();

    try {
      const snapCamel = await db.collection('users').orderBy('partnerId').get();
      snapCamel.forEach(doc => partnerDocsMap.set(doc.id, doc));
    } catch (e) {
      console.warn('  Note: Query for partnerId encountered:', e.message);
    }

    try {
      const snapSnake = await db.collection('users').orderBy('partner_id').get();
      snapSnake.forEach(doc => partnerDocsMap.set(doc.id, doc));
    } catch (e) {
      console.warn('  Note: Query for partner_id encountered:', e.message);
    }

    if (partnerDocsMap.size === 0) {
      console.log('  No users found with partnerId or partner_id.\n');
    } else {
      partnerDocsMap.forEach((doc, id) => {
        const data = doc.data();
        const pId = data.partnerId || data.partner_id;
        const role = data.role || '(no role)';
        const email = data.email || '(anon)';
        console.log(`  - Doc ID:    ${id}`);
        console.log(`    PartnerId: ${pId}`);
        console.log(`    Role:      ${role}`);
        console.log(`    Email:     ${email}`);
      });
      console.log(`  Total partner-linked user docs: ${partnerDocsMap.size}\n`);
    }

    // 3. Admins collection
    console.log('3. ADMINS COLLECTION (Authoritative Admin Documents)');
    console.log('----------------------------------------------------');
    const adminsSnap = await db.collection('admins').get();
    if (adminsSnap.empty) {
      console.log('  No documents in admins collection.\n');
    } else {
      adminsSnap.forEach((doc) => {
        console.log(`  - Doc ID: ${doc.id}`);
        console.log(`    Data:   ${JSON.stringify(doc.data())}`);
      });
      console.log(`  Total admin docs: ${adminsSnap.size}\n`);
    }

    // 4. Collection Counts
    console.log('4. COLLECTION TOTAL COUNTS');
    console.log('----------------------------------------------------');
    let usersCount = 0;
    let tapsCount = 0;

    try {
      const usersCountSnap = await db.collection('users').count().get();
      usersCount = usersCountSnap.data().count;
    } catch (countErr) {
      const usersAll = await db.collection('users').select().get();
      usersCount = usersAll.size;
    }

    try {
      const tapsCountSnap = await db.collection('taps').count().get();
      tapsCount = tapsCountSnap.data().count;
    } catch (countErr) {
      const tapsAll = await db.collection('taps').select().get();
      tapsCount = tapsAll.size;
    }

    console.log(`  Total 'users' documents: ${usersCount}`);
    console.log(`  Total 'taps'  documents: ${tapsCount}`);
    console.log('\n====================================================');
    console.log('  Audit Completed Successfully');
    console.log('====================================================');

  } catch (err) {
    if (err.message && (err.message.includes('refresh_token') || err.message.includes('Could not load the default credentials'))) {
      console.error('\n[AUTHENTICATION ERROR] Cloud Shell Ambient Credentials Failed!');
      console.error('Error detail:', err.message);
      console.error('\n--- REMEDIATION INSTRUCTIONS ---');
      console.error('This occurs when Cloud Shell ambient credentials lack a valid refresh token.');
      console.error('\nOption 1 (Recommended): Re-authenticate application default credentials:');
      console.error('  gcloud auth application-default login');
      console.error('\nOption 2: Run directly using an active gcloud access token:');
      console.error('  ACCESS_TOKEN=$(gcloud auth print-access-token) node audit.js');
      console.error('\nOption 3: Use a service account key file:');
      console.error('  export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"');
      console.error('  node audit.js');
      console.error('--------------------------------\n');
    } else {
      console.error('\nError executing audit queries:', err);
    }
    process.exit(1);
  }
}

runAudit();

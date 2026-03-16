const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('../kellyportfolio-811ca-63bab52901ef.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function main() {
  try {
    const snapshot = await db.collection('tenants').get();
    if (snapshot.empty) {
      console.log('No matching documents found in tenants collection.');
      return;
    }

    console.log('--- tenants documents ---');
    snapshot.forEach(doc => {
      console.log(`${doc.id} =>`, JSON.stringify(doc.data(), null, 2));
    });
  } catch(e) {
    console.error('Error:', e);
  }
}

main();

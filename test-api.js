const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjp7ImlkIjo4NSwibmFtZSI6Ikd1cnUgamkiLCJtb2JpbGVfbnVtYmVyIjoiODExOTg2NTA3NCIsInJvbGUiOiJhZG1pbiJ9LCJpYXQiOjE3NzE1ODUxMTEsImV4cCI6MTc3MTYwMzExMX0.HhTTR1cFirj3WDNiYRwfAgIDYpMARLiJfk9lMgvY8G4";

async function checkApi(name, url) {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const text = await res.text();
    console.log(`\n--- ${name} [${res.status}] ---`);
    console.log(text.substring(0, 500));
  } catch (err) {
    console.error(`Error in ${name}:`, err);
  }
}

async function run() {
  await checkApi("TODAY_PAYOUTS", "https://pos.abheepay.com/api/dashboard/today-payouts");
  await checkApi("REPORT_PAYOUT", "https://pos.abheepay.com/api/report/payout");
}
run();

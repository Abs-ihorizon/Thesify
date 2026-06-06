const fs = require('fs');

const url = 'http://116.203.172.115:8069';
const username = 'admin';
const password = 'admin';

async function rpcCall(service, method, args) {
  const res = await fetch(`${url}/jsonrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
      id: Math.floor(Math.random() * 1000)
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(JSON.stringify(data.error));
  return data.result;
}

async function syncReviews() {
  try {
    console.log('Fetching reviews from Odoo...');
    let dbs = [];
    try {
      dbs = await rpcCall('db', 'list', []);
    } catch(e) {
      // ignore
    }
    const db = dbs && dbs.length > 0 ? dbs[0] : 'thesify';
    
    const uid = await rpcCall('common', 'authenticate', [db, username, password, {}]);
    if (!uid) {
      console.log("Authentication failed.");
      return;
    }
    
    const records = await rpcCall('object', 'execute_kw', [
      db, uid, password,
      'crm.lead', 'search_read',
      [[['x_publish', '=', true]]],
      { fields: ['name', 'x_review'] }
    ]);
    
    console.log(`Found ${records.length} published reviews.`);
    
    let html = fs.readFileSync('index.html', 'utf8');
    
    let newReviewsHtml = records.map(r => `
      <div class="testi-card">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text"><strong>Reviews:</strong> "${r.x_review || ''}"</p>
        <div class="testi-author"><strong>Name:</strong> ${r.name || ''}</div>
      </div>`).join('');

    // Let's insert them right after <div class="testi-track" id="ttrack">
    const insertionPoint = '<div class="testi-track" id="ttrack">';
    if (html.includes(insertionPoint)) {
      html = html.replace(insertionPoint, insertionPoint + newReviewsHtml);
      fs.writeFileSync('index.html', html);
      console.log('Successfully added reviews to index.html');
    } else {
      console.log('Could not find insertion point in index.html');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

syncReviews();

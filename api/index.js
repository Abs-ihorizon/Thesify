const express = require('express');
const path = require('path');

const app = express();
const port = 8080;

app.use(express.json());
app.use(express.static(__dirname));

const odooUrl = 'http://116.203.172.115:8069';
const username = 'admin';
const password = 'admin';

async function rpcCall(service, method, args) {
  const res = await fetch(`${odooUrl}/jsonrpc`, {
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

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, subject, message, budget } = req.body;
    
    // 1. Get DB name
    let dbs = [];
    try {
      dbs = await rpcCall('db', 'list', []);
    } catch(e) {}
    const db = dbs && dbs.length > 0 ? dbs[0] : 'thesify';

    // 2. Authenticate
    const uid = await rpcCall('common', 'authenticate', [db, username, password, {}]);
    if (!uid) {
      return res.status(500).json({ success: false, error: 'Odoo authentication failed' });
    }

    // 3. Create Lead
    const leadData = {
      name: subject || 'Website Contact',
      contact_name: name,
      email_from: email,
      phone: phone,
      description: message,
      expected_revenue: budget ? parseFloat(budget) : 0
    };

    const leadId = await rpcCall('object', 'execute_kw', [
      db, uid, password,
      'crm.lead', 'create',
      [leadData]
    ]);

    res.json({ success: true, leadId });
  } catch (error) {
    console.error('Contact Form Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/review', async (req, res) => {
  try {
    const { name, review, rating } = req.body;
    
    // 1. Get DB name
    let dbs = [];
    try {
      dbs = await rpcCall('db', 'list', []);
    } catch(e) {}
    const db = dbs && dbs.length > 0 ? dbs[0] : 'thesify';

    // 2. Authenticate
    const uid = await rpcCall('common', 'authenticate', [db, username, password, {}]);
    if (!uid) {
      return res.status(500).json({ success: false, error: 'Odoo authentication failed' });
    }

    // 3. Find 'Reviews' stage id
    let stage_id = false;
    try {
      const stages = await rpcCall('object', 'execute_kw', [
        db, uid, password,
        'crm.stage', 'search_read',
        [[['name', '=', 'Reviews']]],
        { fields: ['id'], limit: 1 }
      ]);
      if (stages && stages.length > 0) {
        stage_id = stages[0].id;
      }
    } catch(e) {
      console.log('Could not fetch stage', e);
    }

    let p = '0';
    if (rating == 3) p = '3';
    else if (rating == 2) p = '2';
    else if (rating == 1) p = '1';

    // 4. Create Lead with review field
    const leadData = {
      name: name || 'Anonymous Review',
      x_review: review,
      priority: p
    };
    if (stage_id) {
      leadData.stage_id = stage_id;
    }

    const leadId = await rpcCall('object', 'execute_kw', [
      db, uid, password,
      'crm.lead', 'create',
      [leadData]
    ]);

    res.json({ success: true, leadId });
  } catch (error) {
    console.error('Review Form Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/reviews', async (req, res) => {
  try {
    let dbs = [];
    try { dbs = await rpcCall('db', 'list', []); } catch(e) {}
    const db = dbs && dbs.length > 0 ? dbs[0] : 'thesify';

    const uid = await rpcCall('common', 'authenticate', [db, username, password, {}]);
    if (!uid) return res.status(500).json({ success: false, error: 'Auth failed' });

    const reviews = await rpcCall('object', 'execute_kw', [
      db, uid, password,
      'crm.lead', 'search_read',
      [[['x_publish', '=', true], ['x_review', '!=', false]]],
      { fields: ['name', 'x_review', 'priority'], limit: 50, order: 'id desc' }
    ]);

    res.json({ success: true, reviews });
  } catch (error) {
    console.error('Fetch Reviews Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Yeh route aapke frontend (index.html) ko load karega
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;

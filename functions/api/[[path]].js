export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // --- AUTH ENDPOINTS ---
  if (path === '/api/auth/login' && method === 'POST') {
    let body = {};
    try {
      body = await request.json();
    } catch (e) {}

    const username = (body.username || body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    // Allow admin credentials or demo roles
    if (
      username === 'admin@nirmalaenterprises.in' ||
      username === 'admin' ||
      username.includes('admin') ||
      username.includes('manager') ||
      password === 'Admin@12345' ||
      password.length >= 4
    ) {
      return new Response(
        JSON.stringify({
          success: true,
          token: 'cf-pages-jwt-token-demo-admin-12345',
          user: {
            id: '65f000000000000000000001',
            name: 'System Administrator',
            email: 'admin@nirmalaenterprises.in',
            role: 'ADMIN',
            roleLabel: 'Administrator',
            permissions: ['*'],
            mustChangePassword: false,
            isActive: true
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: false, message: 'Invalid email or password' }),
      { status: 401, headers: corsHeaders }
    );
  }

  if (path === '/api/auth/me') {
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: '65f000000000000000000001',
          name: 'System Administrator',
          email: 'admin@nirmalaenterprises.in',
          role: 'ADMIN',
          roleLabel: 'Administrator',
          permissions: ['*'],
          mustChangePassword: false,
          isActive: true
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  // --- DASHBOARD SUMMARY ---
  if (path === '/api/dashboard/summary') {
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          todaySales: 38400,
          totalProcurement: 214520,
          totalInventoryValue: 1254000,
          outstandingLending: 126200,
          lowStockCount: 2,
          stats: {
            todaySales: 38400,
            totalRevenue: 485000,
            salesCount: 18,
            farmerAdvances: 126200,
            registeredFarmers: 45,
            totalProducts: 12,
            lowStockAlerts: 2,
            procurementVolumeQtl: 96.0,
            netProfit: 87300
          },
          dailySales: [
            { date: '2026-02-23', dayName: 'Mon', label: '23 Feb', amount: 24600, count: 3 },
            { date: '2026-02-24', dayName: 'Tue', label: '24 Feb', amount: 31200, count: 4 },
            { date: '2026-02-25', dayName: 'Wed', label: '25 Feb', amount: 28900, count: 3 },
            { date: '2026-02-26', dayName: 'Thu', label: '26 Feb', amount: 35600, count: 5 },
            { date: '2026-02-27', dayName: 'Fri', label: '27 Feb', amount: 41200, count: 6 },
            { date: '2026-02-28', dayName: 'Sat', label: '28 Feb', amount: 38400, count: 5 }
          ],
          monthlySales: [
            { label: 'Oct', amount: 380000, count: 35 },
            { label: 'Nov', amount: 460000, count: 42 },
            { label: 'Dec', amount: 590000, count: 54 },
            { label: 'Jan', amount: 710000, count: 65 },
            { label: 'Feb', amount: 840000, count: 78 }
          ],
          lowStockProducts: [
            { _id: 'prod_006', name: 'NPK 10:26:26 (50 kg)', currentStock: 12, minStockAlert: 15 },
            { _id: 'prod_007', name: 'Chlorpyrifos 20% EC (1 Ltr)', currentStock: 8, minStockAlert: 10 }
          ],
          recentSales: [
            { _id: 'sale_001', invoiceNo: 'INV-2026-001', customerName: 'Ramesh Chandra Sahu', grandTotal: 17279.36, paymentStatus: 'PAID', date: '2026-02-24T11:30:00.000Z' },
            { _id: 'sale_002', invoiceNo: 'INV-2026-002', customerName: 'Pradeep Mohapatra', grandTotal: 13003.20, paymentStatus: 'PAID', date: '2026-02-26T15:10:00.000Z' }
          ],
          recentPurchases: [
            { _id: 'pur_001', receiptNumber: 'PRC-2026-001', farmerName: 'Ramesh Chandra Sahu', commodity: 'Paddy / Rice (Swarna MTU-7029)', netPayable: 70410, status: 'COMPLETED', createdAt: '2026-02-25T14:30:00.000Z' }
          ]
        }
      }),
      { status: 200, headers: corsHeaders }
    );
  }

  // --- PRODUCTS ---
  if (path.startsWith('/api/products') || path.startsWith('/api/public/products')) {
    const products = [
      { _id: 'prod_001', productCode: 'SED-MZ-01', name: 'Hybrid Maize Seed (Pioneer 3396)', category: 'SEEDS', unit: 'Bags', brand: 'Pioneer Hi-Bred', purchasePrice: 1850, sellingPrice: 2100, currentStock: 145, minStockAlert: 20, description: 'High-yielding drought-tolerant hybrid yellow maize seed (5 kg bag).' },
      { _id: 'prod_002', productCode: 'SED-PD-02', name: 'Paddy Seed IR-64 (Certified)', category: 'SEEDS', unit: 'Bags', brand: 'Odisha State Seeds Corp (OSSC)', purchasePrice: 650, sellingPrice: 760, currentStock: 280, minStockAlert: 30, description: 'Medium slender certified long-grain paddy seed (25 kg bag).' },
      { _id: 'prod_004', productCode: 'FRT-UR-04', name: 'Neem Coated Urea (45 kg)', category: 'FERTILIZERS', unit: 'Bags', brand: 'KRIBHCO / IFFCO', purchasePrice: 242, sellingPrice: 266, currentStock: 420, minStockAlert: 50, description: 'Essential nitrogenous fertilizer for vegetative crop growth.' },
      { _id: 'prod_005', productCode: 'FRT-DP-05', name: 'DAP 18:46:00 (50 kg)', category: 'FERTILIZERS', unit: 'Bags', brand: 'IFFCO', purchasePrice: 1250, sellingPrice: 1350, currentStock: 190, minStockAlert: 25, description: 'Di-Ammonium Phosphate for strong root establishment.' },
      { _id: 'prod_009', productCode: 'CMD-MZ-09', name: 'Yellow Maize (Feed Quality Grade A)', category: 'COMMODITIES', unit: 'Quintals', brand: 'Odisha Mandi Procured', purchasePrice: 2150, sellingPrice: 2380, currentStock: 450, minStockAlert: 50, description: 'Sun-dried clean yellow feed maize procured directly from Odisha farmers.' }
    ];

    if (method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch (e) {}
      const newProd = {
        _id: 'prod_' + Date.now(),
        productCode: body.productCode || 'PRD-' + Math.floor(1000 + Math.random() * 9000),
        name: body.name || 'New Product',
        category: body.category || 'SEEDS',
        unit: body.unit || 'Bags',
        brand: body.brand || 'Nirmala Agro',
        purchasePrice: Number(body.purchasePrice || 0),
        sellingPrice: Number(body.sellingPrice || 0),
        currentStock: Number(body.currentStock || 0),
        minStockAlert: Number(body.minStockAlert || 10),
        description: body.description || ''
      };
      return new Response(JSON.stringify({ success: true, data: newProd, message: 'Product created.' }), { status: 200, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, data: products }), { status: 200, headers: corsHeaders });
  }

  // --- FARMERS ---
  if (path.startsWith('/api/farmers')) {
    const farmers = [
      { _id: 'frm_001', farmerCode: 'FARM-001', name: 'Ramesh Chandra Sahu', fatherName: 'Birendra Sahu', phone: '9861012345', village: 'Attabira', district: 'Bargarh', state: 'Odisha', landAcres: 12.5, primaryCrop: 'Paddy & Maize', outstandingAdvance: 0, totalProcuredQuintals: 185 },
      { _id: 'frm_002', farmerCode: 'FARM-002', name: 'Pradeep Mohapatra', fatherName: 'Jogendra Mohapatra', phone: '9437156789', village: 'Bheden', district: 'Bargarh', state: 'Odisha', landAcres: 8.0, primaryCrop: 'Paddy & Pulses', outstandingAdvance: 18000, totalProcuredQuintals: 120 },
      { _id: 'frm_003', farmerCode: 'FARM-003', name: 'Bikash Kumar Meher', fatherName: 'Surendra Meher', phone: '9937024680', village: 'Barpali', district: 'Bargarh', state: 'Odisha', landAcres: 15.0, primaryCrop: 'Paddy & Mustard', outstandingAdvance: 41200, totalProcuredQuintals: 240 }
    ];
    return new Response(JSON.stringify({ success: true, data: farmers }), { status: 200, headers: corsHeaders });
  }

  // --- MANDI RATES ---
  if (path.startsWith('/api/public/mandi-rates')) {
    const rates = [
      { commodity: 'Yellow Maize', minPrice: 2150, maxPrice: 2380, modalPrice: 2280, market: 'Bargarh APMC', date: new Date().toISOString() },
      { commodity: 'Swarna Paddy (Grade A)', minPrice: 2300, maxPrice: 2580, modalPrice: 2450, market: 'Sambalpur Mandi', date: new Date().toISOString() }
    ];
    return new Response(JSON.stringify({ success: true, data: rates }), { status: 200, headers: corsHeaders });
  }

  // Generic fallback
  return new Response(
    JSON.stringify({ success: true, message: 'API active on Cloudflare Pages', path }),
    { status: 200, headers: corsHeaders }
  );
}

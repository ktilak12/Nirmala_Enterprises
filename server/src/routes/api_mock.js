import { Router } from 'express';

export const mockRouter = Router();

// In-Memory Database with Rich Pre-loaded Dummy Data
let products = [
  {
    _id: 'prod_001',
    productCode: 'SED-MZ-01',
    name: 'Hybrid Maize Seed (Pioneer 3396)',
    category: 'SEEDS',
    unit: 'Bags',
    brand: 'Pioneer Hi-Bred',
    purchasePrice: 1850,
    sellingPrice: 2100,
    currentStock: 145,
    minStockAlert: 20,
    description: 'High-yielding drought-tolerant hybrid yellow maize seed (5 kg bag).'
  },
  {
    _id: 'prod_002',
    productCode: 'SED-PD-02',
    name: 'Paddy Seed IR-64 (Certified)',
    category: 'SEEDS',
    unit: 'Bags',
    brand: 'Andhra Pradesh Seeds Corp',
    purchasePrice: 650,
    sellingPrice: 760,
    currentStock: 280,
    minStockAlert: 30,
    description: 'Medium slender certified long-grain paddy seed (25 kg bag).'
  },
  {
    _id: 'prod_003',
    productCode: 'SED-CT-03',
    name: 'Bt Cotton Seed (RCH-659 BG-II)',
    category: 'SEEDS',
    unit: 'Packets',
    brand: 'Rasi Seeds',
    purchasePrice: 760,
    sellingPrice: 853,
    currentStock: 95,
    minStockAlert: 25,
    description: 'Bollgard-II insect protected hybrid cotton seed (450g packet).'
  },
  {
    _id: 'prod_004',
    productCode: 'FRT-UR-04',
    name: 'Neem Coated Urea (45 kg)',
    category: 'FERTILIZERS',
    unit: 'Bags',
    brand: 'KRIBHCO',
    purchasePrice: 242,
    sellingPrice: 266,
    currentStock: 420,
    minStockAlert: 50,
    description: 'Essential nitrogenous fertilizer for vegetative crop growth.'
  },
  {
    _id: 'prod_005',
    productCode: 'FRT-DP-05',
    name: 'DAP 18:46:00 (50 kg)',
    category: 'FERTILIZERS',
    unit: 'Bags',
    brand: 'IFFCO',
    purchasePrice: 1250,
    sellingPrice: 1350,
    currentStock: 190,
    minStockAlert: 25,
    description: 'Di-Ammonium Phosphate for strong root establishment.'
  },
  {
    _id: 'prod_006',
    productCode: 'FRT-NPK-06',
    name: 'Gromor NPK 20:20:0:13 (50 kg)',
    category: 'FERTILIZERS',
    unit: 'Bags',
    brand: 'Coromandel International',
    purchasePrice: 1100,
    sellingPrice: 1220,
    currentStock: 8,
    minStockAlert: 15,
    description: 'Complex fertilizer with sulphur for higher oil and grain content.'
  },
  {
    _id: 'prod_007',
    productCode: 'PST-CP-07',
    name: 'Chlorpyrifos 20% EC (1 Ltr)',
    category: 'PESTICIDES',
    unit: 'Bottles',
    brand: 'Tata Rallis',
    purchasePrice: 380,
    sellingPrice: 460,
    currentStock: 65,
    minStockAlert: 10,
    description: 'Broad-spectrum insecticide for sucking and chewing pests.'
  },
  {
    _id: 'prod_008',
    productCode: 'PST-GL-08',
    name: 'Glyphosate 41% SL Weedicide (1 Ltr)',
    category: 'PESTICIDES',
    unit: 'Bottles',
    brand: 'Excel Crop Care',
    purchasePrice: 420,
    sellingPrice: 510,
    currentStock: 42,
    minStockAlert: 12,
    description: 'Systemic post-emergence herbicide for non-crop and inter-row weed control.'
  },
  {
    _id: 'prod_009',
    productCode: 'CMD-CH-09',
    name: 'Dried Red Chilli (Teja Best Grade)',
    category: 'COMMODITIES',
    unit: 'Quintals',
    brand: 'Guntur Mandi Procured',
    purchasePrice: 17200,
    sellingPrice: 18800,
    currentStock: 340,
    minStockAlert: 50,
    description: 'Export-quality spicy Teja stemless red chilli with vibrant color.'
  },
  {
    _id: 'prod_010',
    productCode: 'CMD-CT-10',
    name: 'Raw Seed Cotton (Shankar-6 / DCH-32)',
    category: 'COMMODITIES',
    unit: 'Quintals',
    brand: 'AP Cotton Federation',
    purchasePrice: 6800,
    sellingPrice: 7450,
    currentStock: 180,
    minStockAlert: 30,
    description: 'Clean medium-to-long staple cotton with low trash content.'
  }
];

let farmers = [
  {
    _id: 'frm_001',
    name: 'M. Venkat Rao',
    fatherName: 'Appa Rao',
    phone: '9848012345',
    village: 'Garapadu',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    landAcres: 12.5,
    primaryCrop: 'Chilli & Cotton',
    bankName: 'State Bank of India',
    accountNumber: '30982241908',
    ifscCode: 'SBIN0001234',
    outstandingAdvance: 45000,
    totalProcuredQuintals: 185,
    createdAt: '2026-01-10T09:30:00.000Z'
  },
  {
    _id: 'frm_002',
    name: 'K. Lakshmi Narayana',
    fatherName: 'Sambaiah',
    phone: '9440156789',
    village: 'Kolakaluru',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    landAcres: 8.0,
    primaryCrop: 'Paddy & Maize',
    bankName: 'Andhra Pragathi Grameena Bank',
    accountNumber: '71008892341',
    ifscCode: 'APGB0005432',
    outstandingAdvance: 18000,
    totalProcuredQuintals: 120,
    createdAt: '2026-01-15T11:15:00.000Z'
  },
  {
    _id: 'frm_003',
    name: 'B. Koteswara Rao',
    fatherName: 'Venkateswarlu',
    phone: '9989024680',
    village: 'Medikonduru',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    landAcres: 15.0,
    primaryCrop: 'Red Chilli & Turmeric',
    bankName: 'Union Bank of India',
    accountNumber: '54019283741',
    ifscCode: 'UBIN0534211',
    outstandingAdvance: 60000,
    totalProcuredQuintals: 240,
    createdAt: '2026-01-20T14:00:00.000Z'
  },
  {
    _id: 'frm_004',
    name: 'Ch. Ramanjaneyulu',
    fatherName: 'Kotayya',
    phone: '9866112233',
    village: 'Narsaraopet Rural',
    district: 'Palnadu',
    state: 'Andhra Pradesh',
    landAcres: 6.5,
    primaryCrop: 'Cotton & Red Gram',
    bankName: 'Canara Bank',
    accountNumber: '11209485721',
    ifscCode: 'CNRB0002891',
    outstandingAdvance: 0,
    totalProcuredQuintals: 95,
    createdAt: '2026-02-01T10:45:00.000Z'
  },
  {
    _id: 'frm_005',
    name: 'P. Subba Reddy',
    fatherName: 'Ramana Reddy',
    phone: '9701239876',
    village: 'Kaza',
    district: 'Guntur',
    state: 'Andhra Pradesh',
    landAcres: 20.0,
    primaryCrop: 'Maize & Paddy',
    bankName: 'HDFC Bank',
    accountNumber: '50100984729',
    ifscCode: 'HDFC0001092',
    outstandingAdvance: 85000,
    totalProcuredQuintals: 360,
    createdAt: '2026-02-10T16:20:00.000Z'
  }
];

let sales = [
  {
    _id: 'sale_001',
    invoiceNo: 'INV-2026-001',
    invoiceNumber: 'INV-2026-001',
    date: '2026-02-24T11:30:00.000Z',
    farmerId: 'frm_001',
    farmerCode: 'FARM-001',
    customerName: 'M. Venkat Rao',
    customerPhone: '9848012345',
    customerAddress: 'Garapadu, Guntur, AP',
    items: [
      { productId: 'prod_001', productCode: 'PRD-101', name: 'Hybrid Maize Seed (Pioneer 3396)', productName: 'Hybrid Maize Seed (Pioneer 3396)', category: 'SEEDS', unit: 'Bags', qty: 4, quantity: 4, rate: 2100, unitPrice: 2100, gstRate: 12, amount: 8400, total: 8400 },
      { productId: 'prod_004', productCode: 'PRD-104', name: 'Neem Coated Urea (45 kg)', productName: 'Neem Coated Urea (45 kg)', category: 'FERTILIZERS', unit: 'Bags', qty: 8, quantity: 8, rate: 266, unitPrice: 266, gstRate: 12, amount: 2128, total: 2128 },
      { productId: 'prod_005', productCode: 'PRD-105', name: 'DAP 18:46:00 (50 kg)', productName: 'DAP 18:46:00 (50 kg)', category: 'FERTILIZERS', unit: 'Bags', qty: 4, quantity: 4, rate: 1350, unitPrice: 1350, gstRate: 12, amount: 5400, total: 5400 }
    ],
    subtotal: 15928,
    taxTotal: 1851.36,
    discount: 500,
    tax: 1851.36,
    grandTotal: 17279.36,
    total: 17279.36,
    paidAmount: 17279.36,
    balanceDue: 0,
    paymentMode: 'UPI',
    paymentStatus: 'PAID',
    notes: 'Seasonal crop input purchase for Kharif maize.',
    createdAt: '2026-02-24T11:30:00.000Z'
  },
  {
    _id: 'sale_002',
    invoiceNo: 'INV-2026-002',
    invoiceNumber: 'INV-2026-002',
    date: '2026-02-26T15:10:00.000Z',
    farmerId: 'frm_002',
    farmerCode: 'FARM-002',
    customerName: 'K. Lakshmi Narayana',
    customerPhone: '9440156789',
    customerAddress: 'Kolakaluru, Guntur, AP',
    items: [
      { productId: 'prod_002', productCode: 'PRD-102', name: 'Paddy Seed IR-64 (Certified)', productName: 'Paddy Seed IR-64 (Certified)', category: 'SEEDS', unit: 'Bags', qty: 6, quantity: 6, rate: 760, unitPrice: 760, gstRate: 12, amount: 4560, total: 4560 },
      { productId: 'prod_006', productCode: 'PRD-106', name: 'Gromor NPK 20:20:0:13 (50 kg)', productName: 'Gromor NPK 20:20:0:13 (50 kg)', category: 'FERTILIZERS', unit: 'Bags', qty: 5, quantity: 5, rate: 1220, unitPrice: 1220, gstRate: 12, amount: 6100, total: 6100 }
    ],
    subtotal: 10660,
    taxTotal: 1255.20,
    discount: 200,
    tax: 1255.20,
    grandTotal: 11715.20,
    total: 11715.20,
    paidAmount: 11715.20,
    balanceDue: 0,
    paymentMode: 'CASH',
    paymentStatus: 'PAID',
    notes: 'Paddy cultivation inputs.',
    createdAt: '2026-02-26T15:10:00.000Z'
  },
  {
    _id: 'sale_003',
    invoiceNo: 'INV-2026-003',
    invoiceNumber: 'INV-2026-003',
    date: '2026-02-28T09:45:00.000Z',
    farmerId: 'frm_003',
    farmerCode: 'FARM-003',
    customerName: 'B. Koteswara Rao',
    customerPhone: '9989024680',
    customerAddress: 'Medikonduru, Guntur, AP',
    items: [
      { productId: 'prod_003', productCode: 'PRD-103', name: 'Bt Cotton Seed (RCH-659 BG-II)', productName: 'Bt Cotton Seed (RCH-659 BG-II)', category: 'SEEDS', unit: 'Packets', qty: 10, quantity: 10, rate: 853, unitPrice: 853, gstRate: 12, amount: 8530, total: 8530 },
      { productId: 'prod_007', productCode: 'PRD-107', name: 'Chlorpyrifos 20% EC (1 Ltr)', productName: 'Chlorpyrifos 20% EC (1 Ltr)', category: 'PESTICIDES', unit: 'Bottles', qty: 4, quantity: 4, rate: 460, unitPrice: 460, gstRate: 12, amount: 1840, total: 1840 }
    ],
    subtotal: 10370,
    taxTotal: 1200.00,
    discount: 370,
    tax: 1200.00,
    grandTotal: 11200.00,
    total: 11200.00,
    paidAmount: 8000.00,
    balanceDue: 3200.00,
    paymentMode: 'CASH',
    paymentStatus: 'PARTIAL',
    notes: 'Advance input delivery - balance payable after harvest.',
    createdAt: '2026-02-28T09:45:00.000Z'
  }
];

let purchases = [
  {
    _id: 'pur_001',
    receiptNumber: 'PRC-2026-001',
    farmerId: 'frm_001',
    farmerName: 'M. Venkat Rao',
    commodity: 'Dried Red Chilli (Teja Best Grade)',
    grossWeight: 4250,
    tareWeight: 150,
    netWeight: 4100,
    moistureDeductionKg: 40,
    payableWeightKg: 4060,
    ratePerKg: 172,
    grossAmount: 698320,
    advanceDeduction: 45000,
    netPayable: 653320,
    bagCount: 82,
    qualityGrade: 'Grade A',
    status: 'COMPLETED',
    createdAt: '2026-02-25T14:30:00.000Z'
  },
  {
    _id: 'pur_002',
    receiptNumber: 'PRC-2026-002',
    farmerId: 'frm_003',
    farmerName: 'B. Koteswara Rao',
    commodity: 'Raw Seed Cotton (Shankar-6)',
    grossWeight: 5800,
    tareWeight: 200,
    netWeight: 5600,
    moistureDeductionKg: 60,
    payableWeightKg: 5540,
    ratePerKg: 68,
    grossAmount: 376720,
    advanceDeduction: 30000,
    netPayable: 346720,
    bagCount: 112,
    qualityGrade: 'Grade A',
    status: 'COMPLETED',
    createdAt: '2026-02-27T16:00:00.000Z'
  }
];

let loans = [
  {
    _id: 'loan_001',
    loanNumber: 'ADV-2026-001',
    farmerId: 'frm_001',
    farmerName: 'M. Venkat Rao',
    amount: 45000,
    interestRate: 0,
    purpose: 'Crop cultivation inputs & fertilizer advance',
    tenureMonths: 6,
    disbursedAt: '2026-01-10T10:00:00.000Z',
    status: 'RECOVERED_IN_PROCUREMENT',
    paymentMode: 'BANK_TRANSFER'
  },
  {
    _id: 'loan_002',
    loanNumber: 'ADV-2026-002',
    farmerId: 'frm_003',
    farmerName: 'B. Koteswara Rao',
    amount: 60000,
    interestRate: 0,
    purpose: 'Hybrid Chilli seed & field preparation credit',
    tenureMonths: 6,
    disbursedAt: '2026-01-20T14:30:00.000Z',
    status: 'ACTIVE',
    paymentMode: 'CASH'
  },
  {
    _id: 'loan_003',
    loanNumber: 'ADV-2026-003',
    farmerId: 'frm_005',
    farmerName: 'P. Subba Reddy',
    amount: 85000,
    interestRate: 0,
    purpose: 'Maize sowing and crop protection financing',
    tenureMonths: 6,
    disbursedAt: '2026-02-10T16:30:00.000Z',
    status: 'ACTIVE',
    paymentMode: 'BANK_TRANSFER'
  }
];

let mandiRates = [
  { commodity: 'Red Chilli (Teja)', market: 'Guntur AMC', price: 18500, change: '+₹350', unit: 'Quintal', grade: 'Special Grade' },
  { commodity: 'Cotton (Shankar-6)', market: 'Guntur Cotton Yard', price: 7350, change: '+₹120', unit: 'Quintal', grade: 'Medium Staple' },
  { commodity: 'Turmeric (Double Polished)', market: 'Duggirala / Nizamabad', price: 14200, change: '+₹400', unit: 'Quintal', grade: 'Finger Grade' },
  { commodity: 'Yellow Maize', market: 'Tenali AMC', price: 2150, change: 'Stable', unit: 'Quintal', grade: 'Feed Quality' },
  { commodity: 'Paddy (BPT 5204)', market: 'Guntur Mirchi Yard', price: 2450, change: '+₹50', unit: 'Quintal', grade: 'Sona Masoori' },
  { commodity: 'Urea (Neem Coated)', market: 'Central Subsidized', price: 266, change: 'Govt Fixed', unit: '45kg Bag', grade: 'Standard' }
];

let auditLogs = [
  { _id: 'aud_001', action: 'CREATE_SALE', actor: 'System Administrator', summary: 'Invoice INV-2026-001 created for M. Venkat Rao (₹17,279.36)', timestamp: '2026-02-24T11:30:00.000Z' },
  { _id: 'aud_002', action: 'PROCUREMENT_IN', actor: 'Operations Manager', summary: 'Chilli procurement PR-2026-001 from M. Venkat Rao (40.6 Qtl)', timestamp: '2026-02-25T14:30:00.000Z' },
  { _id: 'aud_003', action: 'DISBURSE_ADVANCE', actor: 'System Administrator', summary: 'Seed advance disbursed to B. Koteswara Rao (₹60,000)', timestamp: '2026-01-20T14:30:00.000Z' }
];

// --- PUBLIC ENDPOINTS ---
mockRouter.get('/public/mandi-rates', (_req, res) => {
  res.json({ success: true, data: mandiRates });
});

mockRouter.get('/public/products', (_req, res) => {
  res.json({ success: true, data: products });
});

mockRouter.post('/public/inquiries', (req, res) => {
  res.json({ success: true, message: 'Inquiry received. Our agricultural officer will contact you within 24 hours.' });
});

// --- DASHBOARD SUMMARY ---
mockRouter.get('/dashboard/summary', (_req, res) => {
  const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalAdvances = loans.filter(l => l.status === 'ACTIVE').reduce((sum, l) => sum + (l.amount || 0), 0);
  const lowStockCount = products.filter(p => p.currentStock <= p.minStockAlert).length;

  res.json({
    success: true,
    data: {
      stats: {
        totalRevenue: Math.round(totalRevenue),
        salesCount: sales.length,
        farmerAdvances: totalAdvances,
        registeredFarmers: farmers.length,
        totalProducts: products.length,
        lowStockAlerts: lowStockCount,
        procurementVolumeQtl: purchases.reduce((sum, p) => sum + ((p.payableWeightKg || 0) / 100), 0),
        netProfit: Math.round(totalRevenue * 0.18)
      },
      lowStockProducts: products.filter(p => p.currentStock <= p.minStockAlert),
      recentSales: sales.slice(-5).reverse(),
      recentPurchases: purchases.slice(-5).reverse(),
      mandiRates
    }
  });
});

// --- PRODUCTS & INVENTORY ---
mockRouter.get('/products', (_req, res) => {
  res.json({ success: true, data: products });
});

mockRouter.post('/products', (req, res) => {
  const body = req.body;
  const newProduct = {
    _id: 'prod_' + String(Date.now()).slice(-6),
    productCode: body.productCode || 'PRD-' + Math.floor(1000 + Math.random() * 9000),
    name: body.name || 'Untitled Product',
    category: body.category || 'SEEDS',
    unit: body.unit || 'Bags',
    brand: body.brand || 'Nirmala Agro',
    purchasePrice: Number(body.purchasePrice || 0),
    sellingPrice: Number(body.sellingPrice || 0),
    currentStock: Number(body.currentStock || 0),
    minStockAlert: Number(body.minStockAlert || 10),
    description: body.description || ''
  };
  products.unshift(newProduct);
  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'CREATE_PRODUCT',
    actor: 'Administrator',
    summary: `Added product ${newProduct.name} (${newProduct.productCode}) with stock ${newProduct.currentStock}`,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, data: newProduct, message: 'Product created successfully.' });
});

mockRouter.post('/products/:id/adjust-stock', (req, res) => {
  const { id } = req.params;
  const { adjustmentType, quantity, reason } = req.body;
  const prod = products.find(p => p._id === id || p.productCode === id);
  if (!prod) return res.status(404).json({ success: false, message: 'Product not found.' });

  const qty = Number(quantity || 0);
  if (adjustmentType === 'ADD' || adjustmentType === 'RESTOCK') {
    prod.currentStock += qty;
  } else if (adjustmentType === 'REMOVE' || adjustmentType === 'DAMAGED') {
    prod.currentStock = Math.max(0, prod.currentStock - qty);
  } else {
    prod.currentStock = qty;
  }

  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'STOCK_ADJUSTMENT',
    actor: 'Administrator',
    summary: `Stock for ${prod.name} adjusted by ${adjustmentType}: ${qty} (New stock: ${prod.currentStock}). Reason: ${reason || 'Manual Update'}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: prod, message: 'Stock updated successfully.' });
});

// --- FARMERS CRM ---
mockRouter.get('/farmers', (_req, res) => {
  const enrichedFarmers = farmers.map(farmer => {
    const farmerSales = sales.filter(s =>
      (s.customerPhone && farmer.phone && s.customerPhone.trim() === farmer.phone.trim()) ||
      s.farmerId === farmer._id ||
      (s.customerName && farmer.name && s.customerName.toLowerCase().trim() === farmer.name.toLowerCase().trim())
    );
    const farmerPurchases = purchases.filter(p => p.farmerId === farmer._id || p.farmerName?.toLowerCase() === farmer.name?.toLowerCase());
    const farmerLoans = loans.filter(l => l.farmerId === farmer._id || l.farmerName?.toLowerCase() === farmer.name?.toLowerCase());

    const totalBillsDue = farmerSales.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
    const totalActiveAdvances = farmerLoans.filter(l => l.status === 'ACTIVE').reduce((sum, l) => sum + (l.amount || 0), 0);
    const currentBalance = totalBillsDue + totalActiveAdvances;
    const totalProcuredQtl = farmerPurchases.reduce((sum, p) => sum + ((p.payableWeightKg || 0) / 100), 0);

    return {
      ...farmer,
      currentBalance,
      outstandingAdvance: totalActiveAdvances,
      totalProcuredQuintals: totalProcuredQtl || farmer.totalProcuredQuintals || 0,
      totalBillsCount: farmerSales.length
    };
  });

  res.json({ success: true, data: enrichedFarmers });
});

mockRouter.post('/farmers', (req, res) => {
  const body = req.body;
  const newFarmer = {
    _id: 'frm_' + String(Date.now()).slice(-6),
    farmerCode: 'FARM-' + String(farmers.length + 1).padStart(3, '0'),
    name: body.name || 'Unknown Farmer',
    fatherName: body.fatherName || '',
    phone: body.phone || '',
    village: body.village || 'Guntur',
    district: body.district || 'Guntur',
    state: body.state || 'Andhra Pradesh',
    landAcres: Number(body.landAcres || 0),
    primaryCrop: body.primaryCrop || 'Chilli',
    bankName: body.bankName || '',
    accountNumber: body.accountNumber || '',
    ifscCode: body.ifscCode || '',
    outstandingAdvance: 0,
    currentBalance: 0,
    totalProcuredQuintals: 0,
    createdAt: new Date().toISOString()
  };
  farmers.unshift(newFarmer);
  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'REGISTER_FARMER',
    actor: 'Administrator',
    summary: `Registered farmer ${newFarmer.name} from ${newFarmer.village}`,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, data: newFarmer, message: 'Farmer registered successfully.' });
});

mockRouter.get('/farmers/:id/360', (req, res) => {
  const { id } = req.params;
  const farmer = farmers.find(f => f._id === id || f.phone === id || f.farmerCode === id);
  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

  const farmerPurchases = purchases.filter(p => p.farmerId === farmer._id || p.farmerName?.toLowerCase() === farmer.name?.toLowerCase());
  const farmerLoans = loans.filter(l => l.farmerId === farmer._id || l.farmerName?.toLowerCase() === farmer.name?.toLowerCase());
  const farmerSales = sales.filter(s =>
    (s.customerPhone && farmer.phone && s.customerPhone.trim() === farmer.phone.trim()) ||
    s.farmerId === farmer._id ||
    (s.customerName && farmer.name && s.customerName.toLowerCase().trim() === farmer.name.toLowerCase().trim())
  );

  const totalPurchases = farmerSales.reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
  const totalCommoditySales = farmerPurchases.reduce((sum, p) => sum + (p.grossAmount || 0), 0);
  const totalAdvancesTaken = farmerLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalAdvancesDeducted = farmerPurchases.reduce((sum, p) => sum + (p.advanceDeduction || 0), 0);
  const unpaidBillsBalance = farmerSales.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
  const activeAdvanceBalance = farmerLoans.filter(l => l.status === 'ACTIVE').reduce((sum, l) => sum + (l.amount || 0), 0);
  const currentNetBalance = unpaidBillsBalance + activeAdvanceBalance;

  // Build Chronological Timeline items:
  const timeline = [];

  // 1. Input Purchases (Bills)
  farmerSales.forEach(s => {
    const itemsSummary = (s.items || []).map(it => `${it.qty} ${it.unit || 'unit'} ${it.name}`).join(', ');
    timeline.push({
      type: 'INPUT_PURCHASE',
      title: `Input Purchase Bill #${s.invoiceNo || s.invoiceNumber}`,
      details: `${itemsSummary || 'Agricultural Inputs'} • Status: ${s.paymentStatus} (${s.paymentMode})`,
      amount: s.grandTotal || s.total || 0,
      date: s.date || s.createdAt || new Date().toISOString(),
      raw: s
    });
  });

  // 2. Crop Sales (Procurement)
  farmerPurchases.forEach(p => {
    const qtyQtl = ((p.payableWeightKg || p.netWeight || 0) / 100).toFixed(1);
    timeline.push({
      type: 'CROP_SALE',
      title: `Crop Procurement #${p.receiptNumber} (${p.commodity})`,
      details: `${qtyQtl} Qtl (${p.payableWeightKg || 0} Kg) @ ₹${p.ratePerKg || 0}/Kg • Net Paid: ₹${(p.netPayable || 0).toLocaleString('en-IN')}`,
      amount: p.grossAmount || ((p.payableWeightKg || 0) * (p.ratePerKg || 0)),
      date: p.date || p.createdAt || new Date().toISOString(),
      raw: p
    });
  });

  // 3. Advances / Loans
  farmerLoans.forEach(l => {
    timeline.push({
      type: 'ADVANCE_DISBURSED',
      title: `Seasonal Advance #${l.loanNumber}`,
      details: `${l.purpose || 'Crop Sowing Finance'} • Status: ${l.status} (${l.paymentMode || 'CASH'})`,
      amount: l.amount || 0,
      date: l.disbursedAt || l.createdAt || new Date().toISOString(),
      raw: l
    });
  });

  // Sort timeline chronologically (newest first)
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Update farmer's live balance
  farmer.currentBalance = currentNetBalance;
  farmer.outstandingAdvance = activeAdvanceBalance;

  res.json({
    success: true,
    data: {
      farmer: {
        ...farmer,
        currentBalance: currentNetBalance,
        outstandingAdvance: activeAdvanceBalance
      },
      summary: {
        totalPurchases,
        totalCommoditySales,
        totalAdvancesTaken,
        totalAdvancesDeducted,
        currentNetBalance,
        totalBillsCount: farmerSales.length,
        totalProcurementTrips: farmerPurchases.length,
        totalWeightSoldKg: farmerPurchases.reduce((sum, p) => sum + (p.payableWeightKg || 0), 0)
      },
      timeline,
      sales: farmerSales,
      bills: farmerSales,
      purchases: farmerPurchases,
      loans: farmerLoans
    }
  });
});

mockRouter.get('/farmers/:id/invoices', (req, res) => {
  const { id } = req.params;
  const farmer = farmers.find(f => f._id === id || f.phone === id || f.farmerCode === id);
  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

  const farmerSales = sales.filter(s =>
    (s.customerPhone && farmer.phone && s.customerPhone.trim() === farmer.phone.trim()) ||
    s.farmerId === farmer._id ||
    (s.customerName && farmer.name && s.customerName.toLowerCase().trim() === farmer.name.toLowerCase().trim())
  );

  res.json({ success: true, data: farmerSales, farmer });
});

mockRouter.get('/farmers/:id/bills', (req, res) => {
  const { id } = req.params;
  const farmer = farmers.find(f => f._id === id || f.phone === id || f.farmerCode === id);
  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

  const farmerSales = sales.filter(s =>
    (s.customerPhone && farmer.phone && s.customerPhone.trim() === farmer.phone.trim()) ||
    s.farmerId === farmer._id ||
    (s.customerName && farmer.name && s.customerName.toLowerCase().trim() === farmer.name.toLowerCase().trim())
  );

  res.json({ success: true, data: farmerSales, farmer });
});

mockRouter.post('/farmers/lookup-bills', (req, res) => {
  const { phone, query } = req.body;
  const searchTerm = (phone || query || '').trim().toLowerCase();

  const farmer = farmers.find(f =>
    f.phone.includes(searchTerm) ||
    f.name.toLowerCase().includes(searchTerm) ||
    (f.farmerCode && f.farmerCode.toLowerCase().includes(searchTerm))
  );

  if (!farmer) {
    return res.status(404).json({ success: false, message: 'No farmer account found with given phone or code.' });
  }

  const farmerSales = sales.filter(s =>
    (s.customerPhone && farmer.phone && s.customerPhone.trim() === farmer.phone.trim()) ||
    s.farmerId === farmer._id ||
    (s.customerName && farmer.name && s.customerName.toLowerCase().trim() === farmer.name.toLowerCase().trim())
  );

  res.json({
    success: true,
    data: {
      farmer,
      bills: farmerSales,
      totalBills: farmerSales.length,
      totalBilledAmount: farmerSales.reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0)
    }
  });
});

// --- PARTIES / CUSTOMERS ---
mockRouter.get('/parties', (_req, res) => {
  res.json({ success: true, data: farmers });
});

mockRouter.post('/parties', (req, res) => {
  const body = req.body;
  const newParty = {
    _id: 'pty_' + String(Date.now()).slice(-6),
    name: body.name || 'New Party',
    phone: body.phone || '',
    village: body.address || 'Guntur',
    district: body.city || 'Guntur',
    state: body.state || 'Andhra Pradesh',
    type: body.type || 'CUSTOMER'
  };
  res.json({ success: true, data: newParty });
});

// --- SALES & POS BILLING ---
mockRouter.get('/sales', (_req, res) => {
  res.json({ success: true, data: sales });
});

mockRouter.get('/sales/:id', (req, res) => {
  const { id } = req.params;
  const sale = sales.find(s => s._id === id || s.invoiceNo === id || s.invoiceNumber === id);
  if (!sale) return res.status(404).json({ success: false, message: 'Invoice not found.' });
  res.json({ success: true, data: sale });
});

mockRouter.post('/sales', (req, res) => {
  const body = req.body;
  const rawItems = Array.isArray(body.items) ? body.items : [];
  let subtotal = 0;

  const items = rawItems.map(item => {
    const qty = Number(item.quantity !== undefined ? item.quantity : (item.qty || 1));
    const rate = Number(item.unitPrice !== undefined ? item.unitPrice : (item.rate || 0));
    const amount = Number(item.total !== undefined ? item.total : (qty * rate));
    const name = item.productName || item.name || 'Agro Product';
    const unit = item.unit || 'Units';
    const productId = item.productId || item._id;

    subtotal += amount;

    // Deduct from inventory
    const prod = products.find(p => p._id === productId || p.name === name);
    if (prod) {
      prod.currentStock = Math.max(0, prod.currentStock - qty);
    }

    return {
      productId,
      name,
      productName: name,
      category: prod ? prod.category : (item.category || 'SEEDS'),
      unit,
      qty,
      quantity: qty,
      rate,
      unitPrice: rate,
      amount,
      total: amount
    };
  });

  const discount = Number(body.discount || 0);
  const tax = Math.round((subtotal - discount) * 0.12 * 100) / 100;
  const total = (subtotal - discount) + tax;
  const paid = Number(body.paidAmount !== undefined ? body.paidAmount : total);
  const balance = Math.max(0, total - paid);
  const invNum = 'INV-2026-' + String(sales.length + 1).padStart(3, '0');

  const matchedFarmer = farmers.find(f =>
    (body.farmerId && f._id === body.farmerId) ||
    (body.customerPhone && f.phone === body.customerPhone.trim())
  );

  const newSale = {
    _id: 'sale_' + String(Date.now()).slice(-6),
    invoiceNo: invNum,
    invoiceNumber: invNum,
    date: new Date().toISOString(),
    farmerId: matchedFarmer ? matchedFarmer._id : (body.farmerId || null),
    farmerCode: matchedFarmer ? matchedFarmer.farmerCode : null,
    customerName: matchedFarmer ? matchedFarmer.name : (body.customerName || 'Walk-in Customer'),
    customerPhone: matchedFarmer ? matchedFarmer.phone : (body.customerPhone || ''),
    customerAddress: matchedFarmer ? `${matchedFarmer.village}, ${matchedFarmer.district}` : (body.customerAddress || 'Guntur, Andhra Pradesh'),
    items,
    subtotal,
    discount,
    tax,
    grandTotal: total,
    total,
    paidAmount: paid,
    balanceDue: balance,
    paymentMode: body.paymentMode || 'CASH',
    paymentStatus: (paid >= total) ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'UNPAID'),
    notes: body.notes || '',
    createdAt: new Date().toISOString()
  };

  sales.unshift(newSale);

  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'CREATE_SALE',
    actor: 'Sales Staff',
    summary: `Generated bill ${newSale.invoiceNo} for ${newSale.customerName} (₹${newSale.grandTotal.toLocaleString('en-IN')})`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: newSale, message: 'Sale recorded and bill generated successfully.' });
});

mockRouter.get('/sales/:id/whatsapp', (req, res) => {
  const { id } = req.params;
  const sale = sales.find(s => s._id === id || s.invoiceNo === id || s.invoiceNumber === id);
  if (!sale) return res.status(404).json({ success: false, message: 'Invoice not found.' });

  const itemsList = sale.items.map((it, idx) => `${idx + 1}. *${it.name}* - ${it.qty} ${it.unit || 'unit'} @ ₹${it.rate} = ₹${it.amount}`).join('\n');
  const message = `🌾 *NIRMALA ENTERPRISES - TAX INVOICE*\n` +
    `--------------------------------------\n` +
    `📄 *Invoice No:* ${sale.invoiceNo}\n` +
    `📅 *Date:* ${new Date(sale.date).toLocaleDateString('en-IN')}\n` +
    `👤 *Customer:* ${sale.customerName}\n` +
    `📱 *Phone:* ${sale.customerPhone || 'N/A'}\n\n` +
    `📦 *Purchased Items:*\n${itemsList}\n\n` +
    `--------------------------------------\n` +
    `💵 *Subtotal:* ₹${sale.subtotal.toLocaleString('en-IN')}\n` +
    `✂️ *Discount:* ₹${sale.discount.toLocaleString('en-IN')}\n` +
    `🏛️ *GST (12%):* ₹${sale.tax.toLocaleString('en-IN')}\n` +
    `💰 *Grand Total:* ₹${sale.grandTotal.toLocaleString('en-IN')}\n` +
    `💳 *Paid Amount:* ₹${sale.paidAmount.toLocaleString('en-IN')}\n` +
    `⚖️ *Balance Due:* ₹${sale.balanceDue.toLocaleString('en-IN')}\n` +
    `💳 *Payment Mode:* ${sale.paymentMode} (${sale.paymentStatus})\n\n` +
    `*Guntur, Andhra Pradesh*\n` +
    `_Thank you for doing business with Nirmala Enterprises!_`;

  const phone = (sale.customerPhone || '').replace(/[^0-9]/g, '');
  const targetPhone = phone.length === 10 ? '91' + phone : phone;
  const whatsappUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(message)}`;

  res.json({
    success: true,
    data: {
      invoiceNo: sale.invoiceNo,
      phone: targetPhone,
      message,
      whatsappUrl
    }
  });
});

mockRouter.get('/farmers/:id/ledger', (req, res) => {
  const { id } = req.params;
  const farmer = farmers.find(f => f._id === id || f.phone === id);
  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

  const farmerPurchases = purchases.filter(p => p.farmerId === id);
  const farmerLoans = loans.filter(l => l.farmerId === id);
  const farmerSales = sales.filter(s => s.customerPhone === farmer.phone);

  const totalInputsPurchased = farmerSales.reduce((sum, s) => sum + (s.grandTotal || s.total || 0), 0);
  const totalCropSoldAmount = farmerPurchases.reduce((sum, p) => sum + (p.grossAmount || 0), 0);
  const totalAdvanceDisbursed = farmerLoans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalAdvanceDeducted = farmerPurchases.reduce((sum, p) => sum + (p.advanceDeduction || 0), 0);
  const netAdvanceBalance = Math.max(0, totalAdvanceDisbursed - totalAdvanceDeducted);

  res.json({
    success: true,
    data: {
      farmer,
      summary: {
        totalInputsPurchased,
        totalCropSoldAmount,
        totalAdvanceDisbursed,
        totalAdvanceDeducted,
        netAdvanceBalance,
        totalProcuredWeightKg: farmerPurchases.reduce((sum, p) => sum + (p.payableWeightKg || 0), 0)
      },
      sales: farmerSales,
      procurement: farmerPurchases,
      loans: farmerLoans
    }
  });
});

// --- INVOICES ---
mockRouter.get('/invoices', (_req, res) => {
  res.json({ success: true, data: sales });
});

mockRouter.get('/invoices/:id', (req, res) => {
  const { id } = req.params;
  const sale = sales.find(s => s._id === id || s.invoiceNo === id || s.invoiceNumber === id);
  if (!sale) return res.status(404).json({ success: false, message: 'Invoice not found.' });
  res.json({ success: true, data: sale });
});

// --- PURCHASES & COMMODITY PROCUREMENT ---
mockRouter.get('/purchases', (_req, res) => {
  res.json({ success: true, data: purchases });
});

mockRouter.post('/purchases', (req, res) => {
  const body = req.body;
  const gross = Number(body.grossWeight || 0);
  const tare = Number(body.tareWeight || 0);
  const moisture = Number(body.moistureDeductionKg || 0);
  const net = Math.max(0, gross - tare);
  const payable = Math.max(0, net - moisture);
  const rate = Number(body.ratePerKg || 0);
  const grossAmt = payable * rate;
  const advDeduction = Number(body.advanceDeduction || 0);
  const netPayable = Math.max(0, grossAmt - advDeduction);

  const farmer = farmers.find(f => f._id === body.farmerId);

  const newPurchase = {
    _id: 'pur_' + String(Date.now()).slice(-6),
    receiptNumber: 'PRC-2026-' + String(purchases.length + 1).padStart(3, '0'),
    farmerId: body.farmerId || '',
    farmerName: farmer ? farmer.name : (body.farmerName || 'Walk-in Farmer'),
    commodity: body.commodity || 'Dried Red Chilli',
    grossWeight: gross,
    tareWeight: tare,
    netWeight: net,
    moistureDeductionKg: moisture,
    payableWeightKg: payable,
    ratePerKg: rate,
    grossAmount: grossAmt,
    advanceDeduction: advDeduction,
    netPayable,
    bagCount: Number(body.bagCount || 0),
    qualityGrade: body.qualityGrade || 'Grade A',
    status: 'COMPLETED',
    createdAt: new Date().toISOString()
  };

  purchases.unshift(newPurchase);

  // Add to commodity inventory
  const prod = products.find(p => p.category === 'COMMODITIES' && p.name.toLowerCase().includes(newPurchase.commodity.toLowerCase()));
  if (prod) {
    prod.currentStock += Math.round((payable / 100) * 10) / 10;
  }

  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'PROCUREMENT_IN',
    actor: 'Operations Manager',
    summary: `Procured ${payable} kg of ${newPurchase.commodity} from ${newPurchase.farmerName} (Net Payable: ₹${netPayable.toLocaleString('en-IN')})`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: newPurchase, message: 'Procurement recorded successfully.' });
});

// --- LOANS & FARMER CREDIT ---
mockRouter.get('/loans', (_req, res) => {
  res.json({ success: true, data: loans });
});

mockRouter.post('/loans/disburse', (req, res) => {
  const body = req.body;
  const farmer = farmers.find(f => f._id === body.farmerId);

  const newLoan = {
    _id: 'loan_' + String(Date.now()).slice(-6),
    loanNumber: 'ADV-2026-' + String(loans.length + 1).padStart(3, '0'),
    farmerId: body.farmerId || '',
    farmerName: farmer ? farmer.name : 'Unknown Farmer',
    amount: Number(body.amount || 0),
    interestRate: Number(body.interestRate || 0),
    purpose: body.purpose || 'Agricultural Inputs Advance',
    tenureMonths: Number(body.tenureMonths || 6),
    paymentMode: body.paymentMode || 'CASH',
    status: 'ACTIVE',
    disbursedAt: new Date().toISOString()
  };

  loans.unshift(newLoan);
  if (farmer) {
    farmer.outstandingAdvance = (farmer.outstandingAdvance || 0) + newLoan.amount;
  }

  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'DISBURSE_ADVANCE',
    actor: 'Administrator',
    summary: `Disbursed advance of ₹${newLoan.amount.toLocaleString('en-IN')} to ${newLoan.farmerName}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: newLoan, message: 'Advance disbursed successfully.' });
});

// --- P&L REPORTS ---
mockRouter.get('/reports/pnl', (_req, res) => {
  const totalRevenue = sales.reduce((sum, s) => sum + (s.total || 0), 0) + 1250000;
  const cogs = Math.round(totalRevenue * 0.72);
  const grossProfit = totalRevenue - cogs;
  const operatingExpenses = 185000;
  const netProfit = grossProfit - operatingExpenses;

  res.json({
    success: true,
    data: {
      totalRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      netProfit,
      marginPercent: Math.round((netProfit / totalRevenue) * 100 * 10) / 10,
      monthlyBreakdown: [
        { month: 'Oct 2025', revenue: 210000, expenses: 165000, profit: 45000 },
        { month: 'Nov 2025', revenue: 280000, expenses: 195000, profit: 85000 },
        { month: 'Dec 2025', revenue: 340000, expenses: 240000, profit: 100000 },
        { month: 'Jan 2026', revenue: 420000, expenses: 290000, profit: 130000 },
        { month: 'Feb 2026', revenue: 490000, expenses: 320000, profit: 170000 }
      ]
    }
  });
});

// --- AUDIT LOGS ---
mockRouter.get('/audit', (_req, res) => {
  res.json({ success: true, data: auditLogs });
});

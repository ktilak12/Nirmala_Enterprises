import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromFile(filename, defaultData) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error(`[STORAGE] Error reading ${filename}:`, err.message);
  }
  saveToFile(filename, defaultData);
  return defaultData;
}

function saveToFile(filename, data) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[STORAGE] Error saving ${filename}:`, err.message);
  }
}

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/\r?\n/g, ' ').trim();
  if (str.includes(',') || str.includes('"') || str.includes(';')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}


export const mockRouter = Router();

// In-Memory Database with Rich Pre-loaded Dummy Data
let products = loadFromFile('products.json', [
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
    brand: 'Odisha State Seeds Corp (OSSC)',
    purchasePrice: 650,
    sellingPrice: 760,
    currentStock: 280,
    minStockAlert: 30,
    description: 'Medium slender certified long-grain paddy seed (25 kg bag).'
  },
  {
    _id: 'prod_003',
    productCode: 'SED-MS-03',
    name: 'Mustard Seed (Pusa Bold / M-27)',
    category: 'SEEDS',
    unit: 'Bags',
    brand: 'OSSC Certified',
    purchasePrice: 420,
    sellingPrice: 510,
    currentStock: 120,
    minStockAlert: 20,
    description: 'High oil yielding certified mustard seed for winter cultivation.'
  },
  {
    _id: 'prod_004',
    productCode: 'FRT-UR-04',
    name: 'Neem Coated Urea (45 kg)',
    category: 'FERTILIZERS',
    unit: 'Bags',
    brand: 'KRIBHCO / IFFCO',
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
    name: 'NPK 10:26:26 (50 kg)',
    category: 'FERTILIZERS',
    unit: 'Bags',
    brand: 'IFFCO',
    purchasePrice: 1320,
    sellingPrice: 1450,
    currentStock: 65,
    minStockAlert: 15,
    description: 'High potassium and phosphorus complex fertilizer for paddy and grains.'
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
    description: 'Systemic post-emergence herbicide for inter-row weed control.'
  },
  {
    _id: 'prod_009',
    productCode: 'CMD-MZ-09',
    name: 'Yellow Maize (Feed Quality Grade A)',
    category: 'COMMODITIES',
    unit: 'Quintals',
    brand: 'Odisha Mandi Procured',
    purchasePrice: 2150,
    sellingPrice: 2380,
    currentStock: 450,
    minStockAlert: 50,
    description: 'Sun-dried clean yellow feed maize procured directly from Odisha farmers.'
  },
  {
    _id: 'prod_010',
    productCode: 'CMD-PD-10',
    name: 'Paddy / Rice (Swarna MTU-7029)',
    category: 'COMMODITIES',
    unit: 'Quintals',
    brand: 'Bargarh Mandi Procured',
    purchasePrice: 2350,
    sellingPrice: 2580,
    currentStock: 380,
    minStockAlert: 40,
    description: 'High-grade slender grain Swarna paddy with calibrated moisture.'
  }
]);

let farmers = loadFromFile('farmers.json', [
  {
    _id: 'frm_001',
    farmerCode: 'FARM-001',
    name: 'Ramesh Chandra Sahu',
    fatherName: 'Birendra Sahu',
    phone: '9861012345',
    aadhaarNumber: '7891 2345 6789',
    aadhaarVerified: true,
    village: 'Attabira',
    district: 'Bargarh',
    state: 'Odisha',
    landAcres: 12.5,
    primaryCrop: 'Paddy & Maize',
    bankName: 'Utkal Grameen Bank',
    accountNumber: '30982241908',
    ifscCode: 'UBGB0001234',
    outstandingAdvance: 45000,
    totalProcuredQuintals: 185,
    createdAt: '2026-01-10T09:30:00.000Z'
  },
  {
    _id: 'frm_002',
    farmerCode: 'FARM-002',
    name: 'Pradeep Mohapatra',
    fatherName: 'Jogendra Mohapatra',
    phone: '9437156789',
    aadhaarNumber: '4532 9012 3456',
    aadhaarVerified: true,
    village: 'Bheden',
    district: 'Bargarh',
    state: 'Odisha',
    landAcres: 8.0,
    primaryCrop: 'Paddy & Pulses',
    bankName: 'Odisha Gramya Bank',
    accountNumber: '71008892341',
    ifscCode: 'OGBA0005432',
    outstandingAdvance: 18000,
    totalProcuredQuintals: 120,
    createdAt: '2026-01-15T11:15:00.000Z'
  },
  {
    _id: 'frm_003',
    farmerCode: 'FARM-003',
    name: 'Bikash Kumar Meher',
    fatherName: 'Surendra Meher',
    phone: '9937024680',
    aadhaarNumber: '6721 8934 5612',
    aadhaarVerified: true,
    village: 'Barpali',
    district: 'Bargarh',
    state: 'Odisha',
    landAcres: 15.0,
    primaryCrop: 'Paddy & Mustard',
    bankName: 'State Bank of India',
    accountNumber: '54019283741',
    ifscCode: 'SBIN0002145',
    outstandingAdvance: 60000,
    totalProcuredQuintals: 240,
    createdAt: '2026-01-20T14:00:00.000Z'
  },
  {
    _id: 'frm_004',
    farmerCode: 'FARM-004',
    name: 'Niranjan Pradhan',
    fatherName: 'Kishore Pradhan',
    phone: '9861112233',
    aadhaarNumber: '9012 3456 7890',
    aadhaarVerified: true,
    village: 'Maneswar',
    district: 'Sambalpur',
    state: 'Odisha',
    landAcres: 6.5,
    primaryCrop: 'Maize & Groundnut',
    bankName: 'Canara Bank',
    accountNumber: '11209485721',
    ifscCode: 'CNRB0003891',
    outstandingAdvance: 0,
    totalProcuredQuintals: 95,
    createdAt: '2026-02-01T10:45:00.000Z'
  },
  {
    _id: 'frm_005',
    farmerCode: 'FARM-005',
    name: 'Subash Chandra Majhi',
    fatherName: 'Debendra Majhi',
    phone: '9777239876',
    aadhaarNumber: '3456 7890 1234',
    aadhaarVerified: true,
    village: 'Kansabahal',
    district: 'Sundargarh',
    state: 'Odisha',
    landAcres: 20.0,
    primaryCrop: 'Maize & Paddy',
    bankName: 'HDFC Bank',
    accountNumber: '50100984729',
    ifscCode: 'HDFC0001092',
    outstandingAdvance: 85000,
    totalProcuredQuintals: 360,
    createdAt: '2026-02-10T16:20:00.000Z'
  }
]);

let sales = loadFromFile('sales.json', [
  {
    _id: 'sale_001',
    invoiceNo: 'INV-2026-001',
    invoiceNumber: 'INV-2026-001',
    date: '2026-02-24T11:30:00.000Z',
    farmerId: 'frm_001',
    farmerCode: 'FARM-001',
    customerName: 'Ramesh Chandra Sahu',
    customerPhone: '9861012345',
    customerAddress: 'Attabira, Bargarh, Odisha',
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
    customerName: 'Pradeep Mohapatra',
    customerPhone: '9437156789',
    customerAddress: 'Bheden, Bargarh, Odisha',
    items: [
      { productId: 'prod_002', productCode: 'PRD-102', name: 'Paddy Seed IR-64 (Certified)', productName: 'Paddy Seed IR-64 (Certified)', category: 'SEEDS', unit: 'Bags', qty: 6, quantity: 6, rate: 760, unitPrice: 760, gstRate: 12, amount: 4560, total: 4560 },
      { productId: 'prod_006', productCode: 'PRD-106', name: 'NPK 10:26:26 (50 kg)', productName: 'NPK 10:26:26 (50 kg)', category: 'FERTILIZERS', unit: 'Bags', qty: 5, quantity: 5, rate: 1450, unitPrice: 1450, gstRate: 12, amount: 7250, total: 7250 }
    ],
    subtotal: 11810,
    taxTotal: 1393.20,
    discount: 200,
    tax: 1393.20,
    grandTotal: 13003.20,
    total: 13003.20,
    paidAmount: 13003.20,
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
    customerName: 'Bikash Kumar Meher',
    customerPhone: '9937024680',
    customerAddress: 'Barpali, Bargarh, Odisha',
    items: [
      { productId: 'prod_003', productCode: 'PRD-103', name: 'Mustard Seed (Pusa Bold / M-27)', productName: 'Mustard Seed (Pusa Bold / M-27)', category: 'SEEDS', unit: 'Bags', qty: 10, quantity: 10, rate: 510, unitPrice: 510, gstRate: 12, amount: 5100, total: 5100 },
      { productId: 'prod_007', productCode: 'PRD-107', name: 'Chlorpyrifos 20% EC (1 Ltr)', productName: 'Chlorpyrifos 20% EC (1 Ltr)', category: 'PESTICIDES', unit: 'Bottles', qty: 4, quantity: 4, rate: 460, unitPrice: 460, gstRate: 12, amount: 1840, total: 1840 }
    ],
    subtotal: 6940,
    taxTotal: 832.80,
    discount: 240,
    tax: 832.80,
    grandTotal: 7532.80,
    total: 7532.80,
    paidAmount: 5000.00,
    balanceDue: 2532.80,
    paymentMode: 'CASH',
    paymentStatus: 'PARTIAL',
    notes: 'Advance input delivery - balance payable after harvest.',
    createdAt: '2026-02-28T09:45:00.000Z'
  }
]);

let purchases = loadFromFile('purchases.json', [
  {
    _id: 'pur_001',
    receiptNumber: 'PRC-2026-001',
    farmerId: 'frm_001',
    farmerName: 'Ramesh Chandra Sahu',
    commodity: 'Paddy / Rice (Swarna MTU-7029)',
    grossWeight: 4250,
    tareWeight: 150,
    netWeight: 4100,
    moistureDeductionKg: 40,
    payableWeightKg: 4060,
    ratePerKg: 23.5,
    grossAmount: 95410,
    advanceDeduction: 25000,
    netPayable: 70410,
    bagCount: 82,
    qualityGrade: 'Grade A',
    status: 'COMPLETED',
    createdAt: '2026-02-25T14:30:00.000Z'
  },
  {
    _id: 'pur_002',
    receiptNumber: 'PRC-2026-002',
    farmerId: 'frm_003',
    farmerName: 'Bikash Kumar Meher',
    commodity: 'Yellow Maize (Feed Quality Grade A)',
    grossWeight: 5800,
    tareWeight: 200,
    netWeight: 5600,
    moistureDeductionKg: 60,
    payableWeightKg: 5540,
    ratePerKg: 21.5,
    grossAmount: 119110,
    advanceDeduction: 30000,
    netPayable: 89110,
    bagCount: 112,
    qualityGrade: 'Grade A',
    status: 'COMPLETED',
    createdAt: '2026-02-27T16:00:00.000Z'
  }
]);

let loans = loadFromFile('loans.json', [
  {
    _id: 'loan_001',
    loanNo: 'ADV-2026-001',
    loanNumber: 'ADV-2026-001',
    loanType: 'CROP_ADVANCE',
    farmerId: 'frm_001',
    farmerName: 'Ramesh Chandra Sahu',
    farmerPhone: '9861012345',
    village: 'Attabira',
    district: 'Bargarh',
    isExternalBorrower: false,
    principalAmount: 45000,
    amount: 45000,
    interestRate: 0,
    interestType: 'SIMPLE',
    interestAccrued: 0,
    interestWaived: 0,
    totalRepaid: 45000,
    outstandingBalance: 0,
    purpose: 'Crop cultivation inputs & fertilizer advance',
    tenureMonths: 6,
    disbursedAt: '2026-01-10T10:00:00.000Z',
    date: '2026-01-10T10:00:00.000Z',
    dueDate: '2026-07-10T10:00:00.000Z',
    status: 'CLOSED',
    paymentMode: 'BANK_TRANSFER',
    collateral: null,
    repayments: [
      {
        repaymentId: 'rep_001',
        date: '2026-02-25T14:30:00.000Z',
        amount: 45000,
        principalPaid: 45000,
        interestPaid: 0,
        method: 'HARVEST_OFFSET',
        notes: 'Offset against Swarna Paddy procurement PRC-2026-001'
      }
    ]
  },
  {
    _id: 'loan_002',
    loanNo: 'ADV-2026-002',
    loanNumber: 'ADV-2026-002',
    loanType: 'GOLD_COLLATERAL_LOAN',
    farmerId: 'frm_003',
    farmerName: 'Bikash Kumar Meher',
    farmerPhone: '9937024680',
    village: 'Barpali',
    district: 'Bargarh',
    isExternalBorrower: false,
    principalAmount: 60000,
    amount: 60000,
    interestRate: 12,
    interestType: 'SIMPLE',
    interestAccrued: 1200,
    interestWaived: 0,
    totalRepaid: 20000,
    outstandingBalance: 41200,
    purpose: 'Pledge 22K Gold Bangles for tractor repair & sowing',
    tenureMonths: 12,
    disbursedAt: '2026-01-20T14:30:00.000Z',
    date: '2026-01-20T14:30:00.000Z',
    dueDate: '2027-01-20T14:30:00.000Z',
    status: 'PARTIALLY_PAID',
    paymentMode: 'CASH',
    collateral: {
      type: 'GOLD',
      itemDescription: '22K Gold Bangles (2 pcs)',
      grossWeightGrams: 18.5,
      netWeightGrams: 16.8,
      purityKarat: '22K (916)',
      marketValue: 92400,
      lockerReference: 'Safe Locker B-04 / Pkt #112',
      remarks: 'Verified purity and weighed with calibrated digital scale'
    },
    repayments: [
      {
        repaymentId: 'rep_002',
        date: '2026-02-15T11:00:00.000Z',
        amount: 20000,
        principalPaid: 20000,
        interestPaid: 0,
        method: 'UPI',
        notes: 'Intermediate cash repayment from tractor custom hiring income'
      }
    ]
  },
  {
    _id: 'loan_003',
    loanNo: 'ADV-2026-003',
    loanNumber: 'ADV-2026-003',
    loanType: 'CROP_ADVANCE',
    farmerId: 'frm_005',
    farmerName: 'Subash Chandra Majhi',
    farmerPhone: '9777239876',
    village: 'Kansabahal',
    district: 'Sundargarh',
    isExternalBorrower: false,
    principalAmount: 85000,
    amount: 85000,
    interestRate: 6,
    interestType: 'SIMPLE',
    interestAccrued: 425,
    interestWaived: 0,
    totalRepaid: 0,
    outstandingBalance: 85425,
    purpose: 'Maize sowing and crop protection financing',
    tenureMonths: 6,
    disbursedAt: '2026-02-10T16:30:00.000Z',
    date: '2026-02-10T16:30:00.000Z',
    dueDate: '2026-08-10T16:30:00.000Z',
    status: 'ACTIVE',
    paymentMode: 'BANK_TRANSFER',
    collateral: null,
    repayments: []
  },
  {
    _id: 'loan_004',
    loanNo: 'ADV-2026-004',
    loanNumber: 'ADV-2026-004',
    loanType: 'GOLD_COLLATERAL_LOAN',
    farmerId: null,
    farmerName: 'Kailash Sahu (External Village)',
    farmerPhone: '9861882244',
    village: 'Gaisilet',
    district: 'Bargarh',
    isExternalBorrower: true,
    principalAmount: 50000,
    amount: 50000,
    interestRate: 18,
    interestType: 'SIMPLE',
    interestAccrued: 750,
    interestWaived: 0,
    totalRepaid: 15000,
    outstandingBalance: 35750,
    purpose: 'Gold Chain pledge for seasonal irrigation pump setup',
    tenureMonths: 12,
    disbursedAt: '2026-02-18T10:15:00.000Z',
    date: '2026-02-18T10:15:00.000Z',
    dueDate: '2027-02-18T10:15:00.000Z',
    status: 'PARTIALLY_PAID',
    paymentMode: 'CASH',
    collateral: {
      type: 'GOLD',
      itemDescription: '22K Hallmarked Gold Chain (1 pc)',
      grossWeightGrams: 14.2,
      netWeightGrams: 14.2,
      purityKarat: '22K (916)',
      marketValue: 78100,
      lockerReference: 'Safe Locker A-08 / Pkt #205',
      remarks: 'Customer from neighboring village Gaisilet with Aadhaar verified'
    },
    repayments: [
      {
        repaymentId: 'rep_003',
        date: '2026-03-01T15:30:00.000Z',
        amount: 15000,
        principalPaid: 15000,
        interestPaid: 0,
        method: 'CASH',
        notes: 'Intermediate part payment received at counter'
      }
    ]
  }
]);

let mandiRates = [];

let auditLogs = loadFromFile('auditLogs.json', [
  { _id: 'aud_001', action: 'CREATE_SALE', actor: 'System Administrator', summary: 'Invoice INV-2026-001 created for Ramesh Chandra Sahu (₹17,279.36)', timestamp: '2026-02-24T11:30:00.000Z' },
  { _id: 'aud_002', action: 'PROCUREMENT_IN', actor: 'Operations Manager', summary: 'Paddy procurement PR-2026-001 from Ramesh Chandra Sahu (40.6 Qtl)', timestamp: '2026-02-25T14:30:00.000Z' },
  { _id: 'aud_003', action: 'DISBURSE_ADVANCE', actor: 'System Administrator', summary: 'Seed advance disbursed to Bikash Kumar Meher (₹60,000)', timestamp: '2026-01-20T14:30:00.000Z' }
]);

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
  const todaySales = sales.reduce((sum, s) => sum + (Number(s.grandTotal !== undefined ? s.grandTotal : s.total) || 0), 0);
  const totalProcurement = purchases.reduce((sum, p) => sum + (Number(p.grossAmount !== undefined ? p.grossAmount : p.netPayable) || 0), 0);
  const totalInventoryValue = products.reduce((sum, p) => sum + ((Number(p.currentStock) || 0) * (Number(p.purchasePrice) || 0)), 0);
  const outstandingLending = loans.filter(l => l.status === 'ACTIVE').reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const lowStockCount = products.filter(p => p.currentStock <= p.minStockAlert).length;
  const procurementQtl = purchases.reduce((sum, p) => sum + ((Number(p.payableWeightKg) || 0) / 100), 0);

  // Dynamic daily sales breakdown for the last 14 days
  const todayDate = new Date();
  const todayStr = todayDate.toISOString().split('T')[0];
  const dailySales = [];
  const baseDailyAmounts = [18400, 24600, 15200, 29800, 31200, 21500, 38400, 26700, 33100, 29400, 41200, 35600, 28900];

  for (let i = 13; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = i === 0;
    const dayName = isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' });
    const label = isToday ? 'Today' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    // Filter sales matching this specific date
    const daySales = sales.filter(s => {
      const sDate = new Date(s.date || s.createdAt).toISOString().split('T')[0];
      return sDate === dateStr;
    });

    const recordedTotal = daySales.reduce((sum, s) => sum + (Number(s.grandTotal !== undefined ? s.grandTotal : s.total) || 0), 0);
    const baseAmount = isToday ? 0 : (baseDailyAmounts[13 - i] || 22000);
    const amount = isToday ? (recordedTotal > 0 ? recordedTotal : todaySales) : (recordedTotal > 0 ? recordedTotal : baseAmount);
    const count = daySales.length > 0 ? daySales.length : (isToday ? sales.length : Math.max(1, Math.round(amount / 9500)));

    dailySales.push({
      date: dateStr,
      dayName,
      label,
      amount: Math.round(amount),
      count
    });
  }

  // Monthly sales breakdown
  const monthlySales = [];
  const baseMonthly = [380000, 460000, 590000, 710000, 840000, 920000];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setMonth(d.getMonth() - i);
    const label = d.toLocaleDateString('en-IN', { month: 'short' });
    const isCurrentMonth = i === 0;
    const amt = isCurrentMonth ? (baseMonthly[5] + Math.round(todaySales)) : baseMonthly[5 - i];
    monthlySales.push({
      label,
      amount: amt,
      count: Math.round(amt / 11000)
    });
  }

  const statsObj = {
    todaySales: Math.round(todaySales),
    totalRevenue: Math.round(todaySales),
    salesCount: sales.length,
    farmerAdvances: outstandingLending,
    registeredFarmers: farmers.length,
    totalProducts: products.length,
    lowStockAlerts: lowStockCount,
    procurementVolumeQtl: Math.round(procurementQtl * 10) / 10,
    netProfit: Math.round(todaySales * 0.18)
  };

  res.json({
    success: true,
    data: {
      todaySales: Math.round(todaySales),
      totalProcurement: Math.round(totalProcurement),
      totalInventoryValue: Math.round(totalInventoryValue),
      outstandingLending: Math.round(outstandingLending),
      lowStockCount,
      stats: statsObj,
      dailySales,
      monthlySales,
      lowStockProducts: products.filter(p => p.currentStock <= p.minStockAlert),
      recentSales: sales.slice(0, 5),
      recentPurchases: purchases.slice(0, 5)
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
  saveToFile('products.json', products);
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

// --- CIBIL CREDIT ENGINE FOR FARMERS ---
function calculateFarmerCibil(farmer, farmerSales = [], farmerPurchases = [], farmerLoans = []) {
  let score = 700;

  const closedLoans = farmerLoans.filter(l => l.status === 'CLOSED').length;
  const overdueLoans = farmerLoans.filter(l => l.status === 'OVERDUE').length;
  const partiallyPaidLoans = farmerLoans.filter(l => l.status === 'PARTIALLY_PAID').length;
  const totalLoans = farmerLoans.length;

  let totalRepaymentsCount = 0;
  farmerLoans.forEach(l => {
    if (Array.isArray(l.repayments)) totalRepaymentsCount += l.repayments.length;
  });

  // Repayment bonuses
  score += closedLoans * 40;
  score += partiallyPaidLoans * 15;
  score += totalRepaymentsCount * 15;

  // Delinquency penalty
  score -= overdueLoans * 120;

  // Sales bill payments
  const paidBills = farmerSales.filter(s => (s.balanceDue || 0) <= 0).length;
  const unpaidBills = farmerSales.filter(s => (s.balanceDue || 0) > 0).length;
  score += paidBills * 20;
  score -= unpaidBills * 30;

  // Mandi procurement volume bonus
  const totalProcuredKg = farmerPurchases.reduce((sum, p) => sum + (p.payableWeightKg || 0), 0);
  if (totalProcuredKg > 8000) score += 35;
  else if (totalProcuredKg > 2000) score += 20;

  // Demo anchors ensuring Green, Orange, and Red representation
  if (farmer._id === 'frm_001' || farmer.name?.includes('Ramesh')) {
    score = 810; // GREEN - Spotless track record
  } else if (farmer._id === 'frm_003' || farmer.name?.includes('Bikash')) {
    score = 690; // ORANGE - Moderate with active advance
  } else if (farmer._id === 'frm_002' || farmer.name?.includes('Pradeep')) {
    score = 720; // ORANGE - Moderate with part repayment
  } else if (farmer._id === 'frm_005' || farmer.name?.includes('Subash')) {
    score = 540; // RED - High overdue risk
  }

  score = Math.max(300, Math.min(900, Math.round(score)));

  let category = 'GREEN';
  let rating = 'Excellent';
  let riskLevel = 'Low Credit Risk';
  let recommendation = 'Pre-approved for instant seasonal crop credit up to ₹1,50,000 at prime rates.';

  if (score >= 750) {
    category = 'GREEN';
    rating = 'Excellent';
    riskLevel = 'Low Credit Risk';
    recommendation = 'Pre-approved for instant seasonal crop credit up to ₹1,50,000 at prime rates.';
  } else if (score >= 650) {
    category = 'ORANGE';
    rating = 'Moderate / Fair';
    riskLevel = 'Medium Credit Risk';
    recommendation = 'Standard advances allowed up to ₹50,000 with harvest lien or co-borrower endorsement.';
  } else {
    category = 'RED';
    rating = 'Poor / High Risk';
    riskLevel = 'High Credit Risk';
    recommendation = 'High risk. Unsecured advances restricted. 100% Gold collateral pledge recommended.';
  }

  return {
    score,
    category, // 'GREEN' | 'ORANGE' | 'RED'
    rating,
    riskLevel,
    recommendation,
    closedLoans,
    overdueLoans,
    partiallyPaidLoans,
    totalRepaymentsCount,
    onTimeRate: totalLoans > 0 ? Math.round(((closedLoans + (partiallyPaidLoans * 0.7)) / totalLoans) * 100) : 100
  };
}

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
    const totalActiveAdvances = farmerLoans.filter(l => l.status === 'ACTIVE' || l.status === 'PARTIALLY_PAID').reduce((sum, l) => sum + (l.outstandingBalance !== undefined ? l.outstandingBalance : (l.amount || 0)), 0);
    const currentBalance = totalBillsDue + totalActiveAdvances;
    const totalProcuredQtl = farmerPurchases.reduce((sum, p) => sum + ((p.payableWeightKg || 0) / 100), 0);

    const cibil = calculateFarmerCibil(farmer, farmerSales, farmerPurchases, farmerLoans);
    const maskedAadhaar = farmer.aadhaarNumber ? `•••• •••• ${farmer.aadhaarNumber.replace(/\s+/g, '').slice(-4)}` : '•••• •••• 1234';

    return {
      ...farmer,
      currentBalance,
      outstandingAdvance: totalActiveAdvances,
      totalProcuredQuintals: totalProcuredQtl || farmer.totalProcuredQuintals || 0,
      totalBillsCount: farmerSales.length,
      cibil,
      aadhaarNumber: farmer.aadhaarNumber || '7891 2345 6789',
      maskedAadhaar,
      aadhaarVerified: farmer.aadhaarVerified !== false
    };
  });

  res.json({ success: true, data: enrichedFarmers });
});

mockRouter.post('/farmers', (req, res) => {
  const body = req.body;
  const rawAadhaar = (body.aadhaarNumber || '').replace(/[^0-9]/g, '');
  const formattedAadhaar = rawAadhaar.length >= 12
    ? `${rawAadhaar.slice(0, 4)} ${rawAadhaar.slice(4, 8)} ${rawAadhaar.slice(8, 12)}`
    : (body.aadhaarNumber || '7891 2345 6789');

  const newFarmer = {
    _id: 'frm_' + String(Date.now()).slice(-6),
    farmerCode: 'FARM-' + String(farmers.length + 1).padStart(3, '0'),
    name: body.name || 'Unknown Farmer',
    fatherName: body.fatherName || '',
    phone: body.phone || '',
    aadhaarNumber: formattedAadhaar,
    aadhaarVerified: true,
    village: body.village || 'Bargarh',
    district: body.district || 'Bargarh',
    state: body.state || 'Odisha',
    landAcres: Number(body.landAcres || 0),
    primaryCrop: body.primaryCrop || 'Paddy',
    bankName: body.bankName || '',
    accountNumber: body.accountNumber || '',
    ifscCode: body.ifscCode || '',
    outstandingAdvance: 0,
    currentBalance: 0,
    totalProcuredQuintals: 0,
    createdAt: new Date().toISOString()
  };
  farmers.unshift(newFarmer);
  saveToFile('farmers.json', farmers);
  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'REGISTER_FARMER',
    actor: 'Administrator',
    summary: `Registered farmer ${newFarmer.name} (Aadhaar: ${newFarmer.aadhaarNumber}) from ${newFarmer.village}`,
    timestamp: new Date().toISOString()
  });
  res.json({ success: true, data: newFarmer, message: 'Farmer registered successfully with Aadhaar verification.' });
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
  const totalAdvancesTaken = farmerLoans.reduce((sum, l) => sum + (l.principalAmount || l.amount || 0), 0);
  const totalAdvancesDeducted = farmerPurchases.reduce((sum, p) => sum + (p.advanceDeduction || 0), 0);
  const unpaidBillsBalance = farmerSales.reduce((sum, s) => sum + (s.balanceDue || 0), 0);
  const activeAdvanceBalance = farmerLoans.filter(l => l.status === 'ACTIVE' || l.status === 'PARTIALLY_PAID').reduce((sum, l) => sum + (l.outstandingBalance !== undefined ? l.outstandingBalance : (l.amount || 0)), 0);
  const currentNetBalance = unpaidBillsBalance + activeAdvanceBalance;

  // Build Chronological Timeline items:
  const timeline = [];

  // 1. Input Purchases (Bills)
  farmerSales.forEach(s => {
    const itemsSummary = (s.items || []).map(it => `${it.qty} ${it.unit || 'unit'} ${it.name}`).join(', ');
    timeline.push({
      type: 'INPUT_PURCHASE',
      title: `Input Purchase Bill #${s.invoiceNo || s.invoiceNumber}`,
      details: `${itemsSummary || 'Agricultural Inputs'} • Status: ${s.paymentStatus || 'PAID'} (${s.paymentMode || 'CASH'})`,
      amount: s.grandTotal || s.total || 0,
      balanceDue: s.balanceDue || 0,
      invoiceNo: s.invoiceNo || s.invoiceNumber,
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
      netPayable: p.netPayable,
      advanceDeduction: p.advanceDeduction,
      receiptNumber: p.receiptNumber,
      date: p.date || p.createdAt || new Date().toISOString(),
      raw: p
    });

    if (p.advanceDeduction > 0) {
      timeline.push({
        type: 'ADVANCE_DEDUCTION',
        title: `Harvest Advance Deduction (PRC #${p.receiptNumber})`,
        details: `Offset ₹${p.advanceDeduction.toLocaleString('en-IN')} against ${p.commodity} delivery payout`,
        amount: p.advanceDeduction,
        date: p.date || p.createdAt || new Date().toISOString(),
        raw: p
      });
    }
  });

  // 3. Advances Disbursed & Repayments
  farmerLoans.forEach(l => {
    timeline.push({
      type: 'ADVANCE_DISBURSED',
      title: `Seasonal Advance #${l.loanNo || l.loanNumber}`,
      details: `${l.purpose || 'Crop Sowing Finance'} • Status: ${l.status} (${l.paymentMode || 'CASH'})` + (l.collateral ? ` [Gold: ${l.collateral.grossWeightGrams || 0}g in ${l.collateral.lockerReference || 'Safe'}]` : ''),
      amount: l.principalAmount || l.amount || 0,
      loanNo: l.loanNo || l.loanNumber,
      date: l.disbursedAt || l.date || l.createdAt || new Date().toISOString(),
      raw: l
    });

    if (Array.isArray(l.repayments)) {
      l.repayments.forEach(rep => {
        timeline.push({
          type: 'LOAN_REPAYMENT',
          title: `Advance Repayment #${l.loanNo || l.loanNumber}`,
          details: `Part-repayment via ${rep.method || 'CASH'} • ${rep.notes || 'Counter Receipt'}`,
          amount: rep.amount || 0,
          loanNo: l.loanNo || l.loanNumber,
          date: rep.date || new Date().toISOString(),
          raw: rep
        });
      });
    }
  });

  // Sort timeline chronologically (newest first)
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

  const cibil = calculateFarmerCibil(farmer, farmerSales, farmerPurchases, farmerLoans);
  const maskedAadhaar = farmer.aadhaarNumber ? `•••• •••• ${farmer.aadhaarNumber.replace(/\s+/g, '').slice(-4)}` : '•••• •••• 1234';

  res.json({
    success: true,
    data: {
      farmer: {
        ...farmer,
        currentBalance: currentNetBalance,
        outstandingAdvance: activeAdvanceBalance,
        cibil,
        aadhaarNumber: farmer.aadhaarNumber || '7891 2345 6789',
        maskedAadhaar,
        aadhaarVerified: farmer.aadhaarVerified !== false
      },
      cibil,
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
    village: body.address || 'Bargarh',
    district: body.city || 'Bargarh',
    state: body.state || 'Odisha',
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
    customerAddress: matchedFarmer ? `${matchedFarmer.village}, ${matchedFarmer.district}` : (body.customerAddress || 'Bargarh, Odisha'),
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
  saveToFile('sales.json', sales);

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
    `*Bargarh, Odisha*\n` +
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
    commodity: body.commodity || 'Yellow Maize (Corn)',
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
  saveToFile('purchases.json', purchases);
  saveToFile('products.json', products);

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

// --- LIVE GOLD BULLION RATES (ODISHA APMC BENCHMARK) ---
const defaultGoldRates = {
  rate24kPerGram: 7280,
  rate22kPerGram: 6675,
  rate18kPerGram: 5460,
  rate24kPer10g: 72800,
  rate22kPer10g: 66750,
  silverPerKg: 86500,
  changeToday: '+₹45 (+0.68%)',
  trend: 'UP',
  marketSource: 'Odisha Bullion / Bargarh APMC Lending Benchmark',
  lastUpdated: new Date().toISOString()
};

let goldRates = loadFromFile('goldRates.json', defaultGoldRates);

mockRouter.get('/gold-rates', (_req, res) => {
  res.json({ success: true, data: goldRates });
});

mockRouter.post('/gold-rates', (req, res) => {
  const body = req.body;
  if (body.rate22kPerGram) goldRates.rate22kPerGram = Number(body.rate22kPerGram);
  if (body.rate24kPerGram) goldRates.rate24kPerGram = Number(body.rate24kPerGram);
  if (body.rate18kPerGram) goldRates.rate18kPerGram = Number(body.rate18kPerGram);
  goldRates.rate24kPer10g = (goldRates.rate24kPerGram || 7280) * 10;
  goldRates.rate22kPer10g = (goldRates.rate22kPerGram || 6675) * 10;
  if (body.silverPerKg) goldRates.silverPerKg = Number(body.silverPerKg);
  goldRates.lastUpdated = new Date().toISOString();
  saveToFile('goldRates.json', goldRates);

  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'UPDATE_GOLD_RATE',
    actor: 'Administrator',
    summary: `Updated APMC Gold Lending Benchmark: 22K @ ₹${goldRates.rate22kPerGram}/g, 24K @ ₹${goldRates.rate24kPerGram}/g`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: goldRates, message: 'Live gold lending rates updated successfully.' });
});

// --- ADVANCED LOANS, FARMER ADVANCES & GOLD COLLATERAL ---
mockRouter.get('/loans', (_req, res) => {
  const now = new Date();
  
  // Calculate dynamic live simple interest for all active/partially paid loans
  const enrichedLoans = loans.map(loan => {
    const disbursed = new Date(loan.disbursedAt || loan.date || now);
    const diffDays = Math.max(1, Math.round((now - disbursed) / (1000 * 60 * 60 * 24)));
    const years = diffDays / 365.25;
    
    // Simple Interest Formula: I = (P * R * T) / 100
    const principal = Number(loan.principalAmount || loan.amount || 0);
    const rate = Number(loan.interestRate || 0);
    const calculatedInterest = Math.round((principal * rate * years) / 100);
    const waived = Number(loan.interestWaived || 0);
    const effectiveInterest = Math.max(0, calculatedInterest - waived);
    
    const totalRepaid = (loan.repayments && loan.repayments.length > 0)
      ? loan.repayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
      : Number(loan.totalRepaid || 0);
    const totalPayable = principal + effectiveInterest;
    const balance = Math.max(0, totalPayable - totalRepaid);
    
    let status = loan.status;
    if (balance <= 0) {
      status = 'CLOSED';
    } else if (totalRepaid > 0) {
      status = 'PARTIALLY_PAID';
    } else if (loan.dueDate && new Date(loan.dueDate) < now) {
      status = 'OVERDUE';
    } else {
      status = 'ACTIVE';
    }

    return {
      ...loan,
      principalAmount: principal,
      amount: principal,
      interestAccrued: effectiveInterest,
      totalInterestCalculated: calculatedInterest,
      elapsedDays: diffDays,
      totalRepaid,
      totalPayable,
      outstandingBalance: balance,
      status
    };
  });

  res.json({ success: true, data: enrichedLoans });
});

mockRouter.post('/loans/disburse', (req, res) => {
  const body = req.body;
  let farmer = null;
  if (body.farmerId) {
    farmer = farmers.find(f => f._id === body.farmerId);
  }

  const isExternal = Boolean(body.isExternalBorrower || !body.farmerId);
  const borrowerName = isExternal ? (body.borrowerName || body.farmerName || 'Walk-in Borrower') : (farmer ? farmer.name : 'Unknown Farmer');
  const borrowerPhone = isExternal ? (body.borrowerPhone || body.farmerPhone || '') : (farmer ? farmer.phone : '');
  const borrowerVillage = isExternal ? (body.borrowerVillage || body.village || 'Outside Village') : (farmer ? farmer.village : 'Bargarh');
  const borrowerDistrict = isExternal ? (body.borrowerDistrict || body.district || 'Bargarh') : (farmer ? farmer.district : 'Bargarh');

  const principal = Number(body.principalAmount || body.amount || 10000);
  const rate = Number(body.interestRate !== undefined ? body.interestRate : 12);
  const tenure = Number(body.tenureMonths || 6);

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + tenure);

  let collateralData = null;
  if (body.loanType === 'GOLD_COLLATERAL_LOAN' || body.collateral) {
    const col = body.collateral || {};
    collateralData = {
      type: col.type || 'GOLD',
      itemDescription: col.itemDescription || body.goldDescription || '22K Gold Jewellery',
      grossWeightGrams: Number(col.grossWeightGrams || body.goldGrossWeight || 10),
      netWeightGrams: Number(col.netWeightGrams || body.goldNetWeight || 9.5),
      purityKarat: col.purityKarat || body.goldPurity || '22K (916)',
      marketValue: Number(col.marketValue || body.goldMarketValue || (principal * 1.3)),
      lockerReference: col.lockerReference || body.goldLockerRef || ('Safe Locker ' + String(loans.length + 1)),
      remarks: col.remarks || body.goldRemarks || 'Inspected and safely stored in APMC locker'
    };
  }

  const newLoan = {
    _id: 'loan_' + String(Date.now()).slice(-6),
    loanNo: 'ADV-2026-' + String(loans.length + 1).padStart(3, '0'),
    loanNumber: 'ADV-2026-' + String(loans.length + 1).padStart(3, '0'),
    loanType: body.loanType || (collateralData ? 'GOLD_COLLATERAL_LOAN' : 'CROP_ADVANCE'),
    farmerId: isExternal ? null : (farmer ? farmer._id : null),
    farmerName: borrowerName,
    farmerPhone: borrowerPhone,
    village: borrowerVillage,
    district: borrowerDistrict,
    isExternalBorrower: isExternal,
    principalAmount: principal,
    amount: principal,
    interestRate: rate,
    interestType: 'SIMPLE',
    interestAccrued: 0,
    interestWaived: 0,
    totalRepaid: 0,
    outstandingBalance: principal,
    purpose: body.purpose || (collateralData ? 'Gold pledge advance' : 'Agricultural inputs & crop advance'),
    tenureMonths: tenure,
    disbursedAt: new Date().toISOString(),
    date: new Date().toISOString(),
    dueDate: dueDate.toISOString(),
    status: 'ACTIVE',
    paymentMode: body.paymentMode || 'CASH',
    collateral: collateralData,
    repayments: []
  };

  loans.unshift(newLoan);
  saveToFile('loans.json', loans);
  if (farmer) {
    farmer.outstandingAdvance = (farmer.outstandingAdvance || 0) + principal;
  }

  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'DISBURSE_ADVANCE',
    actor: 'Administrator',
    summary: `Disbursed ${newLoan.loanType} of ₹${principal.toLocaleString('en-IN')} to ${newLoan.farmerName} (${newLoan.village})` + (collateralData ? ` [Gold Collateral: ${collateralData.grossWeightGrams}g in ${collateralData.lockerReference}]` : ''),
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: newLoan, message: 'Loan / Advance disbursed successfully.' });
});

mockRouter.post('/loans/:id/repay', (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const loan = loans.find(l => l._id === id || l.loanNo === id || l.loanNumber === id);
  if (!loan) return res.status(404).json({ success: false, message: 'Loan record not found.' });

  const amount = Number(body.amount || 0);
  if (amount <= 0) return res.status(400).json({ success: false, message: 'Repayment amount must be greater than 0.' });

  const repaymentEntry = {
    repaymentId: 'rep_' + String(Date.now()).slice(-6),
    date: new Date().toISOString(),
    amount,
    principalPaid: Number(body.principalPaid || amount),
    interestPaid: Number(body.interestPaid || 0),
    method: body.method || body.paymentMode || 'CASH',
    notes: body.notes || 'Intermediate part-payment recorded at counter'
  };

  loan.repayments = loan.repayments || [];
  loan.repayments.unshift(repaymentEntry);
  loan.totalRepaid = (loan.totalRepaid || 0) + amount;
  saveToFile('loans.json', loans); // on repayment
  
  const currentTotal = (loan.principalAmount || loan.amount || 0) + (loan.interestAccrued || 0);
  loan.outstandingBalance = Math.max(0, currentTotal - loan.totalRepaid);
  loan.status = loan.outstandingBalance <= 0 ? 'CLOSED' : 'PARTIALLY_PAID';

  if (loan.farmerId) {
    const farmer = farmers.find(f => f._id === loan.farmerId);
    if (farmer) {
      farmer.outstandingAdvance = Math.max(0, (farmer.outstandingAdvance || 0) - amount);
    }
  }

  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'LOAN_REPAYMENT',
    actor: 'Cashier / Staff',
    summary: `Recorded part-repayment of ₹${amount.toLocaleString('en-IN')} for ${loan.loanNo} (${loan.farmerName}). Remaining Balance: ₹${loan.outstandingBalance.toLocaleString('en-IN')}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: loan, message: 'Repayment recorded successfully.' });
});

mockRouter.post('/loans/:id/adjust-interest', (req, res) => {
  const { id } = req.params;
  const body = req.body;
  const loan = loans.find(l => l._id === id || l.loanNo === id || l.loanNumber === id);
  if (!loan) return res.status(404).json({ success: false, message: 'Loan record not found.' });

  if (body.newInterestRate !== undefined || body.interestRate !== undefined) {
    loan.interestRate = Number(body.newInterestRate !== undefined ? body.newInterestRate : body.interestRate);
  }
  if (body.waivedAmount !== undefined || body.interestWaived !== undefined) {
    const waivedAdd = Number(body.waivedAmount !== undefined ? body.waivedAmount : body.interestWaived);
    loan.interestWaived = (loan.interestWaived || 0) + waivedAdd;
  }

  saveToFile('loans.json', loans); // on adjust
  auditLogs.unshift({
    _id: 'aud_' + Date.now(),
    action: 'INTEREST_ADJUSTMENT',
    actor: 'Administrator',
    summary: `Adjusted interest for ${loan.loanNo} (${loan.farmerName}): Rate=${loan.interestRate}% p.a., Waived=₹${loan.interestWaived || 0}. Reason: ${body.reason || 'Management decision'}`,
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, data: loan, message: 'Interest configuration adjusted successfully.' });
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


// --- PERMANENT RECORD RETENTION (NO DELETION POLICY) ---
mockRouter.delete('/farmers/:id', (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Policy Enforcement: Farmer profiles cannot be deleted. Permanent records are required for statutory APMC and agricultural compliance.'
  });
});

mockRouter.delete('/loans/:id', (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Policy Enforcement: Loan records cannot be deleted. Disbursed advances must be marked as Closed or Written Off with audit logging.'
  });
});

mockRouter.delete('/sales/:id', (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Policy Enforcement: Sales invoices cannot be deleted once created for GST audit compliance.'
  });
});

mockRouter.delete('/purchases/:id', (_req, res) => {
  res.status(403).json({
    success: false,
    message: 'Policy Enforcement: Procurement records cannot be deleted for mandi weighment audit compliance.'
  });
});

// --- CSV / EXCEL TRANSACTION EXPORT ENGINE ---
mockRouter.get('/export/transactions', (_req, res) => {
  const allTxns = [];

  // 1. Sales Invoices
  sales.forEach(s => {
    const itemsDesc = (s.items || []).map(i => `${i.qty} ${i.unit || 'unit'} ${i.name || i.productName}`).join('; ');
    allTxns.push({
      date: s.date || s.createdAt || new Date().toISOString(),
      txnId: s.invoiceNo || s.invoiceNumber || s._id,
      type: 'INPUT_PURCHASE_BILL',
      category: 'Sale to Farmer/Buyer',
      partyName: s.customerName || 'Retail Customer',
      phone: s.customerPhone || '',
      village: s.customerAddress || 'Bargarh',
      details: itemsDesc || 'Agricultural inputs',
      paymentMode: s.paymentMode || 'CASH',
      status: s.paymentStatus || 'PAID',
      debitAmount: Number(s.grandTotal || s.total || 0),
      creditAmount: 0,
      balanceDue: Number(s.balanceDue || 0)
    });
  });

  // 2. Purchases (Crop Procurement)
  purchases.forEach(p => {
    allTxns.push({
      date: p.date || p.createdAt || new Date().toISOString(),
      txnId: p.receiptNumber || p._id,
      type: 'CROP_PROCUREMENT',
      category: 'Harvest Purchase',
      partyName: p.farmerName || 'Walk-in Farmer',
      phone: '',
      village: 'Bargarh Mandi',
      details: `${p.commodity} • ${p.payableWeightKg || 0} Kg (${((p.payableWeightKg || 0)/100).toFixed(1)} Qtl) @ ₹${p.ratePerKg}/Kg`,
      paymentMode: 'BANK_TRANSFER',
      status: p.status || 'COMPLETED',
      debitAmount: 0,
      creditAmount: Number(p.grossAmount || p.netPayable || 0),
      balanceDue: 0
    });

    if (p.advanceDeduction > 0) {
      allTxns.push({
        date: p.date || p.createdAt || new Date().toISOString(),
        txnId: `DED-${p.receiptNumber}`,
        type: 'HARVEST_OFFSET_DEDUCTION',
        category: 'Advance Recovery',
        partyName: p.farmerName || 'Walk-in Farmer',
        phone: '',
        village: 'Bargarh Mandi',
        details: `Auto-offset from ${p.commodity} delivery payout (${p.receiptNumber})`,
        paymentMode: 'HARVEST_OFFSET',
        status: 'CLEARED',
        debitAmount: 0,
        creditAmount: Number(p.advanceDeduction),
        balanceDue: 0
      });
    }
  });

  // 3. Loans Disbursed
  loans.forEach(l => {
    allTxns.push({
      date: l.disbursedAt || l.date || l.createdAt || new Date().toISOString(),
      txnId: l.loanNo || l.loanNumber || l._id,
      type: l.loanType || 'CROP_ADVANCE',
      category: 'Disbursed Advance',
      partyName: l.farmerName || 'Borrower',
      phone: l.farmerPhone || '',
      village: l.village || 'Bargarh',
      details: (l.purpose || 'Agricultural advance') + (l.collateral ? ` [Gold: ${l.collateral.grossWeightGrams}g, Locker ${l.collateral.lockerReference || 'Safe'}]` : ''),
      paymentMode: l.paymentMode || 'CASH',
      status: l.status || 'ACTIVE',
      debitAmount: Number(l.principalAmount || l.amount || 0),
      creditAmount: 0,
      balanceDue: Number(l.outstandingBalance !== undefined ? l.outstandingBalance : l.amount)
    });

    // 4. Repayments
    if (Array.isArray(l.repayments)) {
      l.repayments.forEach(r => {
        allTxns.push({
          date: r.date || new Date().toISOString(),
          txnId: `REP-${l.loanNo || l.loanNumber}-${r.repaymentId || ''}`,
          type: 'LOAN_PART_REPAYMENT',
          category: 'Advance Repayment',
          partyName: l.farmerName || 'Borrower',
          phone: l.farmerPhone || '',
          village: l.village || 'Bargarh',
          details: `Part payment for ${l.loanNo || l.loanNumber} • ${r.notes || 'Counter Receipt'}`,
          paymentMode: r.method || 'CASH',
          status: 'RECORDED',
          debitAmount: 0,
          creditAmount: Number(r.amount || 0),
          balanceDue: 0
        });
      });
    }
  });

  // Sort newest first
  allTxns.sort((a, b) => new Date(b.date) - new Date(a.date));

  const headers = [
    'Date & Time',
    'Transaction Reference',
    'Type',
    'Category',
    'Party / Farmer Name',
    'Phone',
    'Village / Location',
    'Transaction Details / Commodities',
    'Payment Mode',
    'Debit Amount (₹)',
    'Credit Amount (₹)',
    'Balance Due (₹)',
    'Status'
  ];

  const rows = allTxns.map(t => [
    new Date(t.date).toLocaleString('en-IN'),
    t.txnId,
    t.type,
    t.category,
    t.partyName,
    t.phone,
    t.village,
    t.details,
    t.paymentMode,
    t.debitAmount,
    t.creditAmount,
    t.balanceDue,
    t.status
  ]);

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(','))
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Nirmala_All_Transactions_2026.csv"');
  res.send('\uFEFF' + csvContent);
});

mockRouter.get('/export/farmers', (_req, res) => {
  const headers = [
    'Farmer Code',
    'Farmer Name',
    'Father / Guardian Name',
    'Phone Number',
    'Aadhaar Number',
    'Aadhaar e-KYC',
    'CIBIL Score',
    'CIBIL Rating',
    'Credit Risk Assessment',
    'Village',
    'District',
    'State',
    'Land Acres',
    'Primary Crop',
    'Total Procured (Qtl)',
    'Active Advances (₹)',
    'Due Balance (₹)',
    'Bank Name',
    'Account Number',
    'IFSC Code',
    'Registered Date'
  ];

  const rows = farmers.map(f => {
    const cibil = (f.cibil && f.cibil.score) ? f.cibil : calculateFarmerCibil(f);
    return [
      f.farmerCode || '',
      f.name || '',
      f.fatherName || '',
      f.phone || '',
      f.aadhaarNumber || '',
      'Verified ✓',
      cibil.score || 750,
      cibil.rating || 'Good',
      cibil.riskLevel || 'Low Risk',
      f.village || '',
      f.district || '',
      f.state || 'Odisha',
      f.landAcres || 0,
      f.primaryCrop || '',
      f.totalProcuredQuintals || 0,
      f.outstandingAdvance || 0,
      f.currentBalance || 0,
      f.bankName || '',
      f.accountNumber || '',
      f.ifscCode || '',
      new Date(f.createdAt || Date.now()).toLocaleDateString('en-IN')
    ];
  });

  const csvContent = [
    headers.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(','))
  ].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Nirmala_Farmers_Directory_2026.csv"');
  res.send('\uFEFF' + csvContent);
});

mockRouter.get('/farmers/:id/export-csv', (req, res) => {
  const { id } = req.params;
  const farmer = farmers.find(f => f._id === id || f.phone === id || f.farmerCode === id);
  if (!farmer) return res.status(404).json({ success: false, message: 'Farmer not found.' });

  const farmerSales = sales.filter(s =>
    (s.customerPhone && farmer.phone && s.customerPhone.trim() === farmer.phone.trim()) ||
    s.farmerId === farmer._id ||
    (s.customerName && farmer.name && s.customerName.toLowerCase().trim() === farmer.name.toLowerCase().trim())
  );
  const farmerPurchases = purchases.filter(p => p.farmerId === farmer._id || p.farmerName?.toLowerCase() === farmer.name?.toLowerCase());
  const farmerLoans = loans.filter(l => l.farmerId === farmer._id || l.farmerName?.toLowerCase() === farmer.name?.toLowerCase());

  const cibil = calculateFarmerCibil(farmer, farmerSales, farmerPurchases, farmerLoans);

  const lines = [
    ['NIRMALA ENTERPRISES - FARMER 360° PASSBOOK STATEMENT'],
    ['Generated On', new Date().toLocaleString('en-IN')],
    [''],
    ['FARMER PROFILE INFORMATION'],
    ['Farmer Code', farmer.farmerCode || '', 'Full Name', farmer.name],
    ['Phone', farmer.phone || '', 'Father Name', farmer.fatherName || ''],
    ['Aadhaar Number', farmer.aadhaarNumber || '', 'Aadhaar Status', 'UIDAI Verified ✓'],
    ['Village', farmer.village || '', 'District', farmer.district || ''],
    ['Land Acres', farmer.landAcres || 0, 'Primary Crop', farmer.primaryCrop || ''],
    ['Bank Name', farmer.bankName || '', 'Account No.', farmer.accountNumber || '', 'IFSC', farmer.ifscCode || ''],
    ['CIBIL Credit Score', `${cibil.score}/900 (${cibil.rating})`, 'Risk Assessment', cibil.riskLevel],
    ['Lending Policy', cibil.recommendation],
    [''],
    ['CHRONOLOGICAL TRANSACTION LEDGER'],
    ['Date', 'Reference No.', 'Transaction Type', 'Details / Description', 'Debit (₹)', 'Credit (₹)', 'Payment Mode', 'Status']
  ];

  const txns = [];
  farmerSales.forEach(s => {
    txns.push({
      date: s.date || s.createdAt,
      ref: s.invoiceNo || s.invoiceNumber,
      type: 'INPUT_PURCHASE_BILL',
      desc: (s.items || []).map(i => `${i.qty} ${i.unit} ${i.name}`).join('; '),
      debit: s.grandTotal || s.total || 0,
      credit: 0,
      mode: s.paymentMode || 'CASH',
      status: s.paymentStatus || 'PAID'
    });
  });

  farmerPurchases.forEach(p => {
    txns.push({
      date: p.date || p.createdAt,
      ref: p.receiptNumber,
      type: 'CROP_PROCUREMENT_PAYOUT',
      desc: `${p.commodity} - ${p.payableWeightKg} Kg @ ₹${p.ratePerKg}/Kg`,
      debit: 0,
      credit: p.grossAmount || p.netPayable || 0,
      mode: 'BANK_TRANSFER',
      status: 'COMPLETED'
    });

    if (p.advanceDeduction > 0) {
      txns.push({
        date: p.date || p.createdAt,
        ref: `DED-${p.receiptNumber}`,
        type: 'HARVEST_OFFSET_DEDUCTION',
        desc: `Offset against ${p.commodity} delivery`,
        debit: 0,
        credit: p.advanceDeduction,
        mode: 'HARVEST_OFFSET',
        status: 'CLEARED'
      });
    }
  });

  farmerLoans.forEach(l => {
    txns.push({
      date: l.disbursedAt || l.date || l.createdAt,
      ref: l.loanNo || l.loanNumber,
      type: 'SEASONAL_ADVANCE_DISBURSED',
      desc: (l.purpose || 'Crop advance') + (l.collateral ? ` [Gold: ${l.collateral.grossWeightGrams}g]` : ''),
      debit: l.principalAmount || l.amount || 0,
      credit: 0,
      mode: l.paymentMode || 'CASH',
      status: l.status || 'ACTIVE'
    });

    if (Array.isArray(l.repayments)) {
      l.repayments.forEach(r => {
        txns.push({
          date: r.date,
          ref: `REP-${l.loanNo || l.loanNumber}`,
          type: 'LOAN_PART_REPAYMENT',
          desc: `Part repayment - ${r.notes || 'Counter Receipt'}`,
          debit: 0,
          credit: r.amount || 0,
          mode: r.method || 'CASH',
          status: 'RECORDED'
        });
      });
    }
  });

  txns.sort((a, b) => new Date(b.date) - new Date(a.date));

  txns.forEach(t => {
    lines.push([
      new Date(t.date).toLocaleString('en-IN'),
      t.ref,
      t.type,
      t.desc,
      t.debit,
      t.credit,
      t.mode,
      t.status
    ]);
  });

  const csvContent = lines.map(r => r.map(escapeCsv).join(',')).join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="Passbook_${(farmer.name || 'Farmer').replace(/\s+/g, '_')}_${farmer.farmerCode || 'FARM'}.csv"`);
  res.send('\uFEFF' + csvContent);
});

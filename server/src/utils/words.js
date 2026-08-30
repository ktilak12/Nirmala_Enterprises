import { round2 } from './money.js';

/**
 * Amount in words using the Indian numbering system (lakh / crore), which is
 * what an invoice issued in India is expected to show.
 *
 *   125600.50  ->  "Rupees One Lakh Twenty Five Thousand Six Hundred and Fifty Paise Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]} ${ONES[o]}` : TENS[t];
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

/** Convert an integer (0 .. 99,99,99,999) to Indian-system words. */
export function integerToWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = n;

  const parts = [];
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Full invoice-ready phrase, including paise. */
export function amountToWords(amount) {
  const value = round2(amount);
  const negative = value < 0;
  const abs = Math.abs(value);
  const rupees = Math.floor(abs);
  const paise = Math.round((abs - rupees) * 100);

  const parts = [`Rupees ${integerToWords(rupees)}`];
  if (paise > 0) parts.push(`and ${twoDigits(paise)} Paise`);
  parts.push('Only');

  return `${negative ? 'Minus ' : ''}${parts.join(' ')}`;
}

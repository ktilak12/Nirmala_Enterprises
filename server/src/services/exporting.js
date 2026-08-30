import ExcelJS from 'exceljs';
import { formatINR } from '../utils/money.js';

/**
 * Excel and CSV generation (Sections 34 and 44).
 *
 * Section 1 is emphatic that spreadsheets are an OUTPUT, never the database.
 * Nothing here reads a file; these functions only turn a report object from
 * reports.js into a downloadable stream. Because every report shares the same
 * `{ columns, rows, totals }` shape, one exporter covers all of them - a new
 * report becomes exportable without touching this file.
 */

const MONEY_FORMAT = '#,##0.00';
const QTY_FORMAT = '#,##0.000';
const DATE_FORMAT = 'dd-mmm-yyyy';

const BRAND = {
  primary: 'FF2E7D32',   // Section 3 primary green
  dark: 'FF1B5E20',
  gold: 'FFF9A825',
  light: 'FFF7F9F5',
};

export async function reportToExcel(report, { company = 'Nirmala Enterprises' } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = company;
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName(report.title), {
    views: [{ state: 'frozen', ySplit: 4 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const width = report.columns.length;

  // ---- Title block ------------------------------------------------------
  ws.mergeCells(1, 1, 1, width);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = company;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: BRAND.dark } };
  titleCell.alignment = { horizontal: 'center' };

  ws.mergeCells(2, 1, 2, width);
  const subCell = ws.getCell(2, 1);
  subCell.value = report.title;
  subCell.font = { name: 'Calibri', size: 12, bold: true };
  subCell.alignment = { horizontal: 'center' };

  ws.mergeCells(3, 1, 3, width);
  const periodCell = ws.getCell(3, 1);
  periodCell.value = report.period ?? '';
  periodCell.font = { name: 'Calibri', size: 10, italic: true };
  periodCell.alignment = { horizontal: 'center' };

  // ---- Header row -------------------------------------------------------
  const header = ws.getRow(4);
  report.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.primary } };
    cell.alignment = { vertical: 'middle', horizontal: alignFor(c.type), wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: BRAND.dark } } };
  });
  header.height = 22;

  // ---- Data rows --------------------------------------------------------
  report.rows.forEach((row, rIdx) => {
    const r = ws.getRow(5 + rIdx);
    report.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      const raw = row[c.key];

      if (c.type === 'date') {
        cell.value = raw ? new Date(raw) : null;
        cell.numFmt = DATE_FORMAT;
      } else if (c.type === 'money') {
        cell.value = raw === null || raw === undefined ? null : Number(raw);
        cell.numFmt = MONEY_FORMAT;
      } else if (c.type === 'qty') {
        cell.value = raw === null || raw === undefined ? null : Number(raw);
        cell.numFmt = QTY_FORMAT;
      } else if (c.type === 'number') {
        cell.value = raw === null || raw === undefined ? null : Number(raw);
      } else {
        cell.value = raw ?? '';
      }

      cell.alignment = { horizontal: alignFor(c.type), vertical: 'top', wrapText: c.type === 'text' };
    });

    if (rIdx % 2 === 1) {
      r.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND.light } };
      });
    }
  });

  // ---- Totals row -------------------------------------------------------
  if (report.totals && Object.keys(report.totals).length > 0) {
    const r = ws.getRow(5 + report.rows.length);
    report.columns.forEach((c, i) => {
      const cell = r.getCell(i + 1);
      if (i === 0) {
        cell.value = 'TOTAL';
      } else if (report.totals[c.key] !== undefined) {
        cell.value = Number(report.totals[c.key]);
        cell.numFmt = c.type === 'qty' ? QTY_FORMAT : MONEY_FORMAT;
      }
      cell.font = { bold: true };
      cell.alignment = { horizontal: i === 0 ? 'left' : alignFor(c.type) };
      cell.border = { top: { style: 'double', color: { argb: BRAND.dark } } };
    });
  }

  // ---- Notes ------------------------------------------------------------
  const notes = [report.meta?.valuationNote, report.meta?.note].filter(Boolean);
  let noteRow = 6 + report.rows.length + (report.totals ? 1 : 0);
  for (const note of notes) {
    ws.mergeCells(noteRow, 1, noteRow, width);
    const cell = ws.getCell(noteRow, 1);
    cell.value = `Note: ${note}`;
    cell.font = { size: 9, italic: true };
    cell.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(noteRow).height = 28;
    noteRow += 1;
  }

  ws.mergeCells(noteRow, 1, noteRow, width);
  const stamp = ws.getCell(noteRow, 1);
  stamp.value = `Generated ${new Date().toLocaleString('en-IN')} - ${company} management system`;
  stamp.font = { size: 8, italic: true, color: { argb: 'FF888888' } };

  autoFitColumns(ws, report);
  if (report.rows.length > 0) {
    ws.autoFilter = {
      from: { row: 4, column: 1 },
      to: { row: 4 + report.rows.length, column: width },
    };
  }

  return wb.xlsx.writeBuffer();
}

/**
 * CSV. Written by hand rather than via ExcelJS so the quoting rules are
 * explicit: a field containing a comma, quote, or newline is wrapped in quotes
 * and its quotes doubled. Anything less and a customer address with a comma in
 * it silently shifts every following column.
 */
export function reportToCsv(report) {
  const lines = [];

  lines.push(csvRow(report.columns.map((c) => c.label)));

  for (const row of report.rows) {
    lines.push(
      csvRow(
        report.columns.map((c) => {
          const raw = row[c.key];
          if (raw === null || raw === undefined) return '';
          if (c.type === 'date') return new Date(raw).toISOString().slice(0, 10);
          return raw;
        }),
      ),
    );
  }

  if (report.totals && Object.keys(report.totals).length > 0) {
    lines.push(
      csvRow(
        report.columns.map((c, i) => {
          if (i === 0) return 'TOTAL';
          return report.totals[c.key] ?? '';
        }),
      ),
    );
  }

  // A BOM so Excel opens the file as UTF-8 and does not mangle rupee symbols
  // or names with diacritics.
  return `﻿${lines.join('\r\n')}\r\n`;
}

function csvRow(values) {
  return values.map(csvCell).join(',');
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function alignFor(type) {
  if (type === 'money' || type === 'qty' || type === 'number') return 'right';
  if (type === 'date') return 'center';
  return 'left';
}

function autoFitColumns(ws, report) {
  report.columns.forEach((c, i) => {
    let widest = c.label.length;
    for (const row of report.rows) {
      const raw = row[c.key];
      const len =
        c.type === 'money'
          ? formatINR(raw ?? 0).length
          : String(raw ?? '').length;
      if (len > widest) widest = len;
    }
    ws.getColumn(i + 1).width = Math.min(Math.max(widest + 3, 10), 46);
  });
}

/** Excel forbids : \ / ? * [ ] in sheet names and caps them at 31 characters. */
function sheetName(title) {
  return String(title).replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Report';
}

export function exportFilename(report, extension) {
  const slug = String(report.title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug}-${stamp}.${extension}`;
}

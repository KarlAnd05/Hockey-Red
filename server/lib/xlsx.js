/**
 * A minimal .xlsx writer.
 *
 * WHY THIS EXISTS INSTEAD OF A DEPENDENCY
 * ---------------------------------------
 * The federation asked for spreadsheet exports. The obvious answer is exceljs,
 * which is an excellent library and about a megabyte of transitive dependencies
 * for the one thing we need: write a grid of values to a file Excel opens.
 * This project has four runtime dependencies, each of which does something we
 * genuinely cannot do ourselves (Stripe, SMTP, PDF, HTTP). A spreadsheet is not
 * one of those: an .xlsx is a ZIP of XML files, Node already has deflate, and
 * the ZIP container is a well-documented format.
 *
 * What this supports: one sheet, a header row, strings, numbers and blanks,
 * frozen header, and sensible column widths. What it does not support: styles
 * beyond bold headers, formulas, multiple sheets, images, dates as real date
 * cells (they are written as text, which is what you want for a date of birth
 * that must not be reinterpreted by a locale).
 *
 * If the federation ever needs pivot tables, charts or multiple sheets, replace
 * this with exceljs and do not try to grow it - that is the line.
 */
import { deflateRawSync } from 'node:zlib';

/* --------------------------------------------------------------------------
   ZIP container
   -------------------------------------------------------------------------- */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buffer[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Build a ZIP archive from {name, data} entries.
 *
 * Deflate is used only when it actually helps; a stored entry is valid ZIP and
 * avoids pathological cases where compression grows a tiny file.
 */
function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, 'utf8');
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const deflated = deflateRawSync(raw, { level: 9 });

    const useDeflate = deflated.length < raw.length;
    const payload = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0x21, 12); // mod date (1 Jan 1980 is 0x21 in this field)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    chunks.push(local, nameBytes, payload);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0); // central directory signature
    dir.writeUInt16LE(20, 4); // version made by
    dir.writeUInt16LE(20, 6); // version needed
    dir.writeUInt16LE(0, 8); // flags
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x21, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(payload.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comment
    dir.writeUInt16LE(0, 34); // disk number
    dir.writeUInt16LE(0, 36); // internal attrs
    dir.writeUInt32LE(0, 38); // external attrs
    dir.writeUInt32LE(offset, 42);

    central.push(dir, nameBytes);
    offset += local.length + nameBytes.length + payload.length;
  }

  const centralBuffer = Buffer.concat(central);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // end of central directory
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

/* --------------------------------------------------------------------------
   Sheet XML
   -------------------------------------------------------------------------- */
const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    /* XML 1.0 forbids most control characters outright. A stray one anywhere in
       the data would make the whole file unopenable, so they are stripped. */
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** 0 -> A, 25 -> Z, 26 -> AA. */
function columnName(index) {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

/**
 * Is this value safe to write as a number?
 *
 * Deliberately strict. A phone number, a postal code and a passport number all
 * look numeric and must stay text, or Excel eats the leading zero and renders
 * long ones in scientific notation. Only a real JS number counts.
 */
const isNumeric = (value) => typeof value === 'number' && Number.isFinite(value);

function cellXml(ref, value, styleIndex) {
  const style = styleIndex ? ` s="${styleIndex}"` : '';

  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"${style}/>`;
  }

  if (isNumeric(value)) {
    return `<c r="${ref}"${style}>${`<v>${value}</v>`}</c>`;
  }

  /* inlineStr rather than a shared string table: one fewer part to build, and
     the exports here have little repetition to gain from sharing. */
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(
    value
  )}</t></is></c>`;
}

/**
 * Build a one-sheet workbook.
 *
 * @param {object} options
 * @param {string} options.sheetName  Tab name (Excel caps this at 31 chars).
 * @param {string[]} options.headers  Header row.
 * @param {Array<Array<string|number|null>>} options.rows
 * @returns {Buffer} the .xlsx file
 */
export function buildXlsx({ sheetName = 'Sheet1', headers = [], rows = [] }) {
  const safeSheet = escapeXml(String(sheetName).slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));

  const allRows = headers.length ? [headers, ...rows] : rows;

  const sheetRows = allRows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, colIndex) =>
          /* Style 1 is the bold header; everything else is unstyled. */
          cellXml(`${columnName(colIndex)}${rowIndex + 1}`, value, headers.length && rowIndex === 0 ? 1 : 0)
        )
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  /* Column widths from the content, so the file opens readable rather than as
     a wall of ####. Capped so one long message cannot create a 500-wide column. */
  const widths = (headers.length ? headers : rows[0] || []).map((_, colIndex) => {
    const longest = allRows.reduce((max, row) => {
      const text = String(row[colIndex] ?? '');
      return Math.max(max, text.length);
    }, 10);
    return Math.min(60, longest + 2);
  });

  const cols = widths.length
    ? `<cols>${widths
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : '';

  /* Freeze the header so it stays visible while scrolling a long roster. */
  const freeze = headers.length
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '';

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${freeze}${cols}<sheetData>${sheetRows}</sheetData></worksheet>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${safeSheet}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  /* Two fonts, two cell formats: regular, and bold for the header row. */
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;

  return zip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rootRels },
    { name: 'xl/workbook.xml', data: workbook },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRels },
    { name: 'xl/styles.xml', data: styles },
    { name: 'xl/worksheets/sheet1.xml', data: sheet },
  ]);
}

/**
 * Neutralise a value that a spreadsheet would treat as a formula.
 *
 * The same risk the CSV export guards against: a leading =, +, - or @ makes
 * Excel evaluate the cell, so a crafted answer in a membership form could run
 * on whoever opens the export. Numbers are left alone - they are written as
 * numeric cells and cannot be formulas.
 */
export function safeCell(value) {
  if (isNumeric(value)) return value;
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

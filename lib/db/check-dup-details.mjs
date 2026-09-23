import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

const barcodeMap = new Map();

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  const barcode = parts[0];
  const name = parts[1];
  if (!barcodeMap.has(barcode)) {
    barcodeMap.set(barcode, []);
  }
  barcodeMap.get(barcode).push({ line: i, name, barcode });
}

console.log('Total unique barcode values:', barcodeMap.size);

const nonSciDuplicates = [];
const sciDuplicates = [];

for (const [code, rows] of barcodeMap.entries()) {
  if (rows.length > 1) {
    if (/^[0-9.]+[eE]\+[0-9]+$/.test(code)) {
      sciDuplicates.push({ code, count: rows.length });
    } else {
      nonSciDuplicates.push({ code, count: rows.length, names: rows.map(r => r.name) });
    }
  }
}

console.log('Scientific notation duplicate groups:', sciDuplicates.length);
console.log('Non-scientific notation duplicate groups:', nonSciDuplicates.length);
if (nonSciDuplicates.length > 0) {
  console.log('Non-sci duplicates details:', JSON.stringify(nonSciDuplicates, null, 2));
}

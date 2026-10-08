import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

const barcodeCounts = {};
let sciNotationCount = 0;

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  const barcode = parts[0];
  barcodeCounts[barcode] = (barcodeCounts[barcode] || 0) + 1;
  if (/^[0-9.]+[eE]\+[0-9]+$/.test(barcode)) {
    sciNotationCount++;
  }
}

const duplicateBarcodes = Object.entries(barcodeCounts).filter(([_, count]) => count > 1);

console.log('Total data rows:', lines.length - 1);
console.log('Unique barcode strings:', Object.keys(barcodeCounts).length);
console.log('Duplicate barcode strings count:', duplicateBarcodes.length);
console.log('Total rows with scientific notation barcodes:', sciNotationCount);

console.log('\nTop 15 duplicate barcodes:');
duplicateBarcodes.sort((a, b) => b[1] - a[1]);
for (let i = 0; i < Math.min(15, duplicateBarcodes.length); i++) {
  console.log(`${duplicateBarcodes[i][0]}: ${duplicateBarcodes[i][1]} occurrences`);
}

import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

let maxNameLen = 0;
let maxName = '';
let maxBarcodeLen = 0;
let maxBarcode = '';
let maxCatLen = 0;
let maxCat = '';

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  const barcode = parts[0] || '';
  const name = parts[1] || '';
  const cat = parts[7] || '';

  if (name.length > maxNameLen) {
    maxNameLen = name.length;
    maxName = name;
  }
  if (barcode.length > maxBarcodeLen) {
    maxBarcodeLen = barcode.length;
    maxBarcode = barcode;
  }
  if (cat.length > maxCatLen) {
    maxCatLen = cat.length;
    maxCat = cat;
  }
}

console.log('Max name length:', maxNameLen, `("${maxName}")`);
console.log('Max barcode length:', maxBarcodeLen, `("${maxBarcode}")`);
console.log('Max category length:', maxCatLen, `("${maxCat}")`);

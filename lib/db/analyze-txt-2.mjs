import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

console.log('Total non-empty lines:', lines.length);

let emptyNameCount = 0;
let emptyBarcodeCount = 0;
let invalidColCount = 0;
const categoriesSet = new Set();
const colCounts = {};

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  colCounts[parts.length] = (colCounts[parts.length] || 0) + 1;
  if (parts.length !== 8) {
    invalidColCount++;
  }
  const barcode = parts[0] || '';
  const name = parts[1] || '';
  const category = parts[7] || parts[parts.length - 1] || '';
  if (!name) emptyNameCount++;
  if (!barcode) emptyBarcodeCount++;
  if (category) categoriesSet.add(category);
}

console.log('Column counts distribution:', colCounts);
console.log('Empty name count:', emptyNameCount);
console.log('Empty barcode count:', emptyBarcodeCount);
console.log('Categories found (' + categoriesSet.size + '):', Array.from(categoriesSet));

// Let's inspect some rows where name is empty
console.log('\nSample rows with empty name:');
let shown = 0;
for (let i = 1; i < lines.length && shown < 15; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  if (!parts[1]) {
    console.log(`Line ${i}:`, parts);
    shown++;
  }
}

import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

console.log('Header:', lines[0]);

const rows = [];
const issues = [];

function parsePrice(str) {
  if (!str) return 0;
  // Format is Bs12.50 or Bs0.00 etc
  const cleaned = str.replace(/Bs\.?/i, '').replace(/,/g, '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseIntSafe(str) {
  if (!str) return 0;
  const num = parseInt(str.trim(), 10);
  return isNaN(num) ? null : num;
}

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  if (parts.length !== 8) {
    issues.push({ line: i, issue: `Column count is ${parts.length}, expected 8`, data: lines[i] });
    continue;
  }

  const [rawBarcode, rawName, rawBuy, rawSell, rawWholesale, rawStock, rawMinStock, rawCat] = parts;

  const buyPrice = parsePrice(rawBuy);
  const sellPrice = parsePrice(rawSell);
  const wholesalePrice = parsePrice(rawWholesale);
  const stock = parseIntSafe(rawStock);
  const minStock = parseIntSafe(rawMinStock);

  if (buyPrice === null) issues.push({ line: i, issue: 'Invalid purchase price', rawBuy });
  if (sellPrice === null) issues.push({ line: i, issue: 'Invalid sale price', rawSell });
  if (wholesalePrice === null) issues.push({ line: i, issue: 'Invalid wholesale price', rawWholesale });
  if (stock === null) issues.push({ line: i, issue: 'Invalid stock', rawStock });
  if (minStock === null) issues.push({ line: i, issue: 'Invalid min stock', rawMinStock });

  rows.push({
    lineIndex: i,
    barcode: rawBarcode,
    name: rawName,
    purchasePrice: buyPrice,
    salePrice: sellPrice,
    wholesalePrice: wholesalePrice,
    stock: stock,
    minStock: minStock,
    category: rawCat
  });
}

console.log(`Successfully parsed ${rows.length} rows.`);
console.log(`Parsing issues found: ${issues.length}`);
if (issues.length > 0) {
  console.log('Sample issues:', issues.slice(0, 10));
}

// Check the 5 empty name rows
const emptyNames = rows.filter(r => !r.name);
console.log('\nEmpty names count:', emptyNames.length);
console.log('Empty name rows:', emptyNames);

// Check categories
const cats = {};
rows.forEach(r => {
  cats[r.category] = (cats[r.category] || 0) + 1;
});
console.log('\nCategories breakdown:');
console.table(cats);

// Price statistics
const zeroSell = rows.filter(r => r.salePrice === 0);
console.log(`Rows with salePrice === 0: ${zeroSell.length}`);


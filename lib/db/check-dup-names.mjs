import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

const namesMap = new Map();

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  const name = parts[1].toLowerCase();
  if (!name) continue;
  if (!namesMap.has(name)) {
    namesMap.set(name, []);
  }
  namesMap.get(name).push({ line: i, rawName: parts[1], barcode: parts[0], price: parts[3], cat: parts[7] });
}

const dupNames = [];
for (const [name, list] of namesMap.entries()) {
  if (list.length > 1) {
    dupNames.push({ name, count: list.length, items: list });
  }
}

console.log('Total non-empty names:', lines.length - 1 - 5);
console.log('Unique names:', namesMap.size);
console.log('Duplicate names count:', dupNames.length);
if (dupNames.length > 0) {
  console.log('Sample duplicate names (first 10):');
  for (let i = 0; i < Math.min(10, dupNames.length); i++) {
    console.log(`- "${dupNames[i].name}" (${dupNames[i].count} times):`, dupNames[i].items.map(it => `[line ${it.line}: code=${it.barcode}, price=${it.price}]`).join(', '));
  }
}

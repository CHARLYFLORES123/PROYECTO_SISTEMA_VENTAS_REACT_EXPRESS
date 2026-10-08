import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

console.log('Searching for TARGETAS items:');
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  if (parts[7] === 'TARGETAS') {
    console.log(`Line ${i}:`, parts);
  }
}

console.log('\nSearching for CASCADA items:');
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  if (parts[0].includes('CASCADA') || parts[1].includes('CASCADA')) {
    console.log(`Line ${i}:`, parts);
  }
}

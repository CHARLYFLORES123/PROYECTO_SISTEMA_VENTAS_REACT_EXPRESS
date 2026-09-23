import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

console.log('Searching for 7.70299E+12:');
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  if (parts[0].includes('7.70299')) {
    console.log(`Line ${i}:`, parts);
  }
}

console.log('\nSearching for GASEOSAS with buy 5.30 and sell 6.00:');
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split('\t').map(s => s.trim());
  if (parts[7] === 'GASEOSAS' && parts[2].includes('5.30') && parts[3].includes('6.00')) {
    console.log(`Line ${i}:`, parts);
  }
}

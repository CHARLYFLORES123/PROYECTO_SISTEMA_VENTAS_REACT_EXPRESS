import fs from 'fs';

const content = fs.readFileSync('textos para base datos.txt', 'utf-8');
const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);

console.log('Total non-empty lines:', lines.length);
console.log('Header line:');
console.log(JSON.stringify(lines[0]));

for (let i = 0; i < Math.min(10, lines.length); i++) {
  console.log(`Line ${i}:`, lines[i].split('\t').map(s => s.trim()));
}

const fs = require('fs');

const rawJson = fs.readFileSync('parsed_data.json', 'utf8');

// The format in data.js is just: const STUDENT_DATA = { ... };
const jsCode = `// ============================================
// DATA SISWA — Dari Excel
// ============================================

const STUDENT_DATA = ${rawJson};

// Helper: Get list of rombels (A, B, C, D, E) based on active data
function getRombelList() {
  return ['A', 'B', 'C', 'D', 'E'];
}
`;

fs.writeFileSync('js/data.js', jsCode);
console.log('Successfully updated js/data.js');

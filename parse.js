const xlsx = require('xlsx');
const fs = require('fs');

try {
  // Read workbook
  const wb = xlsx.readFile('DATA ACAK SISWA.xlsx');
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Convert to JSON (row 1 is header)
  const data = xlsx.utils.sheet_to_json(ws);
  
  // Structure we need:
  // {
  //   '7': { 'A': [ { nama: '...', jk: 'L' } ] },
  //   '8': { ... }
  // }
  
  const studentData = { '7': {}, '8': {}, '9': {} };

  // Track unique classes for debug
  const classes = new Set();

  data.forEach(row => {
    // Expected keys based on user: "nama", "kelas", "jenis kelamin"
    // Let's find the actual keys (case insensitive)
    const keys = Object.keys(row);
    const namaKey = keys.find(k => k.toLowerCase().includes('nama'));
    const kelasKey = keys.find(k => k.toLowerCase().includes('kelas'));
    const jkKey = keys.find(k => k.toLowerCase().includes('jenis') || k.toLowerCase() === 'jk');

    if (!namaKey || !kelasKey || !jkKey) return;

    const nama = row[namaKey].trim();
    const kelasRaw = row[kelasKey].toString().trim().toUpperCase(); // e.g. "7A"
    const jkRaw = row[jkKey].toString().trim().toUpperCase(); // e.g. "L"

    // Parse class (e.g. 7A -> grade: 7, rombel: A)
    const match = kelasRaw.match(/(\d)([A-Z])/);
    if (!match) return;
    
    const grade = match[1];
    const rombel = match[2];

    classes.add(kelasRaw);

    if (!studentData[grade]) studentData[grade] = {};
    if (!studentData[grade][rombel]) studentData[grade][rombel] = [];

    studentData[grade][rombel].push({
      nama: nama,
      jk: jkRaw.startsWith('L') ? 'L' : 'P'
    });
  });

  // Write output to a file so we can inspect or inject it
  fs.writeFileSync('parsed_data.json', JSON.stringify(studentData, null, 2));
  console.log(`Successfully parsed ${data.length} rows.`);
  console.log(`Classes found: ${Array.from(classes).sort().join(', ')}`);
  
} catch (e) {
  console.error("Error parsing Excel:", e);
}

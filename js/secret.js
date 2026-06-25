const SECRET_RULES = {
  // 3 siswa yang tidak boleh satu kelas sama sekali
  separatedStudents: [
    "GUNAWAN FEBRIAN",
    "M. YUSUF",
    "MUHAMMAD FAHRIANSYAH RAMADHAN"
  ],
  // Kelas yang dilarang untuk masing-masing siswa (Hanya Rombel-nya saja, misal 'B' untuk 9B)
  forbiddenClasses: {
    "GUNAWAN FEBRIAN": "B",
    "M. YUSUF": "B",
    "MUHAMMAD FAHRIANSYAH RAMADHAN": "B"
  }
};

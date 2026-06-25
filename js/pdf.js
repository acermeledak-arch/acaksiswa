// ============================================
// PDF Export — jsPDF + AutoTable
// Satu kelas per halaman, custom page size
// ============================================

const PDFExport = {
  // Kop instansi config
  kopConfig: {
    line1: 'PEMERINTAH KABUPATEN TANAH BUMBU',
    line2: 'DINAS PENDIDIKAN',
    line3: 'SMP NEGERI 2 KUSAN HILIR',
    line4: 'Jl. P. Antasari No.78 RT.V Desa Batuah Kecamatan Kusan Hilir Pagatan Telp. (0518) 38116',
  },

  // Logo base64 data (loaded at runtime)
  _logoLeft: null,   // tanbu.jpg (kabupaten)
  _logoRight: null,  // smp.png (sekolah)
  _logosLoaded: false,

  /**
   * Load logos as base64 for PDF embedding
   */
  async _loadLogos() {
    if (this._logosLoaded) return;

    const toBase64 = (url, type) => new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL(type));
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

    try {
      this._logoLeft = await toBase64('tanbu.jpg', 'image/jpeg');
      this._logoRight = await toBase64('smp.png', 'image/png');
    } catch (e) {
      console.warn('Logo loading failed:', e);
    }
    this._logosLoaded = true;
  },

  /**
   * Generate PDF from shuffle results
   * @param {Object} results - { 'A': [...students], 'B': [...], ... }
   * @param {string} targetGrade - '8' or '9'
   * @param {Object} rankings - rankings by class (for reference only, not printed)
   */
  async generatePDF(results, targetGrade, rankings) {
    // Check jsPDF availability
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('Library jsPDF belum dimuat. Pastikan terhubung ke internet.');
    }

    // Load logos
    await this._loadLogos();

    const { jsPDF } = window.jspdf;
    // Use F4 paper size (210mm × 330mm)
    const doc = new jsPDF('portrait', 'mm', [210, 330]);
    const rombels = getRombelList();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;

    rombels.forEach((rombel, idx) => {
      if (idx > 0) doc.addPage([210, 330]);

      // Sort students alphabetically
      const students = [...(results[rombel] || [])].sort((a, b) =>
        a.nama.localeCompare(b.nama)
      );

      // Draw KOP
      let yPos = this._drawKop(doc, pageWidth, margin);

      // Title
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(0, 0, 0);
      const title = `DAFTAR SISWA KELAS ${targetGrade}${rombel}`;
      doc.text(title, pageWidth / 2, yPos, { align: 'center' });
      
      // Underline Title
      const titleWidth = doc.getTextWidth(title);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line((pageWidth / 2) - (titleWidth / 2), yPos + 1.5, (pageWidth / 2) + (titleWidth / 2), yPos + 1.5);

      yPos += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Tahun Pelajaran ${new Date().getFullYear()}/${new Date().getFullYear() + 1}`, pageWidth / 2, yPos, { align: 'center' });

      yPos += 10;

      // Table data — no ranking markers, sorted alphabetically
      const tableData = students.map((s, i) => [
        i + 1,
        s.nama,
        s.jk === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN',
        s.kelasAsal ? `${parseInt(targetGrade) - 1}${s.kelasAsal}` : '-',
      ]);

      // Stats
      const totalL = students.filter(s => s.jk === 'L').length;
      const totalP = students.filter(s => s.jk === 'P').length;

      // AutoTable
      doc.autoTable({
        startY: yPos,
        head: [['NO', 'NAMA SISWA', 'JENIS KELAMIN', 'KELAS ASAL']],
        body: tableData,
        margin: { left: margin, right: margin },
        styles: {
          font: 'helvetica',
          fontSize: 11,
          cellPadding: 4,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [44, 62, 80],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          valign: 'middle',
          fontSize: 11,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },
          1: { cellWidth: 'auto' },
          2: { halign: 'center', cellWidth: 40 },
          3: { halign: 'center', cellWidth: 30 },
        },
        bodyStyles: {
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw === 'LAKI-LAKI') {
              data.cell.styles.textColor = [59, 130, 246];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [217, 70, 239];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });

      // Stats below table
      const finalY = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total Siswa: ${students.length}`, margin, finalY);
      doc.setTextColor(59, 130, 246);
      doc.text(`Laki-laki: ${totalL}`, margin + 55, finalY);
      doc.setTextColor(217, 70, 239);
      doc.text(`Perempuan: ${totalP}`, margin + 100, finalY);

      // Signature
      const sigX = pageWidth - margin - 40; // Shifted further right
      const sigY = finalY + 20;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('Koordinator Kesiswaan,', sigX, sigY, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Syahrul Maarif, S.Pd.', sigX, sigY + 25, { align: 'center' });
      // Underline name
      const nameWidth = doc.getTextWidth('Syahrul Maarif, S.Pd.');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(sigX - nameWidth / 2, sigY + 26, sigX + nameWidth / 2, sigY + 26);

      // Page number
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Halaman ${idx + 1} dari ${rombels.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    });

    // Save — blob fallback for mobile compatibility
    const filename = `Hasil_Pengacakan_Kelas_${targetGrade}_${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  _drawKop(doc, pageWidth, margin) {
    let yPos = 18;
    const centerX = pageWidth / 2;

    // Left Logo (Kabupaten Tanah Bumbu)
    if (this._logoLeft) {
      try {
        doc.addImage(this._logoLeft, 'JPEG', margin + 3, yPos - 7, 20, 22);
      } catch (e) { /* skip */ }
    }

    // Right Logo (SMPN 2 Kusan Hilir)
    if (this._logoRight) {
      try {
        doc.addImage(this._logoRight, 'PNG', pageWidth - margin - 23, yPos - 7, 20, 22);
      } catch (e) { /* skip */ }
    }

    // Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text(this.kopConfig.line1, centerX, yPos, { align: 'center' });

    yPos += 6; // Even spacing
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(this.kopConfig.line2, centerX, yPos, { align: 'center' });

    yPos += 6; // Even spacing
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(this.kopConfig.line3, centerX, yPos, { align: 'center' });

    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(this.kopConfig.line4, centerX, yPos, { align: 'center' });

    // Line separator (double line)
    yPos += 5;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos + 1.2, pageWidth - margin, yPos + 1.2);

    return yPos + 2;
  }
};

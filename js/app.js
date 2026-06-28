// ============================================
// APP.JS — Main Application Controller
// Navigation, state management, UI rendering
// ============================================

const App = {
  // State
  currentPage: 'dashboard',
  mode: null,        // '7to8', '8to9', 'new7'
  students: null,    // students data for current mode
  gradeInfo: null,   // { from, to, label }
  rankings: {},      // { 'A': Set([name,...]), 'B': Set(...), ... }
  exclusions: [],    // [{ student1: {nama,kelas}, student2: {nama,kelas} }, ...]
  gangs: [],         // [[{nama,kelas}, ...], ...] — gang members to distribute evenly
  groupings: [],     // [[{nama,kelas}, ...], ...]
  results: null,     // shuffle results
  currentTab: 'A',   // current active tab
  _tempGang: [],     // temp gang builder

  // ---- Initialization ----
  init() {
    this.renderDashboard();
    this.showPage('dashboard');
  },

  // ---- Navigation ----
  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(`page-${pageId}`);
    if (page) {
      page.classList.add('active');
      this.currentPage = pageId;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  },

  goBack() {
    const rombels = getRombelList();
    const currentIdx = rombels.indexOf(this.currentTab);

    if (this.currentPage === 'ranking') {
      if (currentIdx > 0) {
        this.currentTab = rombels[currentIdx - 1];
        this.renderRanking();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        this.resetState();
        this.renderDashboard();
        this.showPage('dashboard');
      }
    } else if (this.currentPage === 'exclusion') {
      if (currentIdx > 0) {
        this.currentTab = rombels[currentIdx - 1];
        this.renderExclusion();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        this.currentTab = rombels[rombels.length - 1];
        this.renderRanking();
        this.showPage('ranking');
      }
    } else if (this.currentPage === 'grouping') {
      this.currentTab = rombels[rombels.length - 1];
      this.renderExclusion();
      this.showPage('exclusion');
    } else if (this.currentPage === 'shuffle') {
      this.renderGrouping();
      this.showPage('grouping');
    } else if (this.currentPage === 'results') {
      this.renderShuffle();
      this.showPage('shuffle');
    }
  },

  resetState() {
    this.mode = null;
    this.students = null;
    this.gradeInfo = null;
    this.rankings = {};
    this.exclusions = [];
    this.gangs = [];
    this.groupings = [];
    this.results = null;
    this.currentTab = 'A';
    this._tempGang = [];
  },

  // ---- Step Indicator ----
  renderStepIndicator(currentStep) {
    const steps = [
      { num: 1, label: 'Peringkat' },
      { num: 2, label: 'Pemisahan' },
      { num: 3, label: 'Penggabungan' },
      { num: 4, label: 'Acak' },
    ];

    return `
      <div class="step-indicator">
        ${steps.map((step, idx) => {
          const isActive = step.num === currentStep;
          const isCompleted = step.num < currentStep;
          let cls = 'step-dot';
          if (isActive) cls += ' active';
          if (isCompleted) cls += ' completed';
          return `
            ${idx > 0 ? `<div class="step-line ${isCompleted ? 'completed' : ''}"></div>` : ''}
            <div class="${cls}">
              <div class="dot">${isCompleted ? '✓' : step.num}</div>
              <span class="label">${step.label}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // ---- Class Progress Indicator ----
  renderClassProgress(activeRombel) {
    const rombels = getRombelList();
    const activeIdx = rombels.indexOf(activeRombel);
    return `
      <div class="class-progress">
        ${rombels.map((r, idx) => {
          let cls = 'class-dot';
          if (idx < activeIdx) cls += ' completed';
          if (idx === activeIdx) cls += ' active';
          return `<div class="${cls}">${r}</div>`;
        }).join('')}
      </div>
    `;
  },

  // ---- Header ----
  renderHeader(title, subtitle, showBack = true) {
    return `
      <div class="header">
        <div class="header-left">
          ${showBack ? `
            <button class="btn-back" onclick="App.goBack()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Kembali
            </button>
          ` : ''}
          <div>
            <div class="header-title">${title}</div>
            ${subtitle ? `<div class="header-subtitle">${subtitle}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  },

  // ============================================
  //  PAGE 1: DASHBOARD
  // ============================================
  renderDashboard() {
    const container = document.getElementById('page-dashboard');
    container.innerHTML = `
      <div class="dashboard-title">
        <h1>🎓 Acak Siswa</h1>
        <p>Pengacakan Rombongan Belajar</p>
      </div>

      <div class="dashboard-cards">
        <div class="dash-card disabled" onclick="App.selectMode('new7')">
          <div class="dash-card-title">🆕 Siswa Baru Kelas 7</div>
          <span class="dash-card-badge coming-soon">Segera Hadir</span>
        </div>

        <div class="dash-card" onclick="App.selectMode('7to8')">
          <div class="dash-card-title">📈 Kelas 7 → 8</div>
          <span class="dash-card-badge">${this._countStudents('7')} Siswa</span>
        </div>

        <div class="dash-card" onclick="App.selectMode('8to9')">
          <div class="dash-card-title">🎯 Kelas 8 → 9</div>
          <span class="dash-card-badge">${this._countStudents('8')} Siswa</span>
        </div>
      </div>
    `;
  },

  _countStudents(grade) {
    const data = STUDENT_DATA[grade];
    if (!data) return 0;
    return Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
  },

  selectMode(mode) {
    if (mode === 'new7') return; // disabled
    this.mode = mode;
    this.gradeInfo = getGradeLabel(mode);
    this.students = getStudentsForMode(mode);
    this.rankings = {};
    this.exclusions = [];
    this.gangs = [];
    this.groupings = [];
    this.results = null;
    this.currentTab = 'A';
    this._tempGang = [];

    getRombelList().forEach(r => {
      this.rankings[r] = new Set();
    });

    this.renderRanking();
    this.showPage('ranking');
  },

  // ============================================
  //  PAGE 2: RANKING
  // ============================================
  renderRanking() {
    const container = document.getElementById('page-ranking');
    const rombel = this.currentTab;
    const rombels = getRombelList();
    const rombelIdx = rombels.indexOf(rombel);
    const classList = this.students[rombel] || [];
    const ranked = this.rankings[rombel] || new Set();
    const maleCount = classList.filter(s => s.jk === 'L').length;
    const femaleCount = classList.filter(s => s.jk === 'P').length;
    const isLast = rombelIdx === rombels.length - 1;

    container.innerHTML = `
      ${this.renderHeader(`Peringkat — Kelas ${this.gradeInfo.from}${rombel}`, this.gradeInfo.label)}
      ${this.renderStepIndicator(1)}
      ${this.renderClassProgress(rombel)}

      <div class="alert alert-info">
        ⭐ Centang <strong>maks 5 siswa</strong> peringkat. Siswa ini <strong>tetap</strong> di rombel ${this.gradeInfo.to}${rombel}.
      </div>

      <div id="ranking-alert" style="display:none"></div>

      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="text" placeholder="Cari nama siswa..." oninput="App.filterRankingTable(this.value)" id="ranking-search">
      </div>

      <div class="table-container">
        <table class="data-table" id="ranking-table">
          <thead>
            <tr>
              <th style="width:36px">No</th>
              <th>Nama Siswa</th>
              <th style="width:90px">JK</th>
              <th style="width:50px;text-align:center">⭐</th>
            </tr>
          </thead>
          <tbody>
            ${classList.map((s, i) => `
              <tr class="gender-${s.jk === 'L' ? 'male' : 'female'} ${ranked.has(s.nama) ? 'ranked' : ''}"
                  data-name="${s.nama.toLowerCase()}" id="rank-row-${rombel}-${i}">
                <td>${i + 1}</td>
                <td>
                  ${s.nama}
                  ${ranked.has(s.nama) ? '<span class="rank-badge">Peringkat</span>' : ''}
                </td>
                <td>
                  <span class="gender-badge ${s.jk === 'L' ? 'male' : 'female'}">
                    ${s.jk === 'L' ? 'Laki-laki' : 'Perempuan'}
                  </span>
                </td>
                <td>
                  <div class="checkbox-wrapper">
                    <div class="custom-checkbox ${ranked.has(s.nama) ? 'checked' : ''}"
                         data-nama="${s.nama.replace(/"/g, '&quot;')}"
                         onclick="App.toggleRanking('${rombel}', this.dataset.nama, ${i})">
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="table-stats">
          <div class="stat-item">
            <span class="stat-label">Total:</span>
            <span class="stat-value">${classList.length}</span>
          </div>
          <div class="stat-item male">
            <span class="stat-label">Laki-laki:</span>
            <span class="stat-value">${maleCount}</span>
          </div>
          <div class="stat-item female">
            <span class="stat-label">Perempuan:</span>
            <span class="stat-value">${femaleCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">⭐:</span>
            <span class="stat-value">${ranked.size}/5</span>
          </div>
        </div>
      </div>

      <div class="btn-group" style="justify-content: space-between;">
        <button class="btn btn-secondary" onclick="App.goBack()">← Kembali</button>
        <button class="btn btn-primary" onclick="App.goToNextRanking()">${isLast ? 'Lanjut: Pemisahan →' : `Lanjut: Kelas ${this.gradeInfo.from}${rombels[rombelIdx + 1]} →`}</button>
      </div>
    `;
  },

  goToNextRanking() {
    const rombels = getRombelList();
    const currentIdx = rombels.indexOf(this.currentTab);
    if (currentIdx < rombels.length - 1) {
      this.currentTab = rombels[currentIdx + 1];
      this.renderRanking();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.currentTab = 'A';
      this.renderExclusion();
      this.showPage('exclusion');
    }
  },

  toggleRanking(rombel, nama, idx) {
    const ranked = this.rankings[rombel];
    if (ranked.has(nama)) {
      ranked.delete(nama);
    } else {
      if (ranked.size >= 5) {
        const alertEl = document.getElementById('ranking-alert');
        alertEl.style.display = 'block';
        alertEl.innerHTML = `<div class="alert alert-warning">⚠️ Maksimal 5 siswa per kelas! Hapus centang salah satu siswa terlebih dahulu.</div>`;
        setTimeout(() => { alertEl.style.display = 'none'; }, 3000);
        return;
      }
      ranked.add(nama);
    }
    this.renderRanking();
  },

  filterRankingTable(query) {
    const rows = document.querySelectorAll('#ranking-table tbody tr');
    const q = query.toLowerCase();
    rows.forEach(row => {
      const name = row.getAttribute('data-name');
      row.style.display = name.includes(q) ? '' : 'none';
    });
  },

  // goToExclusion is now handled by goToNextRanking

  // ============================================
  //  PAGE 3: EXCLUSION (Pemisahan)
  // ============================================
  renderExclusion() {
    const container = document.getElementById('page-exclusion');
    const rombel = this.currentTab;
    const rombels = getRombelList();
    const rombelIdx = rombels.indexOf(rombel);
    const classList = [...(this.students[rombel] || [])].sort((a, b) => a.nama.localeCompare(b.nama));
    const isLast = rombelIdx === rombels.length - 1;

    // Color map per class
    const classColors = { A: '#ff6b6b', B: '#4dabf7', C: '#51cf66', D: '#ffd43b', E: '#cc5de8' };

    // Build optgroup dropdown for student2
    const optgroupHTML = rombels.map(r => {
      const students = [...(this.students[r] || [])].sort((a, b) => a.nama.localeCompare(b.nama));
      if (students.length === 0) return '';
      const color = classColors[r] || '';
      return `
        <optgroup label="Kelas ${this.gradeInfo.from}${r}">
          ${students.map(s => {
            const isRanked = this.rankings[r] && this.rankings[r].has(s.nama);
            return `<option value="${s.nama}|${r}" style="color:${color};">${s.nama} (${s.jk === 'L' ? 'L' : 'P'})${isRanked ? ' \u2b50' : ''}</option>`;
          }).join('')}
        </optgroup>
      `;
    }).join('');

    // Exclusions involving this class
    const classExclusions = this.exclusions.filter(ex =>
      ex.student1.kelas === rombel || ex.student2.kelas === rombel
    );

    container.innerHTML = `
      ${this.renderHeader(`Pemisahan — Kelas ${this.gradeInfo.from}${rombel}`, this.gradeInfo.label)}
      ${this.renderStepIndicator(2)}
      ${this.renderClassProgress(rombel)}

      <div class="alert alert-info">
        🚫 Pilih siswa dari kelas ${this.gradeInfo.from}${rombel} yang <strong>tidak boleh satu kelas</strong> dengan siswa lain.
      </div>

      <div class="glass-panel">
        <div class="constraint-builder">
          <div class="form-group">
            <label class="form-label">Siswa dari ${this.gradeInfo.from}${rombel}</label>
            <select class="form-select" id="excl-student1">
              <option value="">-- Pilih Siswa --</option>
              ${classList.map(s => {
                const isRanked = this.rankings[rombel] && this.rankings[rombel].has(s.nama);
                return `<option value="${s.nama}|${rombel}">${s.nama} (${s.jk === 'L' ? 'L' : 'P'})${isRanked ? ' \u2b50' : ''}</option>`;
              }).join('')}
            </select>
          </div>

          <div class="constraint-arrow">🚫</div>

          <div class="form-group">
            <label class="form-label">Tidak boleh satu kelas dengan</label>
            <select class="form-select" id="excl-student2">
              <option value="">-- Pilih Siswa --</option>
              ${optgroupHTML}
            </select>
          </div>

          <div>
            <label class="form-label">&nbsp;</label>
            <button class="btn btn-danger" onclick="App.addExclusion()" style="width:100%">+ Tambah</button>
          </div>
        </div>
      </div>

      ${classExclusions.length > 0 ? `
        <div class="section-title">
          <h2>Pemisahan Kelas ${this.gradeInfo.from}${rombel}</h2>
          <p>${classExclusions.length} pasangan</p>
        </div>
        <div class="constraint-list" id="exclusion-list">
          ${classExclusions.map(ex => {
            const globalIdx = this.exclusions.indexOf(ex);
            return `
              <div class="constraint-card exclusion">
                <div class="constraint-info">
                  <span class="constraint-student">${ex.student1.nama} (${this.gradeInfo.from}${ex.student1.kelas})</span>
                  <span class="constraint-icon">🚫</span>
                  <span class="constraint-student">${ex.student2.nama} (${this.gradeInfo.from}${ex.student2.kelas})</span>
                </div>
                <button class="btn-icon" onclick="App.removeExclusion(${globalIdx})" title="Hapus">✕</button>
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="empty-state">
          <span class="empty-state-icon">🤝</span>
          <div class="empty-state-text">Belum ada pemisahan individual untuk kelas ini.</div>
        </div>
      `}

      <!-- ====== GANG SEPARATION SECTION ====== -->
      <div class="gang-separator"></div>

      <div class="alert alert-gang">
        🔥 <strong>Pemisahan Geng</strong> — Tandai sekelompok siswa yang harus <strong>didistribusikan merata</strong> ke semua rombel.
      </div>

      <div class="glass-panel gang-panel">
        <div class="form-group">
          <label class="form-label">Tambah Anggota Geng</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select class="form-select" id="gang-student" style="flex:1; min-width:200px;">
              <option value="">-- Pilih Siswa --</option>
              ${optgroupHTML}
            </select>
            <button class="btn btn-gang" onclick="App.addToTempGang()">+ Tambah</button>
          </div>
        </div>

        <div id="temp-gang" class="constraint-list" style="margin-top:8px;"></div>

        <div style="margin-top:12px; text-align:right;">
          <button class="btn btn-primary" onclick="App.saveGang()" id="save-gang-btn" style="display:none;">
            🔥 Simpan Geng
          </button>
        </div>
      </div>

      ${(() => {
        // Gangs involving at least 1 member from current rombel
        const relevantGangs = this.gangs.map((gang, idx) => ({ gang, idx }))
          .filter(({ gang }) => gang.some(m => m.kelas === rombel));
        const numRombels = rombels.length;

        if (relevantGangs.length > 0) {
          return `
            <div class="section-title">
              <h2>🔥 Geng — Kelas ${this.gradeInfo.from}${rombel}</h2>
              <p>${relevantGangs.length} geng terkait</p>
            </div>
            <div class="constraint-list" id="gang-list">
              ${relevantGangs.map(({ gang, idx }) => {
                const maxPerKelas = Math.ceil(gang.length / numRombels);
                return `
                  <div class="constraint-card gang">
                    <div class="constraint-info" style="flex-direction:column; align-items:flex-start; gap:4px;">
                      <div class="gang-header-info">
                        <span class="gang-badge">${gang.length} anggota</span>
                        <span class="gang-dist-badge">max ${maxPerKelas}/kelas</span>
                      </div>
                      <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        ${gang.map(m => `
                          <span class="constraint-student">${m.nama} (${this.gradeInfo.from}${m.kelas})</span>
                        `).join('')}
                      </div>
                    </div>
                    <button class="btn-icon" onclick="App.removeGang(${idx})" title="Hapus">✕</button>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        } else {
          return `
            <div class="empty-state">
              <span class="empty-state-icon">🔥</span>
              <div class="empty-state-text">Belum ada geng yang dibuat. Tambahkan jika ada kelompok siswa yang harus disebar.</div>
            </div>
          `;
        }
      })()}

      <p class="skip-note">💡 Tidak ada yang perlu dipisahkan? Langsung klik "Lanjut"</p>

      <div class="btn-group" style="justify-content: space-between;">
        <button class="btn btn-secondary" onclick="App.goBack()">← Kembali</button>
        <button class="btn btn-primary" onclick="App.goToNextExclusion()">${isLast ? 'Lanjut: Penggabungan →' : `Lanjut: Kelas ${this.gradeInfo.from}${rombels[rombelIdx + 1]} →`}</button>
      </div>
    `;

    // Reset temp gang
    this._tempGang = [];
  },

  goToNextExclusion() {
    const rombels = getRombelList();
    const currentIdx = rombels.indexOf(this.currentTab);
    if (currentIdx < rombels.length - 1) {
      this.currentTab = rombels[currentIdx + 1];
      this.renderExclusion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      this.goToGrouping();
    }
  },

  addExclusion() {
    const sel1 = document.getElementById('excl-student1').value;
    const sel2 = document.getElementById('excl-student2').value;
    if (!sel1 || !sel2) {
      alert('Pilih kedua siswa terlebih dahulu!');
      return;
    }
    const [nama1, kelas1] = sel1.split('|');
    const [nama2, kelas2] = sel2.split('|');

    if (nama1 === nama2 && kelas1 === kelas2) {
      alert('Tidak bisa memisahkan siswa dengan dirinya sendiri!');
      return;
    }

    // Check if both students are ranked (both fixed in their class = can't separate)
    const isRanked1 = this.rankings[kelas1] && this.rankings[kelas1].has(nama1);
    const isRanked2 = this.rankings[kelas2] && this.rankings[kelas2].has(nama2);
    if (isRanked1 && isRanked2) {
      alert(`"${nama1}" dan "${nama2}" keduanya siswa peringkat — tidak bisa dipisahkan karena siswa peringkat tetap di rombelnya masing-masing.`);
      return;
    }

    // Check duplicate
    const exists = this.exclusions.some(ex =>
      (ex.student1.nama === nama1 && ex.student1.kelas === kelas1 && ex.student2.nama === nama2 && ex.student2.kelas === kelas2) ||
      (ex.student1.nama === nama2 && ex.student1.kelas === kelas2 && ex.student2.nama === nama1 && ex.student2.kelas === kelas1)
    );
    if (exists) {
      alert('Pasangan pemisahan ini sudah ada!');
      return;
    }

    this.exclusions.push({
      student1: { nama: nama1, kelas: kelas1 },
      student2: { nama: nama2, kelas: kelas2 },
    });

    this.renderExclusion();
  },

  removeExclusion(index) {
    this.exclusions.splice(index, 1);
    this.renderExclusion();
  },

  goToGrouping() {
    this.currentTab = 'A';
    this.renderGrouping();
    this.showPage('grouping');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ---- Gang Functions ----
  addToTempGang() {
    const sel = document.getElementById('gang-student');
    if (!sel.value) { alert('Pilih siswa terlebih dahulu!'); return; }

    const [nama, kelas] = sel.value.split('|');

    if (this._tempGang.some(m => m.nama === nama && m.kelas === kelas)) {
      alert('Siswa sudah ada di dalam geng ini!');
      return;
    }

    const inOtherGang = this.gangs.some(gang =>
      gang.some(m => m.nama === nama && m.kelas === kelas)
    );
    if (inOtherGang) {
      alert('Siswa sudah berada di geng lain!');
      return;
    }

    const student = { nama, kelas };
    const studentData = (this.students[kelas] || []).find(s => s.nama === nama);
    if (studentData) student.jk = studentData.jk;

    this._tempGang.push(student);
    this._renderTempGang();
  },

  _renderTempGang() {
    const container = document.getElementById('temp-gang');
    const saveBtn = document.getElementById('save-gang-btn');

    if (this._tempGang.length === 0) {
      container.innerHTML = '';
      saveBtn.style.display = 'none';
      return;
    }

    saveBtn.style.display = this._tempGang.length >= 2 ? 'inline-flex' : 'none';

    const maxPerKelas = Math.ceil(this._tempGang.length / getRombelList().length);
    container.innerHTML = `
      <div class="gang-temp-info">Anggota: ${this._tempGang.length} \u00b7 Max ${maxPerKelas} per kelas</div>
      ${this._tempGang.map((m, i) => `
        <div class="constraint-card gang" style="padding:8px 12px;">
          <div class="constraint-info">
            <span class="constraint-student">${m.nama} (${this.gradeInfo.from}${m.kelas})</span>
            <span class="gender-badge ${m.jk === 'L' ? 'male' : 'female'}">${m.jk === 'L' ? 'L' : 'P'}</span>
          </div>
          <button class="btn-icon" onclick="App.removeTempGang(${i})" title="Hapus">\u2715</button>
        </div>
      `).join('')}
    `;
  },

  removeTempGang(index) {
    this._tempGang.splice(index, 1);
    this._renderTempGang();
  },

  saveGang() {
    if (this._tempGang.length < 2) {
      alert('Geng harus berisi minimal 2 siswa!');
      return;
    }

    const allRanked = this._tempGang.every(m =>
      this.rankings[m.kelas] && this.rankings[m.kelas].has(m.nama)
    );
    const allSameClass = this._tempGang.every(m => m.kelas === this._tempGang[0].kelas);
    if (allRanked && allSameClass) {
      alert('Semua anggota geng adalah siswa peringkat dari rombel yang sama \u2014 pemisahan tidak bermakna karena mereka semua tetap di rombelnya.');
      return;
    }

    this.gangs.push([...this._tempGang]);
    this._tempGang = [];
    this.renderExclusion();
  },

  removeGang(index) {
    this.gangs.splice(index, 1);
    this.renderExclusion();
  },

  // ============================================
  //  PAGE 4: GROUPING (Penggabungan)
  // ============================================
  renderGrouping() {
    const container = document.getElementById('page-grouping');
    const rombel = this.currentTab;

    // All students (including ranked)
    const allStudents = [];
    getRombelList().forEach(r => {
      (this.students[r] || []).forEach(s => {
        allStudents.push({ ...s, kelas: r });
      });
    });

    // Build optgroup for all students sorted alphabetically
    const groupOptgroupHTML = getRombelList().map(r => {
      const classStudents = allStudents.filter(s => s.kelas === r).sort((a, b) => a.nama.localeCompare(b.nama));
      if (classStudents.length === 0) return '';
      return `
        <optgroup label="Kelas ${this.gradeInfo.from}${r}">
          ${classStudents.map(s => {
            const isRanked = this.rankings[r] && this.rankings[r].has(s.nama);
            return `<option value="${s.nama}|${s.kelas}">${s.nama} (${s.jk === 'L' ? 'L' : 'P'})${isRanked ? ' ⭐' : ''}</option>`;
          }).join('')}
        </optgroup>
      `;
    }).join('');

    container.innerHTML = `
      ${this.renderHeader('Penggabungan Siswa', this.gradeInfo.label)}
      ${this.renderStepIndicator(3)}

      <div class="alert alert-info">
        🤝 Buat grup siswa yang <strong>harus ditempatkan satu kelas</strong>. Siswa peringkat ditandai ⭐.
      </div>

      <div class="glass-panel">
        <div class="form-group">
          <label class="form-label">Tambah Siswa ke Grup Baru</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select class="form-select" id="group-student" style="flex:1; min-width:200px;">
              <option value="">-- Pilih Siswa --</option>
              ${groupOptgroupHTML}
            </select>
            <button class="btn btn-success" onclick="App.addToTempGroup()">+ Tambah</button>
          </div>
        </div>

        <div id="temp-group" class="constraint-list" style="margin-top:8px;"></div>

        <div style="margin-top:12px; text-align:right;">
          <button class="btn btn-primary" onclick="App.saveGroup()" id="save-group-btn" style="display:none;">
            💾 Simpan Grup
          </button>
        </div>
      </div>

      <div class="section-title">
        <h2>Daftar Grup Penggabungan</h2>
        <p>${this.groupings.length} grup total</p>
      </div>

      <div class="constraint-list" id="grouping-list">
        ${this.groupings.length === 0 ? `
          <div class="empty-state">
            <span class="empty-state-icon">👥</span>
            <div class="empty-state-text">Belum ada grup penggabungan. Tambahkan jika diperlukan, atau langsung lanjut.</div>
          </div>
        ` : this.groupings.map((group, i) => `
          <div class="constraint-card grouping">
            <div class="constraint-info">
              ${group.map(m => `
                <span class="constraint-student">${m.nama} (${this.gradeInfo.from}${m.kelas})</span>
              `).join('<span class="constraint-icon">🤝</span>')}
            </div>
            <button class="btn-icon" onclick="App.removeGrouping(${i})" title="Hapus">✕</button>
          </div>
        `).join('')}
      </div>

      <p class="skip-note">💡 Jika tidak ada siswa yang perlu digabungkan, langsung klik "Lanjut"</p>

      <div class="btn-group" style="justify-content: space-between;">
        <button class="btn btn-secondary" onclick="App.goBack()">← Kembali</button>
        <button class="btn btn-primary" onclick="App.goToShuffle()">Lanjut: Pengacakan →</button>
      </div>
    `;

    // Reset temp group
    this._tempGroup = [];
  },

  _tempGroup: [],

  addToTempGroup() {
    const sel = document.getElementById('group-student');
    if (!sel.value) { alert('Pilih siswa terlebih dahulu!'); return; }

    const [nama, kelas] = sel.value.split('|');

    // Check not already in temp
    if (this._tempGroup.some(m => m.nama === nama && m.kelas === kelas)) {
      alert('Siswa sudah ada di dalam grup!');
      return;
    }

    // Check not already in another group
    const inOtherGroup = this.groupings.some(group =>
      group.some(m => m.nama === nama && m.kelas === kelas)
    );
    if (inOtherGroup) {
      alert('Siswa sudah berada di grup lain!');
      return;
    }

    const student = { nama, kelas };
    // Get jk
    const studentData = (this.students[kelas] || []).find(s => s.nama === nama);
    if (studentData) student.jk = studentData.jk;

    this._tempGroup.push(student);
    this._renderTempGroup();
  },

  _renderTempGroup() {
    const container = document.getElementById('temp-group');
    const saveBtn = document.getElementById('save-group-btn');

    if (this._tempGroup.length === 0) {
      container.innerHTML = '';
      saveBtn.style.display = 'none';
      return;
    }

    saveBtn.style.display = this._tempGroup.length >= 2 ? 'inline-flex' : 'none';

    container.innerHTML = this._tempGroup.map((m, i) => `
      <div class="constraint-card grouping" style="padding:8px 12px;">
        <div class="constraint-info">
          <span class="constraint-student">${m.nama} (${this.gradeInfo.from}${m.kelas})</span>
          <span class="gender-badge ${m.jk === 'L' ? 'male' : 'female'}">${m.jk === 'L' ? 'L' : 'P'}</span>
        </div>
        <button class="btn-icon" onclick="App.removeTempGroup(${i})" title="Hapus">✕</button>
      </div>
    `).join('');
  },

  removeTempGroup(index) {
    this._tempGroup.splice(index, 1);
    this._renderTempGroup();
  },

  saveGroup() {
    if (this._tempGroup.length < 2) {
      alert('Grup harus berisi minimal 2 siswa!');
      return;
    }

    // Check: if multiple ranked students in group → reject
    const rankedInGroup = this._tempGroup.filter(m =>
      this.rankings[m.kelas] && this.rankings[m.kelas].has(m.nama)
    );
    if (rankedInGroup.length > 1) {
      alert(`Tidak bisa menggabungkan lebih dari satu siswa peringkat. Ditemukan ${rankedInGroup.length} siswa peringkat: ${rankedInGroup.map(m => m.nama).join(', ')}`);
      return;
    }

    this.groupings.push([...this._tempGroup]);
    this._tempGroup = [];
    this.renderGrouping();
  },

  removeGrouping(index) {
    this.groupings.splice(index, 1);
    this.renderGrouping();
  },

  goToShuffle() {
    this.renderShuffle();
    this.showPage('shuffle');
  },

  // ============================================
  //  PAGE 5: SHUFFLE
  // ============================================
  renderShuffle() {
    const container = document.getElementById('page-shuffle');

    // Summary stats
    let totalStudents = 0, totalMale = 0, totalFemale = 0, totalRanked = 0;
    getRombelList().forEach(r => {
      const cl = this.students[r] || [];
      totalStudents += cl.length;
      totalMale += cl.filter(s => s.jk === 'L').length;
      totalFemale += cl.filter(s => s.jk === 'P').length;
      totalRanked += (this.rankings[r] ? this.rankings[r].size : 0);
    });

    container.innerHTML = `
      ${this.renderHeader('Pengacakan Rombel', this.gradeInfo.label)}
      ${this.renderStepIndicator(4)}

      <div class="summary-bar">
        <div class="summary-item total">
          <div class="summary-value">${totalStudents}</div>
          <div class="summary-label">Total Siswa</div>
        </div>
        <div class="summary-item male">
          <div class="summary-value">${totalMale}</div>
          <div class="summary-label">Laki-laki</div>
        </div>
        <div class="summary-item female">
          <div class="summary-value">${totalFemale}</div>
          <div class="summary-label">Perempuan</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--accent-gold);">⭐ ${totalRanked}</div>
          <div class="summary-label">Siswa Peringkat</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--accent-red);">🚫 ${this.exclusions.length}</div>
          <div class="summary-label">Pemisahan</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--accent-green);">🤝 ${this.groupings.length}</div>
          <div class="summary-label">Penggabungan</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" style="color: var(--accent-orange);">🔥 ${this.gangs.length}</div>
          <div class="summary-label">Geng</div>
        </div>
      </div>

      <div class="center-action" id="shuffle-action">
        <button class="btn btn-shuffle" onclick="App.doShuffle()">
          🔀 Acak Sekarang
        </button>
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 8px;">
          Tekan tombol untuk memulai pengacakan rombel kelas ${this.gradeInfo.to}
        </p>
      </div>

      <div class="shuffle-animation" id="shuffle-loading">
        <div class="spinner"></div>
        <div class="shuffle-text">Sedang mengacak siswa...</div>
      </div>

      <div id="shuffle-error" style="display:none;"></div>

      <div class="btn-group">
        <button class="btn btn-secondary" onclick="App.goBack()">← Kembali</button>
      </div>
    `;
  },

  doShuffle() {
    // Show loading
    document.getElementById('shuffle-action').style.display = 'none';
    document.getElementById('shuffle-loading').classList.add('active');
    document.getElementById('shuffle-error').style.display = 'none';

    // Simulate processing delay for UX
    setTimeout(() => {
      const result = Shuffler.shuffle(
        this.students,
        this.rankings,
        this.exclusions,
        this.groupings,
        this.gradeInfo.to,
        this.gangs
      );

      document.getElementById('shuffle-loading').classList.remove('active');

      if (result) {
        this.results = result;
        this.renderResults();
        this.showPage('results');
      } else {
        document.getElementById('shuffle-action').style.display = 'flex';
        document.getElementById('shuffle-error').style.display = 'block';
        document.getElementById('shuffle-error').innerHTML = `
          <div class="alert alert-error">
            ❌ <strong>Pengacakan gagal!</strong> Constraint yang diberikan terlalu ketat dan tidak bisa dipenuhi semua.
            Silakan kurangi jumlah pemisahan/penggabungan atau coba lagi.
          </div>
        `;
      }
    }, 1500);
  },

  // ============================================
  //  PAGE 6: RESULTS
  // ============================================
  renderResults() {
    const container = document.getElementById('page-results');
    const rombels = getRombelList();

    // Overall stats
    let totalStudents = 0, totalMale = 0, totalFemale = 0;
    rombels.forEach(r => {
      const cl = this.results[r] || [];
      totalStudents += cl.length;
      totalMale += cl.filter(s => s.jk === 'L').length;
      totalFemale += cl.filter(s => s.jk === 'P').length;
    });

    container.innerHTML = `
      ${this.renderHeader('Hasil Pengacakan', this.gradeInfo.label)}

      <div class="alert alert-success">
        ✅ Pengacakan berhasil! Berikut hasil pembagian rombel kelas ${this.gradeInfo.to}.
      </div>

      <div class="summary-bar">
        <div class="summary-item total">
          <div class="summary-value">${totalStudents}</div>
          <div class="summary-label">Total Siswa</div>
        </div>
        <div class="summary-item male">
          <div class="summary-value">${totalMale}</div>
          <div class="summary-label">Laki-laki</div>
        </div>
        <div class="summary-item female">
          <div class="summary-value">${totalFemale}</div>
          <div class="summary-label">Perempuan</div>
        </div>
      </div>

      <div class="result-grid">
        ${rombels.map(r => {
          const cl = this.results[r] || [];
          const male = cl.filter(s => s.jk === 'L').length;
          const female = cl.filter(s => s.jk === 'P').length;

          // Sort: ranked first, then alphabetically
          const sorted = [...cl].sort((a, b) => {
            const aRanked = this.rankings[a.kelasAsal] && this.rankings[a.kelasAsal].has(a.nama);
            const bRanked = this.rankings[b.kelasAsal] && this.rankings[b.kelasAsal].has(b.nama);
            if (aRanked && !bRanked) return -1;
            if (!aRanked && bRanked) return 1;
            return a.nama.localeCompare(b.nama);
          });

          return `
            <div class="result-class-card">
              <div class="result-class-header">
                <span class="result-class-name">Kelas ${this.gradeInfo.to}${r}</span>
                <span class="result-class-count">${cl.length} siswa</span>
              </div>
              <table class="data-table">
                <thead>
                  <tr>
                    <th style="width:40px">No</th>
                    <th>Nama Siswa</th>
                    <th style="width:120px">Jenis Kelamin</th>
                    <th style="width:80px">Kelas Asal</th>
                  </tr>
                </thead>
                <tbody>
                  ${sorted.map((s, i) => {
                    const isRanked = this.rankings[s.kelasAsal] && this.rankings[s.kelasAsal].has(s.nama);
                    return `
                      <tr class="gender-${s.jk === 'L' ? 'male' : 'female'} ${isRanked ? 'ranked' : ''}">
                        <td>${i + 1}</td>
                        <td>
                          ${s.nama}
                          ${isRanked ? '<span class="rank-badge">Peringkat</span>' : ''}
                        </td>
                        <td>
                          <span class="gender-badge ${s.jk === 'L' ? 'male' : 'female'}">
                            ${s.jk === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </span>
                        </td>
                        <td>${this.gradeInfo.from}${s.kelasAsal}</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
              <div class="table-stats">
                <div class="stat-item">
                  <span class="stat-label">Total:</span>
                  <span class="stat-value">${cl.length}</span>
                </div>
                <div class="stat-item male">
                  <span class="stat-label">Laki-laki:</span>
                  <span class="stat-value">${male}</span>
                </div>
                <div class="stat-item female">
                  <span class="stat-label">Perempuan:</span>
                  <span class="stat-value">${female}</span>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="btn-group" style="justify-content: center; margin-top: 32px;">
        <button class="btn btn-secondary" onclick="App.goBack()">← Kembali</button>
        <button class="btn btn-shuffle" onclick="App.reshuffleFromResults()">🔀 Acak Ulang</button>
        <button class="btn btn-success" onclick="App.exportPDF()">📄 Cetak PDF</button>
      </div>
    `;
  },

  reshuffleFromResults() {
    this.renderShuffle();
    this.showPage('shuffle');
    // Auto-trigger shuffle
    setTimeout(() => this.doShuffle(), 300);
  },

  async exportPDF() {
    try {
      await PDFExport.generatePDF(this.results, this.gradeInfo.to, this.rankings);
    } catch (e) {
      console.error('PDF Export Error:', e);
      alert('Gagal mencetak PDF: ' + e.message);
    }
  },
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

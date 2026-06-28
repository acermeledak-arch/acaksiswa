// ============================================
// SHUFFLER — Algoritma Pengacakan Siswa
// Constraint-aware random placement
// ============================================

const Shuffler = {
  /**
   * Main shuffle function
   * @param {Object} students - Students by class { 'A': [...], 'B': [...] }
   * @param {Object} rankings - Ranked students by class { 'A': Set([name,...]), ... }
   * @param {Array} exclusions - [{student1: {nama, kelas}, student2: {nama, kelas}}, ...]
   * @param {Array} groupings - [[{nama, kelas}, {nama, kelas}, ...], ...]
   * @param {string} targetGrade - Target grade (e.g., '8', '9')
   * @param {Array} gangs - [[{nama, kelas}, ...], ...] — gang members to distribute evenly
   * @returns {Object|null} Result { 'A': [...], 'B': [...], ... } or null if failed
   */
  shuffle(students, rankings, exclusions, groupings, targetGrade, gangs = []) {
    const rombels = getRombelList();
    const maxAttempts = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = this._attemptShuffle(students, rankings, exclusions, groupings, rombels, targetGrade, gangs);
      if (result) {
        return result;
      }
    }
    return null; // Failed after max attempts
  },

  _attemptShuffle(students, rankings, exclusions, groupings, rombels, targetGrade, gangs) {
    // 1. Separate ranked (fixed) and shuffleable students
    const fixedStudents = {}; // { 'A': [...], 'B': [...] }
    const shufflePool = [];   // all students to be shuffled

    rombels.forEach(r => {
      fixedStudents[r] = [];
      const classList = students[r] || [];
      classList.forEach(s => {
        const studentObj = { ...s, kelasAsal: r };
        if (rankings[r] && rankings[r].has(s.nama)) {
          fixedStudents[r].push(studentObj);
        } else {
          shufflePool.push(studentObj);
        }
      });
    });

    // 2. Process groupings — merge grouped students into super-units
    const groupMap = new Map(); // studentKey -> groupIndex
    const superUnits = [];
    const ungroupedPool = [];

    groupings.forEach((group, idx) => {
      const unit = [];
      group.forEach(member => {
        const key = `${member.nama}|${member.kelas}`;
        groupMap.set(key, idx);
      });
      superUnits.push({ members: [], groupIdx: idx });
    });

    // Assign pool students to super-units or ungrouped
    shufflePool.forEach(s => {
      const key = `${s.nama}|${s.kelasAsal}`;
      if (groupMap.has(key)) {
        const gIdx = groupMap.get(key);
        superUnits[gIdx].members.push(s);
      } else {
        ungroupedPool.push(s);
      }
    });

    // Filter out empty super-units
    const activeSuperUnits = superUnits.filter(su => su.members.length > 0);

    // 3. Calculate target distribution
    const totalStudents = rombels.reduce((sum, r) => {
      return sum + (students[r] ? students[r].length : 0);
    }, 0);
    const basePerClass = Math.floor(totalStudents / rombels.length);
    const remainder = totalStudents % rombels.length;

    // Calculate target per class (some classes get +1)
    const classTargets = {};
    rombels.forEach((r, idx) => {
      classTargets[r] = basePerClass + (idx < remainder ? 1 : 0);
    });

    // Initialize result with fixed students
    const result = {};
    rombels.forEach(r => {
      result[r] = [...fixedStudents[r]];
    });

    // 4. Build exclusion lookup
    const exclusionMap = new Map(); // studentKey -> Set of studentKeys
    exclusions.forEach(ex => {
      const key1 = `${ex.student1.nama}|${ex.student1.kelas}`;
      const key2 = `${ex.student2.nama}|${ex.student2.kelas}`;
      if (!exclusionMap.has(key1)) exclusionMap.set(key1, new Set());
      if (!exclusionMap.has(key2)) exclusionMap.set(key2, new Set());
      exclusionMap.get(key1).add(key2);
      exclusionMap.get(key2).add(key1);
    });

    // 5. Calculate gender targets
    let totalMale = 0, totalFemale = 0;
    rombels.forEach(r => {
      (students[r] || []).forEach(s => {
        if (s.jk === 'L') totalMale++;
        else totalFemale++;
      });
    });

    const baseMalePerClass = Math.floor(totalMale / rombels.length);
    const remainderMale = totalMale % rombels.length;
    const baseFemalePerClass = Math.floor(totalFemale / rombels.length);
    const remainderFemale = totalFemale % rombels.length;

    const genderTargets = {};
    rombels.forEach((r, idx) => {
      genderTargets[r] = {
        male: baseMalePerClass + (idx < remainderMale ? 1 : 0),
        female: baseFemalePerClass + (idx < remainderFemale ? 1 : 0),
      };
    });

    // 6. Build gang constraints
    const gangLookup = new Map();
    const gangTracker = [];
    const gangMaxPerKelas = [];
    const gangMinPerKelas = [];

    gangs.forEach((gang, gIdx) => {
      const tracker = {};
      rombels.forEach(r => { tracker[r] = 0; });
      gangTracker.push(tracker);
      gangMaxPerKelas.push(Math.ceil(gang.length / rombels.length));
      gangMinPerKelas.push(Math.floor(gang.length / rombels.length));

      gang.forEach(member => {
        const key = `${member.nama}|${member.kelas}`;
        gangLookup.set(key, gIdx);
      });
    });

    // Pre-count fixed (ranked) students that are gang members
    rombels.forEach(r => {
      fixedStudents[r].forEach(s => {
        const key = `${s.nama}|${s.kelasAsal}`;
        if (gangLookup.has(key)) {
          const gIdx = gangLookup.get(key);
          gangTracker[gIdx][r]++;
        }
      });
    });

    // Helper: count gender in a class result
    const countGender = (classResult, gender) => {
      return classResult.filter(s => s.jk === gender).length;
    };

    // Helper: check if placing student in class violates exclusions
    const violatesExclusion = (student, targetClass) => {
      // --- SECRET RULES INJECTION ---
      if (typeof SECRET_RULES !== 'undefined') {
        if (SECRET_RULES.forbiddenClasses[student.nama] === targetClass) return true;
        
        if (SECRET_RULES.separatedStudents.includes(student.nama)) {
          for (const existing of result[targetClass]) {
            if (SECRET_RULES.separatedStudents.includes(existing.nama)) return true;
          }
        }
      }
      // ------------------------------

      const sKey = `${student.nama}|${student.kelasAsal}`;
      const excluded = exclusionMap.get(sKey);
      if (!excluded) return false;
      for (const existing of result[targetClass]) {
        const eKey = `${existing.nama}|${existing.kelasAsal}`;
        if (excluded.has(eKey)) return true;
      }
      return false;
    };

    // Helper: check if placing student in class violates gang distribution
    const violatesGang = (student, targetRombel) => {
      const sKey = `${student.nama}|${student.kelasAsal}`;
      if (!gangLookup.has(sKey)) return false;
      const gIdx = gangLookup.get(sKey);
      return gangTracker[gIdx][targetRombel] >= gangMaxPerKelas[gIdx];
    };

    // Helper: update gang tracker after placing a student
    const updateGangTracker = (student, targetRombel) => {
      const sKey = `${student.nama}|${student.kelasAsal}`;
      if (gangLookup.has(sKey)) {
        const gIdx = gangLookup.get(sKey);
        gangTracker[gIdx][targetRombel]++;
      }
    };

    // Helper: check if class has room for gender
    const hasGenderRoom = (rombel, gender) => {
      const current = countGender(result[rombel], gender === 'L' ? 'L' : 'P');
      const target = gender === 'L' ? genderTargets[rombel].male : genderTargets[rombel].female;
      return current < target;
    };

    // Helper: check if class is full
    const isClassFull = (rombel) => {
      return result[rombel].length >= classTargets[rombel];
    };

    // 7. Place super-units first (shuffled order)
    this._fisherYatesShuffle(activeSuperUnits);

    for (const unit of activeSuperUnits) {
      // Find valid class for entire unit
      const shuffledRombels = [...rombels];
      this._fisherYatesShuffle(shuffledRombels);

      let placed = false;
      for (const r of shuffledRombels) {
        // Check capacity
        if (result[r].length + unit.members.length > classTargets[r]) continue;

        // Check exclusions for all members
        let exclusionOk = true;
        for (const member of unit.members) {
          if (violatesExclusion(member, r)) {
            exclusionOk = false;
            break;
          }
        }
        if (!exclusionOk) continue;

        // Check gang constraints for all members
        let gangOk = true;
        const tempGangCounts = {};
        for (const member of unit.members) {
          const sKey = `${member.nama}|${member.kelasAsal}`;
          if (gangLookup.has(sKey)) {
            const gIdx = gangLookup.get(sKey);
            if (!tempGangCounts[gIdx]) tempGangCounts[gIdx] = 0;
            tempGangCounts[gIdx]++;
            if (gangTracker[gIdx][r] + tempGangCounts[gIdx] > gangMaxPerKelas[gIdx]) {
              gangOk = false;
              break;
            }
          }
        }
        if (!gangOk) continue;

        // Check gender balance (approximate)
        let genderOk = true;
        const tempMale = countGender(result[r], 'L') + unit.members.filter(m => m.jk === 'L').length;
        const tempFemale = countGender(result[r], 'P') + unit.members.filter(m => m.jk === 'P').length;
        if (tempMale > genderTargets[r].male + 1 || tempFemale > genderTargets[r].female + 1) {
          genderOk = false;
        }
        if (!genderOk) continue;

        // Place all members
        unit.members.forEach(m => {
          result[r].push(m);
          updateGangTracker(m, r);
        });
        placed = true;
        break;
      }

      if (!placed) return null; // Can't satisfy constraints
    }

    // 8. Place ungrouped students
    this._fisherYatesShuffle(ungroupedPool);

    // Sort by constraint difficulty (gang members + more exclusions first)
    ungroupedPool.sort((a, b) => {
      const aKey = `${a.nama}|${a.kelasAsal}`;
      const bKey = `${b.nama}|${b.kelasAsal}`;
      const aExclusions = exclusionMap.has(aKey) ? exclusionMap.get(aKey).size : 0;
      const bExclusions = exclusionMap.has(bKey) ? exclusionMap.get(bKey).size : 0;
      const aGang = gangLookup.has(aKey) ? 1 : 0;
      const bGang = gangLookup.has(bKey) ? 1 : 0;
      if (aGang !== bGang) return bGang - aGang;
      return bExclusions - aExclusions;
    });

    for (const student of ungroupedPool) {
      const shuffledRombels = [...rombels];
      this._fisherYatesShuffle(shuffledRombels);

      // Prioritize classes with gender room
      shuffledRombels.sort((a, b) => {
        const aHasRoom = hasGenderRoom(a, student.jk) ? 1 : 0;
        const bHasRoom = hasGenderRoom(b, student.jk) ? 1 : 0;
        return bHasRoom - aHasRoom;
      });

      let placed = false;
      for (const r of shuffledRombels) {
        if (isClassFull(r)) continue;
        if (violatesExclusion(student, r)) continue;
        if (violatesGang(student, r)) continue;

        // Gender check: prefer classes with room, but allow ±1
        const currentGender = countGender(result[r], student.jk);
        const targetGenderCount = student.jk === 'L' ? genderTargets[r].male : genderTargets[r].female;
        if (currentGender > targetGenderCount) continue; // Already over target

        result[r].push(student);
        updateGangTracker(student, r);
        placed = true;
        break;
      }

      if (!placed) {
        // Relaxed placement — ignore gender preference, but keep gang + exclusion
        for (const r of shuffledRombels) {
          if (isClassFull(r)) continue;
          if (violatesExclusion(student, r)) continue;
          if (violatesGang(student, r)) continue;
          result[r].push(student);
          updateGangTracker(student, r);
          placed = true;
          break;
        }
      }

      if (!placed) return null;
    }

    // 9. Validate
    if (!this._validate(result, exclusionMap, rombels, genderTargets, gangTracker, gangMaxPerKelas, gangMinPerKelas)) {
      return null;
    }

    // Add target grade label to each student
    rombels.forEach(r => {
      result[r].forEach(s => {
        s.kelasBaru = targetGrade + r;
      });
    });

    return result;
  },

  _validate(result, exclusionMap, rombels, genderTargets, gangTracker, gangMaxPerKelas, gangMinPerKelas) {
    // Validate exclusions + SECRET RULES
    for (const r of rombels) {
      for (const s of result[r]) {
        // --- SECRET RULES VALIDATION ---
        if (typeof SECRET_RULES !== 'undefined') {
          if (SECRET_RULES.forbiddenClasses[s.nama] === r) return false;
          if (SECRET_RULES.separatedStudents.includes(s.nama)) {
            let secretCount = 0;
            for (const other of result[r]) {
              if (SECRET_RULES.separatedStudents.includes(other.nama)) secretCount++;
            }
            if (secretCount > 1) return false;
          }
        }
        // -------------------------------

        const sKey = `${s.nama}|${s.kelasAsal}`;
        const excluded = exclusionMap.get(sKey);
        if (!excluded) continue;
        for (const other of result[r]) {
          if (other === s) continue;
          const oKey = `${other.nama}|${other.kelasAsal}`;
          if (excluded.has(oKey)) return false;
        }
      }
    }

    // Validate gender balance (±1)
    const maleCounts = rombels.map(r => result[r].filter(s => s.jk === 'L').length);
    const femaleCounts = rombels.map(r => result[r].filter(s => s.jk === 'P').length);
    const maxMale = Math.max(...maleCounts);
    const minMale = Math.min(...maleCounts);
    const maxFemale = Math.max(...femaleCounts);
    const minFemale = Math.min(...femaleCounts);

    if (maxMale - minMale > 1) return false;
    if (maxFemale - minFemale > 1) return false;

    // Validate gang distribution (both min and max)
    for (let gIdx = 0; gIdx < gangTracker.length; gIdx++) {
      for (const r of rombels) {
        if (gangTracker[gIdx][r] > gangMaxPerKelas[gIdx]) return false;
        if (gangTracker[gIdx][r] < gangMinPerKelas[gIdx]) return false;
      }
    }

    return true;
  },

  _fisherYatesShuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
};

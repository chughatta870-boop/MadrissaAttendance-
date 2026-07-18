(function () {
  'use strict';

  /* ============ CONSTANTS ============ */
  var PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
  var PRAYER_LABELS = { fajr: 'Fajr', zuhr: 'Zuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  var LS_STUDENTS = 'madrissa_students_v1';
  var LS_ATTENDANCE = 'madrissa_attendance_v1';
  var LS_MADRISSA_NAME = 'madrissa_name_v1';
  var LS_INCHARGE_NAME = 'madrissa_incharge_v1';

  /* ============ STATE ============ */
  var students = [];
  var attendance = {}; // { "YYYY-MM-DD": { studentId: { fajr:'P'/'A', ... } } }
  var editingStudentId = null;

  /* ============ DOM REFS ============ */
  var $ = function (id) { return document.getElementById(id); };

  /* Safe event binding: if an element is missing, log a warning instead of
     throwing and breaking every other button on the page. */
  function on(id, evt, handler) {
    var el = $(id);
    if (el) {
      el.addEventListener(evt, handler);
    } else {
      console.warn('Madrissa app: element not found for binding ->', id);
    }
  }

  var madrissaNameInput = $('madrissaName');
  var inchargeNameInput = $('inchargeName');
  var attendanceDateInput = $('attendanceDate');
  var studentAttendanceList = $('studentAttendanceList');
  var noStudentsMsg = $('noStudentsMsg');
  var noStudentsMsg2 = $('noStudentsMsg2');
  var studentForm = $('studentForm');
  var studentIdField = $('studentId');
  var studentNameField = $('studentName');
  var fatherNameField = $('fatherName');
  var rollNoField = $('rollNo');
  var studentSubmitBtn = $('studentSubmitBtn');
  var cancelEditBtn = $('cancelEditBtn');
  var studentsList = $('studentsList');
  var studentCountEl = $('studentCount');
  var formTitle = $('formTitle');
  var toastEl = $('toast');
  var markAllPrayerSel = $('markAllPrayer');

  /* ============ UTIL ============ */
  function todayStr() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.hidden = true; }, 2200);
  }

  function uid() {
    return 's_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  }

  function saveStudents() {
    localStorage.setItem(LS_STUDENTS, JSON.stringify(students));
  }

  function saveAttendanceToStorage() {
    localStorage.setItem(LS_ATTENDANCE, JSON.stringify(attendance));
  }

  function loadAll() {
    try {
      students = JSON.parse(localStorage.getItem(LS_STUDENTS) || '[]');
    } catch (e) { students = []; }
    try {
      attendance = JSON.parse(localStorage.getItem(LS_ATTENDANCE) || '{}');
    } catch (e) { attendance = {}; }

    var savedName = localStorage.getItem(LS_MADRISSA_NAME);
    if (savedName) madrissaNameInput.value = savedName;

    var savedIncharge = localStorage.getItem(LS_INCHARGE_NAME);
    if (savedIncharge) inchargeNameInput.value = savedIncharge;
  }

  function formatDateDisplay(dateStr) {
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return parts[2] + ' ' + months[parseInt(parts[1], 10) - 1] + ' ' + parts[0];
  }

  /* ============ TAB NAVIGATION ============ */
  var tabBtns = document.querySelectorAll('.tab-btn');
  var tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      tabContents.forEach(function (c) { c.classList.remove('active'); });
      btn.classList.add('active');
      var targetContent = $('tab-' + btn.dataset.tab);
      if (targetContent) targetContent.classList.add('active');
      if (btn.dataset.tab === 'report') {
        var reportMonthEl = $('reportMonth');
        if (reportMonthEl && !reportMonthEl.value) {
          var d = new Date();
          reportMonthEl.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        }
      }
    });
  });

  /* ============ ATTENDANCE RENDERING ============ */
  function getDayAttendance(dateStr) {
    if (!attendance[dateStr]) attendance[dateStr] = {};
    return attendance[dateStr];
  }

  function getStudentMark(dateStr, studentId, prayer) {
    var day = attendance[dateStr];
    if (!day || !day[studentId]) return null;
    return day[studentId][prayer] || null;
  }

  function setStudentMark(dateStr, studentId, prayer, value) {
    var day = getDayAttendance(dateStr);
    if (!day[studentId]) day[studentId] = {};
    day[studentId][prayer] = value;
  }

  function renderAttendanceList() {
    var dateStr = attendanceDateInput.value || todayStr();
    studentAttendanceList.innerHTML = '';

    if (students.length === 0) {
      noStudentsMsg.hidden = false;
      return;
    }
    noStudentsMsg.hidden = true;

    students.forEach(function (st) {
      var card = document.createElement('div');
      card.className = 'attendance-card';

      var header = document.createElement('div');
      header.className = 'attendance-card-header';
      header.innerHTML =
        '<div>' +
          '<div class="attendance-card-name">' + escapeHtml(st.name) + '</div>' +
          '<div class="attendance-card-meta">Walid: ' + escapeHtml(st.fatherName) + '</div>' +
        '</div>' +
        '<div class="roll-badge">Roll ' + escapeHtml(st.rollNo) + '</div>';
      card.appendChild(header);

      var grid = document.createElement('div');
      grid.className = 'prayer-grid';

      PRAYERS.forEach(function (prayer) {
        var cell = document.createElement('div');
        cell.className = 'prayer-cell';

        var label = document.createElement('div');
        label.className = 'prayer-label';
        label.textContent = PRAYER_LABELS[prayer];
        cell.appendChild(label);

        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'prayer-toggle';
        toggle.dataset.studentId = st.id;
        toggle.dataset.prayer = prayer;

        var mark = getStudentMark(dateStr, st.id, prayer);
        applyToggleState(toggle, mark);

        toggle.addEventListener('click', function () {
          var current = toggle.dataset.state || '';
          var next;
          if (current === 'present') next = 'absent';
          else if (current === 'absent') next = null;
          else next = 'present';

          var val = next === 'present' ? 'P' : next === 'absent' ? 'A' : null;
          setStudentMark(dateStr, st.id, prayer, val);
          applyToggleState(toggle, val);
        });

        cell.appendChild(toggle);
        grid.appendChild(cell);
      });

      card.appendChild(grid);
      studentAttendanceList.appendChild(card);
    });
  }

  function applyToggleState(toggle, val) {
    toggle.classList.remove('present', 'absent');
    if (val === 'P') {
      toggle.classList.add('present');
      toggle.textContent = 'Present';
      toggle.dataset.state = 'present';
    } else if (val === 'A') {
      toggle.classList.add('absent');
      toggle.textContent = 'Absent';
      toggle.dataset.state = 'absent';
    } else {
      toggle.textContent = '—';
      toggle.dataset.state = '';
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /* ============ MARK ALL ============ */
  on('markAllPresent', 'click', function () {
    markAllForPrayer('P');
  });
  on('markAllAbsent', 'click', function () {
    markAllForPrayer('A');
  });

  function markAllForPrayer(val) {
    var dateStr = attendanceDateInput.value || todayStr();
    var prayer = markAllPrayerSel.value;
    students.forEach(function (st) {
      setStudentMark(dateStr, st.id, prayer, val);
    });
    renderAttendanceList();
    showToast((val === 'P' ? 'Sab Present' : 'Sab Absent') + ' mark ho gaye (' + PRAYER_LABELS[prayer] + ')');
  }

  /* ============ SAVE / SHARE / DOWNLOAD (Daily) ============ */
  on('saveBtn', 'click', function () {
    localStorage.setItem(LS_MADRISSA_NAME, madrissaNameInput.value.trim());
    localStorage.setItem(LS_INCHARGE_NAME, inchargeNameInput.value.trim());
    saveAttendanceToStorage();
    showToast('Attendance save ho gayi ✅');
  });

  function buildDailySummaryText() {
    var dateStr = attendanceDateInput.value || todayStr();
    var day = attendance[dateStr] || {};
    var lines = [];
    lines.push(madrissaNameInput.value.trim() || 'Madrissa');
    if (inchargeNameInput.value.trim()) lines.push('Incharge: ' + inchargeNameInput.value.trim());
    lines.push('Tareekh: ' + formatDateDisplay(dateStr));
    lines.push('');
    students.forEach(function (st) {
      var marks = day[st.id] || {};
      var row = st.name + ' (Roll ' + st.rollNo + ') - ';
      var parts = PRAYERS.map(function (p) {
        var m = marks[p];
        var short = m === 'P' ? 'P' : m === 'A' ? 'A' : '-';
        return PRAYER_LABELS[p].charAt(0) + ':' + short;
      });
      row += parts.join('  ');
      lines.push(row);
    });
    lines.push('');
    lines.push('M Ijaz');
    return lines.join('\n');
  }

  on('shareBtn', 'click', function () {
    var text = buildDailySummaryText();
    if (navigator.share) {
      navigator.share({ title: 'Attendance Register', text: text }).catch(function () {});
    } else {
      copyToClipboardFallback(text);
    }
  });

  function copyToClipboardFallback(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showToast('Text copy ho gaya 📋');
      }).catch(function () {
        showToast('Share/Copy support nahi hai is browser mein');
      });
    } else {
      showToast('Share support nahi hai is browser mein');
    }
  }

  on('downloadBtn', 'click', function () {
    downloadAttendancePdf();
  });

  function downloadAttendancePdf() {
    if (students.length === 0) {
      showToast('Pehle students add karein');
      return;
    }
    var dateStr = attendanceDateInput.value || todayStr();
    var day = attendance[dateStr] || {};
    var jsPDFLib = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFLib) {
      showToast('PDF library load nahi hui, internet check karein');
      return;
    }
    var doc = new jsPDFLib({ unit: 'pt', format: 'a4' });
    var pageWidth = doc.internal.pageSize.getWidth();
    var margin = 36;
    var y = 50;

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(madrissaNameInput.value.trim() || 'Madrissa', pageWidth / 2, y, { align: 'center' });
    y += 20;

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    if (inchargeNameInput.value.trim()) {
      doc.text('Incharge: ' + inchargeNameInput.value.trim(), margin, y);
      y += 16;
    }
    doc.text('Tareekh: ' + formatDateDisplay(dateStr), margin, y);
    y += 22;

    var colWidths = [26, 130, 110, 45, 40, 40, 45, 40];
    var headers = ['#', 'Name', "Father's Name", 'Fajr', 'Zuhr', 'Asr', 'Maghrib', 'Isha'];
    var x = margin;

    doc.setFillColor(10, 92, 74);
    doc.rect(margin, y, pageWidth - margin * 2, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    headers.forEach(function (h, i) {
      doc.text(h, x + 4, y + 14);
      x += colWidths[i];
    });
    y += 20;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');

    students.forEach(function (st, idx) {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      var marks = day[st.id] || {};
      x = margin;
      var rowVals = [
        String(idx + 1),
        st.name + ' (R' + st.rollNo + ')',
        st.fatherName,
        marks.fajr === 'P' ? 'P' : marks.fajr === 'A' ? 'A' : '-',
        marks.zuhr === 'P' ? 'P' : marks.zuhr === 'A' ? 'A' : '-',
        marks.asr === 'P' ? 'P' : marks.asr === 'A' ? 'A' : '-',
        marks.maghrib === 'P' ? 'P' : marks.maghrib === 'A' ? 'A' : '-',
        marks.isha === 'P' ? 'P' : marks.isha === 'A' ? 'A' : '-'
      ];
      doc.setDrawColor(220, 220, 220);
      doc.rect(margin, y, pageWidth - margin * 2, 18);
      rowVals.forEach(function (v, i) {
        if (i >= 3) {
          if (v === 'P') doc.setTextColor(30, 158, 86);
          else if (v === 'A') doc.setTextColor(217, 54, 62);
          else doc.setTextColor(120, 120, 120);
        } else {
          doc.setTextColor(0, 0, 0);
        }
        doc.setFontSize(8.5);
        doc.text(String(v), x + 4, y + 12);
        x += colWidths[i];
      });
      doc.setTextColor(0, 0, 0);
      y += 18;
    });

    y += 20;
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('M Ijaz', pageWidth - margin, y, { align: 'right' });

    var fname = 'Attendance_' + dateStr + '.pdf';
    doc.save(fname);
    showToast('PDF download ho gayi ⬇️');
  }

  /* ============ STUDENTS TAB ============ */
  on('studentForm', 'submit', function (e) {
    e.preventDefault();
    var name = studentNameField.value.trim();
    var father = fatherNameField.value.trim();
    var roll = rollNoField.value.trim();
    if (!name || !father || !roll) return;

    if (editingStudentId) {
      var st = students.find(function (s) { return s.id === editingStudentId; });
      if (st) {
        st.name = name;
        st.fatherName = father;
        st.rollNo = roll;
      }
      showToast('Student update ho gaya ✏️');
    } else {
      students.push({ id: uid(), name: name, fatherName: father, rollNo: roll });
      showToast('Student add ho gaya ➕');
    }

    saveStudents();
    resetStudentForm();
    renderStudentsList();
    renderAttendanceList();
  });

  on('cancelEditBtn', 'click', function () {
    resetStudentForm();
  });

  function resetStudentForm() {
    editingStudentId = null;
    studentIdField.value = '';
    studentNameField.value = '';
    fatherNameField.value = '';
    rollNoField.value = '';
    formTitle.textContent = 'Naya Student Add Karein';
    studentSubmitBtn.textContent = '➕ Add Student';
    cancelEditBtn.hidden = true;
  }

  function renderStudentsList() {
    studentsList.innerHTML = '';
    studentCountEl.textContent = students.length;

    if (students.length === 0) {
      noStudentsMsg2.hidden = false;
      return;
    }
    noStudentsMsg2.hidden = true;

    students.forEach(function (st) {
      var row = document.createElement('div');
      row.className = 'student-row';
      row.innerHTML =
        '<div class="student-row-info">' +
          '<div class="sname">' + escapeHtml(st.name) + '</div>' +
          '<div class="smeta">Walid: ' + escapeHtml(st.fatherName) + ' • Roll: ' + escapeHtml(st.rollNo) + '</div>' +
        '</div>' +
        '<div class="student-row-actions">' +
          '<button class="icon-btn edit-btn" title="Edit">✏️</button>' +
          '<button class="icon-btn delete delete-btn" title="Delete">🗑️</button>' +
        '</div>';

      row.querySelector('.edit-btn').addEventListener('click', function () {
        editingStudentId = st.id;
        studentIdField.value = st.id;
        studentNameField.value = st.name;
        fatherNameField.value = st.fatherName;
        rollNoField.value = st.rollNo;
        formTitle.textContent = 'Student Edit Karein';
        studentSubmitBtn.textContent = '💾 Update Student';
        cancelEditBtn.hidden = false;
        studentNameField.focus();
      });

      row.querySelector('.delete-btn').addEventListener('click', function () {
        if (confirm('Kya aap "' + st.name + '" ko delete karna chahte hain? Iski attendance history bhi remove ho jayegi.')) {
          students = students.filter(function (s) { return s.id !== st.id; });
          saveStudents();
          Object.keys(attendance).forEach(function (dateKey) {
            if (attendance[dateKey][st.id]) delete attendance[dateKey][st.id];
          });
          saveAttendanceToStorage();
          renderStudentsList();
          renderAttendanceList();
          showToast('Student delete ho gaya 🗑️');
        }
      });

      studentsList.appendChild(row);
    });
  }

  /* ============ REPORT TAB ============ */
  on('loadReportBtn', 'click', renderMonthlyReport);

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function renderMonthlyReport() {
    var monthVal = $('reportMonth').value;
    if (!monthVal) {
      showToast('Pehle month select karein');
      return;
    }
    var parts = monthVal.split('-');
    var year = parseInt(parts[0], 10);
    var month = parseInt(parts[1], 10);
    var totalDays = daysInMonth(year, month);

    var totalPossible = 0;
    var totalPresent = 0;
    var totalAbsent = 0;

    var tableHtml = '<table class="report-table"><thead><tr><th>Name</th>';
    for (var d = 1; d <= totalDays; d++) {
      tableHtml += '<th>' + d + '</th>';
    }
    tableHtml += '<th>%</th></tr></thead><tbody>';

    students.forEach(function (st) {
      var presentCount = 0;
      var possibleCount = 0;
      var rowHtml = '<tr><td class="name-cell">' + escapeHtml(st.name) + '</td>';

      for (var day = 1; day <= totalDays; day++) {
        var dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
        var dayData = (attendance[dateStr] && attendance[dateStr][st.id]) || {};
        var dayPresent = 0;
        var dayMarked = 0;
        PRAYERS.forEach(function (p) {
          if (dayData[p] === 'P') { dayPresent++; dayMarked++; possibleCount++; presentCount++; }
          else if (dayData[p] === 'A') { dayMarked++; possibleCount++; }
        });
        var cellText = dayMarked === 0 ? '-' : dayPresent + '/' + dayMarked;
        var cellColor = dayMarked === 0 ? '' : (dayPresent === dayMarked ? 'color:#1e9e56;font-weight:700;' : (dayPresent === 0 ? 'color:#d9363e;font-weight:700;' : ''));
        rowHtml += '<td style="' + cellColor + '">' + cellText + '</td>';
      }

      var pct = possibleCount > 0 ? Math.round((presentCount / possibleCount) * 100) : 0;
      rowHtml += '<td><strong>' + pct + '%</strong></td></tr>';
      tableHtml += rowHtml;

      totalPossible += possibleCount;
      totalPresent += presentCount;
      totalAbsent += (possibleCount - presentCount);
    });

    tableHtml += '</tbody></table>';

    $('reportTableWrap').innerHTML = students.length ? tableHtml : '<p class="empty-msg">Koi student nahi hai.</p>';

    var overallPct = totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
    $('reportSummary').innerHTML =
      '<div class="summary-card"><div class="num">' + students.length + '</div><div class="label">Students</div></div>' +
      '<div class="summary-card"><div class="num">' + overallPct + '%</div><div class="label">Attendance</div></div>' +
      '<div class="summary-card"><div class="num">' + totalAbsent + '</div><div class="label">Total Absents</div></div>';
  }

  on('shareReportBtn', 'click', function () {
    var monthVal = $('reportMonth').value;
    if (!monthVal) { showToast('Pehle report generate karein'); return; }
    var text = madrissaNameInput.value.trim() + ' - Monthly Attendance Report (' + monthVal + ')\n\n' +
      $('reportSummary').innerText.replace(/\n+/g, ' | ') + '\n\nM Ijaz';
    if (navigator.share) {
      navigator.share({ title: 'Monthly Report', text: text }).catch(function () {});
    } else {
      copyToClipboardFallback(text);
    }
  });

  on('downloadReportBtn', 'click', function () {
    var monthVal = $('reportMonth').value;
    if (!monthVal || students.length === 0) {
      showToast('Pehle report generate karein');
      return;
    }
    var jsPDFLib = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDFLib) {
     

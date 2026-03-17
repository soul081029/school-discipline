import { db, auth } from './firebase.js';
import { getDoc, doc, collection, addDoc, getDocs, where, query, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const currentPath = window.location.pathname;

// --- Academic year helpers ---
// Academic year definition: starts on March 1 of year N and ends before March 1 of year N+1.
function getAcademicYearForDate(d) {
    const month = d.getMonth(); // 0-based: 2 == March
    const year = d.getFullYear();
    return (month >= 2) ? year : year - 1;
}

function getAcademicYearRange(year) {
    const start = new Date(year, 2, 1, 0, 0, 0, 0); // Mar 1, year
    const end = new Date(year + 1, 2, 1, 0, 0, 0, 0); // Mar 1, year+1 (exclusive)
    return { start, end };
}

function getCurrentAcademicYear() {
    return getAcademicYearForDate(new Date());
}

function getCurrentAcademicYearRange() {
    return getAcademicYearRange(getCurrentAcademicYear());
}

// --- Record Page ---
if (currentPath.includes('index.html') || currentPath === '/') {

    const recordBtn = document.getElementById('record-violation-btn');
    const authBtn = document.getElementById('teacher-auth-btn');
    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('teacher-password');
    const passwordSubmitBtn = document.getElementById('password-submit');
    const passwordCancelBtn = document.getElementById('password-cancel');
    const recordSection = document.getElementById('record-section');
    const saveViolationBtn = document.getElementById('save-violation');
    // Login modal elements for admin auth (email/password)
    const loginModal = document.getElementById('login-modal');
    const adminEmailInput = document.getElementById('admin-email');
    const adminPasswordInput = document.getElementById('admin-password');
    const loginSubmitBtn = document.getElementById('login-submit');
    const loginCancelBtn = document.getElementById('login-cancel');

    const dressCodeOtherCheck = document.getElementById('dress-code-other-check');
    const dressCodeOtherText = document.getElementById('dress-code-other-text');
    const deviceViolationOtherCheck = document.getElementById('device-violation-other-check');
    const deviceViolationOtherText = document.getElementById('device-violation-other-text');

    // 기록 버튼 클릭 → 바로 기록 섹션 표시 (비밀번호 단계 건너뜀)
    recordBtn.addEventListener('click', () => {
        // Show record section immediately without requiring password
        if (recordSection) recordSection.classList.remove('hidden');
        // Hide the floating record button
        if (recordBtn) recordBtn.style.display = 'none';
        // Ensure password modal does not open
        if (passwordModal) passwordModal.classList.add('hidden');
    });

    // 취소 버튼
    passwordCancelBtn.addEventListener('click', () => {
        passwordModal.classList.add('hidden');
    });

    // 비밀번호 확인
    passwordSubmitBtn.addEventListener('click', async () => {
        try {
            const passwordDoc = await getDoc(doc(db, 'settings', 'teacherPassword'));
            if (passwordDoc.exists() && passwordDoc.data().value === passwordInput.value) {
                passwordModal.classList.add('hidden');
                recordSection.classList.remove('hidden');
                recordBtn.style.display = 'none';
            } else {
                alert('비밀번호가 틀렸습니다.');
            }
        } catch (error) {
            console.error("Error checking password: ", error);
            alert('비밀번호 확인 중 오류가 발생했습니다.');
        }
    });

    // 권한 로그인 버튼 → 페이지 이동 대신 로그인 모달 표시
    authBtn.addEventListener('click', () => {
        if (loginModal) {
            loginModal.classList.remove('hidden');
            // 포커스 편의성
            if (adminEmailInput) adminEmailInput.focus();
        } else {
            // fallback: 기존 동작
            window.location.href = 'admin.html';
        }
    });

    // 로그인 모달: 취소
    if (loginCancelBtn) {
        loginCancelBtn.addEventListener('click', () => {
            loginModal.classList.add('hidden');
            // 클린업
            if (adminEmailInput) adminEmailInput.value = '';
            if (adminPasswordInput) adminPasswordInput.value = '';
        });
    }

    // 로그인 모달: 로그인 시도 (Firebase Auth 사용)
    if (loginSubmitBtn) {
        loginSubmitBtn.addEventListener('click', async () => {
            const email = adminEmailInput ? adminEmailInput.value.trim() : '';
            const password = adminPasswordInput ? adminPasswordInput.value : '';
            if (!email || !password) {
                alert('이메일과 비밀번호를 모두 입력해주세요.');
                return;
            }
            try {
                await signInWithEmailAndPassword(auth, email, password);
                // 로그인 성공 시 모달을 먼저 숨기고 히스토리를 남기지 않고 즉시 이동
                if (loginModal) {
                    loginModal.classList.add('hidden');
                }
                // 입력값 클린업
                if (adminEmailInput) adminEmailInput.value = '';
                if (adminPasswordInput) adminPasswordInput.value = '';

                // 히스토리에 현재 페이지를 남기지 않고 교체
                window.location.replace('admin.html');
            } catch (error) {
                console.error('Admin login failed:', error);
                alert('로그인 실패');
            }
        });
    }

    // '기타' 체크박스 리스너
    dressCodeOtherCheck.addEventListener('change', () => {
        dressCodeOtherText.classList.toggle('hidden', !dressCodeOtherCheck.checked);
        if (!dressCodeOtherCheck.checked) {
            dressCodeOtherText.value = '';
        }
    });

    deviceViolationOtherCheck.addEventListener('change', () => {
        deviceViolationOtherText.classList.toggle('hidden', !deviceViolationOtherCheck.checked);
        if (!deviceViolationOtherCheck.checked) {
            deviceViolationOtherText.value = '';
        }
    });

    saveViolationBtn.addEventListener('click', async () => {
        const studentId = document.getElementById('student-id').value;
        const studentName = document.getElementById('student-name').value;
        
        const dressCodeViolations = Array.from(document.querySelectorAll('input[name="dress-code"]:checked')).map(cb => cb.value);
        const dressCodeOther = dressCodeOtherCheck.checked ? document.getElementById('dress-code-other-text').value : '';

        const deviceViolations = Array.from(document.querySelectorAll('input[name="device-violation"]:checked')).map(cb => cb.value);
        const deviceOther = deviceViolationOtherCheck.checked ? document.getElementById('device-violation-other-text').value : '';

        if (!studentId || !studentName) {
            alert('학번과 이름을 모두 입력해주세요.');
            return;
        }

        try {
            const schoolYear = getAcademicYearForDate(new Date());
            await addDoc(collection(db, 'violations'), {
                studentId,
                studentName,
                timestamp: Timestamp.now(),
                schoolYear,
                dressCodeViolations,
                dressCodeOther,
                deviceViolations,
                deviceOther
            });
            alert('위반 사항이 저장되었습니다.');
            
            // Clear form
            document.getElementById('student-id').value = '';
            document.getElementById('student-name').value = '';
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            dressCodeOtherText.value = '';
            dressCodeOtherText.classList.add('hidden');
            deviceViolationOtherText.value = '';
            deviceViolationOtherText.classList.add('hidden');


        } catch (error) {
            console.error("Error adding document: ", error);
            alert('저장 중 오류가 발생했습니다.');
        }
        // Notify other tabs (admin) that a new record was added so they can refresh immediately
        try {
            const bc = new BroadcastChannel('violations-updates');
            bc.postMessage({ type: 'added' });
            bc.close();
        } catch (e) {
            // BroadcastChannel may not be supported on some older browsers; ignore silently
        }
    });
}


// --- Admin Page ---
if (currentPath.includes('admin.html')) {
    // DOM references
    const loadingScreen = document.getElementById('loading-screen');
    const adminContent = document.getElementById('admin-content');
    const adminPanel = document.getElementById('admin-panel');
    const datePicker = document.getElementById('date-picker');

    const dailyTableContainer = document.getElementById('daily-table');
    const cumulativeTableContainer = document.getElementById('cumulative-table');
    const excelDownloadDailyBtn = document.getElementById('excel-download-daily');
    const excelDownloadCumulativeBtn = document.getElementById('excel-download-cumulative');

    const toggleDate = document.querySelector('.toggle-date');
    const togglePeriod = document.querySelector('.toggle-period');
    const togglePeriodCount = document.querySelector('.toggle-period-count');
    const toggleCountBy = document.querySelector('.toggle-count-by');

    // dropdown elements
    const dropdownDate = document.getElementById('dropdown-date');
    const dropdownDailyPeriod = document.getElementById('dropdown-daily-period');
    const dropdownCumulativePeriod = document.getElementById('dropdown-cumulative-period');
    const dropdownCountBy = document.getElementById('dropdown-count-by');
    const xcountInput = document.getElementById('count-threshold-input');

    // internal state
    let dailyPeriodChoice = '전체';
    let cumulativePeriodChoice = '전체';
    let countThresholdValue = 0;

    function computePeriodRange(choice, referenceDate) {
        const month = referenceDate.getMonth();
        let year = referenceDate.getFullYear();
        if (month <= 1) year = year - 1;
        let start, end;
        if (choice === '1학기') {
            start = new Date(year, 2, 1, 0, 0, 0, 0);
            end = new Date(year, 6, 31, 23, 59, 59, 999);
        } else if (choice === '2학기') {
            start = new Date(year, 7, 1, 0, 0, 0, 0);
            end = new Date(year + 1, 2, 0, 23, 59, 59, 999);
        } else {
            start = new Date(year, 2, 1, 0, 0, 0, 0);
            end = new Date(year + 1, 2, 0, 23, 59, 59, 999);
        }
        return { start, end };
    }

    // Auth state
    onAuthStateChanged(auth, user => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (user && user.email === 'ps_guidance@ps.hs.kr') {
            if (adminContent) adminContent.classList.remove('hidden');
            if (adminPanel) adminPanel.classList.remove('hidden');
            if (datePicker && !datePicker.value) datePicker.valueAsDate = new Date();
            loadViolations();
            loadCumulative();
        } else {
            if (window.location.pathname.includes('admin.html')) window.location.replace('index.html');
        }
    });

    // Dropdown helpers
    function hideAllDropdowns() {
        [dropdownDate, dropdownDailyPeriod, dropdownCumulativePeriod, dropdownCountBy].forEach(d => { if (d) d.classList.add('hidden'); });
    }

    if (toggleDate && dropdownDate) toggleDate.addEventListener('click', () => { const was = dropdownDate.classList.contains('hidden'); hideAllDropdowns(); if (was) dropdownDate.classList.remove('hidden'); });
    if (togglePeriod && dropdownDailyPeriod) togglePeriod.addEventListener('click', () => { const was = dropdownDailyPeriod.classList.contains('hidden'); hideAllDropdowns(); if (was) dropdownDailyPeriod.classList.remove('hidden'); });
    if (togglePeriodCount && dropdownCumulativePeriod) togglePeriodCount.addEventListener('click', () => { const was = dropdownCumulativePeriod.classList.contains('hidden'); hideAllDropdowns(); if (was) dropdownCumulativePeriod.classList.remove('hidden'); });
    if (toggleCountBy && dropdownCountBy) toggleCountBy.addEventListener('click', () => { const was = dropdownCountBy.classList.contains('hidden'); hideAllDropdowns(); if (was) dropdownCountBy.classList.remove('hidden'); });

    function attachDropdownOptions(dropdownEl, handler) {
        if (!dropdownEl) return;
        dropdownEl.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.addEventListener('click', () => { handler(opt.getAttribute('data-value')); dropdownEl.classList.add('hidden'); });
        });
    }

    attachDropdownOptions(dropdownDailyPeriod, (v) => { dailyPeriodChoice = v || '전체'; loadViolations(); });
    attachDropdownOptions(dropdownCumulativePeriod, (v) => { cumulativePeriodChoice = v || '전체'; loadCumulative(); });
    // Custom handling for '누적 횟수 별 조회' so the numeric input sits inside the dropdown
    if (dropdownCountBy) {
        // Ensure input starts disabled
        if (xcountInput) xcountInput.disabled = true;
        dropdownCountBy.querySelectorAll('.dropdown-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                const v = opt.getAttribute('data-value');
                if (v === 'X회 이상') {
                    // Enable the input and keep the dropdown open so user can type immediately
                    if (xcountInput) { xcountInput.disabled = false; xcountInput.focus(); }
                    // do not hide dropdown here - allow input interaction
                } else {
                    // '전체' selected: disable and clear input, apply no threshold
                    countThresholdValue = 0;
                    if (xcountInput) { xcountInput.disabled = true; xcountInput.value = ''; }
                    // close dropdown after selection
                    dropdownCountBy.classList.add('hidden');
                    loadCumulative();
                }
            });
        });
    }
    if (xcountInput) xcountInput.addEventListener('input', () => { const v = parseInt(xcountInput.value,10); countThresholdValue = Number.isFinite(v) ? v : 0; loadCumulative(); });
    if (datePicker) datePicker.addEventListener('change', () => { hideAllDropdowns(); loadViolations(); });

    // Year-download UI refs
    const downloadByYearBtn = document.getElementById('download-by-year-btn');
    const yearModal = document.getElementById('year-download-modal');
    const yearSelectList = document.getElementById('year-select-list');
    const downloadYearExcelBtn = document.getElementById('download-year-excel');
    const yearDownloadCancel = document.getElementById('year-download-cancel');

    // Listen for cross-tab notifications so admin UI can refresh immediately when a new record is saved elsewhere
    try {
        const bc = new BroadcastChannel('violations-updates');
        bc.onmessage = (ev) => {
            // Simple refresh of both lists to pick up new data
            loadViolations();
            loadCumulative();
        };
    } catch (e) {
        // ignore if not supported
    }

    async function fetchAvailableAcademicYears() {
        // Collect distinct schoolYear values from documents. For very large collections this may be heavy;
        // for now we do a simple scan which matches repository constraints.
        const snap = await getDocs(collection(db, 'violations'));
        const years = new Set();
        snap.forEach(s => {
            const r = s.data();
            if (!r) return;
            if (r.schoolYear !== undefined && r.schoolYear !== null) {
                years.add(Number(r.schoolYear));
            } else if (r.timestamp) {
                const ts = r.timestamp;
                const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                years.add(getAcademicYearForDate(docDate));
            }
        });
        const arr = Array.from(years).sort((a,b) => b - a); // newest first
        return arr;
    }

    function renderYearOptions(years) {
        if (!yearSelectList) return;
        yearSelectList.innerHTML = '';
        if (!years.length) {
            yearSelectList.innerHTML = '<div style="color:#666;padding:8px;">저장된 학년도 데이터가 없습니다.</div>';
            return;
        }
        years.forEach(y => {
            const id = `year-option-${y}`;
            const wrapper = document.createElement('div');
            wrapper.style.padding = '6px 4px';
            const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'year-option'; radio.id = id; radio.value = String(y);
            const label = document.createElement('label'); label.htmlFor = id; label.style.marginLeft = '8px'; label.style.color = '#333'; label.textContent = `${y}학년도 (${y}.03.01 ~ ${y+1}.02.28)`;
            wrapper.appendChild(radio); wrapper.appendChild(label);
            yearSelectList.appendChild(wrapper);
        });
    }

    if (downloadByYearBtn) {
        downloadByYearBtn.addEventListener('click', async () => {
            try {
                const years = await fetchAvailableAcademicYears();
                renderYearOptions(years);
                if (yearModal) yearModal.classList.remove('hidden');
            } catch (err) {
                console.error('학년도 목록 조회 실패 - 상세 오류:', err);
                alert('학년도 목록을 불러오는 중 오류가 발생했습니다. 콘솔을 확인하세요.');
            }
        });
    }

    if (yearDownloadCancel) yearDownloadCancel.addEventListener('click', () => { if (yearModal) yearModal.classList.add('hidden'); });

    if (downloadYearExcelBtn) {
        downloadYearExcelBtn.addEventListener('click', async () => {
            try {
                const sel = document.querySelector('input[name="year-option"]:checked');
                if (!sel) { alert('학년도를 선택해주세요.'); return; }
                const year = Number(sel.value);
                const { start, end } = getAcademicYearRange(year);

                const qPeriod = query(
                    collection(db,'violations'),
                    where('timestamp','>=', Timestamp.fromDate(start)),
                    where('timestamp','<', Timestamp.fromDate(end))
                );
                const snap = await getDocs(qPeriod);
                const map = {};
                snap.forEach(s => {
                    const r = s.data();
                    if (!r || !r.timestamp) return;
                    const ts = r.timestamp;
                    const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                    const docYear = (r.schoolYear !== undefined && r.schoolYear !== null) ? Number(r.schoolYear) : getAcademicYearForDate(docDate);
                    if (docYear !== year) return;
                    const id = r.studentId || '';
                    if (!map[id]) map[id] = { studentName: r.studentName || '', dress:0, device:0 };
                    const hasDressViolation = (r.dressCodeViolations && r.dressCodeViolations.length) || (r.dressCodeOther && String(r.dressCodeOther).trim().length > 0);
                    if (hasDressViolation) map[id].dress++;
                    const hasDeviceViolation = (r.deviceViolations && r.deviceViolations.length) || (r.deviceOther && String(r.deviceOther).trim().length > 0);
                    if (hasDeviceViolation) map[id].device++;
                });

                const rows = Object.keys(map).map(k => ({
                    '학번': k,
                    '이름': map[k].studentName,
                    '복장 누적': `${map[k].dress}회`,
                    '전자 누적': `${map[k].device}회`
                }));

                if (!rows.length) { alert('선택한 학년도에 데이터가 없습니다.'); return; }
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '누적');
                const fn = `위반기록_누적_${year}학년도.xlsx`;
                XLSX.writeFile(wb, fn);
                if (yearModal) yearModal.classList.add('hidden');
            } catch (err) {
                console.error('년도별 누적 엑셀 실패 - 상세 오류:', err);
                alert('엑셀 생성 중 오류가 발생했습니다. 콘솔을 확인하세요.');
            }
        });
    }

    // Excel handlers (use existing logic)
    if (excelDownloadDailyBtn) {
        excelDownloadDailyBtn.addEventListener('click', async () => {
            try {
                if (!datePicker) { alert('날짜를 선택해주세요.'); return; }
                const selectedDate = new Date(datePicker.value);
                const startOfDay = new Date(selectedDate.setHours(0,0,0,0));
                const endOfDay = new Date(selectedDate.setHours(23,59,59,999));

                const q = query(
                    collection(db,'violations'),
                    where('timestamp','>=', Timestamp.fromDate(startOfDay)),
                    where('timestamp','<=', Timestamp.fromDate(endOfDay))
                );
                const qs = await getDocs(q);
                const rows = [];

                const periodChoice = dailyPeriodChoice || '전체';
                const { start: pStart, end: pEnd } = computePeriodRange(periodChoice, new Date(datePicker.value));

                const qPeriod = query(
                    collection(db,'violations'),
                    where('timestamp','>=', Timestamp.fromDate(pStart)),
                    where('timestamp','<=', Timestamp.fromDate(pEnd))
                );
                const periodSnap = await getDocs(qPeriod);
                const counts = {};
                // Count only documents that belong to the current academic year (compute if missing)
                periodSnap.forEach(s => {
                    const r = s.data();
                    if (!r || !r.timestamp) return;
                    const ts = r.timestamp;
                    const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                    const docYear = (r.schoolYear !== undefined && r.schoolYear !== null) ? Number(r.schoolYear) : getAcademicYearForDate(docDate);
                    const currentYear = getCurrentAcademicYear();
                    if (docYear !== currentYear) return;
                    const id = r.studentId || '';
                    if (!counts[id]) counts[id] = { dress:0, device:0 };
                    const hasDressViolation = (r.dressCodeViolations && r.dressCodeViolations.length) || (r.dressCodeOther && String(r.dressCodeOther).trim().length > 0);
                    if (hasDressViolation) counts[id].dress++;
                    const hasDeviceViolation = (r.deviceViolations && r.deviceViolations.length) || (r.deviceOther && String(r.deviceOther).trim().length > 0);
                    if (hasDeviceViolation) counts[id].device++;
                });

                qs.forEach(s => {
                    const r = s.data();
                    if (!r || !r.timestamp) return;
                    const ts = r.timestamp;
                    const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                    const docYear = (r.schoolYear !== undefined && r.schoolYear !== null) ? Number(r.schoolYear) : getAcademicYearForDate(docDate);
                    const currentYear = getCurrentAcademicYear();
                    if (docYear !== currentYear) return; // skip rows outside current academic year
                    const dressDetails = (r.dressCodeViolations || []).join(', ') + (r.dressCodeOther ? (r.dressCodeViolations && r.dressCodeViolations.length ? ', ' : '') + r.dressCodeOther : '');
                    const deviceDetails = (r.deviceViolations || []).join(', ') + (r.deviceOther ? (r.deviceViolations && r.deviceViolations.length ? ', ' : '') + r.deviceOther : '');
                    rows.push({
                        '날짜': new Date(r.timestamp.seconds * 1000).toLocaleDateString(),
                        '학번': r.studentId || '',
                        '이름': r.studentName || '',
                        '복장 위반': dressDetails || '',
                        '복장 누적': counts[r.studentId] ? `${counts[r.studentId].dress}회` : '0회',
                        '전자기기': deviceDetails || '',
                        '전자 누적': counts[r.studentId] ? `${counts[r.studentId].device}회` : '0회'
                    });
                });

                if (!rows.length) { alert('해당 날짜에 데이터가 없습니다.'); return; }
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '일별');
                XLSX.writeFile(wb, `위반기록_일별_${datePicker.value}.xlsx`);
            } catch (err) {
                console.error('엑셀 생성 실패 - 상세 오류:', err);
                alert('엑셀 생성 중 오류가 발생했습니다. 콘솔을 확인하세요.');
            }
        });
    }

    if (excelDownloadCumulativeBtn) {
        excelDownloadCumulativeBtn.addEventListener('click', async () => {
            try {
                const periodChoice = cumulativePeriodChoice || '전체';
                const refDate = datePicker && datePicker.value ? new Date(datePicker.value) : new Date();
                const { start, end } = computePeriodRange(periodChoice, refDate);

                const qPeriod = query(
                    collection(db,'violations'),
                    where('timestamp','>=', Timestamp.fromDate(start)),
                    where('timestamp','<=', Timestamp.fromDate(end))
                );
                const snap = await getDocs(qPeriod);
                const map = {};
                // Filter documents by academic year in JS to support older docs without schoolYear
                snap.forEach(s => {
                    const r = s.data();
                    if (!r || !r.timestamp) return;
                    const ts = r.timestamp;
                    const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                    const docYear = (r.schoolYear !== undefined && r.schoolYear !== null) ? Number(r.schoolYear) : getAcademicYearForDate(docDate);
                    const currentYear = getCurrentAcademicYear();
                    if (docYear !== currentYear) return;
                    const id = r.studentId || '';
                    if (!map[id]) map[id] = { studentName: r.studentName || '', dress:0, device:0 };
                    const hasDressViolation = (r.dressCodeViolations && r.dressCodeViolations.length) || (r.dressCodeOther && String(r.dressCodeOther).trim().length > 0);
                    if (hasDressViolation) map[id].dress++;
                    const hasDeviceViolation = (r.deviceViolations && r.deviceViolations.length) || (r.deviceOther && String(r.deviceOther).trim().length > 0);
                    if (hasDeviceViolation) map[id].device++;
                });

                const rows = Object.keys(map).map(k => ({
                    '학번': k,
                    '이름': map[k].studentName,
                    '복장 누적': `${map[k].dress}회`,
                    '전자 누적': `${map[k].device}회`
                }));

                if (!rows.length) { alert('해당 기간에 데이터가 없습니다.'); return; }
                const ws = XLSX.utils.json_to_sheet(rows);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '누적');
                const fn = `위반기록_누적_${periodChoice}_${(new Date()).toISOString().slice(0,10)}.xlsx`;
                XLSX.writeFile(wb, fn);
            } catch (err) {
                console.error('누적 엑셀 실패 - 상세 오류:', err);
                alert('엑셀 생성 중 오류가 발생했습니다.');
            }
        });
    }

    // Load daily list + compute cumulative counts for selected daily period
    async function loadViolations() {
        try {
            if (!datePicker || !dailyTableContainer) return;
            const selectedDate = new Date(datePicker.value);
            const startOfDay = new Date(selectedDate.setHours(0,0,0,0));
            const endOfDay = new Date(selectedDate.setHours(23,59,59,999));

            const periodChoice = dailyPeriodChoice || '전체';
            const { start: pStart, end: pEnd } = computePeriodRange(periodChoice, new Date(datePicker.value));

            const currentYear = getCurrentAcademicYear();
                const qPeriod = query(
                    collection(db,'violations'),
                    where('timestamp','>=', Timestamp.fromDate(pStart)),
                    where('timestamp','<=', Timestamp.fromDate(pEnd))
                );
            const periodSnap = await getDocs(qPeriod);
            const counts = {};
            // Filter by academic year in JS for backward compatibility
            periodSnap.forEach(s => {
                const r = s.data();
                if (!r || !r.timestamp) return;
                const ts = r.timestamp;
                const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                const docYear = (r.schoolYear !== undefined && r.schoolYear !== null) ? Number(r.schoolYear) : getAcademicYearForDate(docDate);
                const currentYear = getCurrentAcademicYear();
                if (docYear !== currentYear) return;
                const id = r.studentId || '';
                if (!counts[id]) counts[id] = { dress:0, device:0 };
                const hasDressViolation = (r.dressCodeViolations && r.dressCodeViolations.length) || (r.dressCodeOther && String(r.dressCodeOther).trim().length > 0);
                if (hasDressViolation) counts[id].dress++;
                const hasDeviceViolation = (r.deviceViolations && r.deviceViolations.length) || (r.deviceOther && String(r.deviceOther).trim().length > 0);
                if (hasDeviceViolation) counts[id].device++;
            });

                const qDay = query(
                    collection(db,'violations'),
                    where('timestamp','>=', Timestamp.fromDate(startOfDay)),
                    where('timestamp','<=', Timestamp.fromDate(endOfDay))
                );
                const daySnap = await getDocs(qDay);

            dailyTableContainer.innerHTML = '';
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.tableLayout = 'fixed';
            const thead = document.createElement('thead');
            const hrow = document.createElement('tr');
            ['날짜','학번','이름','복장 위반','무단 전자기기 사용','삭제'].forEach(h => {
                const th = document.createElement('th');
                th.textContent = h;
                th.style.color = '#737373';
                th.style.fontSize = '16px';
                th.style.fontWeight = '500';
                th.style.textAlign = 'left';
                th.style.padding = '6px 8px';
                hrow.appendChild(th);
            });
            thead.appendChild(hrow); table.appendChild(thead);

            const tbody = document.createElement('tbody');
                    daySnap.forEach(s => {
                        const r = s.data();
                        if (!r || !r.timestamp) return;
                        const ts = r.timestamp;
                        const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                        const docYear = (r.schoolYear !== undefined && r.schoolYear !== null) ? Number(r.schoolYear) : getAcademicYearForDate(docDate);
                        const currentYear = getCurrentAcademicYear();
                        if (docYear !== currentYear) return; // skip rows not in current academic year
                        const tr = document.createElement('tr');
                        const dateCell = document.createElement('td'); dateCell.textContent = new Date(r.timestamp.seconds * 1000).toLocaleDateString(); dateCell.style.padding = '6px 8px';
                        const idCell = document.createElement('td'); idCell.textContent = r.studentId || ''; idCell.style.padding='6px 8px';
                        const nameCell = document.createElement('td'); nameCell.textContent = r.studentName || ''; nameCell.style.padding='6px 8px';
                        const dressText = (r.dressCodeViolations || []).join(', ') + (r.dressCodeOther ? (r.dressCodeViolations && r.dressCodeViolations.length ? ', ' : '') + r.dressCodeOther : '');
                        const dressCount = counts[r.studentId] ? counts[r.studentId].dress : 0; const dressCell = document.createElement('td'); dressCell.textContent = `${dressText || '없음'} (${dressCount}회)`; dressCell.style.padding='6px 8px';
                        const deviceText = (r.deviceViolations || []).join(', ') + (r.deviceOther ? (r.deviceViolations && r.deviceViolations.length ? ', ' : '') + r.deviceOther : '');
                        const deviceCount = counts[r.studentId] ? counts[r.studentId].device : 0; const deviceCell = document.createElement('td'); deviceCell.textContent = `${deviceText || '없음'} (${deviceCount}회)`; deviceCell.style.padding='6px 8px';
                        [dateCell,idCell,nameCell,dressCell,deviceCell].forEach(c => { c.style.color='#737373'; c.style.fontSize='16px'; c.style.fontWeight='500'; c.style.wordBreak='break-word'; c.style.overflow='hidden'; c.style.textOverflow='ellipsis'; });
                        // Delete button cell
                        const delCell = document.createElement('td');
                        const delBtn = document.createElement('button');
                        delBtn.className = 'delete-record';
                        delBtn.textContent = 'X';
                        delBtn.addEventListener('click', async () => {
                            if (!confirm('삭제하시겠습니까?')) return;
                            try {
                                await deleteDoc(doc(db, 'violations', s.id));
                                // After deletion, reload both views to recalc counts
                                await loadViolations();
                                await loadCumulative();
                            } catch (err) {
                                console.error('삭제 실패', err);
                                alert('삭제 중 오류가 발생했습니다. 콘솔을 확인하세요.');
                            }
                        });
                        delCell.appendChild(delBtn);
                        tr.appendChild(dateCell); tr.appendChild(idCell); tr.appendChild(nameCell); tr.appendChild(dressCell); tr.appendChild(deviceCell);
                        tr.appendChild(delCell);
                        tbody.appendChild(tr);
            });
            table.appendChild(tbody); dailyTableContainer.appendChild(table);

        } catch (err) {
            console.error('loadViolations error - 상세 오류:', err);
            alert('일별 데이터를 불러오는 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
    }

    // Load cumulative aggregated table
    async function loadCumulative() {
        try {
            if (!cumulativeTableContainer) return;
            const periodChoice = cumulativePeriodChoice || '전체';
            const refDate = datePicker && datePicker.value ? new Date(datePicker.value) : new Date();
            const { start, end } = computePeriodRange(periodChoice, refDate);

            const currentYear = getCurrentAcademicYear();
            const qPeriod = query(
                collection(db,'violations'),
                where('timestamp','>=', Timestamp.fromDate(start)),
                where('timestamp','<=', Timestamp.fromDate(end)),
            );
            const snap = await getDocs(qPeriod);
            const map = {};
            snap.forEach(s => {
                const r = s.data();
                if (!r || !r.timestamp) return;
                const ts = r.timestamp;
                const docDate = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
                const docYear = (r.schoolYear !== undefined && r.schoolYear !== null) ? Number(r.schoolYear) : getAcademicYearForDate(docDate);
                const currentYear = getCurrentAcademicYear();
                if (docYear !== currentYear) return;
                const id = r.studentId || '';
                if (!map[id]) map[id] = { studentName: r.studentName || '', dress:0, device:0 };
                const hasDressViolation = (r.dressCodeViolations && r.dressCodeViolations.length) || (r.dressCodeOther && String(r.dressCodeOther).trim().length > 0);
                if (hasDressViolation) map[id].dress++;
                const hasDeviceViolation = (r.deviceViolations && r.deviceViolations.length) || (r.deviceOther && String(r.deviceOther).trim().length > 0);
                if (hasDeviceViolation) map[id].device++;
            });

            const threshold = countThresholdValue || 0;

            let rows = Object.keys(map).map(k => ({ id: k, name: map[k].studentName, dress: map[k].dress, device: map[k].device }));
            if (threshold > 0) rows = rows.filter(r => (r.dress >= threshold) || (r.device >= threshold));

            rows.sort((a,b) => {
                const na = a.id || '';
                const nb = b.id || '';
                if (na !== nb) return na.localeCompare(nb, 'ko');
                return (a.name || '').localeCompare(b.name || '');
            });

            cumulativeTableContainer.innerHTML = '';
            const table = document.createElement('table'); table.style.width='100%'; table.style.borderCollapse='collapse'; table.style.tableLayout='fixed';
            const thead = document.createElement('thead'); const hrow = document.createElement('tr');
            ['학번','이름','복장 누적','전자 누적'].forEach(h => { const th = document.createElement('th'); th.textContent=h; th.style.color='#737373'; th.style.fontSize='16px'; th.style.fontWeight='500'; th.style.padding='6px 8px'; hrow.appendChild(th); });
            thead.appendChild(hrow); table.appendChild(thead);
            const tbody = document.createElement('tbody');
            rows.forEach(r => {
                const tr = document.createElement('tr');
                const idCell = document.createElement('td'); idCell.textContent = r.id; idCell.style.padding='6px 8px'; idCell.style.wordBreak='break-word';
                const nameCell = document.createElement('td'); nameCell.textContent = r.name; nameCell.style.padding='6px 8px'; nameCell.style.wordBreak='break-word';
                const dressCell = document.createElement('td'); dressCell.textContent = `${r.dress}회`; dressCell.style.padding='6px 8px';
                const deviceCell = document.createElement('td'); deviceCell.textContent = `${r.device}회`; deviceCell.style.padding='6px 8px';
                [idCell,nameCell,dressCell,deviceCell].forEach(c=>{ c.style.color='#737373'; c.style.fontSize='16px'; c.style.fontWeight='500'; c.style.overflow='hidden'; c.style.textOverflow='ellipsis'; });
                tr.appendChild(idCell); tr.appendChild(nameCell); tr.appendChild(dressCell); tr.appendChild(deviceCell);
                tbody.appendChild(tr);
            });
            table.appendChild(tbody); cumulativeTableContainer.appendChild(table);

        } catch (err) {
            console.error('loadCumulative error - 상세 오류:', err);
            alert('누적 데이터를 불러오는 중 오류가 발생했습니다. 콘솔을 확인하세요.');
        }
    }

    // Back button -> go to main
    const backBtn = document.querySelector('.back-btn');
    if (backBtn) backBtn.addEventListener('click', () => window.location.replace('index.html'));

}
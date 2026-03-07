import { db, auth } from './firebase.js';
import { getDoc, doc, collection, addDoc, getDocs, where, query, deleteDoc, Timestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const currentPath = window.location.pathname;

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

    // 기록 버튼 클릭 → 비밀번호 모달 열기
    recordBtn.addEventListener('click', () => {
        passwordModal.classList.remove('hidden');
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
            await addDoc(collection(db, 'violations'), {
                studentId,
                studentName,
                timestamp: Timestamp.now(),
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
    });
}


// --- Admin Page ---
if (currentPath.includes('admin.html')) {
    const loadingScreen = document.getElementById('loading-screen');
    const adminContent = document.getElementById('admin-content');
    const adminPanel = document.getElementById('admin-panel');
    const logoutBtn = document.getElementById('logout-btn');
    const datePicker = document.getElementById('date-picker');
    const violationList = document.getElementById('violation-list');
    const excelDownloadBtn = document.getElementById('excel-download');

        // 인증 상태가 결정될 때까지 로딩 화면을 보여주고, 이후 적절한 화면으로 이동/표시
    onAuthStateChanged(auth, user => {

        // admin 페이지에서만 실행되도록 체크
        const loadingScreen = document.getElementById("loading-screen");
        const adminContent = document.getElementById("admin-content");
        const adminPanel = document.getElementById("admin-panel");
        const datePicker = document.getElementById("date-picker");

        // 로딩 화면 숨기기
        if (loadingScreen) {
            loadingScreen.style.display = "none";
        }

        // 관리자 인증 확인
        if (user && user.email === "admin@school.kr") {

            // ⭐ Firebase 인증 확인 후 화면 표시
            document.body.style.display = "block";

            // 관리자 컨텐츠 표시
            if (adminContent) {
                adminContent.classList.remove("hidden");
            }

            if (adminPanel) {
                adminPanel.classList.remove("hidden");
            }

            // 오늘 날짜 자동 설정
            if (datePicker) {
                datePicker.valueAsDate = new Date();
            }

            // 위반 목록 불러오기
            if (typeof loadViolations === "function") {
                loadViolations();
            }

        } else {

            // 로그인 안된 경우 메인 페이지로 이동
            if (window.location.pathname.includes("admin.html")) {
                window.location.replace("index.html");
            }

        }

    });

    // admin.html에서 로그인 폼을 사용하지 않으므로 관리자 로그인 핸들러는 제거됨

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                // 로그아웃 후 인덱스 페이지로 이동 (히스토리 교체)
                window.location.replace('index.html');
            } catch (error) {
                console.error('Sign out failed:', error);
                alert('로그아웃 중 오류가 발생했습니다.');
            }
        });
    }
    
    if (datePicker) {
        datePicker.addEventListener('change', loadViolations);
    }

    async function loadViolations() {
        try {
            if (!datePicker || !violationList) return;
            const selectedDate = new Date(datePicker.value);
            const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

            const q = query(
                collection(db, 'violations'),
                where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
                where('timestamp', '<=', Timestamp.fromDate(endOfDay))
            );

            const querySnapshot = await getDocs(q);
            if (violationList) violationList.innerHTML = '';
            querySnapshot.forEach(docSnap => {
                renderViolation(docSnap.id, docSnap.data());
            });

        } catch (error) {
            console.error("🔥 불러오기 오류:", error);
            alert("데이터를 불러오지 못했습니다. 콘솔을 확인하세요.");
        }
    }

    function renderViolation(id, data) {
        const li = document.createElement('li');
        
        let dressDetails = (data.dressCodeViolations || []).join(', ');
        if (data.dressCodeOther) {
            dressDetails += (dressDetails ? ', ' : '') + `기타 (${data.dressCodeOther})`;
        }
        if (!dressDetails) dressDetails = '없음';

        let deviceDetails = (data.deviceViolations || []).join(', ');
        if (data.deviceOther) {
            deviceDetails += (deviceDetails ? ', ' : '') + `기타 (${data.deviceOther})`;
        }
        if (!deviceDetails) deviceDetails = '없음';

        const details = `
            ${data.studentId} ${data.studentName} 
            (${new Date(data.timestamp.seconds * 1000).toLocaleTimeString()})
            - 복장: ${dressDetails}
            - 전자기기: ${deviceDetails}
        `;
        li.innerHTML = `<span>${details}</span>`;
        
    const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '삭제';
        deleteBtn.onclick = async () => {
            if(confirm('정말로 삭제하시겠습니까?')) {
                await deleteDoc(doc(db, 'violations', id));
                loadViolations(); // Refresh list
            }
        };
        li.appendChild(deleteBtn);
        if (violationList) violationList.appendChild(li);
    }
    
    if (excelDownloadBtn) {
        excelDownloadBtn.addEventListener('click', async () => {
        try {
            if (!datePicker) { alert('날짜를 선택해주세요.'); return; }
            const selectedDate = new Date(datePicker.value);
            const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));
            
            const q = query(
                collection(db, 'violations'),
                where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
                where('timestamp', '<=', Timestamp.fromDate(endOfDay))
            );

            const querySnapshot = await getDocs(q);
            const data = [];

            querySnapshot.forEach(docSnap => {
                const record = docSnap.data();

                let dressDetails = (record.dressCodeViolations || []).join(', ');
                if (record.dressCodeOther) {
                    dressDetails += (dressDetails ? ', ' : '') + `기타 (${record.dressCodeOther})`;
                }

                let deviceDetails = (record.deviceViolations || []).join(', ');
                if (record.deviceOther) {
                    deviceDetails += (deviceDetails ? ', ' : '') + `기타 (${record.deviceOther})`;
                }

                data.push({
                    '학번': record.studentId,
                    '이름': record.studentName,
                    '시간': new Date(record.timestamp.seconds * 1000).toLocaleString(),
                    '복장단속': dressDetails || '',
                    '전자기기': deviceDetails || ''
                });
            });

            if (data.length === 0) {
                alert("해당 날짜에 데이터가 없습니다.");
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, '위반기록');
            XLSX.writeFile(workbook, `위반기록_${datePicker.value}.xlsx`);

        } catch (error) {
            console.error("🔥 엑셀 다운로드 오류:", error);
            alert("엑셀 다운로드 중 오류가 발생했습니다. 콘솔을 확인하세요.");
        }
        });
    }
}
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
    const timeSelect = document.getElementById('time-select');

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

    // 권한 로그인 버튼
    authBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });


    saveViolationBtn.addEventListener('click', async () => {
        const studentId = document.getElementById('student-id').value;
        const studentName = document.getElementById('student-name').value;
        const time = timeSelect.value;
        const classPeriod = time === 'class-time' ? document.getElementById('class-period').value : null;
        const dressCodeViolations = Array.from(document.querySelectorAll('input[name="dress-code"]:checked')).map(cb => cb.value);
        const deviceViolation = document.getElementById('device-violation-toggle').checked;

        if (!studentId || !studentName) {
            alert('학번과 이름을 모두 입력해주세요.');
            return;
        }

        try {
            await addDoc(collection(db, 'violations'), {
                studentId,
                studentName,
                timestamp: Timestamp.now(),
                time,
                classPeriod,
                dressCodeViolations,
                deviceViolation
            });
            alert('위반 사항이 저장되었습니다.');
            // Clear form
            document.getElementById('student-id').value = '';
            document.getElementById('student-name').value = '';
            document.getElementById('class-period').value = '';
            document.querySelectorAll('input[name="dress-code"]').forEach(cb => cb.checked = false);
            document.getElementById('device-violation-toggle').checked = false;

        } catch (error) {
            console.error("Error adding document: ", error);
            alert('저장 중 오류가 발생했습니다.');
        }
    });
}


// --- Admin Page ---
if (currentPath.includes('admin.html')) {
    const loginForm = document.getElementById('login-form');
    const adminPanel = document.getElementById('admin-panel');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const datePicker = document.getElementById('date-picker');
    const violationList = document.getElementById('violation-list');
    const excelDownloadBtn = document.getElementById('excel-download');

    onAuthStateChanged(auth, user => {
        if (user && user.email === 'admin@school.kr') {
            loginForm.classList.add('hidden');
            adminPanel.classList.remove('hidden');
            datePicker.valueAsDate = new Date();
            loadViolations();
        } else {
            loginForm.classList.remove('hidden');
            adminPanel.classList.add('hidden');
        }
    });

    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        signInWithEmailAndPassword(auth, email, password)
            .catch(error => {
                console.error("Login failed:", error);
                alert('로그인에 실패했습니다. 이메일 또는 비밀번호를 확인하세요.');
            });
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth);
    });
    
    datePicker.addEventListener('change', loadViolations);

    async function loadViolations() {
    try {
        const selectedDate = new Date(datePicker.value);
        const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));

        const q = query(
            collection(db, 'violations'),
            where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
            where('timestamp', '<=', Timestamp.fromDate(endOfDay))
        );

        const querySnapshot = await getDocs(q);

        console.log("🔥 가져온 문서 수:", querySnapshot.size);

        violationList.innerHTML = '';

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
        const details = `
            ${data.studentId} ${data.studentName} 
            (${new Date(data.timestamp.seconds * 1000).toLocaleTimeString()})
            - 복장: ${data.dressCodeViolations.join(', ') || '없음'}
            - 전자기기: ${data.deviceViolation ? '사용' : '미사용'}
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
        violationList.appendChild(li);
    }
    
    excelDownloadBtn.addEventListener('click', async () => {
    try {
        const selectedDate = new Date(datePicker.value);
        const startOfDay = new Date(selectedDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(selectedDate.setHours(23, 59, 59, 999));
        
        const q = query(
            collection(db, 'violations'),
            where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
            where('timestamp', '<=', Timestamp.fromDate(endOfDay))
        );

        const querySnapshot = await getDocs(q);

        console.log("🔥 엑셀용 문서 수:", querySnapshot.size);

        const data = [];

        querySnapshot.forEach(docSnap => {
            const record = docSnap.data();

            data.push({
                '학번': record.studentId,
                '이름': record.studentName,
                '시간': new Date(record.timestamp.seconds * 1000).toLocaleString(),
                '구분': record.time === 'class-time' ? '수업시간' : '쉬는시간',
                '교시': record.classPeriod || '-',
                '복장위반': record.dressCodeViolations?.join(', ') || '',
                '전자기기': record.deviceViolation ? '사용' : '미사용'
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
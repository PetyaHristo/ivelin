document.addEventListener("DOMContentLoaded", () => {
    const apiURL = "api.php"; 
    let state = { page: 1, limit: 10, search: '', dept: '', town: '', minSal: '', maxSal: '', sort: '', dir: '' };

    const els = {
        tbody: document.querySelector("#dataTable tbody"),
        search: document.getElementById("filterSearch"),
        dept: document.getElementById("filterDept"),
        town: document.getElementById("filterTown"),
        minSal: document.getElementById("filterMinSal"),
        maxSal: document.getElementById("filterMaxSal"),
        pageText: document.getElementById("pageInfoText"),
        pageNumbers: document.getElementById("pageNumbers"), 
        btnPrev: document.getElementById("btnPrev"),
        btnNext: document.getElementById("btnNext"),
        msgBox: document.getElementById("msgBox"),
        msgText: document.getElementById("msgText")
    };

    const fModal = document.getElementById("formModal");
    const dModal = document.getElementById("delModal");

    fetchMeta();
    fetchData();

    function fetchMeta() {
        fetch(`${apiURL}?action=meta`).then(r => r.json()).then(data => {
            if (data.error) return showMsg("Грешка в базата: " + data.error, true);
            
            data.departments.forEach(d => {
                els.dept.insertAdjacentHTML('beforeend', `<option value="${d.name}">${d.name}</option>`);
                document.getElementById("empDept").insertAdjacentHTML('beforeend', `<option value="${d.id}">${d.name}</option>`);
            });
            data.towns.forEach(t => els.town.insertAdjacentHTML('beforeend', `<option value="${t.name}">${t.name}</option>`));
            data.addresses.forEach(a => document.getElementById("empAddress").insertAdjacentHTML('beforeend', `<option value="${a.id}">${a.name}</option>`));
        });
    }

    function fetchData() {
        state.search = els.search.value; state.dept = els.dept.value; state.town = els.town.value;
        state.minSal = els.minSal.value; state.maxSal = els.maxSal.value;

        const q = new URLSearchParams({ action: 'data', ...state });
        
        fetch(`${apiURL}?${q.toString()}`).then(r => r.json()).then(res => {
            els.tbody.innerHTML = '';
            
            if (!res.data || res.data.length === 0) {
                els.tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Няма намерени записи</td></tr>';
                els.pageText.textContent = "Показани 0 от 0";
                els.pageNumbers.innerHTML = '';
                els.btnPrev.disabled = true; els.btnNext.disabled = true;
                return;
            }

            let rowNum = (state.page - 1) * state.limit + 1;
            res.data.forEach(row => {
                els.tbody.insertAdjacentHTML('beforeend', `
                    <tr>
                        <td><b>${rowNum++}</b></td>
                        <td>${row.full_name}</td>
                        <td>${row.job_title}</td>
                        <td>${row.department_name}</td>
                        <td>${parseFloat(row.salary).toFixed(2)} лв.</td>
                        <td>${row.address_text}</td>
                        <td>${row.town || '-'}</td>
                        <td><button class="btn btn-secondary btn-sm" onclick="editEmp(${row.employee_id}, '${row.first_name}', '${row.last_name}', '${row.job_title}', '${row.department_id}', '${row.salary}', '${row.address_id}')"><i class="fas fa-edit"></i></button></td>
                        <td><button class="btn btn-danger btn-sm" onclick="deleteEmp(${row.employee_id})"><i class="fas fa-trash"></i></button></td>
                    </tr>
                `);
            });

            // Странициране - Инфо текст
            const totalPages = Math.ceil(res.total / state.limit) || 1;
            const startCount = (state.page - 1) * state.limit + 1;
            const endCount = Math.min(state.page * state.limit, res.total);
            els.pageText.textContent = `Показани ${startCount} - ${endCount} от общо ${res.total} служители`;
            
            els.btnPrev.disabled = state.page === 1;
            els.btnNext.disabled = state.page === totalPages;

            // Генериране на квадратчетата
            renderPagination(totalPages);
        });
    }

    function renderPagination(totalPages) {
        els.pageNumbers.innerHTML = '';
        if (totalPages <= 1) return;

        // Показваме максимум 3 съседни страници за по-изчистен вид
        let startPage = Math.max(1, state.page - 1);
        let endPage = Math.min(totalPages, state.page + 1);

        if (state.page === 1) endPage = Math.min(totalPages, 3);
        if (state.page === totalPages) startPage = Math.max(1, totalPages - 2);

        // Бутон за 1-ва страница
        if (startPage > 1) {
            els.pageNumbers.appendChild(createPageBtn(1));
            if (startPage > 2) els.pageNumbers.insertAdjacentHTML('beforeend', `<span class="page-dots">&hellip;</span>`);
        }

        // Средни бутони
        for (let i = startPage; i <= endPage; i++) els.pageNumbers.appendChild(createPageBtn(i));

        // Бутон за последна страница
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) els.pageNumbers.insertAdjacentHTML('beforeend', `<span class="page-dots">&hellip;</span>`);
            els.pageNumbers.appendChild(createPageBtn(totalPages));
        }
    }

    function createPageBtn(num) {
        const btn = document.createElement('button');
        btn.className = `btn-page ${num === state.page ? 'active' : ''}`;
        btn.innerText = num;
        btn.onclick = () => { if(state.page !== num) { state.page = num; fetchData(); } };
        return btn;
    }

    // Слушатели и бутони
    [els.search, els.dept, els.town, els.minSal, els.maxSal].forEach(el => el.addEventListener('input', () => { state.page = 1; fetchData(); }));
    els.btnPrev.onclick = () => { if (state.page > 1) { state.page--; fetchData(); } };
    els.btnNext.onclick = () => { state.page++; fetchData(); };

    document.getElementById("btnClear").addEventListener("click", () => {
        els.search.value = ''; els.dept.value = ''; els.town.value = ''; els.minSal.value = ''; els.maxSal.value = '';
        state.sort = ''; state.dir = ''; state.page = 1;
        document.querySelectorAll('th.sortable i').forEach(i => i.className = 'fas fa-sort');
        fetchData();
    });

    document.getElementById("btnExcel").addEventListener("click", () => {
        const q = new URLSearchParams({ action: 'data', limit: 'all', search: els.search.value, dept: els.dept.value, town: els.town.value, minSal: els.minSal.value, maxSal: els.maxSal.value, sort: state.sort, dir: state.dir });
        fetch(`${apiURL}?${q.toString()}`).then(r => r.json()).then(res => {
            if (res.data && res.data.length > 0) {
                const ws = XLSX.utils.json_to_sheet(res.data.map((r, i) => ({ "№": i+1, "Име": r.full_name, "Длъжност": r.job_title, "Отдел": r.department_name, "Заплата": parseFloat(r.salary), "Адрес": r.address_text, "Град": r.town || 'Без град' })));
                const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Служители"); XLSX.writeFile(wb, "Employees.xlsx");
            } else showMsg("Няма данни.", true);
        });
    });

    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.getAttribute('data-sort');
            if (state.sort === sortKey) state.dir = state.dir === 'asc' ? 'desc' : 'asc'; else { state.sort = sortKey; state.dir = 'asc'; }
            document.querySelectorAll('th.sortable i').forEach(i => i.className = 'fas fa-sort');
            th.querySelector('i').className = state.dir === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
            fetchData();
        });
    });

    // Модални прозорци
    document.getElementById("btnAdd").onclick = () => { document.getElementById("empForm").reset(); document.getElementById("empId").value = ""; document.getElementById("modalTitle").innerText = "Добави служител"; fModal.style.display = "flex"; };
    document.getElementById("closeFormModal").onclick = () => fModal.style.display = "none";
    document.getElementById("cancelDel").onclick = () => dModal.style.display = "none";

    window.editEmp = (id, first, last, job, dept, sal, addr) => {
        document.getElementById("modalTitle").innerText = "Редакция"; document.getElementById("empId").value = id;
        document.getElementById("empFirst").value = first; document.getElementById("empLast").value = last;
        document.getElementById("empJob").value = job; document.getElementById("empDept").value = dept;
        document.getElementById("empSalary").value = sal; document.getElementById("empAddress").value = addr;
        fModal.style.display = "flex";
    };

    window.deleteEmp = id => { document.getElementById("delId").value = id; dModal.style.display = "flex"; };

    document.getElementById("empForm").onsubmit = e => {
        e.preventDefault();
        const id = document.getElementById("empId").value;
        const payload = { employee_id: id, first_name: document.getElementById("empFirst").value, last_name: document.getElementById("empLast").value, job_title: document.getElementById("empJob").value, salary: document.getElementById("empSalary").value, department_id: document.getElementById("empDept").value, address_id: document.getElementById("empAddress").value };
        fetch(apiURL, { method: id ? "PUT" : "POST", body: JSON.stringify(payload) }).then(r => r.json()).then(res => { if (res.success) { fModal.style.display = "none"; fetchData(); showMsg("Успешно!"); } else showMsg(res.error, true); });
    };

    document.getElementById("confirmDel").onclick = () => {
        fetch(`${apiURL}?id=${document.getElementById("delId").value}`, { method: "DELETE" }).then(r => r.json()).then(res => { if(res.success) { dModal.style.display = "none"; fetchData(); showMsg("Изтрито!"); } else showMsg(res.error, true); });
    };

    function showMsg(text, isError = false) { els.msgText.textContent = text; els.msgBox.className = `msg-box ${isError ? 'error' : 'success'} show`; setTimeout(() => els.msgBox.classList.remove("show"), 3000); }
});
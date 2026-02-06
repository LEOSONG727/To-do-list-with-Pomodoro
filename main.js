/**
 * Focus Do v14.0 - Fresh Start & UX Fixes
 */

(function () {
    console.log('Focus Do v14.0 Booting...');

    const appState = {
        tasks: [],
        currentFilter: 'all',
        selectedDate: getFmtDate(new Date()),
        focus: {
            active: false,
            paused: false,
            taskId: null,
            totalElapsed: 0,
            cycleElapsed: 0,
            interval: null,
            sessionTomatoes: 0
        },
        sessionStats: {
            date: getFmtDate(new Date()),
            count: 0
        },
        editingId: null
    };

    const POMODORO_CYCLE = 1500;
    const TIMER_CIRCUMFERENCE = 289;
    const MIN_SESSION_SECONDS = 30;

    function getFmtDate(date) {
        if (!(date instanceof Date)) date = new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function parseLocalDate(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function formatTime(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function formatFullTime(sec) {
        if (sec < 60) return sec > 0 ? `${sec}초` : '0분';
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
    }

    function el(id) { return document.getElementById(id); }

    function save() {
        localStorage.setItem('focus_tasks_v14', JSON.stringify({
            tasks: appState.tasks,
            sessionStats: appState.sessionStats
        }));
    }

    function load() {
        const raw = localStorage.getItem('focus_tasks_v14');
        if (raw) {
            try {
                const data = JSON.parse(raw);
                appState.tasks = Array.isArray(data.tasks) ? data.tasks : [];
                appState.sessionStats = data.sessionStats || { date: getFmtDate(new Date()), count: 0 };

                const today = getFmtDate(new Date());
                if (appState.sessionStats.date !== today) {
                    appState.sessionStats.date = today;
                    appState.sessionStats.count = 0;
                }
            } catch (e) {
                console.warn('데이터 로드 실패, 초기화합니다:', e.message);
                appState.tasks = [];
                appState.sessionStats = { date: getFmtDate(new Date()), count: 0 };
            }
        } else {
            appState.tasks = [];
            appState.sessionStats = { date: getFmtDate(new Date()), count: 0 };
        }
    }

    function render() {
        renderCalendar();
        renderTasks();
        renderStats();
        updateAchievements();
    }

    function renderCalendar() {
        const strip = el('calendar-strip');
        if (!strip) return;
        strip.innerHTML = '';
        const base = parseLocalDate(appState.selectedDate);
        if (isNaN(base.getTime())) {
            appState.selectedDate = getFmtDate(new Date());
            return renderCalendar();
        }

        for (let i = -7; i <= 7; i++) {
            const d = new Date(base);
            d.setDate(d.getDate() + i);
            const dStr = getFmtDate(d);
            const isActive = dStr === appState.selectedDate;
            const weekNames = ['일', '월', '화', '수', '목', '금', '토'];

            const div = document.createElement('div');
            div.className = `cal-day ${isActive ? 'active' : ''}`;
            div.innerHTML = `
                <span class="cal-weekday">${weekNames[d.getDay()]}</span>
                <span class="cal-date">${d.getDate()}</span>
            `;
            div.onclick = () => { appState.selectedDate = dStr; render(); };
            strip.appendChild(div);
        }
    }

    function renderTasks() {
        const list = el('task-list');
        const dateDisp = el('current-date-display');
        if (!list || !dateDisp) return;

        list.innerHTML = '';
        const todayStr = getFmtDate(new Date());
        dateDisp.textContent = (appState.selectedDate === todayStr) ? '오늘' : appState.selectedDate;

        const daily = appState.tasks.filter(t => t.date === appState.selectedDate);
        const filtered = appState.currentFilter === 'completed' ? daily.filter(t => t.completed) : daily;

        if (filtered.length === 0) {
            list.innerHTML = `<li style="padding:40px; text-align:center; opacity:0.4;">할 일이 아직 없습니다. 📝</li>`;
            return;
        }

        filtered.forEach(t => {
            const li = document.createElement('li');
            li.className = `task-item ${t.completed ? 'is-completed' : ''}`;
            li.setAttribute('role', 'listitem');
            li.setAttribute('tabindex', '0');

            const checkbox = document.createElement('div');
            checkbox.className = `task-checkbox ${t.completed ? 'checked' : ''}`;
            checkbox.setAttribute('role', 'checkbox');
            checkbox.setAttribute('aria-checked', String(t.completed));
            checkbox.onclick = (e) => {
                e.stopPropagation();
                t.completed = !t.completed;
                save(); render();
            };

            const content = document.createElement('div');
            content.className = 'task-content';
            const title = document.createElement('p');
            title.className = 'task-title';
            title.textContent = t.title;
            const meta = document.createElement('p');
            meta.className = 'task-meta';
            meta.textContent = `⚡ ${formatFullTime(t.focusedTime)} • 🍅 ${t.tomatoes || 0}`;
            content.appendChild(title);
            content.appendChild(meta);

            li.appendChild(checkbox);
            li.appendChild(content);
            li.onclick = () => openModal(t.id);
            li.onkeydown = (e) => { if (e.key === 'Enter') openModal(t.id); };
            list.appendChild(li);
        });
    }

    function renderStats() {
        const tomatoesEl = el('total-tomatoes');
        const dayEl = el('stats-day');
        const weekEl = el('stats-week');
        const monthEl = el('stats-month');
        if (!tomatoesEl || !dayEl || !weekEl || !monthEl) return;

        const now = new Date();
        const todayStr = getFmtDate(now);
        const todayTasks = appState.tasks.filter(t => t.date === todayStr);
        const dayTime = todayTasks.reduce((s, t) => s + (t.focusedTime || 0), 0);
        const dayToms = todayTasks.reduce((s, t) => s + (t.tomatoes || 0), 0);

        const weekAgo = new Date();
        weekAgo.setDate(now.getDate() - 7);
        const weekStr = getFmtDate(weekAgo);
        const weekTime = appState.tasks.filter(t => t.date >= weekStr).reduce((s, t) => s + (t.focusedTime || 0), 0);

        const mStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const monthTime = appState.tasks.filter(t => t.date >= mStart).reduce((s, t) => s + (t.focusedTime || 0), 0);

        tomatoesEl.textContent = `🍅 x ${dayToms}`;
        dayEl.textContent = formatFullTime(dayTime);
        weekEl.textContent = formatFullTime(weekTime);
        monthEl.textContent = formatFullTime(monthTime);
    }

    function updateAchievements() {
        const daily = appState.tasks.filter(t => t.date === appState.selectedDate);
        const bar = el('achievement-bar');
        const percent = el('achievement-percent');
        const progressBg = bar ? bar.parentElement : null;
        if (!bar || !percent) return;

        if (daily.length === 0) {
            bar.style.width = '0%';
            percent.textContent = '0%';
            if (progressBg) progressBg.setAttribute('aria-valuenow', '0');
            return;
        }
        const p = Math.round((daily.filter(t => t.completed).length / daily.length) * 100);
        bar.style.width = `${p}%`;
        percent.textContent = `${p}%`;
        if (progressBg) progressBg.setAttribute('aria-valuenow', String(p));
    }

    function showToast(msg, icon = "🎉") {
        let container = el('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'toast';
        const iconSpan = document.createElement('span');
        iconSpan.style.cssText = 'font-size:18px; margin-right:8px;';
        iconSpan.textContent = icon;
        const msgSpan = document.createElement('span');
        msgSpan.textContent = msg;
        toast.appendChild(iconSpan);
        toast.appendChild(msgSpan);
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('visible'), 10);
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 500);
        }, 4000);
    }

    function openModal(id = null) {
        appState.editingId = id;
        const task = id ? appState.tasks.find(t => t.id === id) : null;
        el('modal-title').textContent = id ? '작업 수정' : '새 작업';
        el('new-task-input').value = task ? task.title : '';
        el('task-date-input').value = task ? task.date : appState.selectedDate;

        if (id) {
            el('modal-delete').classList.remove('hidden');
            el('modal-submit-focus').classList.add('hidden');
        } else {
            el('modal-delete').classList.add('hidden');
            el('modal-submit-focus').classList.remove('hidden');
        }

        el('modal-overlay').classList.remove('hidden');
        el('new-task-input').focus();
    }

    function closeModals() {
        document.querySelectorAll('.overlay').forEach(o => {
            if (o.id !== 'focus-overlay') o.classList.add('hidden');
        });
    }

    function startFocus(id) {
        const task = appState.tasks.find(t => t.id === id);
        if (!task) return;

        const todayStr = getFmtDate(new Date());
        if (appState.sessionStats.date !== todayStr) {
            appState.sessionStats.date = todayStr;
            appState.sessionStats.count = 0;
        }

        appState.focus.active = true;
        appState.focus.paused = false;
        appState.focus.taskId = id;
        appState.focus.totalElapsed = 0;
        appState.focus.cycleElapsed = 0;
        appState.focus.sessionTomatoes = 0;

        const sessionCountEl = el('focus-session-count');
        const taskTitleEl = el('focus-task-title');
        if (sessionCountEl) sessionCountEl.textContent = `오늘 ${appState.sessionStats.count + 1}번째 집중`;
        if (taskTitleEl) taskTitleEl.textContent = task.title;
        el('pause-focus-btn').textContent = '일시 정지';
        el('focus-overlay').classList.remove('hidden');
        el('focus-overlay').classList.remove('is-paused');

        updateFocusUI();

        if (appState.focus.interval) clearInterval(appState.focus.interval);
        appState.focus.interval = setInterval(() => {
            if (appState.focus.paused) return;

            appState.focus.totalElapsed++;
            appState.focus.cycleElapsed++;
            if (appState.focus.cycleElapsed >= POMODORO_CYCLE) {
                appState.focus.cycleElapsed = 0;
                appState.focus.sessionTomatoes++;
                task.tomatoes = (task.tomatoes || 0) + 1;
                save();
                showToast(`벌써 1뽀모 완료! "${task.title}" 작업에 기록했어요 ✨`, "🍅");
            }
            updateFocusUI();
        }, 1000);
    }

    function togglePause() {
        appState.focus.paused = !appState.focus.paused;
        el('pause-focus-btn').textContent = appState.focus.paused ? '다시 시작' : '일시 정지';
        if (appState.focus.paused) el('focus-overlay').classList.add('is-paused');
        else el('focus-overlay').classList.remove('is-paused');
    }

    function updateFocusUI() {
        const task = appState.tasks.find(t => t.id === appState.focus.taskId);
        if (!task) return;
        const timerEl = el('focus-timer');
        const progressEl = el('timer-progress');
        const tomatoesEl = el('session-tomatoes');
        if (!timerEl || !progressEl || !tomatoesEl) return;

        const left = POMODORO_CYCLE - appState.focus.cycleElapsed;
        const progress = appState.focus.cycleElapsed / POMODORO_CYCLE;
        timerEl.textContent = formatTime(left);
        progressEl.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - progress);
        tomatoesEl.textContent = '🍅'.repeat(task.tomatoes || 0);
    }

    function stopFocus() {
        if (!appState.focus.active) return;
        clearInterval(appState.focus.interval);
        const task = appState.tasks.find(t => t.id === appState.focus.taskId);

        if (task) {
            task.focusedTime += appState.focus.totalElapsed;
            const minutes = Math.floor(appState.focus.totalElapsed / 60);
            const toms = appState.focus.sessionTomatoes;

            if (appState.focus.totalElapsed >= MIN_SESSION_SECONDS) {
                appState.sessionStats.count++;
            }

            let message = "";
            if (toms > 0) {
                message = `토마토 ${toms}개, ${minutes}분을 기록했어요! 정말 대단해요!`;
            } else if (appState.focus.totalElapsed >= MIN_SESSION_SECONDS) {
                const timeStr = appState.focus.totalElapsed < 60 ? `${appState.focus.totalElapsed}초` : `${minutes}분`;
                message = `${timeStr}을 기록 완료! 수고하셨어요!`;
            } else {
                message = '다음에는 조금 더 집중해봐요!';
            }
            showToast(message, toms > 0 ? "🏆" : "👏");
        }

        appState.focus.active = false;
        appState.focus.paused = false;
        const focusOverlay = el('focus-overlay');
        if (focusOverlay) focusOverlay.classList.add('hidden');
        save(); render();
    }

    function boot() {
        const shield = el('js-error-shield');
        try {
            load();

            el('prev-date').onclick = () => {
                const d = parseLocalDate(appState.selectedDate); d.setDate(d.getDate() - 1);
                appState.selectedDate = getFmtDate(d); render();
            };
            el('next-date').onclick = () => {
                const d = parseLocalDate(appState.selectedDate); d.setDate(d.getDate() + 1);
                appState.selectedDate = getFmtDate(d); render();
            };

            el('add-task-btn').onclick = () => openModal();
            el('modal-cancel').onclick = closeModals;
            el('modal-delete').onclick = () => {
                if (appState.editingId) {
                    appState.tasks = appState.tasks.filter(t => t.id !== appState.editingId);
                    save(); render(); closeModals();
                }
            };

            const submitTask = (autoStart = false) => {
                const val = el('new-task-input').value.trim();
                const d = el('task-date-input').value;
                if (!val || !d) return;
                let taskId = appState.editingId;
                if (taskId) {
                    const t = appState.tasks.find(x => x.id === taskId);
                    if (t) { t.title = val; t.date = d; }
                } else {
                    taskId = Date.now();
                    appState.tasks.push({ id: taskId, title: val, date: d, completed: false, focusedTime: 0, tomatoes: 0 });
                }
                save(); render(); closeModals();
                if (autoStart) startFocus(taskId);
            };

            el('modal-submit').onclick = () => submitTask(false);
            el('modal-submit-focus').onclick = () => submitTask(true);

            el('global-start-focus').onclick = () => {
                const active = appState.tasks.filter(t => !t.completed);
                const list = el('focus-select-list');
                if (!list) return;
                list.innerHTML = '';
                if (active.length === 0) {
                    const emptyMsg = document.createElement('p');
                    emptyMsg.style.cssText = 'padding:40px; text-align:center; opacity:0.5;';
                    emptyMsg.textContent = '집중할 수 있는 미완료 작업이 없습니다.';
                    list.appendChild(emptyMsg);
                } else {
                    active.forEach(t => {
                        const div = document.createElement('div');
                        div.className = 'select-item';
                        div.setAttribute('role', 'button');
                        div.setAttribute('tabindex', '0');
                        div.style.cssText = "padding:16px; margin-bottom:12px; background:var(--input-bg); border-radius:14px; cursor:pointer; font-weight:700;";
                        div.textContent = t.title;
                        const selectHandler = () => { el('focus-select-overlay').classList.add('hidden'); startFocus(t.id); };
                        div.onclick = selectHandler;
                        div.onkeydown = (e) => { if (e.key === 'Enter') selectHandler(); };
                        list.appendChild(div);
                    });
                }
                el('focus-select-overlay').classList.remove('hidden');
            };

            el('pause-focus-btn').onclick = togglePause;
            el('stop-focus-btn').onclick = stopFocus;
            el('close-focus').onclick = stopFocus;
            el('close-focus-select').onclick = closeModals;

            el('nav-all').onclick = () => {
                appState.currentFilter = 'all';
                el('nav-all').classList.add('active');
                el('nav-all').setAttribute('aria-pressed', 'true');
                el('nav-completed').classList.remove('active');
                el('nav-completed').setAttribute('aria-pressed', 'false');
                render();
            };
            el('nav-completed').onclick = () => {
                appState.currentFilter = 'completed';
                el('nav-all').classList.remove('active');
                el('nav-all').setAttribute('aria-pressed', 'false');
                el('nav-completed').classList.add('active');
                el('nav-completed').setAttribute('aria-pressed', 'true');
                render();
            };

            const mobileMenuBtn = el('mobile-menu-btn');
            const sidebarBackdrop = el('sidebar-backdrop');
            const sidebar = document.querySelector('.sidebar');
            if (mobileMenuBtn && sidebar) {
                const toggleSidebar = () => {
                    sidebar.classList.toggle('open');
                    if (sidebarBackdrop) sidebarBackdrop.classList.toggle('visible');
                };
                mobileMenuBtn.onclick = toggleSidebar;
                if (sidebarBackdrop) sidebarBackdrop.onclick = toggleSidebar;
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (appState.focus.active) {
                        stopFocus();
                    } else {
                        closeModals();
                    }
                }
                if (e.key === 'Enter' && !el('modal-overlay').classList.contains('hidden')) {
                    const activeEl = document.activeElement;
                    if (activeEl && activeEl.id === 'new-task-input') {
                        submitTask(false);
                    }
                }
            });

            render();
            console.log('Focus Do v14.0 Live');
        } catch (e) {
            console.error('Critical boot error:', e);
            if (el('debug-log')) el('debug-log').textContent = e.message;
        } finally {
            if (shield) shield.style.display = 'none';
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();

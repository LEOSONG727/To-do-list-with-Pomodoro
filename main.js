/**
 * Focus Do v14.0 - Fresh Start & UX Fixes
 */

(function () {
    console.log('Focus Do v14.0 Booting...');

    // Bug 2: prevent double-submit
    let _submitting = false;

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
        // Phase 2-3: user-configurable pomodoro duration
        settings: {
            pomodoroDuration: 25
        },
        editingId: null
    };

    // Phase 2-3: replaces the POMODORO_CYCLE constant
    function getPomodoroSeconds() {
        return (appState.settings.pomodoroDuration || 25) * 60;
    }

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

    // Bug 1: save focusSnapshot so timer survives page refresh
    function save() {
        localStorage.setItem('focus_tasks_v14', JSON.stringify({
            tasks: appState.tasks,
            sessionStats: appState.sessionStats,
            settings: appState.settings,
            focusSnapshot: appState.focus.active ? {
                taskId: appState.focus.taskId,
                totalElapsed: appState.focus.totalElapsed,
                cycleElapsed: appState.focus.cycleElapsed,
                sessionTomatoes: appState.focus.sessionTomatoes,
                pausedAt: Date.now()
            } : null
        }));
    }

    // Bug 1: restore focusSnapshot from storage
    function load() {
        const raw = localStorage.getItem('focus_tasks_v14');
        if (raw) {
            try {
                const data = JSON.parse(raw);
                appState.tasks = Array.isArray(data.tasks) ? data.tasks : [];
                appState.sessionStats = data.sessionStats || { date: getFmtDate(new Date()), count: 0 };
                appState.settings = data.settings || { pomodoroDuration: 25 };

                // Restore paused focus session after refresh
                if (data.focusSnapshot) {
                    const snap = data.focusSnapshot;
                    appState.focus.taskId = snap.taskId;
                    appState.focus.totalElapsed = snap.totalElapsed;
                    appState.focus.cycleElapsed = snap.cycleElapsed;
                    appState.focus.sessionTomatoes = snap.sessionTomatoes;
                    appState.focus.active = true;
                    appState.focus.paused = true;
                }

                const today = getFmtDate(new Date());
                if (appState.sessionStats.date !== today) {
                    appState.sessionStats.date = today;
                    appState.sessionStats.count = 0;
                }
            } catch (e) {
                console.warn('데이터 로드 실패, 초기화합니다:', e.message);
                appState.tasks = [];
                appState.sessionStats = { date: getFmtDate(new Date()), count: 0 };
                appState.settings = { pomodoroDuration: 25 };
            }
        } else {
            appState.tasks = [];
            appState.sessionStats = { date: getFmtDate(new Date()), count: 0 };
            appState.settings = { pomodoroDuration: 25 };
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

    // Phase 2-2: improved empty state with onboarding CTA
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
            const emptyState = document.createElement('li');
            emptyState.className = 'empty-state';

            if (appState.tasks.length === 0) {
                // First-time visitor: show CTA
                emptyState.innerHTML = `
                    <div class="empty-icon">📝</div>
                    <p class="empty-title">첫 번째 할 일을 추가해보세요</p>
                    <p class="empty-sub">작업을 추가하고 뽀모도로 타이머로 집중해봐요!</p>
                    <button class="btn btn-primary empty-cta">새 작업 추가하기</button>
                `;
                emptyState.querySelector('.empty-cta').onclick = () => openModal();
            } else {
                // Returning visitor: completed or no tasks for this date
                emptyState.innerHTML = `
                    <div class="empty-icon">✅</div>
                    <p class="empty-title">오늘은 모두 완료했어요!</p>
                    <p class="empty-sub">수고하셨습니다. 내일도 화이팅!</p>
                `;
            }
            list.appendChild(emptyState);
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

            // Phase 2-8: close mobile sidebar before opening modal
            li.onclick = () => {
                const sidebar = document.querySelector('.sidebar');
                const backdrop = el('sidebar-backdrop');
                if (sidebar) sidebar.classList.remove('open');
                if (backdrop) backdrop.classList.remove('visible');
                openModal(t.id);
            };
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

    // Phase 4: simplified showToast — container is now static in HTML
    function showToast(msg, icon = "🎉") {
        const container = el('toast-container');
        if (!container) return;
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

    // Phase 2-3: sync settings UI button active state
    function updateSettingsUI() {
        const dur = appState.settings.pomodoroDuration || 25;
        const btn25 = el('settings-25');
        const btn50 = el('settings-50');
        if (btn25) btn25.classList.toggle('active', dur === 25);
        if (btn50) btn50.classList.toggle('active', dur === 50);
    }

    // Shared interval starter — used by startFocus and maybeResumeFocus
    function _startFocusInterval(task) {
        if (appState.focus.interval) clearInterval(appState.focus.interval);
        appState.focus.interval = setInterval(() => {
            if (appState.focus.paused) return;

            appState.focus.totalElapsed++;
            appState.focus.cycleElapsed++;

            // Bug 1: auto-save every 10 seconds to preserve progress
            if (appState.focus.totalElapsed % 10 === 0) save();

            // Phase 2-3: use dynamic pomodoro duration
            if (appState.focus.cycleElapsed >= getPomodoroSeconds()) {
                appState.focus.cycleElapsed = 0;
                appState.focus.sessionTomatoes++;
                task.tomatoes = (task.tomatoes || 0) + 1;
                save();
                showToast(`벌써 1뽀모 완료! "${task.title}" 작업에 기록했어요 ✨`, "🍅");
            }
            updateFocusUI();
        }, 1000);
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
        _startFocusInterval(task);
    }

    // Bug 1: restore paused focus session after page reload
    function maybeResumeFocus() {
        if (!appState.focus.active || !appState.focus.paused) return;
        const task = appState.tasks.find(t => t.id === appState.focus.taskId);
        if (!task) {
            appState.focus.active = false;
            appState.focus.paused = false;
            return;
        }

        const sessionCountEl = el('focus-session-count');
        const taskTitleEl = el('focus-task-title');
        if (sessionCountEl) sessionCountEl.textContent = `오늘 ${appState.sessionStats.count + 1}번째 집중`;
        if (taskTitleEl) taskTitleEl.textContent = task.title;
        el('pause-focus-btn').textContent = '다시 시작';
        el('focus-overlay').classList.remove('hidden');
        el('focus-overlay').classList.add('is-paused');

        updateFocusUI();
        _startFocusInterval(task); // interval skips while paused = true
        showToast('이전 집중 세션을 복원했습니다.', '⏸️');
    }

    function togglePause() {
        appState.focus.paused = !appState.focus.paused;
        el('pause-focus-btn').textContent = appState.focus.paused ? '다시 시작' : '일시 정지';
        if (appState.focus.paused) el('focus-overlay').classList.add('is-paused');
        else el('focus-overlay').classList.remove('is-paused');
    }

    // Phase 2-5: fix tomato emoji overflow
    function updateFocusUI() {
        const task = appState.tasks.find(t => t.id === appState.focus.taskId);
        if (!task) return;
        const timerEl = el('focus-timer');
        const progressEl = el('timer-progress');
        const tomatoesEl = el('session-tomatoes');
        if (!timerEl || !progressEl || !tomatoesEl) return;

        const pomodoroSec = getPomodoroSeconds();
        const left = pomodoroSec - appState.focus.cycleElapsed;
        const progress = appState.focus.cycleElapsed / pomodoroSec;
        timerEl.textContent = formatTime(left);
        progressEl.style.strokeDashoffset = TIMER_CIRCUMFERENCE * (1 - progress);

        // Phase 2-5: prevent emoji overflow beyond 8 tomatoes
        const count = task.tomatoes || 0;
        tomatoesEl.textContent = count > 8 ? `🍅 x ${count}` : '🍅'.repeat(count);
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
        appState.focus.interval = null;
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

            // Phase 2-1: delete confirmation dialog
            el('modal-delete').onclick = () => {
                if (appState.editingId) {
                    if (!window.confirm('정말로 이 작업을 삭제하시겠습니까?')) return;
                    appState.tasks = appState.tasks.filter(t => t.id !== appState.editingId);
                    save(); render(); closeModals();
                }
            };

            // Bug 2: guard against double-click duplicate task creation
            const submitTask = (autoStart = false) => {
                if (_submitting) return;
                _submitting = true;
                const submitBtn = el('modal-submit');
                const submitFocusBtn = el('modal-submit-focus');
                if (submitBtn) submitBtn.disabled = true;
                if (submitFocusBtn) submitFocusBtn.disabled = true;

                const val = el('new-task-input').value.trim();
                const d = el('task-date-input').value;
                if (!val || !d) {
                    _submitting = false;
                    if (submitBtn) submitBtn.disabled = false;
                    if (submitFocusBtn) submitFocusBtn.disabled = false;
                    return;
                }

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

                _submitting = false;
                if (submitBtn) submitBtn.disabled = false;
                if (submitFocusBtn) submitFocusBtn.disabled = false;
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

            // Phase 2-3: settings panel handlers
            const settingsBtn = el('settings-btn');
            if (settingsBtn) {
                settingsBtn.onclick = () => {
                    el('settings-overlay').classList.remove('hidden');
                    updateSettingsUI();
                };
            }
            const closeSettings = el('close-settings');
            if (closeSettings) closeSettings.onclick = () => el('settings-overlay').classList.add('hidden');

            const settings25 = el('settings-25');
            if (settings25) settings25.onclick = () => {
                appState.settings.pomodoroDuration = 25;
                save(); updateSettingsUI();
                showToast('뽀모도로 시간이 25분으로 설정되었습니다.', '⏱️');
            };
            const settings50 = el('settings-50');
            if (settings50) settings50.onclick = () => {
                appState.settings.pomodoroDuration = 50;
                save(); updateSettingsUI();
                showToast('뽀모도로 시간이 50분으로 설정되었습니다.', '⏱️');
            };

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
                // Phase 2-4: Ctrl+N / Cmd+N opens new task modal
                if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                    e.preventDefault();
                    if (el('modal-overlay').classList.contains('hidden')) openModal();
                }
            });

            // Bug 1: restore paused focus session after refresh
            maybeResumeFocus();

            // Bug 3: multi-tab localStorage sync
            window.addEventListener('storage', (e) => {
                if (e.key !== 'focus_tasks_v14' || !e.newValue) return;
                if (appState.focus.active) return; // don't interrupt active timer
                load(); render();
                showToast('다른 탭에서 변경 사항을 반영했습니다.', '🔄');
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

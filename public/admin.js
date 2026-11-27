
document.addEventListener('DOMContentLoaded', () => {

    const $ = id => document.getElementById(id);

    const charts = {};

    let services = [];
    let serviceFields = [];
    let editingService = null;
    let loadedReport = null;
    let reportRequest = 0;

    async function request(url, options = {}) {

        const response = await fetch(url, {
            credentials: 'same-origin',
            ...options
        });

        let result;

        try {
            result = await response.json();
        } catch {
            const error = new Error(
                'This feature is currently unavailable.'
            );

            error.status = response.status;
            throw error;
        }

        if (!response.ok || result.success === false) {

            const error = new Error(
                result.message || 'Unable to complete the request.'
            );

            error.status = response.status;
            throw error;
        }

        return result.data ?? result;
    }

    function send(url, method, body) {

        return request(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    }

    function handleAuthError(error) {

        if (error.status === 401) {
            window.location.href =
                'login.html?redirect=%2Fadmin.html';

            return true;
        }

        if (error.status === 403) {
            window.location.href = 'dashboard.html';
            return true;
        }

        return false;
    }

    function element(tag, className, text) {

        const node = document.createElement(tag);

        if (className) node.className = className;

        if (text !== undefined) {
            node.textContent = text;
        }

        return node;
    }

    function humanize(value) {

        return String(value)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
    }

    function displayValue(value) {

        if (value === null || value === undefined) {
            return '—';
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }

    function showMessage(message, type = 'success') {

        $('adminMessage').textContent = message;
        $('adminMessage').className = `admin-message ${type}`;
        $('adminMessage').hidden = false;
    }

    function rowsFrom(result) {

        if (Array.isArray(result)) return result;

        return result.rows ?? result.services ?? [];
    }

    function columnsFrom(result, rows) {

        if (Array.isArray(result.columns)) {

            return result.columns.map(column =>
                typeof column === 'string'
                    ? column
                    : column.name
            );
        }

        return [...new Set(
            rows.flatMap(row => Object.keys(row))
        )];
    }

    function renderTable(table, rows, columns, actions = false) {

        const head = table.querySelector('thead');
        const body = table.querySelector('tbody');

        head.replaceChildren();
        body.replaceChildren();

        const headerRow = element('tr');

        columns.forEach(column => {
            headerRow.appendChild(
                element('th', '', humanize(column))
            );
        });

        if (actions) {
            headerRow.appendChild(
                element('th', '', 'Actions')
            );
        }

        head.appendChild(headerRow);

        if (!rows.length) {

            const row = element('tr');
            const cell = element('td', '', 'No records found.');

            cell.colSpan = Math.max(
                1,
                columns.length + (actions ? 1 : 0)
            );

            row.appendChild(cell);
            body.appendChild(row);

            return;
        }

        rows.forEach(record => {

            const row = element('tr');

            columns.forEach(column => {
                row.appendChild(
                    element('td', '', displayValue(record[column]))
                );
            });

            if (actions) {

                const cell = element('td');
                const wrapper = element('div', 'table-actions');

                const edit = element(
                    'button',
                    'edit-button',
                    'Edit'
                );

                const remove = element(
                    'button',
                    'delete-button',
                    'Delete'
                );

                edit.type = 'button';
                remove.type = 'button';

                edit.addEventListener('click', () => {
                    openServiceModal(record);
                });

                remove.addEventListener('click', () => {
                    deleteService(record);
                });

                wrapper.append(edit, remove);
                cell.appendChild(wrapper);
                row.appendChild(cell);
            }

            body.appendChild(row);
        });
    }

    async function loadOverview() {

        const result = await request('/api/admin/stats');

        $('appointmentCount').textContent =
            result.total_appointments ?? '—';

        $('customerCount').textContent =
            result.total_customers ?? '—';

        $('stylistCount').textContent =
            result.total_stylists ?? '—';

        const revenue = result.total_revenue;

        $('totalRevenue').textContent =
            revenue !== null &&
            revenue !== undefined &&
            Number.isFinite(Number(revenue))
                ? `$${Number(revenue).toFixed(2)}`
                : '—';
    }

    async function initialize() {

        $('loadingState').hidden = false;
        $('errorState').hidden = true;
        $('adminContent').hidden = true;

        try {

            const result = await request('/api/auth/me');
            const user = result.user ?? result;

            if (!user?.user_id && !user?.id) {

                window.location.href =
                    'login.html?redirect=%2Fadmin.html';

                return;
            }

            if (String(user.role).toLowerCase() !== 'admin') {

                window.location.href = 'dashboard.html';
                return;
            }

            $('adminContent').hidden = false;

            try {
                await loadOverview();
            } catch (error) {

                if (!handleAuthError(error)) {
                    showMessage(
                        'Overview statistics could not be loaded.',
                        'error'
                    );
                }
            }

        } catch (error) {

            if (handleAuthError(error)) return;

            $('errorState').hidden = false;
            $('errorText').textContent = error.message;

        } finally {
            $('loadingState').hidden = true;
        }
    }

    // Dashboard navigation

    function openPanel(panelId) {

        $('adminMessage').hidden = true;

        document.querySelectorAll('.admin-panel')
            .forEach(panel => {
                panel.hidden = panel.id !== panelId;
            });

        document.querySelectorAll('.admin-tab')
            .forEach(tab => {

                tab.classList.toggle(
                    'active',
                    tab.dataset.panel === panelId
                );
            });

        if (panelId === 'analytics') loadCharts();

        if (panelId === 'reports') loadReport();

        if (panelId === 'services') loadServices();
    }

    document.querySelectorAll('.admin-tab')
        .forEach(tab => {

            tab.addEventListener('click', () => {
                openPanel(tab.dataset.panel);
            });
        });

    document.querySelectorAll('[data-open]')
        .forEach(button => {

            button.addEventListener('click', () => {
                openPanel(button.dataset.open);
            });
        });

    // Database reports

    function reportUrl(view, search = '') {

        const params = new URLSearchParams();

        if (search) params.set('search', search);

        return `/api/admin/views/${encodeURIComponent(view)}?${params}`;
    }

    function invalidateReport() {

        reportRequest++;
        loadedReport = null;

        $('exportCsv').disabled = true;
        $('exportPdf').disabled = true;

        $('reportCount').textContent =
            'Run the report to view updated results.';

        $('reportTable').querySelector('thead').replaceChildren();
        $('reportTable').querySelector('tbody').replaceChildren();

        $('reportMessage').textContent = '';
    }

    async function loadReport() {

        const requestId = ++reportRequest;

        const view = $('viewSelect').value;
        const search = $('reportSearch').value.trim();

        loadedReport = null;

        $('exportCsv').disabled = true;
        $('exportPdf').disabled = true;

        $('reportMessage').textContent = 'Loading report...';

        try {

            const result = await request(
                reportUrl(view, search)
            );

            if (requestId !== reportRequest) return;

            const rows = rowsFrom(result);
            const columns = columnsFrom(result, rows);

            renderTable(
                $('reportTable'),
                rows,
                columns
            );

            $('reportCount').textContent =
                `${rows.length} record(s) found`;

            $('reportMessage').textContent = '';

            loadedReport = { view, search };

            $('exportCsv').disabled = false;
            $('exportPdf').disabled = false;

        } catch (error) {

            if (requestId !== reportRequest) return;

            if (handleAuthError(error)) return;

            renderTable($('reportTable'), [], []);

            $('reportCount').textContent = 'Report unavailable';
            $('reportMessage').textContent = error.message;
        }
    }

    $('loadReport').addEventListener('click', loadReport);

    $('viewSelect').addEventListener('change', () => {
        invalidateReport();
        loadReport();
    });

    $('reportSearch').addEventListener(
        'input',
        invalidateReport
    );

    $('reportSearch').addEventListener('keydown', event => {

        if (event.key === 'Enter') {
            event.preventDefault();
            loadReport();
        }
    });

    // Export reports

    async function exportReport(format) {

        if (!loadedReport) return;

        const { view, search } = loadedReport;

        const params = new URLSearchParams({ format });

        if (search) params.set('search', search);

        try {

            const response = await fetch(
                `/api/admin/export/${encodeURIComponent(view)}?${params}`,
                { credentials: 'same-origin' }
            );

            if (!response.ok) {

                const error = new Error('Unable to export report.');
                error.status = response.status;
                throw error;
            }

            const blob = await response.blob();

            const url = URL.createObjectURL(blob);

            const link = element('a');

            link.href = url;
            link.download = `${view}.${format}`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            setTimeout(() => URL.revokeObjectURL(url), 1000);

        } catch (error) {

            if (!handleAuthError(error)) {
                $('reportMessage').textContent = error.message;
            }
        }
    }

    $('exportCsv').addEventListener('click', () => {
        exportReport('csv');
    });

    $('exportPdf').addEventListener('click', () => {
        exportReport('pdf');
    });

    // Chart.js visualizations

    function createChart(id, type, labels, values, title) {

        if (charts[id]) charts[id].destroy();

        const colors = [
            '#A65D6A',
            '#E8C4C4',
            '#874653',
            '#C98D98',
            '#BCA39A',
            '#D6B2A5',
            '#75635D'
        ];

        charts[id] = new Chart($(id), {

            type,

            data: {

                labels,

                datasets: [{
                    label: title,
                    data: values,

                    backgroundColor: type === 'line'
                        ? 'rgba(166, 93, 106, 0.15)'
                        : labels.map(
                            (_, index) =>
                                colors[index % colors.length]
                        ),

                    borderColor: '#A65D6A',
                    borderWidth: type === 'line' ? 2 : 1,
                    tension: 0.3,
                    fill: type === 'line',
                    borderRadius: type === 'bar' ? 5 : 0
                }]
            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: type === 'doughnut'
                    }
                },

                scales: type === 'doughnut'
                    ? {}
                    : {
                        y: {
                            beginAtZero: true
                        }
                    }
            }
        });
    }

    async function loadCharts() {

        $('chartMessage').textContent = 'Loading analytics...';
        $('refreshCharts').disabled = true;

        try {

            if (typeof Chart === 'undefined') {
                throw new Error(
                    'Chart.js could not load. Check your internet connection.'
                );
            }

            const result = await request('/api/admin/analytics');

            const definitions = [

                {
                    id: 'revenueChart',
                    type: 'bar',
                    title: 'Revenue ($)',
                    data: result.stylist_revenue
                },

                {
                    id: 'popularityChart',
                    type: 'doughnut',
                    title: 'Appointments',
                    data: result.service_popularity
                },

                {
                    id: 'daysChart',
                    type: 'line',
                    title: 'Appointments',
                    data: result.busiest_days
                }
            ];

            let emptyCharts = 0;

            definitions.forEach(definition => {

                const rows = definition.data;

                if (!Array.isArray(rows)) {
                    throw new Error(
                        'Analytics response has an unexpected format.'
                    );
                }

                const validRows = rows.filter(row =>
                    row.label !== undefined &&
                    row.value !== null &&
                    row.value !== undefined &&
                    Number.isFinite(Number(row.value))
                );

                if (!validRows.length) emptyCharts++;

                createChart(
                    definition.id,
                    definition.type,
                    validRows.map(row => String(row.label)),
                    validRows.map(row => Number(row.value)),
                    definition.title
                );
            });

            $('chartMessage').textContent = emptyCharts
                ? 'Some charts have no matching database records.'
                : '';

        } catch (error) {

            if (!handleAuthError(error)) {
                $('chartMessage').textContent = error.message;
            }

        } finally {
            $('refreshCharts').disabled = false;
        }
    }

    $('refreshCharts').addEventListener('click', loadCharts);

    // Service management

    function serviceId(service) {
        return service.service_id ?? service.id;
    }

    async function loadServices() {

        $('serviceMessage').textContent = 'Loading services...';
        $('addService').disabled = true;

        try {

            const result = await request('/api/admin/services');

            services = rowsFrom(result);

            serviceFields = Array.isArray(result.fields)
                ? result.fields
                : [];

            const columns = columnsFrom(result, services);

            renderTable(
                $('servicesTable'),
                services,
                columns,
                true
            );

            $('serviceMessage').textContent =
                `${services.length} service(s) found`;

            $('addService').disabled = !serviceFields.length;

            if (!serviceFields.length) {
                $('serviceMessage').textContent +=
                    '. Service form configuration is unavailable.';
            }

        } catch (error) {

            if (!handleAuthError(error)) {
                $('serviceMessage').textContent = error.message;
            }
        }
    }

    function openServiceModal(service = null) {

        if (!serviceFields.length) {

            showMessage(
                'Service form configuration is unavailable.',
                'error'
            );

            return;
        }

        editingService = service;

        $('modalTitle').textContent =
            service ? 'Edit Service' : 'Add Service';

        $('serviceFields').replaceChildren();
        $('formMessage').textContent = '';

        serviceFields.forEach((field, index) => {

            const wrapper = element('div', 'admin-field');

            const label = element(
                'label',
                '',
                field.label ?? humanize(field.name)
            );

            const inputId = `serviceField${index}`;

            label.htmlFor = inputId;

            let input;

            if (field.type === 'select') {

                input = element('select');

                const placeholder = element(
                    'option',
                    '',
                    'Select an option'
                );

                placeholder.value = '';

                input.appendChild(placeholder);

                (field.options ?? []).forEach(item => {

                    const option = element(
                        'option',
                        '',
                        item.label
                    );

                    option.value = item.value;
                    input.appendChild(option);
                });

            } else if (field.type === 'textarea') {

                input = element('textarea');
                input.rows = 4;

            } else {

                input = element('input');

                input.type = field.type === 'number'
                    ? 'number'
                    : 'text';

                if (field.min !== undefined) {
                    input.min = field.min;
                }

                if (field.max !== undefined) {
                    input.max = field.max;
                }

                if (field.step !== undefined) {
                    input.step = field.step;
                }
            }

            input.id = inputId;
            input.name = field.name;
            input.required = Boolean(field.required);

            if (field.maxlength !== undefined) {
                input.maxLength = field.maxlength;
            }

            input.value = service?.[field.name] ??
                field.default ?? '';

            wrapper.append(label, input);

            $('serviceFields').appendChild(wrapper);
        });

        $('serviceModal').showModal();
    }

    $('addService').addEventListener('click', () => {
        openServiceModal();
    });

    $('closeModal').addEventListener('click', () => {
        $('serviceModal').close();
    });

    $('serviceForm').addEventListener('submit', async event => {

        event.preventDefault();

        const formData = new FormData(event.target);

        const payload = {};

        serviceFields.forEach(field => {

            const value = String(
                formData.get(field.name) ?? ''
            ).trim();

            payload[field.name] = field.type === 'number'
                ? value === '' ? null : Number(value)
                : value;
        });

        $('saveService').disabled = true;

        try {

            if (editingService) {

                await send(
                    `/api/admin/services/${serviceId(editingService)}`,
                    'PUT',
                    payload
                );

            } else {

                await send(
                    '/api/admin/services',
                    'POST',
                    payload
                );
            }

            $('serviceModal').close();

            await loadServices();

            showMessage(
                editingService
                    ? 'Service updated successfully.'
                    : 'Service added successfully.'
            );

        } catch (error) {

            if (!handleAuthError(error)) {
                $('formMessage').textContent = error.message;
            }

        } finally {
            $('saveService').disabled = false;
        }
    });

    async function deleteService(service) {

        if (!window.confirm(
            `Delete ${service.service_name ?? 'this service'}?`
        )) return;

        try {

            await request(
                `/api/admin/services/${serviceId(service)}`,
                { method: 'DELETE' }
            );

            await loadServices();

            showMessage('Service deleted successfully.');

        } catch (error) {

            if (!handleAuthError(error)) {
                showMessage(error.message, 'error');
            }
        }
    }

    // Authentication

    $('logoutButton').addEventListener('click', async () => {

        try {

            await request('/api/auth/logout', {
                method: 'POST'
            });

            window.location.href = 'login.html';

        } catch (error) {

            if (!handleAuthError(error)) {
                window.alert(error.message);
            }
        }
    });

    $('retryButton').addEventListener('click', initialize);

    initialize();
});

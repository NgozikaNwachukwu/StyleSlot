
document.addEventListener('DOMContentLoaded', () => {

    const $ = id => document.getElementById(id);

    let appointments = [];
    let selectedAppointment = null;
    let availableSlots = [];
    let rescheduleRequest = 0;

    async function request(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            ...options
        });

        let result;

        try {
            result = await response.json();
        } catch {
            const error = new Error('This feature is currently unavailable.');
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
                'login.html?redirect=%2Fdashboard.html';

            return true;
        }

        return false;
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);

        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;

        return node;
    }

    function showMessage(message, type = 'success') {
        $('dashboardMessage').textContent = message;
        $('dashboardMessage').className =
            `dashboard-message ${type}`;

        $('dashboardMessage').hidden = false;
    }

    function statusOf(appointment) {
        return String(
            appointment.status ??
            appointment.appointment_status ??
            ''
        ).toLowerCase();
    }

    function isUpcoming(appointment) {
        const status = statusOf(appointment);

        return [
            'pending',
            'confirmed',
            'scheduled',
            'booked'
        ].includes(status);
    }

    function isCancelled(appointment) {
        return ['cancelled', 'canceled'].includes(
            statusOf(appointment)
        );
    }

    function formatDate(value) {
        const match = String(value ?? '')
            .match(/\d{4}-\d{2}-\d{2}/);

        if (!match) return '—';

        return new Date(`${match[0]}T12:00:00`)
            .toLocaleDateString('en-CA', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
    }

    function formatTime(value) {
        const match = String(value ?? '')
            .match(/(\d{2}):(\d{2})/);

        if (!match) return '—';

        const hour = Number(match[1]);

        return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    function money(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        const amount = Number(value);

        return Number.isFinite(amount)
            ? `$${amount.toFixed(2)}`
            : '—';
    }

    function appointmentId(appointment) {
        return appointment.appointment_id ?? appointment.id;
    }

    function detail(label, value) {
        const container = element('div', 'appointment-detail');

        container.append(
            element('span', '', label),
            element('strong', '', value)
        );

        return container;
    }

    function actionButton(label, className, callback) {
        const button = element('button', className, label);

        button.type = 'button';
        button.addEventListener('click', callback);

        return button;
    }

    function renderAppointments() {

        $('totalCount').textContent = appointments.length;

        $('upcomingCount').textContent =
            appointments.filter(isUpcoming).length;

        $('completedCount').textContent =
            appointments.filter(a =>
                statusOf(a) === 'completed'
            ).length;

        $('cancelledCount').textContent =
            appointments.filter(isCancelled).length;

        const filter = $('statusFilter').value;

        const filtered = appointments.filter(appointment => {
            if (filter === 'all') return true;
            if (filter === 'upcoming') return isUpcoming(appointment);
            if (filter === 'cancelled') return isCancelled(appointment);

            return statusOf(appointment) === filter;
        });

        $('appointmentsList').replaceChildren();
        $('emptyState').hidden = filtered.length > 0;

        filtered.forEach(appointment => {

            const card = element('article', 'appointment-card');
            const top = element('div', 'appointment-top');
            const title = element('div');

            title.append(
                element(
                    'h3',
                    '',
                    appointment.service_name ?? 'Appointment'
                ),
                element(
                    'p',
                    '',
                    `${appointment.stylist_name ?? 'Stylist'} · ${appointment.salon_name ?? 'Independent stylist'}`
                )
            );

            const status = statusOf(appointment);

            const statusClass = isCancelled(appointment)
                ? 'cancelled'
                : status === 'completed'
                    ? 'completed'
                    : '';

            top.append(
                title,
                element(
                    'span',
                    `appointment-status ${statusClass}`,
                    status || 'Unknown'
                )
            );

            const details = element('div', 'appointment-details');

            details.append(
                detail(
                    'Date',
                    formatDate(
                        appointment.appointment_date ??
                        appointment.start_time
                    )
                ),
                detail(
                    'Time',
                    formatTime(appointment.start_time)
                ),
                detail(
                    'Price',
                    money(
                        appointment.price ??
                        appointment.total_amount ??
                        appointment.amount
                    )
                ),
                detail(
                    'Payment',
                    appointment.payment_status ?? 'Not recorded'
                )
            );

            const actions = element('div', 'appointment-actions');

            if (isUpcoming(appointment)) {
                actions.append(
                    actionButton(
                        'Reschedule',
                        'btn btn-outline',
                        () => openReschedule(appointment)
                    ),
                    actionButton(
                        'Cancel Appointment',
                        'cancel-button',
                        () => cancelAppointment(appointment)
                    )
                );
            }

            const reviewed =
                appointment.has_review === true ||
                Number(appointment.has_review) === 1;

            if (status === 'completed' && !reviewed) {
                actions.append(
                    actionButton(
                        'Leave a Review',
                        'btn btn-primary',
                        () => openReview(appointment)
                    )
                );
            }

            if (status === 'completed' && reviewed) {
                actions.append(
                    element('p', '', 'Review submitted')
                );
            }

            card.append(top, details, actions);
            $('appointmentsList').appendChild(card);
        });
    }

    async function loadAppointments() {
        const result = await request('/api/appointments');

        appointments = Array.isArray(result)
            ? result
            : result.appointments ?? [];

        renderAppointments();
    }

    async function initialize() {

        $('loadingState').hidden = false;
        $('errorState').hidden = true;
        $('dashboardContent').hidden = true;

        try {
            const result = await request('/api/auth/me');
            const user = result.user ?? result;

            if (!user?.user_id) {
                window.location.href =
                    'login.html?redirect=%2Fdashboard.html';
                return;
            }

            if (String(user.role).toLowerCase() === 'admin') {
                window.location.href = 'admin.html';
                return;
            }

            $('customerName').textContent =
                (user.full_name ?? user.name ?? 'Customer')
                    .split(' ')[0];

            await loadAppointments();

            $('dashboardContent').hidden = false;

        } catch (error) {

            if (handleAuthError(error)) return;

            $('errorState').hidden = false;
            $('errorText').textContent = error.message;

        } finally {
            $('loadingState').hidden = true;
        }
    }

    async function cancelAppointment(appointment) {

        if (!window.confirm(
            'Are you sure you want to cancel this appointment?'
        )) return;

        try {
            await request(
                `/api/appointments/${appointmentId(appointment)}`,
                { method: 'DELETE' }
            );

            await loadAppointments();

            showMessage('Appointment cancelled successfully.');

        } catch (error) {
            if (!handleAuthError(error)) {
                showMessage(error.message, 'error');
            }
        }
    }

    function resetSelect(select, placeholder) {
        select.replaceChildren();

        const option = element('option', '', placeholder);
        option.value = '';

        select.appendChild(option);
    }

    function addOption(select, value, label) {
        const option = element('option', '', label);

        option.value = value;
        select.appendChild(option);
    }

    function populateTimes() {

        resetSelect($('newTime'), 'Select a time');

        availableSlots
            .filter(slot => slot.date === $('newDate').value)
            .forEach(slot => {
                addOption(
                    $('newTime'),
                    slot.key,
                    formatTime(slot.time)
                );
            });

        $('rescheduleButton').disabled = true;
    }

    async function openReschedule(appointment) {

        selectedAppointment = appointment;

        const requestId = ++rescheduleRequest;

        availableSlots = [];

        resetSelect($('newDate'), 'Select a date');
        resetSelect($('newTime'), 'Select a time');

        $('rescheduleButton').disabled = true;
        $('rescheduleMessage').textContent = 'Loading availability...';

        $('rescheduleModal').showModal();

        try {
            const result = await request(
                `/api/stylists/${appointment.stylist_id}/availability?service_id=${appointment.service_id}`
            );

            if (requestId !== rescheduleRequest) return;

            const slots = Array.isArray(result)
                ? result
                : result.availability ?? result.slots ?? [];

            availableSlots = slots
                .filter(slot => slot.is_available !== false)
                .map((slot, index) => {

                    const rawStart = String(
                        slot.start_time ?? slot.time ?? ''
                    );

                    const rawDate = String(
                        slot.date ??
                        slot.available_date ??
                        slot.availability_date ??
                        rawStart
                    );

                    return {
                        key: String(index),
                        slot_id:
                            slot.slot_id ??
                            slot.availability_id ??
                            slot.id ??
                            null,
                        date: rawDate.match(/\d{4}-\d{2}-\d{2}/)?.[0],
                        time: rawStart.match(/\d{2}:\d{2}(?::\d{2})?/)?.[0]
                    };
                })
                .filter(slot => slot.date && slot.time);

            const dates = [...new Set(
                availableSlots.map(slot => slot.date)
            )].sort();

            dates.forEach(date => {
                addOption($('newDate'), date, formatDate(date));
            });

            $('rescheduleMessage').textContent = dates.length
                ? ''
                : 'No available appointments found.';

        } catch (error) {
            if (requestId !== rescheduleRequest) return;

            if (!handleAuthError(error)) {
                $('rescheduleMessage').textContent = error.message;
            }
        }
    }

    $('newDate').addEventListener('change', populateTimes);

    $('newTime').addEventListener('change', () => {
        $('rescheduleButton').disabled = !$('newTime').value;
    });

    $('rescheduleForm').addEventListener('submit', async event => {

        event.preventDefault();

        const slot = availableSlots.find(slot =>
            slot.key === $('newTime').value &&
            slot.date === $('newDate').value
        );

        if (!slot || !selectedAppointment) return;

        $('rescheduleButton').disabled = true;

        try {
            await send(
                `/api/appointments/${appointmentId(selectedAppointment)}`,
                'PUT',
                {
                    slot_id: slot.slot_id,
                    appointment_date: slot.date,
                    start_time: slot.time
                }
            );

            $('rescheduleModal').close();

            await loadAppointments();

            showMessage('Appointment rescheduled successfully.');

        } catch (error) {
            if (!handleAuthError(error)) {
                $('rescheduleMessage').textContent = error.message;
            }
        } finally {
            $('rescheduleButton').disabled = false;
        }
    });

    function openReview(appointment) {

        selectedAppointment = appointment;

        $('reviewForm').reset();
        $('reviewMessage').textContent = '';

        $('reviewModal').showModal();
    }

    $('reviewForm').addEventListener('submit', async event => {

        event.preventDefault();

        const button = event.target.querySelector(
            'button[type="submit"]'
        );

        const rating = Number($('rating').value);
        const comment = $('reviewComment').value.trim();

        if (!selectedAppointment || rating < 1 || rating > 5 || !comment) {
            $('reviewMessage').textContent =
                'Please provide a rating and review.';
            return;
        }

        button.disabled = true;

        try {
            await send('/api/reviews', 'POST', {
                appointment_id: appointmentId(selectedAppointment),
                rating,
                comment
            });

            $('reviewModal').close();

            await loadAppointments();

            showMessage('Your review has been submitted.');

        } catch (error) {
            if (!handleAuthError(error)) {
                $('reviewMessage').textContent = error.message;
            }
        } finally {
            button.disabled = false;
        }
    });

    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            button.closest('dialog').close();
        });
    });

    $('rescheduleModal').addEventListener('close', () => {
        rescheduleRequest++;
    });

    $('weatherButton').addEventListener('click', async () => {

        const button = $('weatherButton');

        button.disabled = true;
        button.textContent = 'Checking...';

        try {
            const result = await send('/api/weather', 'POST', {
                city: 'Oshawa'
            });

            const weather = result.weather ?? result;

            const temperature = weather.temperature;

            $('weatherTemperature').textContent =
                temperature !== undefined && temperature !== null
                    ? `${temperature}°C`
                    : '—';

            $('weatherDescription').textContent =
                weather.description ?? 'Current weather in Oshawa';

            $('weatherUpdated').textContent =
                weather.fetched_at
                    ? `Updated: ${new Date(weather.fetched_at).toLocaleString()}`
                    : '';

        } catch (error) {
            if (!handleAuthError(error)) {
                $('weatherDescription').textContent =
                    'Unable to retrieve weather. Please try again.';
            }
        } finally {
            button.disabled = false;
            button.textContent = 'Check Weather';
        }
    });

    $('logoutButton').addEventListener('click', async () => {

        try {
            await request('/api/auth/logout', {
                method: 'POST'
            });

            window.location.href = 'login.html';

        } catch (error) {
            window.alert(error.message);
        }
    });

    $('statusFilter').addEventListener('change', renderAppointments);
    $('retryButton').addEventListener('click', initialize);

    initialize();
});

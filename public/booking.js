
document.addEventListener('DOMContentLoaded', () => {

    const params = new URLSearchParams(window.location.search);

    const stylistId = params.get('stylist_id');
    const initialServiceId = params.get('service_id');
    const initialDate = params.get('date');
    const initialTime = params.get('time');

    const $ = id => document.getElementById(id);

    const serviceSelect = $('serviceSelect');
    const dateSelect = $('dateSelect');
    const timeSelect = $('timeSelect');
    const confirmButton = $('confirmButton');

    let services = [];
    let availability = [];
    let availabilityRequest = 0;

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

    function money(value) {
        if (value === null || value === undefined || value === '') {
            return '—';
        }

        const amount = Number(value);

        return Number.isFinite(amount)
            ? `$${amount.toFixed(2)}`
            : '—';
    }

    function formatDate(value) {
        if (!value) return '—';

        const date = new Date(`${value}T12:00:00`);

        return Number.isNaN(date.getTime())
            ? value
            : date.toLocaleDateString('en-CA', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
    }

    function formatTime(value) {
        if (!value) return '—';

        const match = String(value).match(/(\d{2}):(\d{2})/);

        if (!match) return value;

        const hour = Number(match[1]);
        const minute = match[2];

        return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`;
    }

    function addOption(select, value, label) {
        const option = document.createElement('option');

        option.value = value;
        option.textContent = label;

        select.appendChild(option);
    }

    function resetSelect(select, placeholder) {
        select.replaceChildren();
        addOption(select, '', placeholder);
    }

    function getService() {
        return services.find(service =>
            String(service.service_id ?? service.id) === serviceSelect.value
        );
    }

    function getSlot() {
        return availability.find(slot =>
            slot.key === timeSelect.value &&
            slot.date === dateSelect.value
        );
    }

    function updateSummary() {

        const service = getService();
        const slot = getSlot();

        $('summaryService').textContent = service
            ? service.service_name ?? service.name
            : '—';

        const duration = service?.duration_minutes ?? service?.duration;

        $('summaryDuration').textContent = duration
            ? `${duration} minutes`
            : '—';

        $('summaryDate').textContent = formatDate(dateSelect.value);

        $('summaryTime').textContent = slot
            ? formatTime(slot.time)
            : '—';

        $('summaryTotal').textContent = service
            ? money(service.price ?? service.service_price)
            : '—';

        confirmButton.disabled = !service || !slot;
    }

    function showError(message) {
        $('bookingMessage').textContent = message;
        $('bookingMessage').hidden = false;
    }

    function normalizeSlot(slot, index) {

        const rawStart = String(slot.start_time ?? slot.time ?? '');

        const rawDate = String(
            slot.date ??
            slot.available_date ??
            slot.availability_date ??
            rawStart
        );

        const dateMatch = rawDate.match(/\d{4}-\d{2}-\d{2}/);
        const timeMatch = rawStart.match(/\d{2}:\d{2}(?::\d{2})?/);

        return {
            key: String(index),
            slotId: slot.slot_id ?? slot.availability_id ?? slot.id ?? null,
            date: dateMatch ? dateMatch[0] : '',
            time: timeMatch ? timeMatch[0] : ''
        };
    }

    function populateTimes(preferredTime = '') {

        resetSelect(timeSelect, 'Select a time');

        const matchingSlots = availability.filter(slot =>
            slot.date === dateSelect.value
        );

        matchingSlots.forEach(slot => {
            addOption(
                timeSelect,
                slot.key,
                formatTime(slot.time)
            );
        });

        const preferred = matchingSlots.find(slot =>
            preferredTime &&
            formatTime(slot.time) === formatTime(preferredTime)
        );

        if (preferred) {
            timeSelect.value = preferred.key;
        }

        timeSelect.disabled = matchingSlots.length === 0;

        updateSummary();
    }

    async function loadAvailability(useInitialSelection = false) {

        const requestId = ++availabilityRequest;

        availability = [];

        resetSelect(dateSelect, 'Select a date');
        resetSelect(timeSelect, 'Select a time');

        dateSelect.disabled = true;
        timeSelect.disabled = true;

        updateSummary();

        if (!serviceSelect.value) return;

        $('availabilityMessage').textContent =
            'Checking available appointments...';

        try {

            const result = await request(
                `/api/stylists/${stylistId}/availability?service_id=${encodeURIComponent(serviceSelect.value)}`
            );

            if (requestId !== availabilityRequest) return;

            const slots = Array.isArray(result)
                ? result
                : result.availability ?? result.slots ?? [];

            availability = slots
                .filter(slot => slot.is_available !== false)
                .map(normalizeSlot)
                .filter(slot => slot.date && slot.time);

            const dates = [...new Set(
                availability.map(slot => slot.date)
            )].sort();

            dates.forEach(date => {
                addOption(dateSelect, date, formatDate(date));
            });

            dateSelect.disabled = dates.length === 0;

            $('availabilityMessage').textContent = dates.length
                ? 'Choose an available date and time.'
                : 'No appointments are currently available for this service.';

            if (
                useInitialSelection &&
                initialDate &&
                dates.includes(initialDate)
            ) {
                dateSelect.value = initialDate;
            } else if (dates.length === 1) {
                dateSelect.value = dates[0];
            }

            populateTimes(
                useInitialSelection ? initialTime : ''
            );

        } catch (error) {

            if (requestId !== availabilityRequest) return;

            $('availabilityMessage').textContent =
                'Unable to retrieve availability. Please try again.';

            console.error(error);
        }

        updateSummary();
    }

    async function initialize() {

        try {

            if (!stylistId || !/^\d+$/.test(stylistId)) {
                throw new Error(
                    'Please select a stylist from the browse page first.'
                );
            }

            const [profileResult, serviceResult] = await Promise.all([
                request(`/api/stylists/${stylistId}`),
                request(`/api/stylists/${stylistId}/services`)
            ]);

            const stylist = profileResult.stylist ?? profileResult;

            services = Array.isArray(serviceResult)
                ? serviceResult
                : serviceResult.services ?? [];

            const name = stylist.stylist_name ?? stylist.name ?? 'Stylist';

            $('stylistName').textContent = name;

            $('stylistInitials').textContent = name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map(word => word[0].toUpperCase())
                .join('');

            $('salonName').textContent =
                stylist.salon_name ?? 'Independent stylist';

            $('salonLocation').textContent =
                stylist.location ?? '';

            resetSelect(serviceSelect, 'Select a service');

            services.forEach(service => {

                const id = service.service_id ?? service.id;
                const name = service.service_name ?? service.name;
                const price = service.price ?? service.service_price;

                addOption(
                    serviceSelect,
                    String(id),
                    `${name} — ${money(price)}`
                );
            });

            if (
                initialServiceId &&
                services.some(service =>
                    String(service.service_id ?? service.id) === initialServiceId
                )
            ) {
                serviceSelect.value = initialServiceId;
            } else if (services.length === 1) {
                serviceSelect.value = String(
                    services[0].service_id ?? services[0].id
                );
            }

            $('loadingState').hidden = true;
            $('bookingContent').hidden = false;

            await loadAvailability(true);

        } catch (error) {

            $('loadingState').hidden = true;
            $('errorState').hidden = false;
            $('errorText').textContent = error.message;

            console.error(error);
        }
    }

    serviceSelect.addEventListener('change', () => {
        $('bookingMessage').hidden = true;
        loadAvailability();
    });

    dateSelect.addEventListener('change', () => {
        populateTimes();
    });

    timeSelect.addEventListener('change', updateSummary);

    $('bookingForm').addEventListener('submit', async event => {

        event.preventDefault();

        $('bookingMessage').hidden = true;

        const service = getService();
        const slot = getSlot();

        if (!service || !slot) {
            showError('Please select a service, date and time.');
            return;
        }

        confirmButton.disabled = true;
        confirmButton.textContent = 'Confirming...';

        try {

            // Check that the customer is authenticated.
            const authResult = await request('/api/auth/me');
            const user = authResult.user ?? authResult;

            if (!user?.user_id) {
                const error = new Error('Please log in first.');
                error.status = 401;
                throw error;
            }

            const paymentMethod = document.querySelector(
                'input[name="paymentMethod"]:checked'
            ).value;

            await request('/api/appointments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stylist_id: Number(stylistId),
                    service_id: Number(serviceSelect.value),
                    slot_id: slot.slotId,
                    appointment_date: slot.date,
                    start_time: slot.time,
                    notes: $('notes').value.trim(),
                    payment_method: paymentMethod
                })
            });

            $('bookingContent').hidden = true;
            $('successState').hidden = false;

            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });

        } catch (error) {

            if (error.status === 401) {

                const destination = new URL(
                    'booking.html',
                    window.location.href
                );

                destination.searchParams.set('stylist_id', stylistId);
                destination.searchParams.set('service_id', serviceSelect.value);
                destination.searchParams.set('date', slot.date);
                destination.searchParams.set('time', slot.time);

                window.location.href =
                    `login.html?redirect=${encodeURIComponent(
                        destination.pathname + destination.search
                    )}`;

                return;
            }

            if (error.status === 409) {
                await loadAvailability();
            }

            showError(error.message);

        } finally {

            confirmButton.textContent = 'Confirm Booking';
            updateSummary();
        }
    });

    initialize();
});

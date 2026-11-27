
document.addEventListener('DOMContentLoaded', () => {

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const formMessage = document.getElementById('formMessage');

    // Show and hide passwords
    document.querySelectorAll('.password-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const input = button.parentElement.querySelector('input');

            const isHidden = input.type === 'password';

            input.type = isHidden ? 'text' : 'password';
            button.textContent = isHidden ? 'Hide' : 'Show';
        });
    });

    function showMessage(message, type = 'error') {
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}`;
        formMessage.hidden = false;
    }

    function clearMessage() {
        formMessage.hidden = true;
        formMessage.textContent = '';
    }

    function setLoading(form, loading, originalText) {
        const button = form.querySelector('button[type="submit"]');

        button.disabled = loading;
        button.textContent = loading
            ? 'Please wait...'
            : originalText;
    }

    async function sendRequest(url, body) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(body)
        });

        let result;

        try {
            result = await response.json();
        } catch {
            throw new Error(
                'This feature is currently unavailable. Please try again later.'
            );
        }

        if (!response.ok || result.success === false) {
            throw new Error(
                result.message || 'Something went wrong. Please try again.'
            );
        }

        return result;
    }

    function getRedirect() {
        const params = new URLSearchParams(window.location.search);
        const redirect = params.get('redirect');

        // Only allow redirects to approved local pages.
        if (redirect) {
            try {
                const target = new URL(redirect, window.location.origin);

                const allowedPages = [
                    '/booking.html',
                    '/browse.html',
                    '/stylist.html',
                    '/dashboard.html'
                ];

                if (
                    target.origin === window.location.origin &&
                    allowedPages.includes(target.pathname)
                ) {
                    return target.pathname + target.search;
                }
            } catch {
                // Use default destination.
            }
        }

        return 'dashboard.html';
    }

    // Login
    if (loginForm) {

        loginForm.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();

            const email = document
                .getElementById('email')
                .value.trim();

            const password = document
                .getElementById('password')
                .value;

            if (!email || !password) {
                showMessage('Please enter your email and password.');
                return;
            }

            setLoading(loginForm, true, 'Log In');

            try {
                const result = await sendRequest('/api/auth/login', {
                    email,
                    password
                });

                const user =
                    result.data?.user ||
                    result.user ||
                    result.data;

                showMessage('Login successful!', 'success');

                if (user?.role?.toLowerCase() === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = getRedirect();
                }

            } catch (error) {
                showMessage(error.message);
            } finally {
                setLoading(loginForm, false, 'Log In');
            }
        });
    }

    // Registration
    if (registerForm) {

        registerForm.addEventListener('submit', async event => {
            event.preventDefault();
            clearMessage();

            const fullName = document
                .getElementById('fullName')
                .value.trim();

            const email = document
                .getElementById('email')
                .value.trim();

            const phone = document
                .getElementById('phone')
                .value.trim();

            const password = document
                .getElementById('password')
                .value;

            const confirmPassword = document
                .getElementById('confirmPassword')
                .value;

            if (!fullName || !email || !phone || !password) {
                showMessage('Please complete all required fields.');
                return;
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(email)) {
                showMessage('Please enter a valid email address.');
                return;
            }

            const phoneDigits = phone.replace(/\D/g, '');

            if (phoneDigits.length < 10 || phoneDigits.length > 15) {
                showMessage('Please enter a valid phone number.');
                return;
            }

            if (password.length < 8) {
                showMessage('Your password must contain at least 8 characters.');
                return;
            }

            if (password !== confirmPassword) {
                showMessage('Your passwords do not match.');
                return;
            }

            setLoading(registerForm, true, 'Create Account');

            try {
                await sendRequest('/api/auth/register', {
                    full_name: fullName,
                    email,
                    phone,
                    password
                });

                showMessage(
                    'Account created successfully! Redirecting to login...',
                    'success'
                );

                registerForm.reset();

                setTimeout(() => {
                    const params = new URLSearchParams(
                        window.location.search
                    );

                    const redirect = params.get('redirect');

                    window.location.href = redirect
                        ? `login.html?redirect=${encodeURIComponent(redirect)}`
                        : 'login.html';

                }, 1000);

            } catch (error) {
                showMessage(error.message);
            } finally {
                setLoading(registerForm, false, 'Create Account');
            }
        });
    }

    // Preserve booking destination between login and registration.
    const redirect = new URLSearchParams(
        window.location.search
    ).get('redirect');

    if (redirect) {
        const switchLink = document.querySelector('.auth-switch a');

        if (switchLink) {
            const destination = switchLink.getAttribute('href');

            switchLink.href =
                `${destination}?redirect=${encodeURIComponent(redirect)}`;
        }
    }

});

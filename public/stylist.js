
// DOM elements
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");
const profileContent = document.getElementById("profile-content");
const retryButton = document.getElementById("retry-button");

const serviceList = document.getElementById("service-list");
const availabilityService = document.getElementById("availability-service");
const availabilityGrid = document.getElementById("availability-grid");
const availabilityMessage = document.getElementById("availability-message");
const reviewsList = document.getElementById("reviews-list");


// Page state
const params = new URLSearchParams(window.location.search);
const stylistId = params.get("id");

let stylist = null;
let services = [];
let reviews = [];
let availabilityRequest = 0;
let animationObserver = null;


// Create HTML elements safely
function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    if (text !== undefined) {
        element.textContent = text;
    }

    return element;
}


// Generate initials
function getInitials(name) {
    return String(name || "")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("") || "?";
}


// Convert database values to numbers
function toNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}


// Format prices
function formatPrice(price) {
    const number = toNumber(price);

    if (number === null) {
        return "Price unavailable";
    }

    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD"
    }).format(number);
}


// Format service duration
function formatDuration(minutes) {
    const duration = toNumber(minutes);

    if (duration === null || duration <= 0) {
        return "Duration unavailable";
    }

    const hours = Math.floor(duration / 60);
    const remainingMinutes = duration % 60;

    const parts = [];

    if (hours > 0) {
        parts.push(`${hours} hr`);
    }

    if (remainingMinutes > 0) {
        parts.push(`${remainingMinutes} min`);
    }

    return parts.join(" ");
}


// Format dates
function formatDate(value) {
    if (!value) {
        return "";
    }

    const dateString = String(value).slice(0, 10);
    const date = new Date(`${dateString}T12:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleDateString("en-CA", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}


// Format appointment times
function formatTime(value) {
    if (!value) {
        return "";
    }

    const match = String(value).match(
        /(?:^|T|\s)(\d{2}):(\d{2})/
    );

    if (!match) {
        return "";
    }

    const hours = Number(match[1]);
    const minutes = match[2];

    if (hours > 23 || Number(minutes) > 59) {
        return "";
    }

    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${minutes} ${period}`;
}


// Generate star ratings
function generateStars(rating) {
    const rounded = Math.max(
        0,
        Math.min(5, Math.round(Number(rating) || 0))
    );

    return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}


// API request helper
async function fetchData(url) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/json"
        }
    });

    if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.success === false) {
        throw new Error(result.message || "Request failed");
    }

    return result.data ?? result;
}


// Manage page states
function showState(state, message = "") {
    loadingState.hidden = state !== "loading";
    errorState.hidden = state !== "error";
    profileContent.hidden = state !== "profile";

    if (message) {
        errorMessage.textContent = message;
    }
}


// Normalize stylist information
function normalizeStylist(record) {
    return {
        id: record.stylist_id ?? record.id ?? stylistId,

        name: record.stylist_name ??
            record.name ??
            "Unnamed stylist",

        salon: record.salon_name ?? record.salon ?? "",

        location: record.location ??
            record.salon_location ??
            record.city ??
            "",

        rating: toNumber(
            record.avg_rating ?? record.rating
        ),

        reviewCount: toNumber(record.review_count),

        bio: record.bio ?? record.description ?? ""
    };
}


// Normalize service information
function normalizeService(service) {
    return {
        id: service.service_id ?? service.id,

        name: service.service_name ??
            service.name ??
            "Unnamed service",

        price: toNumber(
            service.price ?? service.service_price
        ),

        duration: toNumber(
            service.duration_minutes ?? service.duration
        ),

        description: service.description ?? ""
    };
}


// Normalize review information
function normalizeReview(review) {
    return {
        name: review.client_name ??
            review.reviewer_name ??
            review.customer_name ??
            "Customer",

        rating: toNumber(review.rating),

        comment: review.comment ??
            review.review_text ??
            "",

        date: review.review_date ??
            review.created_at ??
            ""
    };
}


// Create booking page URL
function createBookingUrl(serviceId, date = "", time = "", slotId = "") {
    const bookingParams = new URLSearchParams({
        stylist_id: stylistId,
        service_id: String(serviceId)
    });

    if (date) {
        bookingParams.set("date", date);
    }

    if (time) {
        bookingParams.set("time", time);
    }

    if (slotId !== "" && slotId !== null) {
        bookingParams.set("slot_id", String(slotId));
    }

    return `booking.html?${bookingParams.toString()}`;
}


// Display stylist information
function displayProfile() {
    document.title = `${stylist.name} | StyleSlot`;

    document.getElementById("stylist-name").textContent =
        stylist.name;

    document.getElementById("salon-name").textContent =
        stylist.salon;

    document.getElementById("salon-location").textContent =
        stylist.location;

    // Stylist initials
    const profileImage = document.getElementById("profile-image");

    const placeholder = createElement(
        "div",
        "profile-placeholder",
        getInitials(stylist.name)
    );

    profileImage.setAttribute("aria-hidden", "true");
    profileImage.replaceChildren(placeholder);

    // Rating
    const ratingValue = document.getElementById("rating-value");
    const reviewCount = document.getElementById("review-count");
    const ratingStar = document.querySelector(
        "#profile-rating .rating-star"
    );

    if (stylist.rating !== null) {
        ratingStar.hidden = false;
        ratingValue.textContent = stylist.rating.toFixed(1);

        reviewCount.textContent =
            stylist.reviewCount !== null
                ? `(${stylist.reviewCount} reviews)`
                : "";

    } else {
        ratingStar.hidden = true;
        ratingValue.textContent =
            stylist.reviewCount === 0
                ? "No reviews yet"
                : "Rating unavailable";

        reviewCount.textContent = "";
    }

    // Optional biography
    const bio = document.getElementById("stylist-bio");

    bio.textContent = stylist.bio;
    bio.hidden = !stylist.bio;

    // Service tags
    const specialties = document.getElementById(
        "profile-specialties"
    );

    specialties.replaceChildren();

    const uniqueServices = [
        ...new Set(services.map(service => service.name))
    ];

    uniqueServices.slice(0, 6).forEach(name => {
        specialties.appendChild(
            createElement("span", "specialty-tag", name)
        );
    });
}


// Display services and prices
function displayServices() {
    serviceList.replaceChildren();

    const emptyMessage = document.getElementById("services-empty");

    emptyMessage.hidden = services.length !== 0;

    services.forEach(service => {
        const row = createElement("article", "service-row");

        const details = createElement("div", "service-details");

        const name = createElement(
            "h3",
            "",
            service.name
        );

        const duration = createElement(
            "p",
            "service-duration",
            formatDuration(service.duration)
        );

        details.append(name, duration);

        if (service.description) {
            details.appendChild(
                createElement(
                    "p",
                    "service-description",
                    service.description
                )
            );
        }

        const booking = createElement("div", "service-booking");

        const price = createElement(
            "span",
            "service-price",
            formatPrice(service.price)
        );

        booking.appendChild(price);

        if (service.id !== null && service.id !== undefined) {
            const bookButton = createElement(
                "a",
                "btn btn-outline",
                "Book"
            );

            bookButton.href = createBookingUrl(service.id);

            booking.appendChild(bookButton);
        }

        row.append(details, booking);
        serviceList.appendChild(row);
    });
}


// Populate availability service dropdown
function populateServiceDropdown() {
    availabilityService.replaceChildren();

    const defaultOption = createElement(
        "option",
        "",
        "Choose a service"
    );

    defaultOption.value = "";

    availabilityService.appendChild(defaultOption);

    services.forEach(service => {
        if (service.id === undefined || service.id === null) {
            return;
        }

        const option = createElement(
            "option",
            "",
            `${service.name} — ${formatDuration(service.duration)}`
        );

        option.value = service.id;

        availabilityService.appendChild(option);
    });

    availabilityService.disabled =
        availabilityService.options.length <= 1;

    availabilityMessage.textContent =
        availabilityService.disabled
            ? "No services available."
            : "Choose a service to view available times.";

    availabilityMessage.hidden = false;
}


// Retrieve availability for selected service
async function loadAvailability() {
    const serviceId = availabilityService.value;
    const requestId = ++availabilityRequest;

    availabilityGrid.replaceChildren();
    availabilityMessage.hidden = false;

    if (!serviceId) {
        availabilityMessage.textContent =
            "Choose a service to view available times.";

        return;
    }

    availabilityMessage.textContent = "Loading available times...";

    try {
        const query = new URLSearchParams({
            service_id: serviceId
        });

        const result = await fetchData(
            `/api/stylists/${encodeURIComponent(stylistId)}/availability?${query}`
        );

        if (requestId !== availabilityRequest) {
            return;
        }

        const slots = Array.isArray(result)
            ? result
            : result.availability ?? result.slots;

        if (!Array.isArray(slots)) {
            throw new Error("Unexpected availability response");
        }

        displayAvailability(slots, serviceId);

    } catch (error) {
        if (requestId !== availabilityRequest) {
            return;
        }

        console.error("Error loading availability:", error);

        availabilityMessage.textContent =
            "Unable to load available times. Please try again.";

        const retry = createElement(
            "button",
            "btn btn-outline",
            "Try Again"
        );

        retry.type = "button";
        retry.addEventListener("click", loadAvailability);

        availabilityGrid.appendChild(retry);
    }
}


// Display available appointment times
function displayAvailability(slots, serviceId) {
    availabilityGrid.replaceChildren();

    const groupedSlots = {};

    slots.forEach(slot => {
        const rawDate = slot.date ??
            slot.available_date ??
            slot.start_time ??
            "";

        const date = String(rawDate).slice(0, 10);

        const time = slot.start_time ??
            slot.time ??
            "";

        const slotId = slot.slot_id ??
            slot.availability_id ??
            slot.id ??
            "";

        if (!formatDate(date) || !formatTime(time)) {
            return;
        }

        if (!groupedSlots[date]) {
            groupedSlots[date] = [];
        }

        groupedSlots[date].push({
            time,
            slotId
        });
    });

    const dates = Object.keys(groupedSlots).sort();

    if (dates.length === 0) {
        availabilityMessage.hidden = false;
        availabilityMessage.textContent =
            "No upcoming appointments available for this service.";

        return;
    }

    availabilityMessage.hidden = true;

    dates.forEach(date => {
        const day = createElement("div", "availability-day");

        const heading = createElement(
            "h3",
            "availability-date",
            formatDate(date)
        );

        const timeSlots = createElement("div", "time-slots");

        groupedSlots[date].forEach(slot => {
            const timeLink = createElement(
                "a",
                "time-slot",
                formatTime(slot.time)
            );

            timeLink.href = createBookingUrl(
                serviceId,
                date,
                slot.time,
                slot.slotId
            );

            timeSlots.appendChild(timeLink);
        });

        day.append(heading, timeSlots);
        availabilityGrid.appendChild(day);
    });
}


// Display customer reviews
function displayReviews() {
    reviewsList.replaceChildren();

    const emptyMessage = document.getElementById("reviews-empty");
    const summary = document.getElementById("reviews-summary");
    const breakdown = document.getElementById("rating-breakdown");

    breakdown.replaceChildren();

    emptyMessage.hidden = reviews.length !== 0;
    summary.hidden = stylist.rating === null;

    if (stylist.rating !== null) {
        document.getElementById("overall-rating").textContent =
            stylist.rating.toFixed(1);

        document.getElementById("overall-stars").textContent =
            generateStars(stylist.rating);

        document.getElementById("total-reviews").textContent =
            stylist.reviewCount !== null
                ? `${stylist.reviewCount} reviews`
                : "";
    }

    // Rating distribution
    const validReviews = reviews.filter(review =>
        Number.isInteger(review.rating) &&
        review.rating >= 1 &&
        review.rating <= 5
    );

    // Only show distribution when all reviews are available
    if (
        validReviews.length > 0 &&
        stylist.reviewCount === validReviews.length
    ) {
        for (let rating = 5; rating >= 1; rating--) {
            const count = validReviews.filter(
                review => review.rating === rating
            ).length;

            const percentage =
                (count / validReviews.length) * 100;

            const row = createElement("div", "rating-row");

            const label = createElement(
                "span",
                "rating-label",
                `${rating} ★`
            );

            const bar = createElement("div", "rating-bar");
            const fill = createElement("div", "rating-bar-fill");

            fill.style.width = `${percentage}%`;

            bar.appendChild(fill);

            const total = createElement(
                "span",
                "rating-total",
                String(count)
            );

            row.append(label, bar, total);
            breakdown.appendChild(row);
        }
    }

    // Individual reviews
    reviews.forEach(review => {
        const card = createElement("article", "review-card");

        const header = createElement("div", "review-header");

        const avatar = createElement(
            "div",
            "reviewer-avatar",
            getInitials(review.name)
        );

        avatar.setAttribute("aria-hidden", "true");

        const details = createElement("div", "reviewer-details");

        const name = createElement(
            "p",
            "reviewer-name",
            review.name
        );

        const date = createElement(
            "p",
            "review-date",
            formatDate(review.date)
        );

        details.append(name, date);
        header.append(avatar, details);

        card.appendChild(header);

        if (review.rating !== null) {
            const stars = createElement(
                "div",
                "review-card-stars",
                generateStars(review.rating)
            );

            stars.setAttribute(
                "aria-label",
                `${review.rating} out of 5 stars`
            );

            card.appendChild(stars);
        }

        if (review.comment) {
            card.appendChild(
                createElement(
                    "p",
                    "review-comment",
                    review.comment
                )
            );
        }

        reviewsList.appendChild(card);
    });
}


// Smooth section navigation
function initializeTabs() {
    const tabs = document.querySelectorAll(".profile-tab");

    tabs.forEach(tab => {
        tab.addEventListener("click", event => {
            const target = document.querySelector(
                tab.getAttribute("href")
            );

            if (!target) {
                return;
            }

            event.preventDefault();

            tabs.forEach(item => {
                item.classList.remove("active");
            });

            tab.classList.add("active");

            target.scrollIntoView({
                behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)"
                ).matches ? "auto" : "smooth",
                block: "start"
            });
        });
    });
}


// Scroll reveal animations
function initializeAnimations() {
    const sections = document.querySelectorAll(
        ".profile-page .reveal"
    );

    if (
        !("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        return;
    }

    if (animationObserver) {
        animationObserver.disconnect();
    }

    animationObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                animationObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.08
    });

    sections.forEach(section => {
        section.classList.add("profile-animate");
        animationObserver.observe(section);
    });
}


// Retrieve stylist profile from backend
async function loadProfile() {
    if (!stylistId || !/^\d+$/.test(stylistId)) {
        showState(
            "error",
            "Please select a stylist from the browse page."
        );

        retryButton.hidden = true;
        return;
    }

    retryButton.hidden = false;
    showState("loading");

    try {
        const result = await fetchData(
            `/api/stylists/${encodeURIComponent(stylistId)}`
        );

        const record = result.stylist ?? result;

        if (!record || typeof record !== "object" ||
            Array.isArray(record)) {
            throw new Error("Stylist not found");
        }

        stylist = normalizeStylist(record);

        // Services may be included in the profile response
        let serviceRecords = result.services ?? record.services;

        if (!Array.isArray(serviceRecords)) {
            const serviceResult = await fetchData(
                `/api/stylists/${encodeURIComponent(stylistId)}/services`
            );

            serviceRecords = Array.isArray(serviceResult)
                ? serviceResult
                : serviceResult.services;
        }

        if (!Array.isArray(serviceRecords)) {
            throw new Error("Unexpected services response");
        }

        services = serviceRecords.map(normalizeService);

        // Reviews may be included in the profile response
        let reviewRecords = result.reviews ?? record.reviews;
        let reviewsUnavailable = false;

        if (!Array.isArray(reviewRecords)) {
            try {
                const reviewResult = await fetchData(
                    `/api/stylists/${encodeURIComponent(stylistId)}/reviews`
                );

                reviewRecords = Array.isArray(reviewResult)
                    ? reviewResult
                    : reviewResult.reviews;

                if (!Array.isArray(reviewRecords)) {
                    throw new Error("Unexpected reviews response");
                }

            } catch (error) {
                console.error("Error loading reviews:", error);

                reviewsUnavailable = true;
                reviewRecords = [];
            }
        }

        reviews = reviewRecords.map(normalizeReview);

        displayProfile();
        displayServices();
        populateServiceDropdown();
        displayReviews();

        const reviewsMessage = document.getElementById("reviews-empty");

        if (reviewsUnavailable) {
            reviewsMessage.textContent =
                "Unable to load customer reviews.";

            reviewsMessage.hidden = false;

        } else {
            reviewsMessage.textContent = "No reviews yet.";
        }

        showState("profile");
        initializeAnimations();

    } catch (error) {
        console.error("Error loading stylist profile:", error);

        showState(
            "error",
            "Unable to retrieve stylist information. Please try again."
        );
    }
}


// Event listeners
retryButton.addEventListener("click", loadProfile);

availabilityService.addEventListener(
    "change",
    loadAvailability
);


// Initialize page
initializeTabs();
loadProfile();



// DOM elements
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const serviceFilters = document.getElementById("service-filters");
const sortSelect = document.getElementById("sort-select");
const stylistGrid = document.getElementById("stylist-grid");
const resultsCount = document.getElementById("results-count");

const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");

const clearFilters = document.getElementById("clear-filters");
const retryButton = document.getElementById("retry-button");


// Page state
let stylists = [];
let selectedService = "all";
let searchQuery = "";
let selectedSort = "recommended";
let dataLoaded = false;


// Service categories
const serviceKeywords = {
    braids: ["braid", "cornrow"],
    locs: ["loc", "retwist"],
    twists: ["twist"],
    wig: ["wig"],
    natural: ["natural", "wash and go", "afro"],
    silk: ["silk press"]
};


// Read service filter from homepage URL
function initializeFilters() {
    const params = new URLSearchParams(window.location.search);
    const service = params.get("service");

    if (service && Object.hasOwn(serviceKeywords, service)) {
        selectedService = service;
    }

    updateActiveFilter();
}


// Update selected filter appearance
function updateActiveFilter() {
    const buttons = serviceFilters.querySelectorAll(".filter-chip");

    buttons.forEach(button => {
        const isActive = button.dataset.service === selectedService;

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}


// Manage loading, empty and error states
function showState(state) {
    loadingState.hidden = state !== "loading";
    emptyState.hidden = state !== "empty";
    errorState.hidden = state !== "error";

    stylistGrid.hidden = state !== "results";
}


// Convert numeric database values
function toNumber(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const number = Number(value);

    return Number.isFinite(number) ? number : null;
}


// Map API response to frontend fields
function normalizeStylist(stylist) {
    return {
        id: stylist.stylist_id ?? stylist.id,
        name: stylist.stylist_name ?? stylist.name ?? "Unnamed stylist",
        salon: stylist.salon_name ?? stylist.salon ?? "",
        rating: toNumber(stylist.avg_rating ?? stylist.rating),
        reviewCount: toNumber(stylist.review_count) ?? 0,
        startingPrice: toNumber(stylist.starting_price),

        services: Array.isArray(stylist.services)
            ? stylist.services
                .map(service => typeof service === "string"
                    ? service
                    : service.service_name ?? service.name)
                .filter(Boolean)
            : typeof stylist.services === "string"
                ? stylist.services.split(",").map(service => service.trim())
                : []
    };
}


// Retrieve stylists from backend
async function loadStylists() {
    dataLoaded = false;
    stylistGrid.replaceChildren();

    showState("loading");
    resultsCount.textContent = "Loading stylists...";

    try {
        const response = await fetch("/api/stylists");

        if (!response.ok) {
            throw new Error(`Request failed: ${response.status}`);
        }

        const result = await response.json();

        if (result.success === false) {
            throw new Error("Unable to retrieve stylists");
        }

        const records = Array.isArray(result)
            ? result
            : result.data ?? result.stylists;

        if (!Array.isArray(records)) {
            throw new Error("Unexpected API response format");
        }

        stylists = records.map(normalizeStylist);

        dataLoaded = true;
        displayStylists();

    } catch (error) {
        console.error("Error loading stylists:", error);

        showState("error");
        resultsCount.textContent = "Stylists unavailable";
    }
}


// Filter stylists by service
function matchesService(stylist) {
    if (selectedService === "all") {
        return true;
    }

    const keywords = serviceKeywords[selectedService] ?? [];

    return stylist.services.some(service =>
        keywords.some(keyword =>
            service.toLowerCase().includes(keyword)
        )
    );
}


// Search stylists by name, salon or service
function matchesSearch(stylist) {
    const query = searchQuery.toLowerCase().trim();

    if (!query) {
        return true;
    }

    const searchableText = [
        stylist.name,
        stylist.salon,
        ...stylist.services
    ].join(" ").toLowerCase();

    return searchableText.includes(query);
}


// Sort results
function sortStylists(results) {
    switch (selectedSort) {

        case "rating":
            return results.sort((a, b) =>
                (b.rating ?? -1) - (a.rating ?? -1)
            );

        case "price-low":
            return results.sort((a, b) =>
                (a.startingPrice ?? Infinity) -
                (b.startingPrice ?? Infinity)
            );

        case "price-high":
            return results.sort((a, b) =>
                (b.startingPrice ?? -Infinity) -
                (a.startingPrice ?? -Infinity)
            );

        case "name":
            return results.sort((a, b) =>
                a.name.localeCompare(b.name)
            );

        default:
            return results;
    }
}


// Create an HTML element safely
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


// Generate stylist initials
function getInitials(name) {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");
}


// Format prices
function formatPrice(price) {
    return new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD"
    }).format(price);
}


// Create a stylist card
function createStylistCard(stylist) {
    const card = createElement("article", "stylist-card");

    // Stylist avatar
    const imageContainer = createElement("div", "stylist-image");

    const placeholder = createElement(
        "div",
        "stylist-placeholder",
        getInitials(stylist.name)
    );

    imageContainer.setAttribute("aria-hidden", "true");
    imageContainer.appendChild(placeholder);

    // Stylist information
    const info = createElement("div", "stylist-info");

    const name = createElement("h3", "", stylist.name);
    const salon = createElement("p", "salon-name", stylist.salon);

    info.append(name, salon);

    // Rating
    const rating = createElement("div", "stylist-rating");

    if (stylist.rating !== null && stylist.reviewCount > 0) {
        const star = createElement("span", "rating-star", "★");

        const ratingValue = createElement(
            "span",
            "",
            stylist.rating.toFixed(1)
        );

        const reviewCount = createElement(
            "span",
            "review-count",
            `(${stylist.reviewCount} reviews)`
        );

        rating.append(star, ratingValue, reviewCount);

    } else {
        rating.textContent = "No reviews yet";
    }

    info.appendChild(rating);

    // Services
    const services = createElement("div", "stylist-services");

    stylist.services.slice(0, 4).forEach(service => {
        const tag = createElement("span", "service-tag", service);
        services.appendChild(tag);
    });

    if (stylist.services.length > 4) {
        const extra = createElement(
            "span",
            "service-tag",
            `+${stylist.services.length - 4} more`
        );

        services.appendChild(extra);
    }

    info.appendChild(services);

    // Card footer
    const footer = createElement("div", "stylist-card-footer");
    const price = createElement("div", "stylist-price");

    const priceLabel = createElement(
        "span",
        "price-label",
        "Starting from"
    );

    const priceValue = createElement(
        "span",
        "price-value",
        stylist.startingPrice !== null
            ? formatPrice(stylist.startingPrice)
            : "View prices"
    );

    price.append(priceLabel, priceValue);

    footer.appendChild(price);

    // Profile link
    if (stylist.id !== undefined && stylist.id !== null) {
        const profileLink = createElement(
            "a",
            "btn btn-primary",
            "View Profile"
        );

        profileLink.href =
            `stylist.html?id=${encodeURIComponent(stylist.id)}`;

        footer.appendChild(profileLink);
    }

    info.appendChild(footer);

    card.append(imageContainer, info);

    return card;
}


// Display filtered and sorted stylists
function displayStylists() {
    if (!dataLoaded) {
        return;
    }

    stylistGrid.replaceChildren();

    let results = stylists.filter(stylist =>
        matchesService(stylist) && matchesSearch(stylist)
    );

    results = sortStylists(results);

    resultsCount.textContent =
        `${results.length} stylist${results.length === 1 ? "" : "s"} found`;

    if (results.length === 0) {
        showState("empty");
        return;
    }

    showState("results");

    results.forEach(stylist => {
        stylistGrid.appendChild(createStylistCard(stylist));
    });
}


// Search form
searchForm.addEventListener("submit", event => {
    event.preventDefault();

    searchQuery = searchInput.value;
    displayStylists();
});


// Reset search when input is cleared
searchInput.addEventListener("input", () => {
    if (searchInput.value.trim() === "") {
        searchQuery = "";
        displayStylists();
    }
});


// Service filter selection
serviceFilters.addEventListener("click", event => {
    const button = event.target.closest(".filter-chip");

    if (!button) {
        return;
    }

    selectedService = button.dataset.service;

    updateActiveFilter();

    const url = new URL(window.location.href);

    if (selectedService === "all") {
        url.searchParams.delete("service");
    } else {
        url.searchParams.set("service", selectedService);
    }

    // Update URL when running through the web server
    if (window.location.protocol !== "file:") {
        window.history.replaceState({}, "", url);
    }

    displayStylists();
});


// Sorting
sortSelect.addEventListener("change", () => {
    selectedSort = sortSelect.value;
    displayStylists();
});


// Clear all filters
clearFilters.addEventListener("click", () => {
    selectedService = "all";
    searchQuery = "";
    selectedSort = "recommended";

    searchInput.value = "";
    sortSelect.value = "recommended";

    const url = new URL(window.location.href);
    url.searchParams.delete("service");

    if (window.location.protocol !== "file:") {
        window.history.replaceState({}, "", url);
    }

    updateActiveFilter();
    displayStylists();
});


// Retry failed API request
retryButton.addEventListener("click", loadStylists);


// Initialize page
initializeFilters();
loadStylists();

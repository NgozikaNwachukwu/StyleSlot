
// ========================================
// STYLESLOT - HOMEPAGE INTERACTIONS
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    // ========================================
    // HAIRSTYLE CAROUSEL
    // ========================================

    const carousel = document.getElementById("category-carousel");
    const prevButton = document.getElementById("prev-category");
    const nextButton = document.getElementById("next-category");

    if (carousel && prevButton && nextButton) {

        function getScrollAmount() {
            const card = carousel.querySelector(".category-card");

            if (!card) return 300;

            const gap = parseFloat(
                getComputedStyle(carousel).columnGap
            ) || 0;

            return card.getBoundingClientRect().width + gap;
        }

        function updateButtons() {
            const maxScroll =
                carousel.scrollWidth - carousel.clientWidth;

            prevButton.disabled = carousel.scrollLeft <= 2;

            nextButton.disabled =
                carousel.scrollLeft >= maxScroll - 2;
        }

        nextButton.addEventListener("click", () => {
            carousel.scrollBy({
                left: getScrollAmount(),
                behavior: reducedMotion ? "instant" : "smooth"
            });
        });

        prevButton.addEventListener("click", () => {
            carousel.scrollBy({
                left: -getScrollAmount(),
                behavior: reducedMotion ? "instant" : "smooth"
            });
        });

        carousel.addEventListener("scroll", updateButtons);
        window.addEventListener("resize", updateButtons);

        updateButtons();
    }

    // ========================================
    // SCROLL REVEAL ANIMATIONS
    // ========================================

    const revealElements = document.querySelectorAll(".reveal");

    if ("IntersectionObserver" in window && !reducedMotion) {

        document.body.classList.add("js-enabled");

        const revealObserver = new IntersectionObserver(
            (entries, observer) => {

                entries.forEach(entry => {

                    if (entry.isIntersecting) {
                        entry.target.classList.add("visible");

                        // Animate each element only once
                        observer.unobserve(entry.target);
                    }

                });

            },
            {
                threshold: 0.1
            }
        );

        revealElements.forEach(element => {
            revealObserver.observe(element);
        });

    } else {

        revealElements.forEach(element => {
            element.classList.add("visible");
        });

    }

});

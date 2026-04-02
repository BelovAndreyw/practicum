const tabs = document.querySelectorAll(".tab");
const roleViews = document.querySelectorAll(".role-view");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetId = tab.dataset.target;

    tabs.forEach((item) => item.classList.remove("is-active"));
    roleViews.forEach((view) => view.classList.remove("is-active"));

    tab.classList.add("is-active");

    const targetView = document.getElementById(targetId);
    if (targetView) {
      targetView.classList.add("is-active");
    }
  });
});

const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.14,
    },
  );

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add("is-visible"));
}

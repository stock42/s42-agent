const status = document.getElementById("copy-status");
const spanish = document.documentElement.lang.startsWith("es");
const copyText = spanish
  ? { success: "Comando copiado. Pegalo en tu terminal.", done: "Copiado ✓", manual: "Seleccionamos el comando. Copialo con Ctrl+C o ⌘C." }
  : { success: "Command copied. Paste it into your terminal.", done: "Copied ✓", manual: "Command selected. Copy it with Ctrl+C or ⌘C." };

for (const button of document.querySelectorAll("[data-copy]")) {
  const originalLabel = button.textContent;
  let resetLabel;
  button.hidden = false;
  button.addEventListener("click", async () => {
    const command = document.getElementById(button.dataset.copy)?.textContent;
    if (!command) return;
    window.gtag?.("event", "copy_install_command", {
      installation_method: button.dataset.copy.replace("install-", ""),
      ui_language: document.documentElement.lang,
    });
    try {
      await navigator.clipboard.writeText(command);
      if (status) status.textContent = copyText.success;
      clearTimeout(resetLabel);
      button.textContent = copyText.done;
      resetLabel = setTimeout(() => { button.textContent = originalLabel; }, 2000);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (status) status.textContent = copyText.manual;
    }
  });
}

for (const link of document.querySelectorAll("[data-language]")) {
  const destination = new URL(link.href);
  destination.search = location.search;
  destination.hash = location.hash;
  link.href = destination.href;
  link.addEventListener("click", () => {
    const currentDestination = new URL(link.href);
    currentDestination.search = location.search;
    currentDestination.hash = location.hash;
    link.href = currentDestination.href;
  });
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const reveals = [...document.querySelectorAll("[data-reveal]")];
let revealObserver;
function configureMotion() {
  revealObserver?.disconnect();
  delete document.body.dataset.motion;
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    }
  }, { threshold: .08, rootMargin: "0px 0px -25px 0px" });
  for (const element of reveals) revealObserver.observe(element);
  document.body.dataset.motion = "on";
}
configureMotion();
reducedMotion.addEventListener("change", configureMotion);

const hero = document.querySelector(".hero-stage");
const visual = document.querySelector(".hero-visual");
if (hero && visual && matchMedia("(pointer: fine)").matches) {
  hero.addEventListener("pointermove", event => {
    if (reducedMotion.matches) return;
    const rect = hero.getBoundingClientRect();
    visual.style.setProperty("--pointer-x", `${((event.clientX - rect.left) / rect.width - .5) * 16}px`);
    visual.style.setProperty("--pointer-y", `${((event.clientY - rect.top) / rect.height - .5) * 12}px`);
  });
  hero.addEventListener("pointerleave", () => {
    visual.style.setProperty("--pointer-x", "0px");
    visual.style.setProperty("--pointer-y", "0px");
  });
}

const progress = document.querySelector(".page-progress");
let scrollFrame;
function updateProgress() {
  scrollFrame = undefined;
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  if (progress) progress.style.transform = `scaleX(${distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0})`;
}
window.addEventListener("scroll", () => {
  if (scrollFrame === undefined) scrollFrame = requestAnimationFrame(updateProgress);
}, { passive: true });
updateProgress();

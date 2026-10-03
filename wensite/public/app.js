const status = document.getElementById("copy-status");

for (const button of document.querySelectorAll("[data-copy]")) {
  const originalLabel = button.textContent;
  let resetLabel;
  button.hidden = false;
  button.addEventListener("click", async () => {
    const command = document.getElementById(button.dataset.copy)?.textContent;
    if (!command) return;
    try {
      await navigator.clipboard.writeText(command);
      if (status) status.textContent = "Comando copiado. Pegalo en tu terminal.";
      clearTimeout(resetLabel);
      button.textContent = "Copiado ✓";
      resetLabel = setTimeout(() => { button.textContent = originalLabel; }, 2000);
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      selection?.removeAllRanges();
      selection?.addRange(range);
      if (status) status.textContent = "Seleccionamos el comando. Copialo con Ctrl+C o ⌘C.";
    }
  });
}

// crossword-reveal.js — encart "réponse des mots croisés" (section 03)
// La solution reste floutée tant que le visiteur n'a pas cliqué sur
// « Cliquez pour révéler la réponse ». Un seul sens : une fois révélée,
// l'image reste visible (pas de re-flou).

document.querySelectorAll(".crossword-reveal").forEach((box) => {
  const btn = box.querySelector(".crossword-overlay");
  if (!btn) return;
  btn.addEventListener("click", () => {
    box.classList.add("revealed");
    btn.setAttribute("aria-pressed", "true");
  });
});

// instagram-feed.js — affiche le dernier post Instagram en encart "coupure de presse"
// À inclure dans la page : <script src="/js/instagram-feed.js" defer></script>
// Remplit les éléments #ig-post-* et #ig-carousel-* déjà présents dans le gabarit (index.njk).
// En cas d'absence de post, masque l'encart (.ig-clip) pour ne pas afficher un squelette vide.
//
// Gère les carousels multi-images : flèches, compteur (1/N), swipe tactile, clavier (←/→).

async function loadInstagramFeed() {
  const clip = document.querySelector(".ig-clip");
  if (!clip) return;

  const link     = document.getElementById("ig-post-link");
  const img      = document.getElementById("ig-post-image");
  const caption  = document.getElementById("ig-post-caption");
  const dateEl   = document.getElementById("ig-clip-date");

  const carousel   = document.getElementById("ig-carousel");
  const prevBtn    = document.getElementById("ig-carousel-prev");
  const nextBtn    = document.getElementById("ig-carousel-next");
  const counterEl  = document.getElementById("ig-carousel-counter");
  const frame      = carousel?.querySelector(".ig-carousel-frame");

  // L'image porte son vrai ratio (1/1, 4/5, 9/16…) → le polaroid blanc
  // s'enroule exactement autour, jamais de bandes vides sur desktop.
  if (img && frame) {
    img.addEventListener("load", () => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) return;
      img.style.aspectRatio = `${w} / ${h}`;
      // Images paysage (rare) : on contraint la largeur plutôt que la hauteur
      frame.classList.toggle("ig-frame--wide", w / h > 1.1);
    });
  }

  try {
    // Override : si un post est épinglé via le CMS, on lit d'abord le snapshot
    // durable (data/instagram-pinned.json, régénéré à chaque sync) — il reste
    // affichable même quand le post est sorti de la fenêtre des 12 récents.
    // En l'absence de snapshot (ou si l'ID ne correspond plus), on retombe sur
    // le flux classique.
    const overrideId = clip.getAttribute("data-override-id");
    let feed = null;
    if (overrideId) {
      try {
        const pinnedRes = await fetch("/data/instagram-pinned.json", { cache: "no-store" });
        if (pinnedRes.ok) feed = await pinnedRes.json();
      } catch {
        feed = null;
      }
    }
    if (!feed) {
      const res = await fetch("/data/instagram.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`Réponse HTTP ${res.status}`);
      feed = await res.json();
    }

    const { posts } = feed;
    if (!posts || posts.length === 0) {
      clip.style.display = "none";
      return;
    }

    // Le post affiché : l'épinglé s'il correspond à l'override, sinon le plus récent
    let post = posts[0];
    if (overrideId) {
      const found = posts.find((p) => String(p.id) === String(overrideId));
      if (found) {
        post = found;
      }
    }

    // --- Lien Instagram ---
    if (link) link.href = post.permalink;

    // --- Date ---
    if (dateEl && post.timestamp) {
      const d = new Date(post.timestamp);
      if (!isNaN(d)) {
        dateEl.textContent = d.toLocaleDateString("fr-FR", {
          day: "2-digit", month: "long", year: "numeric"
        });
      }
    }

    // --- Caption complète (sans troncation) ---
    if (caption) {
      caption.textContent = post.caption ?? "";
      caption.style.whiteSpace = "pre-line"; // préserve les sauts de ligne du \n
    }

    // --- Carousel ---
    const images = Array.isArray(post.carousel) && post.carousel.length > 0
      ? post.carousel
      : [{ url: post.previewUrl, type: post.type }];

    let index = 0;
    const total = images.length;

    function show(i) {
      if (i < 0) i = total - 1;
      if (i >= total) i = 0;
      index = i;
      if (img) {
        img.src = images[i].url;
        img.alt = truncate(post.caption, 160);
      }
      if (counterEl && total > 1) {
        counterEl.textContent = `${index + 1} / ${total}`;
        counterEl.hidden = false;
      }
      if (prevBtn) prevBtn.hidden = total <= 1;
      if (nextBtn) nextBtn.hidden = total <= 1;
    }

    show(0);

    // --- Navigation carousel ---
    if (total > 1) {
      prevBtn?.addEventListener("click", () => show(index - 1));
      nextBtn?.addEventListener("click", () => show(index + 1));

      // Clavier quand le carousel a le focus
      carousel?.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft")  { e.preventDefault(); show(index - 1); }
        if (e.key === "ArrowRight") { e.preventDefault(); show(index + 1); }
      });

      // Swipe tactile
      let touchX = null;
      frame?.addEventListener("touchstart", (e) => {
        touchX = e.changedTouches[0].clientX;
      }, { passive: true });
      frame?.addEventListener("touchend", (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) {
          if (dx > 0) show(index - 1);
          else show(index + 1);
        }
        touchX = null;
      }, { passive: true });
    }

    clip.classList.add("ig-clip--loaded");
  } catch (err) {
    console.error("Erreur de chargement du flux Instagram :", err);
    clip.style.display = "none";
  }
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max).trim() + "…" : str;
}

document.addEventListener("DOMContentLoaded", loadInstagramFeed);

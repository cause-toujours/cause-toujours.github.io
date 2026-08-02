// instagram-feed.js — affiche le dernier post Instagram en encart "coupure de presse"
// À inclure dans la page : <script src="/js/instagram-feed.js" defer></script>
// Remplit les éléments #ig-post-* déjà présents dans le gabarit (index.njk).
// En cas d'absence de post, masque l'encart (.ig-clip) pour ne pas afficher un squelette vide.

async function loadInstagramFeed() {
  const clip = document.querySelector(".ig-clip");
  if (!clip) return;

  const link    = document.getElementById("ig-post-link");
  const img     = document.getElementById("ig-post-image");
  const caption = document.getElementById("ig-post-caption");
  const dateEl  = document.getElementById("ig-clip-date");

  try {
    const res = await fetch("/data/instagram.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`Réponse HTTP ${res.status}`);

    const { posts } = await res.json();
    if (!posts || posts.length === 0) {
      clip.style.display = "none";
      return;
    }

    const post = posts[0];

    if (link)  link.href = post.permalink;
    if (img) {
      img.src = post.previewUrl;
      img.alt = truncate(post.caption, 120);
    }
    if (caption) caption.textContent = truncate(post.caption, 180);

    if (dateEl && post.timestamp) {
      const d = new Date(post.timestamp);
      if (!isNaN(d)) {
        dateEl.textContent = d.toLocaleDateString("fr-FR", {
          day: "2-digit", month: "long", year: "numeric"
        });
      }
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

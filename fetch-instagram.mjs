// fetch-instagram.mjs
// Récupère les derniers posts du compte Instagram (Business/Creator) via
// l'API "Instagram avec connexion Instagram" (Instagram Login flow, sans Page Facebook)
// et écrit le résultat dans data/instagram.json à la racine du repo.
//
// Secrets requis (à définir dans GitHub → Settings → Secrets and variables → Actions) :
//   IG_ACCESS_TOKEN   -> jeton d'accès longue durée
//   IG_USER_ID        -> l'ID du compte Instagram (pas le @nomdutilisateur)
//
// Utilise le fetch natif de Node (Node 18+).

import { writeFile, readFile, unlink, mkdir } from "node:fs/promises";
import path from "node:path";

const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const IG_USER_ID = process.env.IG_USER_ID;
const API_VERSION = "v21.0";
const OUTPUT_PATH = path.join(process.cwd(), "data", "instagram.json");
// Fichier "très léger" (id + légende uniquement) que le CMS Sveltia déclare en
// collection pour alimenter la liste déroulante "Post Instagram affiché"
// (widget relation). Uniquement pour l'édition via le CMS, jamais pour l'affichage du site.
const PIN_OPTIONS_PATH = path.join(process.cwd(), "data", "instagram-pin-options.json");
// Snapshot complet du post épinglé via le CMS (champ numero.ig_override_post_id).
// Permet d'afficher un post épinglé même longtemps après sa publication : le script
// le re-récupère par son ID à chaque sync (URLs fraîches tant que le post existe).
const PINNED_PATH = path.join(process.cwd(), "data", "instagram-pinned.json");
const HOMEPAGE_PATH = path.join(process.cwd(), "_data", "homepage.json");
const MAX_POSTS = 12; // nombre d'aperçus à conserver dans le flux d'affichage
const OPTIONS_LIMIT = 50; // fenêtre de posts proposés dans la liste déroulante du CMS

if (!ACCESS_TOKEN || !IG_USER_ID) {
  console.error("IG_ACCESS_TOKEN et/ou IG_USER_ID manquants dans l'environnement.");
  process.exit(1);
}

const FIELDS = [
  "id",
  "caption",
  "media_type",
  "media_url",
  "thumbnail_url", // utile pour les vidéos (media_url pointe vers le fichier vidéo)
  "permalink",
  "timestamp",
].join(",");

const CHILDREN_FIELDS = ["media_type", "media_url", "thumbnail_url"].join(",");

async function fetchJSON(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    console.error("Erreur API Instagram :", JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json;
}

// Variante non fatale : renvoie null si l'item n'est plus accessible au lieu
// de couper tout le script (utile pour un post épinglé supprimé sur Instagram).
async function fetchJSONSafe(url) {
  const res = await fetch(url);
  const json = await res.json();
  return res.ok ? json : null;
}

async function fetchRawPosts(limit) {
  const url =
    `https://graph.instagram.com/${API_VERSION}/${IG_USER_ID}/media` +
    `?fields=${FIELDS}&limit=${limit}&access_token=${ACCESS_TOKEN}`;
  const json = await fetchJSON(url);
  return json.data ?? [];
}

// Re-récupère un post précis par son ID (peut être très ancien). Renvoie null
// s'il n'existe plus ou n'appartient pas au compte.
async function fetchRawPostById(id) {
  const url =
    `https://graph.instagram.com/${API_VERSION}/${id}` +
    `?fields=${FIELDS}&access_token=${ACCESS_TOKEN}`;
  return fetchJSONSafe(url);
}

// Pour un CAROUSEL_ALBUM, on récupère chaque média enfant (image/vidéo)
// via l'endpoint /media/{id}/children. Renvoie un tableau {url, type}.
async function fetchCarouselChildren(id) {
  const url =
    `https://graph.instagram.com/${API_VERSION}/${id}/children` +
    `?fields=${CHILDREN_FIELDS}&access_token=${ACCESS_TOKEN}`;
  const json = await fetchJSON(url);
  const items = json.data ?? [];
  return items
    .map((it) => ({
      url: it.media_type === "VIDEO" ? (it.thumbnail_url ?? it.media_url) : it.media_url,
      type: it.media_type,
    }))
    .filter((it) => it.url);
}

function mediaItem(raw) {
  return {
    url: raw.media_type === "VIDEO" ? (raw.thumbnail_url ?? raw.media_url) : raw.media_url,
    type: raw.media_type,
  };
}

async function simplify(post) {
  let carousel;
  if (post.media_type === "CAROUSEL_ALBUM") {
    try {
      carousel = await fetchCarouselChildren(post.id);
    } catch (err) {
      console.error(`Carousel ${post.id} : échec récupération enfants, fallback image unique.`, err.message);
      carousel = [mediaItem(post)];
    }
  } else {
    carousel = [mediaItem(post)];
  }
  // Filtre les éventuels items sans URL
  carousel = carousel.filter((it) => it && it.url);

  return {
    id: post.id,
    caption: post.caption ?? "",
    type: post.media_type, // IMAGE | VIDEO | CAROUSEL_ALBUM
    // previewUrl conservé pour rétrocompat (1ère image du carousel)
    previewUrl: carousel[0]?.url ?? post.media_url,
    carousel,
    permalink: post.permalink,
    timestamp: post.timestamp,
  };
}

function labelOf(raw) {
  const caption = (raw.caption ?? "").trim();
  return caption ? caption : raw.timestamp ?? String(raw.id);
}

// Lit l'ID du post épinglé dans le fichier éditable du CMS. "" = aucun post forcé.
async function readOverrideId() {
  try {
    const data = JSON.parse(await readFile(HOMEPAGE_PATH, "utf-8"));
    return data?.numero?.ig_override_post_id ?? "";
  } catch {
    return "";
  }
}

async function readPreviousPinned() {
  try {
    return JSON.parse(await readFile(PINNED_PATH, "utf-8"));
  } catch {
    return null;
  }
}

async function main() {
  const now = new Date().toISOString();
  const rawPosts = await fetchRawPosts(OPTIONS_LIMIT);

  // --- Flux d'affichage (data/instagram.json) : les MAX_POSTS plus récents ---
  const displayPosts = [];
  for (const raw of rawPosts.slice(0, MAX_POSTS)) {
    displayPosts.push(await simplify(raw));
  }
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify({ updatedAt: now, posts: displayPosts }, null, 2),
    "utf-8"
  );
  console.log(`${displayPosts.length} posts écrits dans ${OUTPUT_PATH}`);

  // --- Post épinglé (data/instagram-pinned.json) ---
  const overrideId = await readOverrideId();
  let pinned = null;
  if (overrideId) {
    // 1) Dans la fenêtre courante ? (rapide, aucun appel supplémentaire)
    const raw = rawPosts.find((r) => String(r.id) === String(overrideId));
    if (raw) {
      pinned = { display: await simplify(raw), label: labelOf(raw) };
    } else {
      // 2) Post plus ancien : re-récupération par ID (URLs d'images rafraîchies)
      const single = await fetchRawPostById(overrideId);
      if (single) {
        pinned = { display: await simplify(single), label: labelOf(single) };
      }
    }
  }

  if (overrideId && pinned) {
    await writeFile(
      PINNED_PATH,
      JSON.stringify({ updatedAt: now, posts: [pinned.display] }, null, 2),
      "utf-8"
    );
    console.log(`post épinglé ${overrideId} écrit dans ${PINNED_PATH}`);
  } else if (overrideId) {
    // Le post épinglé n'est plus accessible (supprimé ?) : on conserve le dernier
    // snapshot connu pour ne pas casser l'affichage, et on l'avertit.
    const prev = await readPreviousPinned();
    if (prev?.posts?.[0]) {
      pinned = { display: prev.posts[0], label: labelOf(prev.posts[0]) };
      console.warn(
        `post épinglé ${overrideId} introuvable sur le compte — snapshot précédent conservé dans ${PINNED_PATH}`
      );
    } else {
      console.warn(`post épinglé ${overrideId} introuvable et aucun snapshot de secours disponible.`);
    }
  } else {
    await unlink(PINNED_PATH).catch(() => {});
  }

  // --- Options de la liste déroulante CMS (data/instagram-pin-options.json) ---
  // Fenêtre récente + le post épinglé en tête s'il en est sorti (jamais perdu).
  const options = [];
  const seen = new Set();
  if (pinned && Object.prototype.hasOwnProperty.call(pinned, "label")) {
    if (!rawPosts.some((r) => String(r.id) === String(overrideId))) {
      options.push({ id: String(overrideId), caption: pinned.label });
      seen.add(String(overrideId));
    }
  }
  for (const raw of rawPosts) {
    const id = String(raw.id);
    if (seen.has(id)) continue;
    seen.add(id);
    options.push({ id, caption: labelOf(raw) });
  }

  await writeFile(
    PIN_OPTIONS_PATH,
    JSON.stringify({ updatedAt: now, posts: options }, null, 2),
    "utf-8"
  );
  console.log(`${options.length} options CMS écrites dans ${PIN_OPTIONS_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
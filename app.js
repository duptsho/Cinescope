/* CineScope SPA — plain HTML/CSS/JS
   Replace YOUR_TMDB_API_KEY with a valid TMDB key.
*/
const TMDB_KEY = '5326de6853eb6b84402447748595915f';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';

const DOM = {
    genreSelect: document.getElementById('genreSelect'),
    movieContainer: document.getElementById('movieContainer'),
    app: document.getElementById('app'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),

    watchCount: document.getElementById('watch-count'),
    authBtn: document.getElementById('auth-btn'),
    navBtns: document.querySelectorAll('.nav-btn'),
    brand: document.querySelector('.brand'),
    toast: document.getElementById('toast'),
    cardTpl: document.getElementById('card-tpl'),
    navToggle: document.getElementById('nav-toggle')
};

let state = {
    watchlist: loadWatchlist(),
    user: loadUser(),
    lastQuery: ''
};

updateWatchCount();
initEvents();
handleRouting(); // initial render
window.addEventListener('hashchange', handleRouting);

/* ---------- Utility: TMDB fetch ---------- */
async function tmdb(path, params = {}) {
    const url = new URL(TMDB_BASE + path);
    url.searchParams.set('api_key', TMDB_KEY);
    url.searchParams.set('language', 'en-US');
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.href);
    if (!res.ok) throw new Error('TMDB fetch error ' + res.status);
    return res.json();
}

/* ---------- Routing ---------- */
/* hash format: #page?key=value&...  e.g. #search?q=Inception */
function parseHash() {
    const hash = location.hash.slice(1) || 'home';
    const [pagePart, queryPart] = hash.split('?');
    const params = {};
    if (queryPart) {
        new URLSearchParams(queryPart).forEach((v, k) => params[k] = v);
    }
    return { page: pagePart || 'home', params };
}

function handleRouting() {
    const { page, params } = parseHash();
    switch (page) {
        case 'home': renderHome(); break;
        case 'search': renderSearch(params.q || ''); break;
        case 'details': renderDetails(params.id, params.type || 'movie'); break;
        case 'watchlist': renderWatchlist(); break;
        case 'login': renderLogin(); break;
        case 'signup': renderSignup(); break;
        case 'hidden': renderHidden(); break;
        case 'about': renderAbout(); break;

        // 👇 Add this new case for genre pages
        case 'genre': renderGenre(params.name || 'Horror'); break;

        default: renderHome();
    }
}

// update header active state
document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

/* ---------- Render helpers ---------- */
function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') e.className = v;
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v);
    });
    children.flat().forEach(c => {
        if (c === null || c === undefined) return;
        e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
}

function placeholderPoster() {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='400' height='600'><rect width='100%' height='100%' fill='#111'/><text x='50%' y='50%' fill='#666' font-size='20' text-anchor='middle' dy='.35em'>No Poster</text></svg>`);
}

function createCard(item, { showAdd = true } = {}) {
    const tpl = DOM.cardTpl.content.cloneNode(true);
    const poster = tpl.querySelector('.poster');
    const title = tpl.querySelector('.title');
    const meta = tpl.querySelector('.meta');
    const overview = tpl.querySelector('.overview');
    const watchBtn = tpl.querySelector('.watch-btn');
    const detailsBtn = tpl.querySelector('.details-btn');

    const itemTitle = item.title || item.name || 'Untitled';
    const type = item.media_type || (item.release_date ? 'movie' : 'tv');
    const date = item.release_date || item.first_air_date || '—';
    const rating = item.vote_average ? `${item.vote_average.toFixed(1)} ⭐` : '—';

    poster.src = item.poster_path ? IMG + item.poster_path : (item.poster ? item.poster : placeholderPoster());
    title.textContent = itemTitle;
    meta.textContent = `${type.toUpperCase()} • ${date} • ${rating}`;
    overview.textContent = item.overview || 'No description available';

    if (!showAdd) watchBtn.style.display = 'none';
    else {
        if (isInWatchlist(item)) {
            watchBtn.classList.add('added');
            watchBtn.textContent = 'In Watchlist';
        } else {
            watchBtn.classList.remove('added');
            watchBtn.textContent = 'Add';
        }
        watchBtn.onclick = (e) => {
            e.stopPropagation();
            toggleWatchlist(item);
            updateWatchCount();
            // update button text
            if (isInWatchlist(item)) { watchBtn.classList.add('added'); watchBtn.textContent = 'In Watchlist'; }
            else { watchBtn.classList.remove('added'); watchBtn.textContent = 'Add'; }
            showToast(`${itemTitle} watchlist updated`);
        };
    }

    detailsBtn.onclick = () => {
        location.hash = `details?id=${item.id}&type=${type}`;
        window.scrollTo(0, 0);
    };

    return tpl;
}

/* ---------- Pages ---------- */

async function renderHome() {
    DOM.app.innerHTML = '';
    const hero = el('div', { class: 'hero' },
        el('img', { src: 'welcome-poster.jpg', alt: 'Welcome Poster' }),
        el('div', { class: 'meta-block' },
            el('h2', { class: 'page-title' }, 'Welcome to CineScope'),
            el('p', {}, 'Discover trending and top rated movies. Use the search to find films and TV shows.')
        )
    );
    DOM.app.appendChild(hero);

    // Trending row
    const trendingSection = el('section', { class: 'section' }, el('h3', { class: 'page-title' }, 'Trending Now'));
    DOM.app.appendChild(trendingSection);
    const trendingGrid = el('div', { class: 'grid' });
    trendingSection.appendChild(trendingGrid);

    // Top rated row
    const topSection = el('section', { class: 'section' }, el('h3', { class: 'page-title' }, 'Top Rated'));
    DOM.app.appendChild(topSection);
    const topGrid = el('div', { class: 'grid' });
    topSection.appendChild(topGrid);

    try {
        const t = await tmdb('/trending/all/week', { page: 1 });
        (t.results || []).slice(0, 12).forEach(it => trendingGrid.appendChild(createCard(it)));
        const r = await tmdb('/movie/top_rated', { page: 1 });
        (r.results || []).slice(0, 12).forEach(it => topGrid.appendChild(createCard(it)));
    } catch (err) {
        DOM.app.appendChild(el('div', { class: 'message' }, 'Failed to load data. Check API key or network.'));
        console.error(err);
    }
}

async function renderSearch(query) {
    DOM.app.innerHTML = '';
    const q = query || state.lastQuery || '';
    state.lastQuery = q;
    const header = el('div', {}, el('h2', { class: 'page-title' }, `Search Results ${q ? `for "${q}"` : ''}`));
    DOM.app.appendChild(header);
    const resultsGrid = el('div', { class: 'grid' });
    DOM.app.appendChild(resultsGrid);
    if (!q) {
        DOM.app.appendChild(el('div', { class: 'message' }, 'Type a search term in the header and press Search.'));
        return;
    }
    try {
        const data = await tmdb('/search/multi', { query: q, page: 1, include_adult: false });
        const list = (data.results || []).filter(r => r.media_type === 'movie' || r.media_type === 'tv');
        if (!list.length) DOM.app.appendChild(el('div', { class: 'message' }, 'No results.'));
        list.forEach(it => resultsGrid.appendChild(createCard(it)));
    } catch (err) {
        DOM.app.appendChild(el('div', { class: 'message' }, 'Search failed.'));
    }
}

async function renderDetails(id, type = 'movie') {
    DOM.app.innerHTML = '';
    try {
        const data = await tmdb(`/${type}/${id}`, { append_to_response: 'credits,reviews' });
        const poster = data.poster_path ? IMG + data.poster_path : placeholderPoster();
        const title = data.title || data.name || 'Untitled';
        const release = data.release_date || data.first_air_date || '—';
        const rating = data.vote_average ? data.vote_average.toFixed(1) : '—';
        const runtime = data.runtime ? `${data.runtime} min` : (data.episode_run_time && data.episode_run_time[0] ? `${data.episode_run_time[0]} min ep` : '—');
        const genres = (data.genres || []).map(g => g.name).join(', ');

        const hero = el('div', { class: 'hero' },
            el('img', { src: poster, alt: title }),
            el('div', { class: 'meta-block' },
                el('h2', { class: 'page-title' }, title),
                el('p', { class: 'meta' }, `${type.toUpperCase()} • ${release} • ${runtime} • ${rating} ⭐`),
                el('p', {}, el('strong', {}, 'Genres: '), genres || '—'),
                el('p', {}, el('strong', {}, 'Overview: '), data.overview || '—'),
                // Watch on Netflix button
                el('button', {
                    class: 'btn watch', onclick: () => {
                        const query = encodeURIComponent(title);
                        window.open(`https://www.netflix.com/bt/search?q=${query}`, '_blank');
                    }
                }, 'Watch on Netflix'),

                // Watch on MovieBox button
                el('button', {
                    class: 'btn watch', onclick: () => {
                        const query = encodeURIComponent(title);
                        window.open(`https://moviebox.ph/?s=${query}`, '_blank');
                    }
                }, 'Watch on MovieBox')

            )
        )
        DOM.app.appendChild(hero);

        // cast
        const castList = (data.credits && data.credits.cast) ? data.credits.cast.slice(0, 8) : [];
        if (castList.length) {
            const castSection = el('section', { class: 'section' }, el('h3', { class: 'page-title' }, 'Cast'));
            const castGrid = el('div', { class: 'grid' });
            castList.forEach(c => castGrid.appendChild(el('div', {}, el('img', { src: c.profile_path ? IMG + c.profile_path : placeholderPoster(), style: 'width:100%;height:160px;object-fit:cover;border-radius:6px' }), el('p', {}, c.name), el('p', { class: 'meta' }, c.character || ''))));
            castSection.appendChild(castGrid);
            DOM.app.appendChild(castSection);
        }

        // reviews (two)
        const reviews = (data.reviews && data.reviews.results) ? data.reviews.results.slice(0, 2) : [];
        const revSection = el('section', { class: 'section' }, el('h3', { class: 'page-title' }, 'Reviews'));
        if (!reviews.length) revSection.appendChild(el('div', { class: 'message' }, 'No reviews.'));
        else reviews.forEach(r => revSection.appendChild(el('div', { class: 'form' }, el('p', {}, r.content.slice(0, 400) + '...'), el('p', { class: 'meta' }, `— ${r.author}`))));
        DOM.app.appendChild(revSection);

    } catch (err) {
        DOM.app.innerHTML = '';
        DOM.app.appendChild(el('div', { class: 'message' }, 'Failed to load details.'));
    }
}

/* ---------- Genre / Release / Hidden / About ---------- */
const genresList = [
    { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
    { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 99, name: "Documentary" },
    { id: 18, name: "Drama" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" },
    { id: 36, name: "History" }, { id: 27, name: "Horror" }, { id: 10402, name: "Music" },
    { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" }, { id: 878, name: "Science Fiction" },
    { id: 10770, name: "TV Movie" }, { id: 53, name: "Thriller" }, { id: 10752, name: "War" },
    { id: 37, name: "Western" }
];

function populateGenres() {
    if (!DOM.genreSelect) return;
    genresList.forEach(g => { const opt = document.createElement('option'); opt.value = g.id; opt.textContent = g.name; DOM.genreSelect.appendChild(opt); });
}

async function fetchMoviesByGenre(genreId) { const data = await tmdb('/discover/movie', { with_genres: genreId, sort_by: 'popularity.desc', page: 1 }); return data.results || []; }
function renderMovies(movies) { if (!DOM.movieContainer) return; DOM.movieContainer.innerHTML = ''; if (!movies.length) { DOM.movieContainer.innerHTML = '<p>No movies found.</p>'; return; } movies.forEach(m => DOM.movieContainer.appendChild(createCard(m))); }
function initGenreFilter() { if (!DOM.genreSelect) return; DOM.genreSelect.addEventListener('change', async e => { const movies = await fetchMoviesByGenre(e.target.value); renderMovies(movies); }); }

function renderWatchlist() {
    DOM.app.innerHTML = '';
    const header = el('div', {}, el('h2', { class: 'page-title' }, 'My Watchlist'));
    DOM.app.appendChild(header);
    if (!state.watchlist.length) {
        DOM.app.appendChild(el('div', { class: 'message' }, 'Watchlist is empty. Add titles from search or home.'));
        return;
    }
    const grid = el('div', { class: 'grid' });
    state.watchlist.forEach(item => {
        // shaped item for createCard
        const shaped = {
            id: item.id, poster_path: item.poster_path, title: item.title, overview: item.overview, release_date: item.date, media_type: item.media_type
        };
        const node = createCard(shaped);
        // add extra actions: mark watched & remove
        const watchBtn = node.querySelector('.watch-btn');
        const actions = node.querySelector('.card-actions');
        const markBtn = el('button', { class: 'btn', onclick: () => { markWatched(item.id); renderWatchlist(); } }, item.watched ? 'Watched' : 'Mark watched');
        const removeBtn = el('button', { class: 'btn', onclick: () => { removeFromWatchlist(item.id); renderWatchlist(); updateWatchCount(); showToast('Removed from watchlist'); } }, 'Remove');
        actions.appendChild(markBtn);
        actions.appendChild(removeBtn);
        grid.appendChild(node);
    });
    DOM.app.appendChild(grid);
}

async function renderGenre(name = 'Horror') {
    DOM.app.innerHTML = '';
    DOM.app.appendChild(el('h2', { class: 'page-title' }, `${name} Movies`));
    const grid = el('div', { class: 'grid' });
    DOM.app.appendChild(grid);
    try {
        // find genre id
        const genres = await tmdb('/genre/movie/list', {});
        const g = (genres.genres || []).find(x => x.name.toLowerCase() === name.toLowerCase());
        if (!g) {
            DOM.app.appendChild(el('div', { class: 'message' }, 'Genre not found.'));
            return;
        }
        const data = await tmdb('/discover/movie', { with_genres: g.id, sort_by: 'popularity.desc', page: 1 });
        (data.results || []).slice(0, 24).forEach(it => grid.appendChild(createCard(it)));
    } catch (e) {
        DOM.app.appendChild(el('div', { class: 'message' }, 'Failed to load genre.'));
    }
}

async function renderRelease(year = '2022') {
    DOM.app.innerHTML = '';
    DOM.app.appendChild(el('h2', { class: 'page-title' }, `Released in ${year}`));
    const grid = el('div', { class: 'grid' });
    DOM.app.appendChild(grid);
    try {
        const data = await tmdb('/discover/movie', { primary_release_year: year, sort_by: 'popularity.desc', page: 1 });
        (data.results || []).slice(0, 24).forEach(it => grid.appendChild(createCard(it)));
    } catch (e) {
        DOM.app.appendChild(el('div', { class: 'message' }, 'Failed to load release year.'));
    }
}

async function renderHidden() {
    DOM.app.innerHTML = '';
    DOM.app.appendChild(el('h2', { class: 'page-title' }, 'Hidden Gems'));
    const grid = el('div', { class: 'grid' });
    DOM.app.appendChild(grid);
    try {
        // curated: search a few lesser-known titles (use discover with vote_count filter)
        const data = await tmdb('/discover/movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 50, page: 1 });
        (data.results || []).slice(0, 24).forEach(it => grid.appendChild(createCard(it)));
    } catch (e) {
        DOM.app.appendChild(el('div', { class: 'message' }, 'Failed to load hidden gems.'));
    }
}

function renderAbout() {
    DOM.app.innerHTML = '';
    const card = el('div', { class: 'form' }, el('h2', { class: 'page-title' }, 'About CineScope'),
        el('p', {}, 'CineScope is a prototype movie & TV explorer. It provides search, watchlist, and curated views.'),
        el('p', {}, 'This is a local demo using TMDB for content; watchlist and auth are stored locally.Our goal is to make discovering films enjoyable and simple by providing up-to-date recommendations and an easy-to-use interface. Whether you’re looking for your next favorite movie or just browsing for inspiration, CineScope is here to guide your journey through the world of cinema. This project was created by college students Jigme Wangchuk, Duptho Wangmo, Jamyang Choden, Kalpana Monger, and Kezang Dema.')
        

    );
    DOM.app.appendChild(card);
}

/* ---------- Auth pages (local only) ---------- */
function renderLogin() {
    DOM.app.innerHTML = '';
    const form = el('div', { class: 'form' },
        el('h2', { class: 'page-title' }, 'Log in'),
        el('input', { class: 'input', id: 'login-email', placeholder: 'Email' }),
        el('input', { class: 'input', id: 'login-pass', placeholder: 'Password', type: 'password' }),
        el('div', {}, el('button', { class: 'btn', onclick: () => { attemptLogin(); } }, 'Log In'),
            el('button', { class: 'btn', onclick: () => location.hash = 'signup' }, 'Sign up'))
    );
    DOM.app.appendChild(form);
}

function renderSignup() {
    DOM.app.innerHTML = '';
    const form = el('div', { class: 'form' },
        el('h2', { class: 'page-title' }, 'Sign up'),
        el('input', { class: 'input', id: 'su-name', placeholder: 'Full name' }),
        el('input', { class: 'input', id: 'su-email', placeholder: 'Email' }),
        el('input', { class: 'input', id: 'su-pass', placeholder: 'Password', type: 'password' }),
        el('div', {}, el('button', { class: 'btn', onclick: () => { attemptSignup(); } }, 'Create account'),
            el('button', { class: 'btn', onclick: () => location.hash = 'login' }, 'Already have account?'))
    );
    DOM.app.appendChild(form);
}

/* ---------- Watchlist CRUD & auth ---------- */
function loadWatchlist() {
    try { return JSON.parse(localStorage.getItem('cinescope_watchlist_v1') || '[]'); } catch (e) { return []; }
}
function saveWatchlist() { localStorage.setItem('cinescope_watchlist_v1', JSON.stringify(state.watchlist)); }
function isInWatchlist(item) {
    const id = item.id; const type = item.media_type || item.media_type === undefined ? (item.media_type || (item.release_date ? 'movie' : 'tv')) : item.media_type;
    return state.watchlist.some(w => w.id == id && w.media_type == type);
}
function toggleWatchlist(item) {
    const type = item.media_type || (item.release_date ? 'movie' : 'tv');
    const idx = state.watchlist.findIndex(w => w.id == item.id && w.media_type == type);
    if (idx >= 0) { state.watchlist.splice(idx, 1); }
    else {
        state.watchlist.push({ id: item.id, media_type: type, title: item.title || item.name, poster_path: item.poster_path || item.poster, overview: item.overview || '', date: item.release_date || item.first_air_date || '', watched: false });
    }
    saveWatchlist();
}
function removeFromWatchlist(id) { state.watchlist = state.watchlist.filter(x => x.id != id); saveWatchlist(); updateWatchCount(); }
function markWatched(id) { const it = state.watchlist.find(x => x.id == id); if (it) { it.watched = true; saveWatchlist(); } }
function updateWatchCount() { DOM.watchCount.textContent = state.watchlist.length; }

/* ---------- Auth (local simple) ---------- */
function loadUser() { try { return JSON.parse(localStorage.getItem('cinescope_user_v1') || 'null'); } catch (e) { return null; } }
function saveUser(u) { localStorage.setItem('cinescope_user_v1', JSON.stringify(u)); state.user = u; updateAuthBtn(); }
function attemptSignup() {
    const name = document.getElementById('su-name').value.trim();
    const email = document.getElementById('su-email').value.trim();
    const pass = document.getElementById('su-pass').value.trim();
    if (!email || !pass) return showToast('Provide email & password');
    saveUser({ name, email, pass });
    showToast('Account created');
    location.hash = 'home';
}
function attemptLogin() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const u = loadUser();
    if (!u) return showToast('No account found. Sign up first.');
    if (u.email === email && u.pass === pass) { state.user = u; showToast('Logged in'); updateAuthBtn(); location.hash = 'home'; }
    else showToast('Invalid credentials');
}
function updateAuthBtn() {
    DOM.authBtn.textContent = state.user ? (state.user.name || 'Account') : 'Log In';
    if (state.user) DOM.authBtn.onclick = () => { if (confirm('Log out?')) { localStorage.removeItem('cinescope_user_v1'); state.user = null; updateAuthBtn(); showToast('Logged out'); location.hash = 'home'; } };
    else DOM.authBtn.onclick = () => { location.hash = 'login'; };
}

/* ---------- UI events ---------- */
function initEvents() {
    // search
    DOM.searchBtn.onclick = () => runSearch();
    DOM.searchInput.onkeydown = (e) => { if (e.key === 'Enter') runSearch(); };
    // nav buttons
    document.querySelectorAll('[data-route]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            const route = btn.getAttribute('data-route');
            if (route === 'genre') {
                const name = btn.getAttribute('data-genre') || 'Horror';
                location.hash = `genre?name=${encodeURIComponent(name)}`;
            } else if (route === 'release') {
                const year = btn.getAttribute('data-year') || '2022';
                location.hash = `release?year=${encodeURIComponent(year)}`;
            } else location.hash = route;
        });
    });
    DOM.brand.onclick = () => location.hash = 'home';
    updateAuthBtn();

    // small nav toggle for mobile
    DOM.navToggle?.addEventListener('click', () => {
        document.querySelector('.nav')?.classList.toggle('open');
    });
}

function runSearch() {
    const q = DOM.searchInput.value.trim();
    if (!q) return showToast('Type something to search');
    state.lastQuery = q;
    location.hash = `search?q=${encodeURIComponent(q)}`;
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(text, ms = 2000) {
    if (toastTimer) clearTimeout(toastTimer);
    DOM.toast.textContent = text;
    DOM.toast.classList.remove('hidden');
    toastTimer = setTimeout(() => { DOM.toast.classList.add('hidden'); DOM.toast.textContent = ''; toastTimer = null; }, ms);
}

/* ---------- boot ---------- */
function updateWatchCount() { DOM.watchCount.textContent = state.watchlist.length; }
updateWatchCount();

function renderWatchlist() {
    DOM.app.innerHTML = `<h2 class="page-title">My Watchlist</h2>
                       <div class="grid"></div>`;
    const grid = DOM.app.querySelector(".grid");

    if (state.watchlist.length === 0) {
        DOM.app.innerHTML += `<p class="message">Your watchlist is empty.</p>`;
        return;
    }

    state.watchlist.forEach((movie, index) => {
        const card = document.createElement("article");
        card.classList.add("card");
        card.innerHTML = `
      <img class="poster" src="${movie.poster_path ? IMG + movie.poster_path : ''}" alt="Poster"/>
      <div class="card-body">
        <h3 class="title">${movie.title}</h3>
        <p class="meta">${movie.release_date || ''}</p>
        <p class="overview">${movie.overview}</p>
        <div class="card-actions">
          <button class="btn mark-watched-btn">${movie.watched ? 'Watched' : 'Mark Watched'}</button>
          <button class="btn details-btn">Details</button>
          <button class="btn remove-btn">Remove</button>
        </div>
      </div>
    `;

        // Mark Watched
        const markBtn = card.querySelector(".mark-watched-btn");
        if (movie.watched) markBtn.disabled = true;
        markBtn.addEventListener("click", () => {
            movie.watched = true;             // update watchlist
            saveWatchlist();                  // persist
            markBtn.textContent = "Watched";
            markBtn.disabled = true;
        });

        // Remove from watchlist
        card.querySelector(".remove-btn").addEventListener("click", () => {
            state.watchlist.splice(index, 1);
            saveWatchlist();
            renderWatchlist();
            updateWatchCount();
            showToast('Removed from watchlist');
        });

        // Details button
        card.querySelector(".details-btn").addEventListener("click", () => {
            const type = movie.media_type || 'movie';
            location.hash = `details?id=${movie.id}&type=${type}`;
            window.scrollTo(0, 0);
        });

        grid.appendChild(card);
    });
}
/* ---------- Init ---------- */
window.addEventListener('hashchange', handleRouting);
populateGenres();
updateWatchCount();
updateAuthBtn();
handleRouting();

/* ---------- Genre Filter ---------- */
DOM.genreSelect.addEventListener('change', async e => {
    const genreId = e.target.value;

    if (genreId === 'all') {
        location.hash = 'home';
    } else {
        const selectedGenre = genresList.find(g => g.id == genreId);
        if (selectedGenre) {
            // Update the hash correctly — no extra spaces or typos
            location.hash = `genre?name=${encodeURIComponent(selectedGenre.name)}`;
        }
    }
});

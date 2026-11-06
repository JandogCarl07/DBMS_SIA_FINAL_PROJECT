const API = '/api';
const $ = id => document.getElementById(id);

const state = {
    am: new Set(),
    amenities: [],
    ratingsFor: null,
    token: localStorage.getItem('vrent_ctoken'),
    customer: JSON.parse(localStorage.getItem('vrent_ccustomer') || 'null'),
    cars: [],
    cat: '',
    start: '',
    end: '',
    afterAuth: null,
    tab: 'reservations'
};

const esc = v => {
    const d = document.createElement('div');
    d.textContent = v ?? '';
    return d.innerHTML;
};

const peso = n =>
    '\u20B1' + Number(n || 0).toLocaleString('en-PH', {
        maximumFractionDigits: 2
    });

const day = s =>
    s
        ? new Date(String(s).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-PH', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        })
        : '\u2014';

const dayTime = s =>
    s ? day(s) + ' ' + String(s).slice(11, 16) : '\u2014';

const iso = d =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (s, n) => {
    const d = new Date(s + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return iso(d);
};

const today = () => iso(new Date());

const stars = (avg, n) =>
    avg
        ? `<span class="stars" title="${avg} out of 5">${'\u2605'.repeat(Math.round(avg))}${'\u2606'.repeat(5 - Math.round(avg))} <small>${avg} (${n})</small></span>`
        : '<span class="stars"><small>No ratings yet</small></span>';

function toast(msg, type = '') {
    const t = document.createElement('div');

    t.className = 'toast ' + type;
    t.setAttribute('role', type === 'bad' ? 'alert' : 'status');
    t.innerHTML = `<span>${esc(msg)}</span><button aria-label="Dismiss">\u00D7</button>`;

    t.querySelector('button').onclick = () => t.remove();

    $('toasts').appendChild(t);

    setTimeout(() => t.remove(), type === 'bad' ? 8000 : 5000);
}

async function api(path, { method = 'GET', body, quiet } = {}) {
    try {
        const res = await fetch(API + path, {
            method,
            body: body ? JSON.stringify(body) : undefined,
            headers: {
                'Content-Type': 'application/json',
                ...(state.token
                    ? { Authorization: 'Bearer ' + state.token }
                    : {})
            }
        });

        const json = await res.json().catch(() => ({
            success: false,
            error: 'Something went wrong. Please try again.'
        }));

        if (
            res.status === 401 &&
            state.token &&
            path.startsWith('/portal/') &&
            !path.endsWith('/login')
        ) {
            setSession(null);
        }

        if (!res.ok || !json.success) {
            throw new Error(json.error || 'Something went wrong. Please try again.');
        }

        return json.data;
    } catch (e) {
        if (!quiet) {
            toast(
                e.message === 'Failed to fetch'
                    ? 'Cannot reach the server. Check your connection.'
                    : e.message,
                'bad'
            );
        }

        throw e;
    }
}

function setSession(data) {
    state.token = data?.token || null;
    state.customer = data?.customer || null;

    if (data) {
        localStorage.setItem('vrent_ctoken', data.token);
        localStorage.setItem('vrent_ccustomer', JSON.stringify(data.customer));
    } else {
        localStorage.removeItem('vrent_ctoken');
        localStorage.removeItem('vrent_ccustomer');
    }

    renderNav();
    renderAccess();
}

function renderNav() {
    const on = !!state.token;

    $('guestButtons').hidden = on;
    $('userButtons').hidden = !on;

    if (!on && !$('pageAccount').hidden) {
        showHome();
    }
}

const open = id => {
    $(id).hidden = false;
    $(id).querySelector('input,select,button:not(.x)')?.focus();
};

const close = id => {
    $(id).hidden = true;
};

document.querySelectorAll('[data-close]').forEach(b =>
    b.addEventListener('click', () => {
        b.closest('.overlay').hidden = true;
    })
);

document.querySelectorAll('.overlay').forEach(o =>
    o.addEventListener('mousedown', e => {
        if (e.target === o) o.hidden = true;
    })
);

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.overlay').forEach(o => o.hidden = true);
    }
});

$('burger').addEventListener('click', () => {
    const o = $('navLinks').classList.toggle('open');
    $('burger').setAttribute('aria-expanded', String(o));
});

$('navLinks').addEventListener('click', e => {
    if (e.target.closest('a')) {
        $('navLinks').classList.remove('open');

        if (e.target.hasAttribute('data-home')) {
            showHome();
        }
    }
});

async function initHome() {
    const [sum, cats, branches, amenities] = await Promise.all([
        api('/public/summary'),
        api('/public/categories'),
        api('/public/branches'),
        api('/public/amenities')
    ]);

    state.amenities = amenities;

    $('nVehicles').textContent = sum.vehicles;
    $('nCats').textContent = sum.categories;
    $('nAmen').textContent = sum.amenities;
    $('nRating').textContent = sum.avg_rating ? sum.avg_rating + ' \u2605' : 'New';

    $('sCat').innerHTML =
        '<option value="">Any type</option>' +
        cats.map(c => `<option>${esc(c.category_name)}</option>`).join('');

    $('sBranch').innerHTML =
        '<option value="">Any branch</option>' +
        branches.map(b =>
            `<option value="${b.branch_id}">${esc(b.branch_name)}</option>`
        ).join('');

    if (branches.length <= 1) {
        $('branchField').hidden = true;
    }

    $('chips').innerHTML =
        `<button class="chip" aria-pressed="true" data-cat="">All</button>` +
        cats.map(c =>
            `<button class="chip" aria-pressed="false" data-cat="${esc(c.category_name)}">${esc(c.category_name)} <small>from ${peso(c.from_rate)}/day</small></button>`
        ).join('');

    $('amenGrid').innerHTML = amenities.map(a =>
        `<article class="amen">
            ${VehicleArt.amenityIcon(a.amenity_name, 64)}
            <h3>${esc(a.amenity_name)}</h3>
            <p>${esc(a.description)}</p>
            <span class="count">${a.vehicle_count} vehicles</span>
        </article>`
    ).join('');

    $('amChips').innerHTML = amenities.map(a =>
        `<button class="chip am" aria-pressed="false" data-am="${a.amenity_id}">
            ${VehicleArt.amenityIcon(a.amenity_name, 26)}
            ${esc(a.amenity_name)}
        </button>`
    ).join('');

    $('branchGrid').innerHTML = branches.map(b =>
        `<article class="branch">
            <h3>${esc(b.branch_name)}</h3>
            <p>${esc(b.address)}, ${esc(b.city)}</p>
            <p>\u260E ${esc(b.phone)}</p>
            <p>\u{1F552} ${esc(b.opening_hours || 'Call for hours')}</p>
            <p><b>${b.vehicle_count}</b> vehicles</p>
        </article>`
    ).join('');

    $('sStart').min = $('sEnd').min = today();

    await loadCars();
}

async function loadCars() {
    $('carGrid').innerHTML = '<p class="loading">Loading cars...</p>';

    const p = new URLSearchParams();

    if (state.start) {
        p.set('start_date', state.start);
        p.set('end_date', state.end);
    }

    if ($('sBranch').value) {
        p.set('branch_id', $('sBranch').value);
    }

    state.cars = await api('/public/vehicles?' + p);

    $('carsHint').textContent = state.start
        ? `Availability for ${day(state.start)} to ${day(state.end)}.`
        : 'Showing every vehicle. Pick your dates above to see what is free.';

    renderCars();
}

function renderCars() {
    let list = state.cars.filter(v =>
        (!state.cat || v.category_name === state.cat) &&
        (!$('fTrans').value || v.transmission === $('fTrans').value) &&
        (!$('fAvail').checked || v.bookable) &&
        (
            !$('fSearch').value ||
            `${v.brand} ${v.model}`.toLowerCase().includes($('fSearch').value.toLowerCase())
        ) &&
        [...state.am].every(id =>
            v.amenities.some(a => a.amenity_id === id)
        )
    );

    const s = $('fSort').value;

    if (s) {
        list = [...list].sort((a, b) =>
            s === 'low'
                ? a.daily_rate - b.daily_rate
                : s === 'high'
                    ? b.daily_rate - a.daily_rate
                    : (b.avg_rating || 0) - (a.avg_rating || 0)
        );
    }

    $('carCount').textContent =
        `${list.length} vehicle${list.length === 1 ? '' : 's'} found`;

    $('carGrid').innerHTML = list.length
        ? list.map(v => `
            <article class="car ${v.bookable ? '' : 'off'}">
                ${VehicleArt.picture(v)}
                <div class="body">
                    <div>
                        <span class="tag ${v.bookable ? 'ok' : 'no'}">
                            ${v.bookable
                                ? (state.start ? 'Available for your dates' : 'Available now')
                                : (state.start ? 'Not available for your dates' : 'Not available now')}
                        </span>
                    </div>

                    <h3>${esc(v.brand)} ${esc(v.model)}</h3>

                    ${stars(v.avg_rating, v.rating_count)}

                    <div class="specs">
                        <span>${esc(v.category_name)} \u2022 ${v.year}</span>
                        <span>\u{1F465} ${v.seats} seats</span>
                        <span>\u2699 ${esc(v.transmission)}</span>
                        <span>\u26FD ${esc(v.fuel_type)}</span>
                    </div>

                    <div class="mini" aria-label="Amenities">
                        ${v.amenities.map(a =>
                            VehicleArt.amenityIcon(a.amenity_name, 26)
                                .replace('<svg', `<svg title="${esc(a.amenity_name)}"`)
                        ).join('')}
                    </div>

                    <div class="price">
                        ${peso(v.daily_rate)} <small>/ day</small>
                    </div>

                    <div class="actions">
                        <button class="btn ghost small" data-detail="${v.vehicle_id}">
                            View details
                        </button>
                        <button class="btn small" data-reserve="${v.vehicle_id}" ${v.bookable ? '' : 'disabled'}>
                            Reserve
                        </button>
                    </div>
                </div>
            </article>
        `).join('')
        : '<p class="empty">No vehicles match your filters. Try clearing some filters or changing the dates.</p>';
}

$('amChips').addEventListener('click', e => {
    const b = e.target.closest('.chip');

    if (!b) return;

    const id = Number(b.dataset.am);

    state.am.has(id)
        ? state.am.delete(id)
        : state.am.add(id);

    b.setAttribute('aria-pressed', String(state.am.has(id)));

    renderCars();
});

$('chips').addEventListener('click', e => {
    const b = e.target.closest('.chip');

    if (!b) return;

    state.cat = b.dataset.cat;

    document.querySelectorAll('.chip').forEach(c =>
        c.setAttribute('aria-pressed', String(c === b))
    );

    renderCars();
});

['fTrans', 'fSort', 'fAvail'].forEach(id =>
    $(id).addEventListener('change', renderCars)
);

$('fSearch').addEventListener('input', renderCars);

$('carGrid').addEventListener('click', e => {
    const d = e.target.closest('[data-detail]');
    const r = e.target.closest('[data-reserve]');

    if (d) openCar(Number(d.dataset.detail));
    if (r) openCar(Number(r.dataset.reserve), true);
});

$('searchForm').addEventListener('submit', async e => {
    e.preventDefault();

    const s = $('sStart').value;
    const en = $('sEnd').value;
    const err = $('searchErr');

    err.textContent = '';

    if (!s || !en) {
        err.textContent = 'Please choose both a pick-up and a return date.';
        return;
    }

    if (s < today()) {
        err.textContent = 'Pick-up date cannot be in the past.';
        return;
    }

    if (en < s) {
        err.textContent = 'Return date cannot be before the pick-up date.';
        return;
    }

    state.start = s;
    state.end = en;

    if ($('sCat').value) {
        state.cat = $('sCat').value;

        document.querySelectorAll('.chip').forEach(c =>
            c.setAttribute('aria-pressed', String(c.dataset.cat === state.cat))
        );
    }

    $('fAvail').checked = true;

    await loadCars();

    $('cars').scrollIntoView();
});

$('sStart').addEventListener('change', () => {
    if (!$('sEnd').value || $('sEnd').value < $('sStart').value) {
        $('sEnd').value = addDays($('sStart').value, 1);
    }

    $('sEnd').min = $('sStart').value;
});

/* ---------- car details + booking ---------- */

let quoteTimer = null;

async function openCar(id, focusBook) {
    const v = state.cars.find(c => c.vehicle_id === id);

    if (!v) return;

    const s = state.start || addDays(today(), 1);
    const e = state.end || addDays(s, 2);

    $('carDetail').innerHTML = `
        <div class="car-left">
            ${VehicleArt.picture(v)}

            <h3>What is included</h3>

            <div class="inc">
                ${v.amenities.length
                    ? v.amenities.map(a => `
                        <div>
                            ${VehicleArt.amenityIcon(a.amenity_name, 40)}
                            <span>
                                <b>${esc(a.amenity_name)}</b>
                                <small>${esc(a.description)}</small>
                            </span>
                        </div>
                    `).join('')
                    : '<p class="muted">No extra amenities.</p>'}
            </div>

            <h3>Reviews</h3>
            <div class="reviews" id="revBox">
                <p class="muted">Loading reviews...</p>
            </div>
        </div>

        <div class="car-info">
            <div>
                <span class="tag blue">${esc(v.category_name)}</span>
                ${stars(v.avg_rating, v.rating_count)}
            </div>

            <h2 id="carTitle" style="text-align:left">
                ${esc(v.brand)} ${esc(v.model)}
                <small class="muted">${v.year}</small>
            </h2>

            <div class="kv">
                <div><small>Seats</small>${v.seats}</div>
                <div><small>Transmission</small>${esc(v.transmission)}</div>
                <div><small>Fuel</small>${esc(v.fuel_type)}</div>
                <div><small>Colour</small>${esc(v.color)}</div>
                <div style="grid-column:1/-1">
                    <small>Pick-up branch</small>
                    ${esc(v.branch_name)}, ${esc(v.city)}
                </div>
            </div>

            <table class="rates">
                <tr>
                    <td>Daily (1-6 days)</td>
                    <td>${peso(v.daily_rate)}/day</td>
                </tr>
                ${v.weekly_rate
                    ? `<tr><td>Weekly (7-29 days)</td><td>${peso(v.weekly_rate)}/day</td></tr>`
                    : ''}
                ${v.monthly_rate
                    ? `<tr><td>Monthly (30+ days)</td><td>${peso(v.monthly_rate)}/day</td></tr>`
                    : ''}
            </table>

            <div class="row2">
                <div class="f">
                    <label for="bStart">Pick-up date</label>
                    <input type="date" id="bStart" min="${today()}" value="${s}">
                </div>

                <div class="f">
                    <label for="bEnd">Return date</label>
                    <input type="date" id="bEnd" min="${s}" value="${e}">
                </div>
            </div>

            <div class="quote" id="bQuote" aria-live="polite">
                Calculating price...
            </div>

            <button class="btn big" id="bReserve" data-id="${id}">
                Reserve this car
            </button>

            <p class="fine">
                Pay at the branch when you pick up. Your reservation is confirmed by our staff.
                Please bring a valid driver's license.
            </p>
        </div>
    `;

    open('carModal');

    $('bStart').oninput = $('bEnd').oninput = () => {
        clearTimeout(quoteTimer);
        quoteTimer = setTimeout(() => refreshQuote(id), 250);
    };

    $('bStart').onchange = () => {
        $('bEnd').min = $('bStart').value;

        if ($('bEnd').value < $('bStart').value) {
            $('bEnd').value = $('bStart').value;
            refreshQuote(id);
        }
    };

    $('bReserve').onclick = () => reserve(id);

    api(`/public/vehicles/${id}/reviews`, { quiet: true })
        .then(rows => {
            $('revBox').innerHTML = rows.length
                ? rows.map(r => `
                    <div class="rev">
                        <span class="stars">
                            ${'\u2605'.repeat(r.rating)}${'\u2606'.repeat(5 - r.rating)}
                        </span>
                        <small>${esc(r.customer)} \u2022 ${day(r.rated_at)}</small>
                        <br>
                        ${esc(r.review || '')}
                    </div>
                `).join('')
                : '<p class="muted">No reviews yet. Be the first after your trip!</p>';
        })
        .catch(() => {
            $('revBox').innerHTML = '';
        });

    await refreshQuote(id);

    if (focusBook) $('bReserve').focus();
}

async function refreshQuote(id) {
    const s = $('bStart')?.value;
    const e = $('bEnd')?.value;
    const q = $('bQuote');
    const btn = $('bReserve');

    if (!q) return;

    if (!s || !e || e < s) {
        q.textContent = 'Choose valid dates to see the price.';
        btn.disabled = true;
        return;
    }

    try {
        const [price, av] = await Promise.all([
            api(`/public/quote?vehicle_id=${id}&start_date=${s}&end_date=${e}`, {
                quiet: true
            }),
            api(`/public/availability?vehicle_id=${id}&start_date=${s}&end_date=${e}`, {
                quiet: true
            })
        ]);

        q.innerHTML =
            `${price.days} day${price.days > 1 ? 's' : ''} × ${peso(price.rate_per_day)} (${esc(price.plan_name)}) = <span style="font-size:1.2rem">${peso(price.total_amount)}</span>` +
            (av.bookable
                ? ''
                : '<br><span style="color:#dc2626">Not available for these dates. Please try other dates.</span>');

        btn.disabled = !av.bookable;
    } catch (err) {
        q.textContent = err.message;
        btn.disabled = true;
    }
}

async function reserve(id) {
    const s = $('bStart').value;
    const e = $('bEnd').value;

    if (!state.token) {
        state.afterAuth = () => openCar(id, true);

        return showAuth(
            'login',
            'Please log in or create a free account to reserve this car.'
        );
    }

    const btn = $('bReserve');

    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        await api('/portal/reservations', {
            method: 'POST',
            body: {
                vehicle_id: id,
                start_date: s,
                end_date: e
            }
        });

        close('carModal');
        toast('Reservation sent! Our staff will confirm it soon.', 'ok');
        showAccount('reservations');
        loadCars().catch(() => {});
    } catch (_) {
        btn.disabled = false;
        btn.textContent = 'Reserve this car';
    }
}

/* ---------- log in / sign up ---------- */

function showAuth(mode, notice) {
    $('authNotice').hidden = !notice;
    $('authNotice').textContent = notice || '';

    ['login', 'signup', 'forgot', 'reset'].forEach(m => {
        $(m + 'Form').hidden = m !== mode;
    });

    $('authTitle').textContent = {
        login: 'Welcome back',
        signup: 'Create your account',
        forgot: 'Forgot your password?',
        reset: 'Choose a new password'
    }[mode];

    ['loginErr', 'suErr', 'fgErr', 'rsErr'].forEach(i => {
        $(i).textContent = '';
    });

    $('fgOk').hidden = true;

    if (mode === 'signup') {
        suStep = 0;
        renderSignup();
    }

    open('authModal');
}

$('loginBtn').onclick = () => {
    state.afterAuth = null;
    showAuth('login');
};

$('signupBtn').onclick = () => {
    state.afterAuth = null;
    showAuth('signup');
};

$('toSignup').onclick = e => {
    e.preventDefault();
    showAuth('signup');
};

$('toLogin').onclick = e => {
    e.preventDefault();
    showAuth('login');
};

$('toForgot').onclick = () => {
    showAuth('forgot');
    $('fgEmail').value = $('lEmail').value;
};

$('fgBack').onclick = e => {
    e.preventDefault();
    showAuth('login');
};

$('forgotForm').addEventListener('submit', async e => {
    e.preventDefault();

    $('fgErr').textContent = '';
    $('fgOk').hidden = true;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('fgEmail').value.trim())) {
        $('fgErr').textContent = 'Please enter a valid email address.';
        return;
    }

    try {
        const d = await api('/portal/forgot-password', {
            method: 'POST',
            body: {
                email: $('fgEmail').value.trim()
            },
            quiet: true
        });

        $('fgOk').textContent = d.message;
        $('fgOk').hidden = false;
    } catch (ex) {
        $('fgErr').textContent = ex.message;
    }
});

let resetToken = null;

$('resetForm').addEventListener('submit', async e => {
    e.preventDefault();

    $('rsErr').textContent = '';

    if ($('rsPass').value.length < 8) {
        $('rsErr').textContent = 'Use at least 8 characters.';
        return;
    }

    if ($('rsPass').value !== $('rsPass2').value) {
        $('rsErr').textContent = 'Passwords do not match.';
        return;
    }

    try {
        const d = await api('/portal/reset-password', {
            method: 'POST',
            body: {
                token: resetToken,
                password: $('rsPass').value
            },
            quiet: true
        });

        history.replaceState(null, '', '/');
        toast(d.message, 'ok');
        showAuth('login');
    } catch (ex) {
        $('rsErr').textContent = ex.message;
    }
});

function finishAuth(data, msg) {
    setSession(data);
    close('authModal');
    toast(msg, 'ok');

    const cb = state.afterAuth;
    state.afterAuth = null;

    if (cb) cb();
}

$('loginForm').addEventListener('submit', async e => {
    e.preventDefault();

    const err = $('loginErr');
    err.textContent = '';

    if (!$('lEmail').value.trim() || !$('lPass').value) {
        err.textContent = 'Please enter your email and password.';
        return;
    }

    try {
        const d = await api('/portal/login', {
            method: 'POST',
            body: {
                email: $('lEmail').value.trim(),
                password: $('lPass').value
            },
            quiet: true
        });

        $('lPass').value = '';
        finishAuth(d, `Welcome back, ${d.customer.name}!`);
    } catch (ex) {
        err.textContent = ex.message;
    }
});

const SIGNUP = [
    {
        title: 'Account',
        fields: [
            { n: 'email', l: 'Email', t: 'email', ac: 'email' },
            {
                n: 'password',
                l: 'Password (at least 8 characters)',
                t: 'password',
                ac: 'new-password',
                strength: true
            },
            {
                n: 'password2',
                l: 'Confirm password',
                t: 'password',
                ac: 'new-password'
            }
        ]
    },
    {
        title: 'About you',
        fields: [
            { n: 'first_name', l: 'First name', ac: 'given-name' },
            { n: 'middle_name', l: 'Middle name (optional)', opt: true },
            { n: 'last_name', l: 'Last name', ac: 'family-name' },
            { n: 'birth_date', l: 'Birth date', t: 'date', ac: 'bday' },
            { n: 'gender', l: 'Gender', sel: ['Male', 'Female', 'Other'] },
            {
                n: 'phone',
                l: 'Mobile number',
                t: 'tel',
                ac: 'tel',
                ph: '0917-123-4567'
            }
        ]
    },
    {
        title: 'Address',
        fields: [
            { n: 'street', l: 'Street / house no.', ac: 'address-line1' },
            { n: 'barangay', l: 'Barangay' },
            { n: 'city', l: 'City / municipality', ac: 'address-level2' },
            { n: 'province', l: 'Province', ac: 'address-level1' },
            { n: 'postal_code', l: 'Postal code', ac: 'postal-code' }
        ]
    },
    {
        title: 'License',
        fields: [
            {
                n: 'license_number',
                l: "Driver's license number",
                ph: 'N01-23-456789'
            },
            {
                n: 'license_expiry_date',
                l: 'License expiry date',
                t: 'date'
            },
            {
                n: 'emergency_contact_name',
                l: 'Emergency contact name'
            },
            {
                n: 'emergency_contact_phone',
                l: 'Emergency contact number',
                t: 'tel'
            },
            {
                n: 'agree',
                l: 'I confirm the details are correct and I hold a valid driver\'s license.',
                chk: true
            }
        ]
    }
];

let suStep = 0;
const suData = {};

function renderSignup() {
    $('suProgress').innerHTML = SIGNUP.map((s, i) =>
        `<li class="${i === suStep ? 'on' : i < suStep ? 'done' : ''}">${i + 1}. ${s.title}</li>`
    ).join('');

    $('suFields').innerHTML = SIGNUP[suStep].fields.map(f => {
        const id = 'su_' + f.n;
        const v = suData[f.n] ?? '';

        if (f.chk) {
            return `
                <div class="f">
                    <label class="check">
                        <input type="checkbox" id="${id}" ${suData[f.n] ? 'checked' : ''}>
                        ${esc(f.l)}
                    </label>
                    <small class="err" id="e_${f.n}"></small>
                </div>
            `;
        }

        const input = f.sel
            ? `<select id="${id}">
                <option value="">Select...</option>
                ${f.sel.map(o =>
                    `<option ${o === v ? 'selected' : ''}>${o}</option>`
                ).join('')}
            </select>`
            : `<input id="${id}" type="${f.t || 'text'}" value="${esc(v)}" autocomplete="${f.ac || 'off'}" placeholder="${esc(f.ph || '')}">`;

        return `
            <div class="f" id="f_${f.n}">
                <label for="${id}">${esc(f.l)}</label>
                ${input}
                ${f.strength ? '<div class="strength"><i id="pwBar"></i></div>' : ''}
                <small class="err" id="e_${f.n}"></small>
            </div>
        `;
    }).join('');

    $('suBack').style.visibility = suStep ? 'visible' : 'hidden';

    $('suNext').textContent =
        suStep === SIGNUP.length - 1
            ? 'Create my account'
            : 'Next';

    const pw = $('su_password');

    if (pw) {
        pw.addEventListener('input', () => {
            const v = pw.value;

            const sc = Math.min(
                4,
                (v.length >= 8) +
                /[A-Z]/.test(v) +
                /\d/.test(v) +
                /[^A-Za-z0-9]/.test(v)
            );

            const b = $('pwBar');

            b.style.width = sc * 25 + '%';
            b.style.background = [
                '#dc2626',
                '#dc2626',
                '#d97706',
                '#16a34a',
                '#16a34a'
            ][sc];
        });
    }

    $('suFields').querySelector('input,select')?.focus();
}

function collect() {
    for (const f of SIGNUP[suStep].fields) {
        const el = $('su_' + f.n);
        suData[f.n] = f.chk ? el.checked : el.value.trim();
    }
}

function validateStep() {
    collect();

    let ok = true;

    const age = d => {
        const b = new Date(d + 'T00:00:00');
        const t = new Date();

        let a = t.getFullYear() - b.getFullYear();

        if (t < new Date(t.getFullYear(), b.getMonth(), b.getDate())) {
            a--;
        }

        return a;
    };

    for (const f of SIGNUP[suStep].fields) {
        let m = '';
        const v = suData[f.n];

        if (f.chk) {
            if (!v) {
                m = 'Please tick this box to continue.';
            }
        } else if (!v && !f.opt) {
            m = 'This field is required.';
        } else if (
            f.n === 'email' &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        ) {
            m = 'Please enter a valid email address.';
        } else if (f.n === 'password' && v.length < 8) {
            m = 'Use at least 8 characters.';
        } else if (f.n === 'password2' && v !== suData.password) {
            m = 'Passwords do not match.';
        } else if (
            f.n === 'birth_date' &&
            v &&
            (age(v) < 18 || age(v) > 100)
        ) {
            m = age(v) < 18
                ? 'You must be at least 18 years old.'
                : 'Please check the birth date.';
        } else if (
            f.n === 'license_expiry_date' &&
            v &&
            v < today()
        ) {
            m = 'Your license must not be expired.';
        }

        const el = $('e_' + f.n);

        if (el) el.textContent = m;

        $('f_' + f.n)?.classList.toggle('bad', !!m);

        if (m) ok = false;
    }

    if (!ok) {
        $('suFields').querySelector('.bad input,.bad select')?.focus();
    }

    return ok;
}

$('suBack').onclick = () => {
    collect();
    suStep = Math.max(0, suStep - 1);
    renderSignup();
};

$('signupForm').addEventListener('submit', async e => {
    e.preventDefault();

    $('suErr').textContent = '';

    if (!validateStep()) return;

    if (suStep < SIGNUP.length - 1) {
        suStep++;
        renderSignup();
        return;
    }

    const body = { ...suData };

    delete body.password2;
    delete body.agree;

    if (!body.middle_name) {
        delete body.middle_name;
    }

    const btn = $('suNext');

    btn.disabled = true;
    btn.textContent = 'Creating...';

    try {
        const d = await api('/portal/signup', {
            method: 'POST',
            body,
            quiet: true
        });

        Object.keys(suData).forEach(k => delete suData[k]);

        finishAuth(d, `Account created. Welcome, ${d.customer.name}!`);
    } catch (ex) {
        $('suErr').textContent = ex.message;
        btn.disabled = false;
        btn.textContent = 'Create my account';
    } finally {
        btn.disabled = false;

        if (btn.textContent === 'Creating...') {
            btn.textContent = 'Create my account';
        }
    }
});

$('logoutBtn').onclick = async () => {
    try {
        await api('/portal/logout', {
            method: 'POST',
            quiet: true
        });
    } catch (_) {
        /* ignore */
    }

    setSession(null);
    toast('You are logged out. See you soon!');
};

/* ---------- My Account ---------- */

function showHome() {
    $('pageAccount').hidden = true;
    $('pageHome').hidden = false;
}

$('backHome').onclick = () => {
    showHome();
    window.scrollTo(0, 0);
};

$('accountBtn').onclick = () => showAccount('reservations');

function showAccount(tab) {
    if (!state.token) return showAuth('login');

    state.tab = tab;

    $('pageHome').hidden = true;
    $('pageAccount').hidden = false;

    window.scrollTo(0, 0);

    $('welcome').textContent =
        `Hello, ${state.customer?.name?.split(' ')[0] || 'there'}!`;

    document.querySelectorAll('#accTabs [role=tab]').forEach(t => {
        t.setAttribute('aria-selected', String(t.dataset.tab === tab));
    });

    ({
        reservations: loadReservations,
        rentals: loadRentals,
        ratings: loadRatings,
        profile: loadProfile
    })[tab]().catch(() => {});
}

document.querySelectorAll('#accTabs [role=tab]').forEach(t =>
    t.addEventListener('click', () => showAccount(t.dataset.tab))
);

const STATUS = {
    Pending: ['pend', 'Waiting for confirmation'],
    Confirmed: ['ok', 'Confirmed - see you at the branch'],
    Cancelled: ['no', 'Cancelled'],
    Completed: ['gray', 'Completed'],
    'No-Show': ['no', 'Marked as no-show'],
    Active: ['blue', 'Currently renting'],
    Returned: ['ok', 'Returned'],
    Overdue: ['no', 'Overdue - please return']
};

const tag = s =>
    `<span class="tag ${(STATUS[s] || ['gray'])[0]}">${esc((STATUS[s] || [0, s])[1])}</span>`;

async function loadReservations() {
    $('accBody').innerHTML = '<p class="loading">Loading...</p>';

    const rows = await api('/portal/reservations');

    $('accBody').innerHTML = rows.length
        ? `<div class="list">
            ${rows.map(r => `
                <article class="item">
                    <div>
                        <h3>
                            ${esc(r.vehicle_name)}
                            <small class="muted">${esc(r.plate_number)}</small>
                        </h3>

                        <p class="meta">
                            ${day(r.start_date)} → ${day(r.end_date)}
                            • Reservation #${r.reservation_id}
                        </p>

                        <p>${tag(r.status)}</p>
                    </div>

                    <div>
                        ${['Pending', 'Confirmed'].includes(r.status) && !r.rental_id
                            ? `<button class="btn ghost small" data-cancel="${r.reservation_id}">Cancel reservation</button>`
                            : ''}
                    </div>
                </article>
            `).join('')}
        </div>`
        : `<div class="empty">
            <p>You have no reservations yet.</p>
            <p><button class="btn" id="goCars">Browse cars</button></p>
        </div>`;

    $('goCars')?.addEventListener('click', () => {
        showHome();
        $('cars').scrollIntoView();
    });
}

async function loadRentals() {
    $('accBody').innerHTML = '<p class="loading">Loading...</p>';

    const rows = await api('/portal/rentals');

    $('accBody').innerHTML = rows.length
        ? `<div class="list">
            ${rows.map(r => `
                <article class="item" style="align-items:flex-start">
                    <div style="flex:1;min-width:240px">
                        <h3>
                            ${esc(r.vehicle_name)}
                            <small class="muted">${esc(r.plate_number)}</small>
                        </h3>

                        <p class="meta">
                            Picked up ${dayTime(r.rental_date)}
                            • Due ${dayTime(r.due_date)}
                            ${r.return_date
                                ? ' • Returned ' + dayTime(r.return_date)
                                : ''}
                        </p>

                        <p>${tag(r.status)} <b>${peso(r.total_amount)}</b></p>

                        ${r.status === 'Overdue'
                            ? `<p class="alert">
                                This rental is ${r.days_late} day(s) overdue.
                                A late fee of ${peso(r.late_fee_per_day)} per day applies.
                                Please return the vehicle or contact ${esc(r.pickup_branch)}.
                            </p>`
                            : ''}

                        ${r.fee_amount > 0 && r.status !== 'Overdue'
                            ? `<p class="meta">
                                Late fee: ${peso(r.fee_amount)} (${esc(r.late_fee_status)})
                            </p>`
                            : ''}

                        ${r.payments.length
                            ? `<p class="meta">
                                Payments: ${r.payments.map(p =>
                                    `${esc(p.payment_type)} ${peso(p.amount)} (${esc(p.status)})`
                                ).join(', ')}
                            </p>`
                            : ''}
                    </div>
                </article>
            `).join('')}
        </div>`
        : '<div class="empty">You have no rentals yet. Once the branch hands you a car, it will show up here.</div>';
}

const PROFILE = [
    ['phone', 'Mobile number'],
    ['street', 'Street'],
    ['barangay', 'Barangay'],
    ['city', 'City'],
    ['province', 'Province'],
    ['postal_code', 'Postal code'],
    ['license_expiry_date', 'License expiry date', 'date'],
    ['emergency_contact_name', 'Emergency contact'],
    ['emergency_contact_phone', 'Emergency number']
];

async function loadProfile() {
    const c = await api('/portal/me');

    $('accBody').innerHTML = `
        <form class="card profile" id="profileForm" novalidate>
            <p>
                <b>${esc(c.first_name)} ${esc(c.last_name)}</b>
                <br>
                <span class="muted">
                    ${esc(c.email)} • License ${esc(c.license_number)}
                </span>
            </p>

            <br>

            ${PROFILE.map(([n, l, t]) => `
                <div class="f">
                    <label for="p_${n}">${l}</label>
                    <input id="p_${n}" type="${t || 'text'}" value="${esc(c[n])}">
                </div>
            `).join('')}

            <p class="err" id="profileErr" role="alert"></p>

            <button class="btn" type="submit">Save changes</button>
        </form>

        <form class="card profile" id="pwForm" novalidate>
            <h3>Change password</h3>

            <br>

            <div class="f">
                <label for="pw_cur">Current password</label>
                <input id="pw_cur" type="password" autocomplete="current-password">
            </div>

            <div class="f">
                <label for="pw_new">New password (at least 8 characters)</label>
                <input id="pw_new" type="password" autocomplete="new-password">
            </div>

            <p class="err" id="pwErr" role="alert"></p>

            <button class="btn" type="submit">Change password</button>
        </form>
    `;

    $('pwForm').addEventListener('submit', async e => {
        e.preventDefault();

        try {
            await api('/portal/password', {
                method: 'PUT',
                body: {
                    current_password: $('pw_cur').value,
                    new_password: $('pw_new').value
                },
                quiet: true
            });

            toast('Password changed', 'ok');

            $('pw_cur').value = $('pw_new').value = '';
            $('pwErr').textContent = '';
        } catch (ex) {
            $('pwErr').textContent = ex.message;
        }
    });

    $('profileForm').addEventListener('submit', async e => {
        e.preventDefault();

        const body = {};

        PROFILE.forEach(([n]) => {
            body[n] = $('p_' + n).value.trim();
        });

        try {
            await api('/portal/me', {
                method: 'PUT',
                body,
                quiet: true
            });

            toast('Profile saved', 'ok');
            $('profileErr').textContent = '';
        } catch (ex) {
            $('profileErr').textContent = ex.message;
        }
    });
}

async function loadRatings() {
    $('accBody').innerHTML = '<p class="loading">Loading...</p>';

    const rows = await api('/portal/ratings');

    $('accBody').innerHTML = rows.length
        ? `<div class="list">
            ${rows.map(r => `
                <article class="item" data-vid="${r.vehicle_id}" data-rating="${r.rating || 0}">
                    <div>
                        <h3>
                            ${esc(r.brand)} ${esc(r.model)}
                            <small class="muted">${esc(r.plate_number)}</small>
                        </h3>

                        <p class="meta">Returned ${day(r.last_returned)}</p>
                    </div>

                    <div class="rate-form">
                        <div class="rate-row" role="radiogroup" aria-label="Your rating">
                            ${[1, 2, 3, 4, 5].map(n => `
                                <button
                                    type="button"
                                    role="radio"
                                    aria-checked="${r.rating === n}"
                                    class="${n <= (r.rating || 0) ? 'on' : ''}"
                                    data-star="${n}"
                                    aria-label="${n} star${n > 1 ? 's' : ''}"
                                >\u2605</button>
                            `).join('')}
                        </div>

                        <textarea rows="2" placeholder="Write a short review (optional)" aria-label="Review">${esc(r.review || '')}</textarea>

                        <p style="margin-top:.4rem">
                            <button class="btn small" data-saverate="${r.vehicle_id}">
                                ${r.rating ? 'Update rating' : 'Submit rating'}
                            </button>

                            ${r.rating
                                ? `<button class="btn ghost small" data-delrate="${r.vehicle_id}">Remove</button>`
                                : ''}
                        </p>
                    </div>
                </article>
            `).join('')}
        </div>`
        : '<div class="empty">You can rate a car after you have rented and returned it. Your finished rentals will appear here.</div>';
}

$('accBody').addEventListener('click', async e => {
    const star = e.target.closest('[data-star]');

    if (star) {
        const item = star.closest('.item');
        const n = Number(star.dataset.star);

        item.dataset.rating = n;

        item.querySelectorAll('[data-star]').forEach(b => {
            b.classList.toggle('on', Number(b.dataset.star) <= n);
            b.setAttribute(
                'aria-checked',
                String(Number(b.dataset.star) === n)
            );
        });

        return;
    }

    const sv = e.target.closest('[data-saverate]');

    if (sv) {
        const item = sv.closest('.item');
        const rating = Number(item.dataset.rating);

        if (!rating) {
            return toast('Please choose 1 to 5 stars first.', 'bad');
        }

        try {
            await api(`/portal/ratings/${sv.dataset.saverate}`, {
                method: 'PUT',
                body: {
                    rating,
                    review: item.querySelector('textarea').value
                }
            });

            toast('Thanks for your rating!', 'ok');

            loadRatings();
            loadCars().catch(() => {});
        } catch (_) {
            
        }

        return;
    }

    const dl = e.target.closest('[data-delrate]');

    if (dl) {
        if (!confirm('Remove your rating?')) return;

        try {
            await api(`/portal/ratings/${dl.dataset.delrate}`, {
                method: 'DELETE'
            });

            toast('Rating removed', 'ok');

            loadRatings();
            loadCars().catch(() => {});
        } catch (_) {
            
        }

        return;
    }

    const b = e.target.closest('[data-cancel]');

    if (!b) return;

    if (!confirm('Cancel this reservation?')) return;

    try {
        await api('/portal/reservations/' + b.dataset.cancel, {
            method: 'DELETE'
        });

        toast('Reservation cancelled', 'ok');
        loadReservations();
    } catch (_) {
    
    }
});


function createWelcomeCover() {
    let cover = $('welcomeCover');

    if (!cover) {
        cover = document.createElement('section');
        cover.id = 'welcomeCover';

        cover.innerHTML = `
            <div class="welcome-content">
                <img
                    src="logo.png"
                    class="welcome-logo"
                >

                <h1>V-RENT</h1>
                <p>Your journey starts here.</p>

                <div class="welcome-actions">
                    <button type="button" id="coverLogin" class="btn">
                        Log In
                    </button>

                    <button type="button" id="coverSignup" class="btn ghost">
                        Sign Up
                    </button>
                </div>
            </div>
        `;

        document.body.prepend(cover);
    }

    $('coverLogin').onclick = () => {
        state.afterAuth = null;
        showAuth('login');
    };

    $('coverSignup').onclick = () => {
        state.afterAuth = null;
        showAuth('signup');
    };
}

function renderAccess() {
    const loggedIn = !!state.token;

    createWelcomeCover();

    $('welcomeCover').hidden = loggedIn;

    document.querySelectorAll(
        'header, #pageHome, #pageAccount, footer, .skip'
    ).forEach(el => {
        el.hidden = !loggedIn;
    });

    document.body.classList.toggle('welcome-mode', !loggedIn);
}

renderNav();
renderAccess();

const resetParam = new URLSearchParams(location.search).get('reset');

if (resetParam) {
    resetToken = resetParam;
    showAuth('reset', 'Choose a new password for your account.');
}

initHome().catch(() => {
    $('carGrid').innerHTML =
        '<p class="empty">We could not load the cars right now. Please refresh the page.</p>';
});

renderNav();
renderAccess();

initHome().catch(() => {
    $('carGrid').innerHTML =
        '<p class="empty">We could not load the cars right now. Please refresh the page.</p>';
});

function addPasswordToggle() {
  document.querySelectorAll('.f input[type="password"]').forEach(input => {
    if (input.dataset.eyeAdded) return;

    input.dataset.eyeAdded = "true";
    input.classList.add("password-toggle-input");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "password-eye";
    button.textContent = "👁";
    button.setAttribute("aria-label", "Show password");

    button.addEventListener("click", () => {
      const showing = input.type === "text";

      input.type = showing ? "password" : "text";
      button.textContent = showing ? "👁" : "🙈";
      button.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password"
      );
    });

    input.insertAdjacentElement("afterend", button);
  });
}

addPasswordToggle();

const passwordObserver = new MutationObserver(() => {
  addPasswordToggle();
});

passwordObserver.observe(document.body, {
  childList: true,
  subtree: true
});

(function (root) {
  const COLORS = {
    white: '#f4f7fb',
    silver: '#c5ced9',
    black: '#1f2937',
    gray: '#6b7280',
    grey: '#6b7280',
    orange: '#f97316',
    red: '#dc2626',
    blue: '#2563eb',
    yellow: '#facc15',
    green: '#16a34a'
  };

  const LINE = 'rgba(15,23,42,.38)';
  const AMENITY_COLOR = '#3b9ae1';

  let illustrationCount = 0;

  function slug(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function photoUrl(vehicle) {
    return `/images/vehicles/${slug(vehicle.brand)}-${slug(vehicle.model)}.jpg`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    })[character]);
  }

  function styleOf(vehicle) {
    const model = String(vehicle.model || '').toLowerCase();
    const category = vehicle.category_name;

    if (category === 'Motorcycle') return 'scooter';
    if (category === 'Pickup') return 'pickup';

    if (category === 'Van') {
      if (/staria|carnival/.test(model)) return 'mpv';
      if (/l300/.test(model)) return 'l300';
      return 'van';
    }

    if (category === 'SUV') {
      return /cr-v|crv/.test(model) ? 'crossover' : 'suv';
    }

    return /mirage/.test(model) ? 'compact' : 'sedan';
  }

  function tire(cx, cy, radius) {
    return `
      <circle cx="${cx}" cy="${cy}" r="${radius + 4}" fill="#0b1220"/>
      <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#111827"/>
      <circle cx="${cx}" cy="${cy}" r="${radius * 0.6}" fill="#d5dde8"/>
      <circle cx="${cx}" cy="${cy}" r="${radius * 0.22}" fill="#64748b"/>
      ${[0, 72, 144, 216, 288].map(angle => `
        <line
          x1="${cx}"
          y1="${cy}"
          x2="${(cx + Math.cos(angle * Math.PI / 180) * radius * 0.58).toFixed(1)}"
          y2="${(cy + Math.sin(angle * Math.PI / 180) * radius * 0.58).toFixed(1)}"
          stroke="#94a3b8"
          stroke-width="2"
        />
      `).join('')}
    `;
  }

  function lights(x1, x2, y) {
    return `
      <rect x="${x1}" y="${y}" width="14" height="8" rx="3" fill="#fde68a"/>
      <rect x="${x2}" y="${y}" width="8" height="11" rx="3" fill="#ef4444"/>
    `;
  }

  function body(style, bodyColor, glassColor) {
    const glass = glassColor;

    switch (style) {
      case 'suv':
        return `
          <path d="M24 122V98c0-8 6-13 16-15l30-7 20-22c4-4 9-6 16-6h112c10 0 18 4 24 12l16 22 24 6c9 3 14 9 14 18v14z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M100 76l16-18c3-3 6-4 11-4h28v22zM162 54h50c6 0 11 3 15 8l12 14h-77z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <rect x="98" y="43" width="132" height="5" rx="2.5" fill="${LINE}"/>
          <rect x="118" y="86" width="14" height="3" rx="1.5" fill="${LINE}"/>
          <rect x="190" y="86" width="14" height="3" rx="1.5" fill="${LINE}"/>
          <rect x="266" y="100" width="30" height="5" rx="2" fill="rgba(0,0,0,.35)"/>
          ${lights(282, 24, 96)}
          ${tire(88, 124, 20)}
          ${tire(252, 124, 20)}
        `;

      case 'crossover':
        return `
          <path d="M22 122V102c0-8 6-12 16-14l36-8c10-14 30-24 62-24h42c18 0 34 8 46 24l30 8c10 3 14 8 14 16v18z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M92 80c10-10 26-18 50-18h28v20zM178 62h30c10 2 20 9 28 20h-58z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <rect x="106" y="50" width="100" height="4" rx="2" fill="${LINE}"/>
          ${lights(284, 22, 98)}
          ${tire(86, 124, 20)}
          ${tire(250, 124, 20)}
        `;

      case 'van':
        return `
          <path d="M20 122V68c0-10 7-17 18-17h178c9 0 16 4 21 11l24 32c8 4 15 9 15 20v8z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M38 62h46v26H34zM92 62h46v26H92zM146 62h46v26h-46zM200 62h20c4 0 7 2 9 5l14 21h-43z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <line x1="84" y1="62" x2="84" y2="118" stroke="${LINE}"/>
          <line x1="192" y1="62" x2="192" y2="118" stroke="${LINE}"/>
          ${lights(288, 20, 104)}
          ${tire(82, 124, 20)}
          ${tire(246, 124, 20)}
        `;

      case 'l300':
        return `
          <path d="M20 122V62c0-8 6-12 14-12h150c8 0 14 4 18 10l20 26h26c10 4 16 10 16 22v14z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M200 64h14c4 2 8 6 12 12l10 12h-36z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <path d="M36 62h40v22H36z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <line x1="150" y1="52" x2="150" y2="118" stroke="${LINE}"/>
          ${lights(284, 20, 104)}
          ${tire(78, 124, 20)}
          ${tire(244, 124, 20)}
        `;

      case 'mpv':
        return `
          <path d="M22 122V90c0-12 8-18 22-20l36-8c14-14 40-20 80-20 30 0 52 10 66 32l20 6c14 4 20 10 20 22v20z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M86 70c12-8 30-12 56-12h36c18 0 34 6 46 22h-138z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <line x1="150" y1="58" x2="150" y2="80" stroke="${LINE}" stroke-width="2"/>
          <line x1="204" y1="60" x2="204" y2="80" stroke="${LINE}" stroke-width="2"/>
          ${lights(290, 22, 98)}
          ${tire(86, 124, 20)}
          ${tire(248, 124, 20)}
        `;

      case 'pickup':
        return `
          <path d="M18 122V92c0-4 3-7 7-7h102v-18c0-4 3-7 7-7h30c7 0 13 3 18 8l22 22 32 6c9 2 14 8 14 16v10z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M30 85h98v24H30z" fill="rgba(0,0,0,.2)"/>
          <path d="M142 66h28c5 0 9 2 12 5l14 14h-54z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <line x1="62" y1="85" x2="62" y2="109" stroke="rgba(0,0,0,.2)"/>
          <line x1="96" y1="85" x2="96" y2="109" stroke="rgba(0,0,0,.2)"/>
          <rect x="266" y="98" width="30" height="5" rx="2" fill="rgba(0,0,0,.35)"/>
          ${lights(284, 18, 98)}
          ${tire(76, 124, 20)}
          ${tire(246, 124, 20)}
        `;

      case 'scooter':
        return `
          <circle cx="90" cy="116" r="24" fill="none" stroke="#0b1220" stroke-width="10"/>
          <circle cx="90" cy="116" r="9" fill="#94a3b8"/>
          <circle cx="238" cy="116" r="24" fill="none" stroke="#0b1220" stroke-width="10"/>
          <circle cx="238" cy="116" r="9" fill="#94a3b8"/>
          <rect x="104" y="112" width="52" height="8" rx="3" fill="#94a3b8"/>
          <rect x="130" y="98" width="62" height="12" rx="4" fill="#1f2937"/>
          <path d="M58 106c-2-26 18-42 48-42l44 2c6 14 8 28 0 42z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M66 64c22-10 60-10 86 0l-2 8H68z" fill="#111827"/>
          <path d="M186 108l10-46c2-8 10-12 18-10l10 4-10 52z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M206 52l10-16h24" fill="none" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
          <path d="M216 56l20 54" stroke="#64748b" stroke-width="6" stroke-linecap="round"/>
          <ellipse cx="226" cy="62" rx="9" ry="6" fill="#fde68a"/>
          <rect x="56" y="84" width="8" height="12" rx="3" fill="#ef4444"/>
        `;

      case 'compact':
        return `
          <path d="M24 114c0-10 7-15 20-18l40-8c14-18 36-28 70-28 26 0 46 12 60 30l34 8c12 3 20 10 20 22v10H24z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M96 86c10-12 28-20 56-20 22 0 40 9 52 22z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <line x1="160" y1="67" x2="160" y2="88" stroke="${LINE}" stroke-width="3"/>
          ${lights(284, 24, 100)}
          ${tire(86, 124, 19)}
          ${tire(240, 124, 19)}
        `;

      default:
        return `
          <path d="M22 114c0-9 7-14 20-17l44-9c14-18 38-28 74-28 28 0 50 12 66 30l36 8c13 3 22 10 22 22v10H22z"
            fill="${bodyColor}" stroke="${LINE}" stroke-width="2"/>
          <path d="M96 86c12-12 32-20 62-20 24 0 42 9 56 22z"
            fill="${glass}" stroke="${LINE}" stroke-width="1.5"/>
          <line x1="162" y1="67" x2="162" y2="88" stroke="${LINE}" stroke-width="3"/>
          <rect x="172" y="98" width="14" height="3" rx="1.5" fill="${LINE}"/>
          ${lights(288, 22, 102)}
          ${tire(84, 124, 20)}
          ${tire(242, 124, 20)}
        `;
    }
  }

  function svg(vehicle) {
    const style = styleOf(vehicle);
    const color = COLORS[String(vehicle.color || '').toLowerCase()] || '#64748b';

    illustrationCount += 1;

    const id = `vehicle-${vehicle.vehicle_id || illustrationCount}`;
    const bodyGradient = `url(#bd-${id})`;
    const glassGradient = `url(#gl-${id})`;

    const plate = vehicle.plate_number
      ? `
        <rect
          x="${style === 'scooter' ? 40 : 14}"
          y="130"
          width="62"
          height="14"
          rx="3"
          fill="#f8fafc"
          stroke="#334155"
          stroke-width="1"
        />
        <text
          x="${style === 'scooter' ? 71 : 45}"
          y="141"
          text-anchor="middle"
          font-size="8.5"
          font-family="Arial, sans-serif"
          font-weight="700"
          fill="#0f172a"
        >${esc(vehicle.plate_number)}</text>
      `
      : '';

    const label = `${esc(vehicle.brand)} ${esc(vehicle.model)}`.toUpperCase();

    return `
      <svg
        viewBox="0 0 320 160"
        role="img"
        aria-label="${esc(vehicle.color)} ${esc(vehicle.brand)} ${esc(vehicle.model)}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bd-${id}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="${color}"/>
            <stop offset=".55" stop-color="${color}"/>
            <stop offset="1" stop-color="${color}" stop-opacity=".82"/>
          </linearGradient>

          <linearGradient id="gl-${id}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#d6efff"/>
            <stop offset="1" stop-color="#8cc8ef"/>
          </linearGradient>
        </defs>

        <ellipse
          cx="160"
          cy="146"
          rx="132"
          ry="8"
          fill="rgba(15,23,42,.16)"
        />

        ${body(style, bodyGradient, glassGradient)}

        <path
          d="M40 98h210"
          stroke="rgba(255,255,255,.28)"
          stroke-width="3"
          stroke-linecap="round"
          ${style === 'scooter' ? 'opacity="0"' : ''}
        />

        ${plate}

        <text
          x="306"
          y="18"
          text-anchor="end"
          font-size="10"
          font-family="Arial, sans-serif"
          font-weight="700"
          letter-spacing=".5"
          fill="currentColor"
          opacity=".45"
        >${label}</text>
      </svg>
    `;
  }

  function picture(vehicle, extraClass = '') {
    return `
      <div class="vpic ${extraClass}">
        ${svg(vehicle)}
        <img
          src="${photoUrl(vehicle)}"
          alt="${esc(vehicle.brand)} ${esc(vehicle.model)}"
          loading="lazy"
          onerror="this.remove()"
        >
      </div>
    `;
  }

  const ICONS = {
    dash: `
      <rect x="10" y="12" width="44" height="30" rx="6"
        fill="none" stroke="currentColor" stroke-width="3"/>
      <path d="M14 42l-6 10h48l-6-10"
        fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <rect x="24" y="16" width="16" height="10" rx="3" fill="${AMENITY_COLOR}"/>
      <circle cx="32" cy="21" r="3" fill="#fff"/>
      <line x1="32" y1="12" x2="32" y2="16" stroke="currentColor" stroke-width="3"/>
      <circle cx="46" cy="36" r="2.5" fill="#ef4444"/>
    `,

    roof: `
      <path d="M8 40c2-8 10-12 20-12h14c8 0 14 4 18 12v6H8z"
        fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="20" cy="48" r="5" fill="currentColor"/>
      <circle cx="46" cy="48" r="5" fill="currentColor"/>
      <line x1="14" y1="24" x2="54" y2="24"
        stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      <line x1="20" y1="24" x2="20" y2="30" stroke="currentColor" stroke-width="3"/>
      <line x1="46" y1="24" x2="46" y2="30" stroke="currentColor" stroke-width="3"/>
      <rect x="20" y="10" width="26" height="14" rx="3" fill="${AMENITY_COLOR}"/>
      <line x1="33" y1="10" x2="33" y2="24" stroke="#fff" stroke-width="2"/>
    `,

    gps: `
      <rect x="12" y="8" width="40" height="48" rx="7"
        fill="none" stroke="currentColor" stroke-width="3"/>
      <rect x="17" y="13" width="30" height="30" rx="3"
        fill="${AMENITY_COLOR}" opacity=".25"/>
      <path d="M32 18c-5 0-8 4-8 8 0 6 8 14 8 14s8-8 8-14c0-4-3-8-8-8z"
        fill="#ef4444"/>
      <circle cx="32" cy="26" r="3" fill="#fff"/>
      <path d="M19 40c6-4 10 0 14-2"
        fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="3 3"/>
      <circle cx="32" cy="50" r="2.5" fill="currentColor"/>
    `,

    parking: `
      <path d="M12 44c0-8 4-14 10-16h20c6 2 10 8 10 16v6H12z"
        fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <rect x="16" y="40" width="8" height="4" rx="1" fill="#ef4444"/>
      <rect x="40" y="40" width="8" height="4" rx="1" fill="#ef4444"/>
      <circle cx="20" cy="52" r="4" fill="currentColor"/>
      <circle cx="44" cy="52" r="4" fill="currentColor"/>
      <path d="M24 18c4-4 12-4 16 0"
        fill="none" stroke="${AMENITY_COLOR}" stroke-width="3" stroke-linecap="round"/>
      <path d="M19 12c7-7 19-7 26 0"
        fill="none" stroke="${AMENITY_COLOR}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="24" r="2.5" fill="${AMENITY_COLOR}"/>
    `,

    wireless: `
      <rect x="20" y="6" width="24" height="40" rx="5"
        fill="none" stroke="currentColor" stroke-width="3"/>
      <rect x="26" y="9" width="12" height="3" rx="1.5" fill="currentColor"/>
      <path d="M33 18l-5 9h4l-2 8 7-11h-4z" fill="${AMENITY_COLOR}"/>
      <rect x="10" y="50" width="44" height="8" rx="4" fill="${AMENITY_COLOR}"/>
      <path d="M22 47c4 3 16 3 20 0"
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    `,

    other: `
      <circle cx="32" cy="32" r="22"
        fill="none" stroke="currentColor" stroke-width="3"/>
      <path d="M21 33l8 8 14-17"
        fill="none" stroke="${AMENITY_COLOR}" stroke-width="5"
        stroke-linecap="round" stroke-linejoin="round"/>
    `
  };

  function amenityKey(name) {
    const value = String(name || '').toLowerCase();

    if (/dash/.test(value)) return 'dash';
    if (/roof|luggage/.test(value)) return 'roof';
    if (/gps|navigat/.test(value)) return 'gps';
    if (/parking|sensor/.test(value)) return 'parking';
    if (/wireless|charger/.test(value)) return 'wireless';

    return 'other';
  }

  function amenityIcon(name, size = 56) {
    return `
      <svg
        class="aicon"
        viewBox="0 0 64 64"
        width="${size}"
        height="${size}"
        role="img"
        aria-label="${esc(name)}"
        xmlns="http://www.w3.org/2000/svg"
      >
        ${ICONS[amenityKey(name)]}
      </svg>
    `;
  }

  root.VehicleArt = {
    svg,
    picture,
    photoUrl,
    slug,
    amenityIcon,
    styleOf
  };

  if (typeof module !== 'undefined') {
    module.exports = root.VehicleArt;
  }
})(typeof window !== 'undefined' ? window : globalThis);

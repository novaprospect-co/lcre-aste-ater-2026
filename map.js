(function () {
  'use strict';
  const positioned = p => ['verified', 'street'].includes(p.geocoding?.status) && Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
  const colors = ['Ottimo', 'Buono', 'Sufficiente', 'Poco', 'Basso', 'NA'];
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scroll = element => element?.scrollIntoView({ behavior: reducedMotion() ? 'instant' : 'smooth', block: 'center' });

  function create(properties, format) {
    const canvas = document.getElementById('property-map');
    const status = document.getElementById('map-status');
    const review = document.getElementById('map-review');
    const reviewList = document.getElementById('map-review-list');
    const tileMessage = document.getElementById('map-tile-message');
    const interaction = document.getElementById('map-interaction');
    const escape = format.escape;
    const getCard = id => document.querySelector(`.property-card[data-property-id="${id}"]`);
    let activeId = null;
    function highlightCard(id, move = false) {
      document.querySelectorAll('.property-card.is-selected').forEach(card => card.classList.remove('is-selected'));
      const card = getCard(id);
      if (card) {
        card.classList.add('is-selected');
        if (move) { scroll(card); card.focus({ preventScroll: true }); }
      }
    }
    reviewList.addEventListener('click', event => {
      const button = event.target.closest('[data-card-id]');
      if (button) highlightCard(button.dataset.cardId, true);
    });
    if (!window.L) {
      tileMessage.hidden = false;
      tileMessage.textContent = 'Mappa non disponibile. Tutti i lotti restano consultabili nelle schede.';
      return { update: () => { status.textContent = 'Mappa non disponibile'; }, selectFromCard: () => {}, positioned };
    }
    const coarse = matchMedia('(pointer: coarse)');
    const map = L.map(canvas, { scrollWheelZoom: false, dragging: !coarse.matches, touchZoom: false, doubleClickZoom: false, zoomControl: false, minZoom: 9, maxZoom: 19, zoomAnimation: !reducedMotion() }).setView([41.895, 12.49], 12);
    L.control.zoom({ zoomInTitle: 'Ingrandisci', zoomOutTitle: 'Riduci' }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>');
    const layer = L.layerGroup().addTo(map);
    const markers = new Map();
    const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, updateWhenIdle: true, keepBuffer: 0, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors' });
    tileLayer.on('tileerror', () => { tileMessage.hidden = false; tileMessage.textContent = 'Fondomappa non disponibile. Marker e schede restano consultabili.'; });
    tileLayer.on('tileload', () => { tileMessage.hidden = true; });
    // Only request tiles for the map while it is actually in view. No prefetch or geocoding.
    if (location.protocol !== 'file:') {
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) { if (!map.hasLayer(tileLayer)) tileLayer.addTo(map); }
        else if (map.hasLayer(tileLayer)) map.removeLayer(tileLayer);
      });
      observer.observe(canvas);
    }
    function interactionMode(enabled) {
      canvas.classList.toggle('map-interactive', enabled);
      interaction.setAttribute('aria-pressed', String(enabled));
      interaction.textContent = enabled ? 'Torna allo scorrimento della pagina' : 'Interagisci con la mappa';
      if (enabled || !coarse.matches) map.dragging.enable(); else map.dragging.disable();
      if (enabled && coarse.matches) map.touchZoom.enable(); else map.touchZoom.disable();
    }
    interaction.hidden = !coarse.matches;
    interaction.addEventListener('click', () => interactionMode(interaction.getAttribute('aria-pressed') !== 'true'));
    coarse.addEventListener('change', () => { interaction.hidden = !coarse.matches; interactionMode(false); });
    interactionMode(false);

    function identify(id, moveToCard = false) {
      activeId = id;
      markers.forEach((marker, key) => marker.getElement()?.classList.toggle('is-selected', key === id));
      highlightCard(id, moveToCard);
    }
    canvas.addEventListener('click', event => {
      const button = event.target.closest('[data-card-id]');
      if (button) { identify(button.dataset.cardId, true); map.closePopup(); }
    });
    function popup(p) {
      return `<div class="map-popup"><span class="popup-lot">LOTTO ${escape(p.lot || p.id)}</span><h3>${escape(p.address)}</h3><p class="popup-neighborhood">${escape(p.neighborhood || '')}</p>${p.geocoding.status === 'street' ? '<p class="popup-location-note">Posizione indicativa della via · civico non disponibile</p>' : ''}<div class="popup-numbers">${Number.isFinite(p.startingPrice) ? `<div><small>Base d’asta</small><strong>${format.currency.format(p.startingPrice)}</strong></div>` : ''}${p.surface != null ? `<span>${format.display(p.surface)} m²</span>` : ''}</div>${p.evaluation ? `<p class="popup-rating">Valutazione: <span class="rating rating-${colors.includes(p.evaluation) ? p.evaluation.toLowerCase() : 'na'}">${escape(p.evaluation)}</span></p>` : ''}${p.auction ? `<p class="popup-date">DATA ASTA: ${escape(format.auctionLabel(p.auction))}</p>` : ''}<button class="popup-card-button" type="button" data-card-id="${escape(p.id)}">VEDI IMMOBILE ↓</button></div>`;
    }
    function update(items) {
      layer.clearLayers(); markers.clear(); activeId = null;
      const located = items.filter(positioned), unresolved = items.filter(p => !positioned(p));
      const indicative = located.filter(p => p.geocoding.status === 'street').length;
      status.textContent = `${located.length} ${located.length === 1 ? 'lotto in mappa' : 'lotti in mappa'}${indicative ? ` · ${indicative} ${indicative === 1 ? 'posizione indicativa' : 'posizioni indicative'}` : ''}${unresolved.length ? ` · ${unresolved.length} ${unresolved.length === 1 ? 'indirizzo da verificare' : 'indirizzi da verificare'}` : ''}`;
      review.hidden = unresolved.length === 0;
      document.getElementById('map-review-summary').textContent = `Indirizzi da verificare (${unresolved.length})`;
      reviewList.innerHTML = unresolved.map(p => `<li><span><strong>${escape(p.address)}</strong> · Lotto ${escape(p.lot)}<small>${escape(p.geocoding?.reason || 'Posizione non verificata: nessun marker approssimato.')}</small></span><button type="button" data-card-id="${escape(p.id)}">Vedi scheda ↓</button></li>`).join('');
      const groups = new Map();
      located.forEach(p => {
        const key = `${p.latitude},${p.longitude}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(p);
      });
      groups.forEach(group => group.forEach((p, index) => {
        // Screen-only offsets: every marker retains the exact saved latitude/longitude.
        const angle = index * 2 * Math.PI / group.length - Math.PI / 2;
        const radius = group.length > 1 ? 40 : 0;
        const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius;
        const rank = colors.includes(p.evaluation) ? p.evaluation.toLowerCase() : 'na';
        const icon = L.divIcon({ className: `property-marker${p.geocoding.status === 'street' ? ' is-approximate' : ''}`, html: `<span class="lot-marker rating-${rank}">${escape(p.lot?.split('/').at(-1) || '•')}</span>`, iconSize: [44, 44], iconAnchor: [22 - dx, 22 - dy], popupAnchor: [dx, dy - 18] });
        const marker = L.marker([p.latitude, p.longitude], { icon, title: `${p.address} · Lotto ${p.lot}`, alt: `Lotto ${p.lot}`, keyboard: true }).addTo(layer);
        marker.bindPopup(popup(p), { minWidth: 215, maxWidth: 270, autoPanPadding: [24, 24] });
        marker.on('click', () => identify(p.id));
        const element = marker.getElement();
        element.dataset.propertyId = p.id;
        element.setAttribute('aria-label', `${p.address}, lotto ${p.lot}${p.geocoding.status === 'street' ? ', posizione indicativa della via' : ''}`);
        markers.set(p.id, marker);
      }));
      canvas.dataset.markerCount = located.length;
      document.getElementById('map-empty').hidden = located.length > 0;
      document.getElementById('map-empty').textContent = items.length === 0 ? 'Nessun lotto corrisponde ai filtri.' : 'Le posizioni di questi lotti sono da verificare. Tutte le schede sono disponibili qui sotto.';
      const fit = located.length ? located : properties.filter(positioned);
      if (fit.length) map.fitBounds(L.latLngBounds(fit.map(p => [p.latitude, p.longitude])), { padding: [50, 50], maxZoom: 16, animate: false });
      else map.setView([41.895, 12.49], 12);
    }
    function selectFromCard(id, show = false) {
      const marker = markers.get(id);
      if (!marker) return;
      identify(id);
      if (show) {
        scroll(document.getElementById('map-section'));
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16), { animate: false });
        marker.openPopup();
      }
    }
    return { update, selectFromCard, positioned, map, markers };
  }
  window.LCRE_Map = { create, positioned };
})();

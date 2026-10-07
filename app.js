(function () {
  'use strict';
  const ranks = ['Ottimo', 'Buono', 'Sufficiente', 'Poco', 'Basso', 'NA'];
  const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' });
  const currency = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0, useGrouping: 'always' });
  const present = value => value !== null && value !== undefined && value !== '' && value !== '—';
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const categories = { Mono: 'Monolocale', Bilo: 'Bilocale', Trilo: 'Trilocale', Trino: 'Trilocale', Quadri: 'Quadrilocale', Penta: 'Pentilocale' };
  const categoryName = value => categories[value] || value;
  const conditionName = value => ({ Ottime: "Pronto all'uso", Ottimo: "Pronto all'uso", Buone: "Quasi pronto all'uso", Buono: "Quasi pronto all'uso", 'Da lavori': 'Da fare lavori' })[value] || value;
  function auctionLabel(value) {
    const match = /^(\d{1,2})\/(\d{1,2}) (\d{2}):(\d{2})$/.exec(value || '');
    const months = ['GENNAIO', 'FEBBRAIO', 'MARZO', 'APRILE', 'MAGGIO', 'GIUGNO', 'LUGLIO', 'AGOSTO', 'SETTEMBRE', 'OTTOBRE', 'NOVEMBRE', 'DICEMBRE'];
    return match && months[Number(match[2]) - 1] ? `${Number(match[1])} ${months[Number(match[2]) - 1]} alle ore ${match[3]}:${match[4]}` : value;
  }
  function safeUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && Boolean(url.hostname) ? value : null; }
    catch { return null; }
  }
  function compare(a, b, mode) {
    let first, second, direction = 1;
    if (mode === 'evaluation') {
      first = ranks.indexOf(a.evaluation); second = ranks.indexOf(b.evaluation);
      first = first < 0 ? ranks.length : first; second = second < 0 ? ranks.length : second;
    } else if (mode === 'auction-asc') {
      first = a.auctionSortKey; second = b.auctionSortKey;
    } else {
      const field = ({ 'price-asc': 'startingPrice', 'price-desc': 'startingPrice', 'rate-asc': 'pricePerSqm', 'surface-desc': 'surface' })[mode] || 'startingPrice';
      first = numeric(a[field]) ? a[field] : null; second = numeric(b[field]) ? b[field] : null;
      direction = mode.endsWith('-desc') ? -1 : 1;
    }
    if (!present(first) && !present(second)) return a.sourceRow - b.sourceRow;
    if (!present(first)) return 1;
    if (!present(second)) return -1;
    return (first < second ? -1 : first > second ? 1 : 0) * direction || a.sourceRow - b.sourceRow;
  }
  function select(properties, filters = {}, mode = 'evaluation') {
    const maximum = filters.maxPrice === '' || filters.maxPrice == null ? null : Number(filters.maxPrice);
    return properties.filter(p => (!filters.neighborhood || p.neighborhood === filters.neighborhood)
      && (!filters.category || p.category === filters.category)
      && (!filters.evaluation || p.evaluation === filters.evaluation)
      && (maximum === null || !Number.isFinite(maximum) || (numeric(p.startingPrice) && p.startingPrice <= maximum)))
      .sort((a, b) => compare(a, b, mode));
  }
  window.LCRE = { select, compare, safeUrl, ranks, present, numeric };
  if (typeof document === 'undefined') return;
  const properties = window.LCRE_DATA?.properties || [];
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const display = value => numeric(value) ? number.format(value) : escape(value);
  const icon = '<svg width="12" height="14" viewBox="0 0 14 16" fill="none" aria-hidden="true"><path d="M12 6c0 4-5 8-5 8S2 10 2 6a5 5 0 1 1 10 0Z" stroke="currentColor"/><circle cx="7" cy="6" r="1.5" stroke="currentColor"/></svg>';
  const mapController = window.LCRE_Map?.create(properties, { escape, currency, display, auctionLabel });
  if (window.LCRE_Map) window.LCRE_Map.controller = mapController;
  function options(id, field, values) {
    (values || [...new Set(properties.map(p => p[field]).filter(present))].sort((a, b) => String(a).localeCompare(String(b), 'it'))).forEach(value => {
      const option = document.createElement('option'); option.value = value; option.textContent = field === 'category' ? categoryName(value) : value; $(id).append(option);
    });
  }
  options('neighborhood', 'neighborhood'); options('category', 'category');
  options('evaluation', 'evaluation', [...ranks, ...new Set(properties.map(p => p.evaluation).filter(v => present(v) && !ranks.includes(v)))]);
  function card(p) {
    const official = safeUrl(p.officialUrl), video = safeUrl(p.videoUrl);
    const fact = (label, value, wide = false, badgeClass = '') => present(value) ? `<div${wide ? ' class="wide"' : ''}><dt>${label}:</dt><dd${badgeClass ? ` class="chip ${badgeClass}"` : ''}>${display(value)}</dd></div>` : '';
    const type = categoryName(p.category);
    const typeClass = ['Monolocale', 'Bilocale', 'Trilocale', 'Quadrilocale', 'Pentilocale'].includes(type) ? `type-${type.toLowerCase()}` : 'chip-neutral';
    const elevatorClass = p.elevator === 'Sì' || p.elevator === 'Si' ? 'elevator-yes' : p.elevator === 'No' ? 'elevator-no' : 'chip-neutral';
    const assessment = present(p.evaluation) ? `<div class="assessment"><a href="#informazioni">Valutazione:</a><span class="rating rating-${ranks.includes(p.evaluation) ? p.evaluation.toLowerCase() : 'na'}">${escape(p.evaluation)}</span></div>` : '';
    const mapAction = window.LCRE_Map?.positioned(p) ? `<button type="button" class="card-map-button" data-map-property="${escape(p.id)}">Sulla mappa ↑</button>` : '<span class="card-location-review">Posizione da verificare</span>';
    return `<article class="property-card" data-property-id="${escape(p.id)}" aria-labelledby="title-${escape(p.id)}" tabindex="-1">
      <div class="card-body"><div class="lot-label"><span>${present(p.lot) ? `LOTTO ${escape(p.lot)}` : 'ASTA ATER ROMA'}</span>${mapAction}</div>
      <h3 id="title-${escape(p.id)}">${present(p.address) ? escape(p.address) : 'Indirizzo non disponibile'}</h3>
      ${present(p.neighborhood) ? `<p class="neighborhood">${icon}${escape(p.neighborhood)}</p>` : ''}
      <div class="price-summary"><div>${present(p.startingPrice) ? `<span class="price-label">Base d'asta</span><p class="price">${numeric(p.startingPrice) ? currency.format(p.startingPrice) : escape(p.startingPrice)}</p>` : ''}</div>
      <div class="measurements">${present(p.surface) ? `<span><strong>${display(p.surface)}</strong> m²</span>` : ''}${present(p.pricePerSqm) ? `<span>${display(p.pricePerSqm)} €/m²</span>` : ''}</div></div>
      <dl class="facts">${fact('Tipologia', type, false, typeClass)}${fact('Ascensore', p.elevator, false, elevatorClass)}${fact('Piano', p.floor)}${fact('Condizioni', conditionName(p.condition))}${fact('Pertinenza', p.appurtenance, true)}</dl>${assessment}</div>
      <div class="card-footer">${present(p.auction) ? `<p class="auction-line">DATA ASTA: <time${p.auctionSortKey ? ` datetime="${escape(p.auctionSortKey)}"` : ''}>${escape(auctionLabel(p.auction))}</time></p>` : ''}
      <div class="card-actions${video ? ' has-video' : ''}">${official ? `<a class="official-link" href="${escape(official)}" target="_blank" rel="noopener noreferrer" aria-label="Documentazione ufficiale, lotto ${escape(p.lot || p.id)} (nuova scheda)">DOCUMENTAZIONE UFFICIALE ↗</a>` : '<p class="no-official">Collegamento ufficiale non disponibile nella fonte.</p>'}
      ${video ? `<a class="video-link" href="${escape(video)}" target="_blank" rel="noopener noreferrer" aria-label="Video visita, lotto ${escape(p.lot || p.id)} (nuova scheda)">VIDEO VISITA ↗</a>` : ''}</div>${official ? '<p class="official-caption">Foto, planimetria e informazioni sull\'asta</p>' : ''}</div>
    </article>`;
  }
  function render() {
    const items = select(properties, { neighborhood: $('neighborhood').value, category: $('category').value, evaluation: $('evaluation').value, maxPrice: $('max-price').value }, $('sort').value);
    $('properties').innerHTML = items.map(card).join('');
    $('result-count').innerHTML = `<strong>${items.length}</strong> ${items.length === 1 ? 'lotto' : 'lotti'} <span>su ${properties.length}</span>`;
    $('empty-state').hidden = items.length > 0;
    mapController?.update(items);
  }
  $('properties').addEventListener('click', event => {
    const button = event.target.closest('[data-map-property]');
    const property = event.target.closest('.property-card');
    if (property) mapController?.selectFromCard(property.dataset.propertyId, Boolean(button));
  });
  $('properties').addEventListener('focusin', event => {
    const property = event.target.closest('.property-card');
    if (property) mapController?.selectFromCard(property.dataset.propertyId);
  });
  $('filters').addEventListener('submit', event => event.preventDefault());
  $('filters').addEventListener('input', render);
  $('filters').addEventListener('change', render);
  $('sort').addEventListener('change', render);
  $('filters').addEventListener('reset', () => { $('sort').value = 'evaluation'; setTimeout(render, 0); });
  $('empty-reset').addEventListener('click', () => { $('filters').reset(); $('neighborhood').focus(); });
  render();
})();

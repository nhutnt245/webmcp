// One flight as a card. Used by the results page (with a Select button) and the summary page (without).

function formatPrice(priceUsd) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    priceUsd,
  );
}

function formatStops(stops) {
  if (stops === 0) {
    return 'non-stop';
  }
  return stops === 1 ? '1 stop' : `${stops} stops`;
}

// onSelect is optional: without it the card has no Select button.
export function createFlightCard(flight, { isLowestPrice, onSelect }) {
  const card = document.createElement('article');
  card.className = 'card';

  if (isLowestPrice) {
    const badge = document.createElement('span');
    badge.className = 'lowest-price-badge';
    badge.textContent = 'Lowest price';
    card.append(badge);
  }

  const title = document.createElement('h2');
  title.textContent = `${flight.id} · ${flight.from} → ${flight.to}`;

  const details = document.createElement('p');
  details.textContent = `${flight.date} · ${flight.departureTime} · ${flight.durationMinutes} minutes · ${formatStops(flight.stops)}`;

  // The lowest price is bold; other prices are plain text.
  const price = document.createElement(isLowestPrice ? 'strong' : 'span');
  price.textContent = formatPrice(flight.priceUsd);

  const priceLine = document.createElement('p');
  priceLine.append(price, ` · ${flight.seatsLeft} seats left`);

  card.append(title, details, priceLine);

  if (onSelect) {
    const selectButton = document.createElement('button');
    selectButton.type = 'button';
    selectButton.textContent = 'Select flight';
    selectButton.setAttribute('aria-label', `Select ${flight.id} for ${formatPrice(flight.priceUsd)}`);
    selectButton.addEventListener('click', () => onSelect(flight.id));
    card.append(selectButton);
  }

  return card;
}

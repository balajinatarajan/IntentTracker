import { regions } from '../utils/categories.js';

let modalOverlay = null;

export function initModal() {
  modalOverlay = document.getElementById('detail-modal');

  // Close on overlay click
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
      closeModal();
    }
  });
}

export function openModal(dest) {
  if (!modalOverlay) return;

  const regionLabel = regions[dest.region]?.label || dest.region;

  modalOverlay.querySelector('.modal-content').innerHTML = `
    <button class="modal-close" aria-label="Close">&times;</button>
    <img class="modal-image" src="${dest.image.replace('w=400&h=300', 'w=800&h=400')}" alt="${dest.name}">
    <div class="modal-body">
      <div class="modal-header">
        <span class="modal-name">${dest.name}</span>
        <span class="modal-price">From $${dest.price}</span>
      </div>
      <div class="modal-meta">
        <span class="region-tag">${regionLabel}</span>
        <span class="price-badge ${dest.priceTier}">${dest.priceTier.replace('-', ' ')}</span>
        ${dest.tripTypes.map(t => `<span class="card-tag">${t}</span>`).join('')}
      </div>
      <p class="modal-desc">${dest.fullDesc}</p>
      <p class="modal-highlights-title">Highlights</p>
      <ul class="modal-highlights">
        ${dest.highlights.map(h => `<li>${h}</li>`).join('')}
      </ul>
      <div class="modal-actions">
        <button class="btn btn-primary">Book This Trip</button>
        <button class="btn btn-secondary modal-close-btn">Close</button>
      </div>
    </div>
  `;

  // Wire close buttons
  modalOverlay.querySelector('.modal-close').addEventListener('click', closeModal);
  modalOverlay.querySelector('.modal-close-btn').addEventListener('click', closeModal);

  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

export function closeModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

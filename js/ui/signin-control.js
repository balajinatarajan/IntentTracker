import { getCurrentUser, signIn, signOut } from '../auth/auth-state.js';
import { getAllUsers } from '../data/users.js';

export function mountSigninControl(container) {
  const user = getCurrentUser();
  const allUsers = getAllUsers();

  container.innerHTML = renderHTML(user, allUsers);

  const root = container.querySelector('.signin-root');
  const dropdown = root ? root.querySelector('.signin-dropdown') : null;

  function closeDropdown() {
    if (dropdown && !dropdown.hidden) {
      dropdown.hidden = true;
    }
  }

  function toggleDropdown() {
    if (!dropdown) return;
    dropdown.hidden = !dropdown.hidden;
  }

  function onContainerClick(event) {
    const trigger = event.target.closest('.signin-trigger');
    if (trigger && root && root.contains(trigger)) {
      if (!user && allUsers.length === 1) {
        signIn(allUsers[0].id);
        return;
      }
      if (!user && allUsers.length > 1) {
        toggleDropdown();
        return;
      }
    }

    const avatar = event.target.closest('.signin-avatar');
    if (avatar && root && root.contains(avatar)) {
      toggleDropdown();
      return;
    }

    const userRow = event.target.closest('.signin-user-row');
    if (userRow && root && root.contains(userRow)) {
      const userId = userRow.dataset.userId;
      if (userId) {
        signIn(userId);
      }
      return;
    }

    const signoutBtn = event.target.closest('.signin-signout');
    if (signoutBtn && root && root.contains(signoutBtn)) {
      signOut();
      return;
    }
  }

  function onDocumentClick(event) {
    if (!root) return;
    if (root.contains(event.target)) return;
    closeDropdown();
  }

  container.addEventListener('click', onContainerClick);
  document.addEventListener('click', onDocumentClick);

  return function teardown() {
    container.removeEventListener('click', onContainerClick);
    document.removeEventListener('click', onDocumentClick);
    container.innerHTML = '';
  };
}

function renderHTML(user, allUsers) {
  if (user) {
    return renderSignedIn(user);
  }
  if (allUsers.length === 1) {
    return renderGuestSingle();
  }
  return renderGuestPicker(allUsers);
}

function renderSignedIn(user) {
  const pointsText = formatPoints(user.points);
  return `
    <div class="signin-root signed-in">
      <button class="signin-avatar" type="button">${escapeHTML(user.initials)}</button>
      <div class="signin-dropdown" hidden>
        <div class="signin-card">
          <div class="signin-card-name">${escapeHTML(user.name)}</div>
          <div class="signin-card-email">${escapeHTML(user.email)}</div>
          <div class="signin-card-tier">${escapeHTML(user.tier)} · ${pointsText} pts</div>
        </div>
        <button class="signin-signout" type="button">Sign out</button>
      </div>
    </div>
  `;
}

function renderGuestSingle() {
  return `
    <div class="signin-root">
      <button class="signin-trigger" type="button">Sign in</button>
    </div>
  `;
}

function renderGuestPicker(allUsers) {
  const rows = allUsers.map(u => `
    <button class="signin-user-row" type="button" data-user-id="${escapeAttr(u.id)}">
      <span class="signin-user-avatar">${escapeHTML(u.initials)}</span>
      <span class="signin-user-meta">
        <span class="signin-user-name">${escapeHTML(u.name)}</span>
        <span class="signin-user-tier">${escapeHTML(u.tier)} member</span>
      </span>
    </button>
  `).join('');

  return `
    <div class="signin-root">
      <button class="signin-trigger" type="button">Sign in</button>
      <div class="signin-dropdown" hidden>
        <div class="signin-dropdown-title">Sign in as…</div>
        ${rows}
      </div>
    </div>
  `;
}

function formatPoints(points) {
  if (typeof points !== 'number') return '0';
  return points.toLocaleString('en-US');
}

function escapeHTML(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHTML(value);
}

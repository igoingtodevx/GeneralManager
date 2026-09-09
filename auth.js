// auth.js

const authStyles = `
#auth-overlay,
#workspace-choice-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 9, 12, 0.82);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
#auth-container,
#workspace-choice-container {
  background: #171c22;
  border: 1px solid #303944;
  border-radius: 10px;
  width: min(380px, 100%);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.auth-header { text-align: center; }
.auth-header h2 {
  font-size: 22px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.auth-header p,
.workspace-choice-copy {
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1.5;
}
.auth-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
}
.auth-tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  cursor: pointer;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
}
.auth-tab.active {
  color: var(--text-primary);
  border-color: var(--accent-purple);
}
.auth-form,
.workspace-choice-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auth-field label {
  font-size: 11px;
  font-weight: 650;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
}
.auth-field input {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius);
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 14px;
}
.auth-field input:focus {
  border-color: var(--accent-purple);
  box-shadow: 0 0 0 3px var(--accent-purple-dim);
}
.auth-btn {
  background: var(--accent-purple);
  color: #fff;
  border-radius: 7px;
  padding: 11px 12px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  border: none;
  margin-top: 4px;
}
.auth-btn:hover { background: #6d32d0; }
.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.auth-secondary {
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
  cursor: pointer;
}
.auth-secondary:hover { color: var(--text-primary); }
#auth-error {
  color: var(--priority-high);
  font-size: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  display: none;
  line-height: 1.4;
}
.workspace-choice-actions .btn { justify-content: center; }
.workspace-choice-actions .btn-danger { color: var(--priority-high); }
`;

const styleEl = document.createElement('style');
styleEl.textContent = authStyles;
document.head.appendChild(styleEl);

const authStateCallbacks = [];
let authStateKnown = false;
let lastAuthUser = null;
const authService = typeof auth !== 'undefined' && auth ? auth : null;
const firebaseAuthAvailable = Boolean(authService);

function onUserChanged(callback) {
  authStateCallbacks.push(callback);
  if (authStateKnown) {
    queueMicrotask(() => callback(lastAuthUser));
  }
}

function notifyAuthState(user) {
  lastAuthUser = user;
  authStateKnown = true;
  authStateCallbacks.forEach(callback => callback(user));
}

function showAuthModal() {
  if (!firebaseAuthAvailable) {
    showSyncUnavailable();
    return;
  }
  if (document.getElementById('auth-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.innerHTML = `
    <div id="auth-container" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div class="auth-header">
        <h2 id="auth-title">Sign in to sync</h2>
        <p>Keep using GeneralManager locally, or sign in to sync this workspace across devices.</p>
      </div>
      <div class="auth-tabs" role="tablist" aria-label="Account action">
        <div class="auth-tab active" id="tab-login" role="tab" tabindex="0">Login</div>
        <div class="auth-tab" id="tab-signup" role="tab" tabindex="0">Sign Up</div>
      </div>
      <form class="auth-form" id="auth-form">
        <div id="auth-error" role="alert"></div>
        <div class="auth-field">
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" required placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" required placeholder="At least 6 characters" autocomplete="current-password">
        </div>
        <button type="submit" class="auth-btn" id="auth-submit-btn">Login</button>
        <button type="button" class="auth-secondary" id="auth-cancel-btn">Continue locally</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const submitBtn = document.getElementById('auth-submit-btn');
  const form = document.getElementById('auth-form');
  const errorEl = document.getElementById('auth-error');
  const headerP = overlay.querySelector('.auth-header p');
  let mode = 'login';

  const setMode = (nextMode) => {
    mode = nextMode;
    tabLogin.classList.toggle('active', mode === 'login');
    tabSignup.classList.toggle('active', mode === 'signup');
    submitBtn.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    headerP.textContent = mode === 'login'
      ? 'Keep using GeneralManager locally, or sign in to sync this workspace across devices.'
      : 'Create an account only if you want cloud sync across devices.';
    errorEl.style.display = 'none';
  };

  tabLogin.addEventListener('click', () => setMode('login'));
  tabSignup.addEventListener('click', () => setMode('signup'));
  document.getElementById('auth-cancel-btn').addEventListener('click', hideAuthModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) hideAuthModal();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    try {
      if (mode === 'login') {
        submitBtn.textContent = 'Signing in...';
        await authService.signInWithEmailAndPassword(email, password);
      } else {
        submitBtn.textContent = 'Creating account...';
        await authService.createUserWithEmailAndPassword(email, password);
      }
    } catch (error) {
      console.error(error);
      errorEl.textContent = getFriendlyErrorMessage(error);
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = mode === 'login' ? 'Login' : 'Sign Up';
    }
  });
}

function hideAuthModal() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.remove();
}

function showSyncUnavailable() {
  const status = document.getElementById('workspace-status');
  if (status) {
    status.textContent = 'Local workspace · sync unavailable';
    status.classList.add('status-warning');
  }
}

function showWorkspaceChoice({ hasCloudWorkspace, localCardCount }) {
  return new Promise(resolve => {
    const existing = document.getElementById('workspace-choice-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'workspace-choice-overlay';
    const cloudCopy = hasCloudWorkspace
      ? 'A synced workspace already exists for this account.'
      : 'No synced workspace exists for this account yet.';
    overlay.innerHTML = `
      <div id="workspace-choice-container" role="dialog" aria-modal="true" aria-labelledby="workspace-choice-title">
        <div class="auth-header">
          <h2 id="workspace-choice-title">Choose a workspace</h2>
          <p class="workspace-choice-copy">${localCardCount} local card${localCardCount === 1 ? '' : 's'} found. ${cloudCopy} Nothing is merged or deleted automatically.</p>
        </div>
        <div class="workspace-choice-actions">
          <button class="btn btn-primary" data-choice="import">Import local workspace</button>
          ${hasCloudWorkspace ? '<button class="btn btn-ghost" data-choice="cloud">Use synced workspace</button>' : '<button class="btn btn-ghost" data-choice="cloud">Start a new synced workspace</button>'}
          <button class="btn btn-ghost btn-danger" data-choice="local">Keep using local mode</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const finish = (choice) => {
      overlay.remove();
      resolve(choice);
    };
    overlay.querySelectorAll('[data-choice]').forEach(button => {
      button.addEventListener('click', () => finish(button.dataset.choice));
    });
    overlay.addEventListener('click', event => {
      if (event.target === overlay) finish('local');
    });
  });
}

function getFriendlyErrorMessage(error) {
  switch (error.code) {
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
      return 'No user found with this email. Please sign up.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/email-already-in-use':
      return 'This email address is already in use by another account.';
    case 'auth/weak-password':
      return 'The password must be at least 6 characters long.';
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/network-request-failed':
      return 'Network error. You can keep working locally and try again later.';
    default:
      return error.message || 'An authentication error occurred.';
  }
}

if (authService) {
  authService.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => console.error('Error setting auth persistence:', error));

  authService.onAuthStateChanged(user => {
    if (user) hideAuthModal();
    notifyAuthState(user);
  });
} else {
  notifyAuthState(null);
}

function signOutUser() {
  return authService ? authService.signOut() : Promise.resolve();
}

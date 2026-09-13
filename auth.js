// auth.js

// CSS styles for the auth modal
const authStyles = `
#auth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(7, 7, 10, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 200ms ease;
}
#auth-container {
  background: rgba(18, 18, 28, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  width: 380px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(124, 58, 237, 0.15);
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.auth-header {
  text-align: center;
}
.auth-header h2 {
  font-size: 22px;
  font-weight: 850;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 6px;
}
.auth-header p {
  color: var(--text-muted);
  font-size: 13px;
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
  transition: all var(--transition);
}
.auth-tab.active {
  color: var(--accent-purple);
  border-color: var(--accent-purple);
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.auth-field label {
  font-size: 11px;
  font-weight: 600;
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
  transition: border-color var(--transition);
}
.auth-field input:focus {
  border-color: rgba(124, 58, 237, 0.65);
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
}
.auth-btn {
  background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
  color: #fff;
  border-radius: 9px;
  padding: 12px;
  font-weight: 700;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition);
  box-shadow: 0 0 18px rgba(124, 58, 237, 0.35);
  border: none;
  margin-top: 8px;
}
.auth-btn:hover {
  box-shadow: 0 0 28px rgba(124, 58, 237, 0.55);
  transform: translateY(-1px);
}
.auth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
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
`;

// Injects styling to document
const styleEl = document.createElement('style');
styleEl.textContent = authStyles;
document.head.appendChild(styleEl);

// State listeners callbacks
const authStateCallbacks = [];

// Register callback to trigger on authentication state changes
function onUserChanged(callback) {
  authStateCallbacks.push(callback);
  // If user is already loaded/determined, fire callback immediately
  if (auth && auth.currentUser !== undefined && auth.currentUser !== null) {
    callback(auth.currentUser);
  }
}

function notifyAuthState(user) {
  authStateCallbacks.forEach(cb => cb(user));
}

// Shows the Authentication Modal
function showAuthModal() {
  if (document.getElementById('auth-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.innerHTML = `
    <div id="auth-container" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div class="auth-header">
        <h2 id="auth-title">GeneralManager</h2>
        <p>Sign in to sync your workspace</p>
        <a href="?demo=1">Try the interactive demo — no account needed</a>
        <p>Cloud data uses Firebase. Pending edits are also kept in this browser for recovery. Avoid shared browser profiles.</p>
      </div>
      <div class="auth-tabs">
        <button type="button" class="auth-tab active" id="tab-login">Login</button>
        <button type="button" class="auth-tab" id="tab-signup">Sign Up</button>
      </div>
      <form class="auth-form" id="auth-form">
        <div id="auth-error"></div>
        <div class="auth-field">
          <label for="auth-email">Email</label>
          <input type="email" id="auth-email" required placeholder="you@example.com" autocomplete="email">
        </div>
        <div class="auth-field">
          <label for="auth-password">Password</label>
          <input type="password" id="auth-password" required placeholder="••••••••" autocomplete="current-password">
        </div>
        <button type="submit" class="auth-btn" id="auth-submit-btn">Login</button>
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

  let mode = 'login'; // 'login' or 'signup'

  tabLogin.addEventListener('click', () => {
    if (mode === 'login') return;
    mode = 'login';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    submitBtn.textContent = 'Login';
    headerP.textContent = 'Sign in to sync your workspace';
    errorEl.style.display = 'none';
  });

  tabSignup.addEventListener('click', () => {
    if (mode === 'signup') return;
    mode = 'signup';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    submitBtn.textContent = 'Sign Up';
    headerP.textContent = 'Create an account to start syncing';
    errorEl.style.display = 'none';
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    try {
      if (mode === 'login') {
        submitBtn.textContent = 'Signing in...';
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        submitBtn.textContent = 'Creating account...';
        await auth.createUserWithEmailAndPassword(email, password);
      }
      // Successful login/signup will trigger onAuthStateChanged
    } catch (err) {
      console.error(err);
      errorEl.textContent = getFriendlyErrorMessage(err);
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
    default:
      return error.message || 'An authentication error occurred.';
  }
}

// Set auth persistence to local storage
if (!demoMode) auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .catch((err) => console.error("Error setting persistence:", err));

// Set up Auth state listener
if (!demoMode) auth.onAuthStateChanged((user) => {
  if (user) {
    hideAuthModal();
    notifyAuthState(user);
  } else {
    showAuthModal();
    notifyAuthState(null);
  }
});

function signOutUser() {
  return auth.signOut();
}

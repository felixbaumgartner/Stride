window.Auth = (() => {
  let idToken = null;
  let onLoginCallback = null;

  async function init(onLogin) {
    onLoginCallback = onLogin;

    const res = await fetch('/api/config');
    const config = await res.json();
    firebase.initializeApp(config);

    firebase.auth().onAuthStateChanged(async (user) => {
      const appEl = document.getElementById('app');
      const authEl = document.getElementById('auth-screen');
      const profileEl = document.getElementById('user-profile');

      if (user) {
        idToken = await user.getIdToken();

        // Refresh token before expiry
        setInterval(async () => {
          try { idToken = await firebase.auth().currentUser.getIdToken(true); } catch {}
        }, 50 * 60 * 1000);

        // Claim unclaimed data on first login
        if (!localStorage.getItem('stride_claimed')) {
          try {
            await fetch('/api/auth/claim', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
              },
            });
            localStorage.setItem('stride_claimed', '1');
          } catch {}
        }

        if (authEl) authEl.classList.add('hidden');
        if (appEl) appEl.classList.remove('hidden');

        if (profileEl) {
          const nameEl = profileEl.querySelector('.user-name');
          const avatarEl = profileEl.querySelector('.user-avatar');
          if (nameEl) nameEl.textContent = user.displayName || user.email;
          if (avatarEl && user.photoURL) avatarEl.src = user.photoURL;
          profileEl.classList.remove('hidden');
        }

        if (onLoginCallback) onLoginCallback();
      } else {
        idToken = null;
        if (authEl) authEl.classList.remove('hidden');
        if (appEl) appEl.classList.add('hidden');
        if (profileEl) profileEl.classList.add('hidden');
      }
    });
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    await firebase.auth().signInWithPopup(provider);
  }

  async function signOut() {
    await firebase.auth().signOut();
    localStorage.removeItem('stride_claimed');
  }

  function getToken() {
    return idToken;
  }

  return { init, signIn, signOut, getToken };
})();

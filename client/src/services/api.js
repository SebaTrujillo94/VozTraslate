// api service usando LocalStorage (Fake Backend)

// manejar el token ficticio en el localstorage
export function getToken() {
  return localStorage.getItem('voztranslate_token');
}

export function setToken(token) {
  localStorage.setItem('voztranslate_token', token);
}

export function clearToken() {
  localStorage.removeItem('voztranslate_token');
}

// helper para leer y guardar la "base de datos" del localstorage
function getUsersDB() {
  const data = localStorage.getItem('voztranslate_users_db');
  return data ? JSON.parse(data) : [];
}

function saveUsersDB(users) {
  localStorage.setItem('voztranslate_users_db', JSON.stringify(users));
}

// ── Auth API (Falsa, puramente en LocalStorage) ──────────────────────

// registrar un usuario nuevo
export async function register({ email, password, username, displayName, preferredLanguage }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const users = getUsersDB();
      const lowerEmail = email.toLowerCase();
      const lowerUsername = username.toLowerCase();

      // chequear si existe
      if (users.find(u => u.email === lowerEmail)) {
        return reject({ status: 409, message: 'El correo ya está en uso' });
      }
      if (users.find(u => u.username === lowerUsername)) {
        return reject({ status: 409, message: 'El nombre de usuario ya está en uso' });
      }

      // crear usuario
      const newUser = {
        id: 'usr_' + Date.now().toString(36),
        email: lowerEmail,
        password, // guardamos la clave cruda solo porque es de prueba escolar
        username: lowerUsername,
        displayName: displayName || username,
        preferredLanguage: preferredLanguage || 'en',
        avatarUrl: null
      };

      users.push(newUser);
      saveUsersDB(users);

      // simulamos un token JWT usando el mismo ID
      setToken(newUser.id);

      resolve({ token: newUser.id, user: newUser });
    }, 400); // retraso artificial
  });
}

// mandar correo y pass para loguear
export async function login({ email, password }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const users = getUsersDB();
      const user = users.find(u => u.email === email.toLowerCase());

      if (!user || user.password !== password) {
        return reject({ status: 401, message: 'Correo o contraseña incorrectos' });
      }

      setToken(user.id);

      // no devolvemos la contraseña
      const { password: _, ...userSafeInfo } = user;
      resolve({ token: user.id, user: userSafeInfo });
    }, 400);
  });
}

// obtener mis datos desde el localstorage si tengo token
export async function getMe() {
  return new Promise((resolve, reject) => {
    const token = getToken();
    if (!token) return reject({ status: 401, message: 'No estás logueado' });

    const users = getUsersDB();
    const user = users.find(u => u.id === token);

    if (!user) {
      clearToken();
      return reject({ status: 404, message: 'Usuario no encontrado' });
    }

    const { password: _, ...userSafeInfo } = user;
    resolve({ user: userSafeInfo });
  });
}

// cambiar la data de mi perfil
export async function updateProfile({ displayName, preferredLanguage, avatarUrl }) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    if (!token) return reject({ status: 401, message: 'No estás logueado' });

    const users = getUsersDB();
    const index = users.findIndex(u => u.id === token);

    if (index === -1) return reject({ status: 404, message: 'Usuario no encontrado' });

    if (displayName !== undefined) users[index].displayName = displayName;
    if (preferredLanguage !== undefined) users[index].preferredLanguage = preferredLanguage;
    if (avatarUrl !== undefined) users[index].avatarUrl = avatarUrl;

    saveUsersDB(users);

    const { password: _, ...userSafeInfo } = users[index];
    resolve({ message: 'Perfil actualizado', user: userSafeInfo });
  });
}

// salir de la cuenta y borrar token
export function logout() {
  clearToken();
}

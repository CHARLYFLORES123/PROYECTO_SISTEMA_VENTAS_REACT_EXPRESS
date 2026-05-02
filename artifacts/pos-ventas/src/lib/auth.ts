export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('pos_token');
}

export function setToken(token: string) {
  localStorage.setItem('pos_token', token);
}

export function clearToken() {
  localStorage.removeItem('pos_token');
}

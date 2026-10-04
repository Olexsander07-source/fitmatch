// Public UI helpers. Authentication and subscription authority stay on the server.
export const BRAND_IMAGES = ['coaching', 'online', 'boxing'];
export const WORKSPACE_LIMIT = 24576;
export const escapeHTML = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function workspaceRole(profile, coach) {
  return coach || ['coach','admin'].includes(profile?.role) ? 'coach' : 'client';
}
export function entryPage(profile, coach, state = {}) {
  if (workspaceRole(profile, coach) === 'coach') return coach ? 'profile' : 'account';
  if (!state.introduction_seen) return 'welcome';
  if (['ai','dashboard','match','inbox','account'].includes(state.last_page)) return state.last_page;
  return state.preferred_path === 'human' ? 'dashboard' : 'ai';
}
export function guardedPage(id, signedIn, role) {
  if (!signedIn && !['home','signup','profile'].includes(id)) return 'login';
  if (signedIn && role === 'coach' && ['welcome','dashboard','match','matches','searching'].includes(id)) return 'account';
  return id;
}
export function formDraft(form) {
  const result = {};
  for (const item of form.elements) {
    if (!item.name || ['password','email','website','photo','photos','published','consent'].includes(item.name) || item.type === 'file' || item.disabled) continue;
    if (item.type === 'checkbox') {
      result[item.name] ||= [];
      if (item.checked) result[item.name].push(item.value);
    } else result[item.name] = item.value;
  }
  return result;
}
export function restoreDraft(form, data = {}) {
  for (const field of form.elements) {
    if (!field.name || !(field.name in data) || field.type === 'file' || field.name === 'password' || field.name === 'published') continue;
    if (field.type === 'checkbox') field.checked = Array.isArray(data[field.name]) && data[field.name].includes(field.value);
    else if (typeof data[field.name] === 'string' || typeof data[field.name] === 'number') field.value = data[field.name];
  }
}
export function bookmarkIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id)))].slice(-100) : [];
}
export function safeWorkspace(data) {
  const result = data && typeof data === 'object' && !Array.isArray(data) ? structuredClone(data) : {};
  result.saved_ai = bookmarkIds(result.saved_ai);
  // Never accept client preferences as roles, paid access, or credentials.
  for (const key of ['role','subscription','friend','token','password','access_token','refresh_token']) delete result[key];
  if (new TextEncoder().encode(JSON.stringify(result)).length > WORKSPACE_LIMIT) throw Error('workspace_too_large');
  return result;
}

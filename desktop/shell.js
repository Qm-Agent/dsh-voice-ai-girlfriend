for (const id of ['chat','pet','pin','hide','retry']) document.getElementById(id).onclick = () => window.companion.command(id);
window.companion.onState(state => {
  const pin = document.getElementById('pin');
  pin.textContent = state.pinned ? '已置顶' : '置顶';
  pin.setAttribute('aria-pressed', String(state.pinned));
  document.getElementById('chat').setAttribute('aria-pressed', String(state.mode === 'chat'));
  document.getElementById('pet').setAttribute('aria-pressed', String(state.mode === 'pet'));
  document.getElementById('status').textContent = state.message;
});

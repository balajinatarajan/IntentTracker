export function initSearchBar(inputEl, onSearch) {
  let debounceTimer = null;

  inputEl.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      onSearch(inputEl.value);
    }, 300);
  });
}

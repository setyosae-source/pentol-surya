export function createRouter(onChange) {
  const normalize = () => window.location.hash.replace(/^#/, '') || '/';

  window.addEventListener('hashchange', () => {
    onChange(normalize());
  });

  onChange(normalize());

  return {
    current: normalize,
    go(path) {
      window.location.hash = `#${path}`;
    },
  };
}

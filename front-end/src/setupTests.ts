import "@testing-library/jest-dom/extend-expect";

// jsdom has no matchMedia, which Mantine's menus read for reduced motion.
window.matchMedia = (query: string) =>
  ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as MediaQueryList);

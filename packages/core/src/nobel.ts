/**
 * Nobel laureates used to name agent sessions, each with a short quote and a
 * one-line contribution shown on hover in the Agents panel.
 */
export interface Laureate {
  name:         string
  field:        string
  year:         number
  quote:        string
  contribution: string
}

export const LAUREATES: readonly Laureate[] = [
  { name: 'Curie',       field: 'Physics/Chemistry', year: 1903, quote: 'Nothing in life is to be feared, it is only to be understood.', contribution: 'Pioneered radioactivity; only person to win Nobels in two sciences.' },
  { name: 'Einstein',    field: 'Physics',           year: 1921, quote: 'Imagination is more important than knowledge.',               contribution: 'Photoelectric effect; relativity reshaped modern physics.' },
  { name: 'Feynman',     field: 'Physics',           year: 1965, quote: 'I would rather have questions that can\'t be answered than answers that can\'t be questioned.', contribution: 'Quantum electrodynamics; Feynman diagrams.' },
  { name: 'Bohr',        field: 'Physics',           year: 1922, quote: 'An expert is a person who has made all the mistakes in a narrow field.', contribution: 'Atomic structure and quantum theory.' },
  { name: 'Dirac',       field: 'Physics',           year: 1933, quote: 'Pick a flower on Earth and you move the farthest star.',       contribution: 'Predicted antimatter; relativistic quantum mechanics.' },
  { name: 'Fermi',       field: 'Physics',           year: 1938, quote: 'Before I came here I was confused; now I am still confused, but on a higher level.', contribution: 'Induced radioactivity; first nuclear reactor.' },
  { name: 'McClintock',  field: 'Medicine',          year: 1983, quote: 'If you know you are on the right track, no one can turn you off.', contribution: 'Discovered transposons — "jumping genes".' },
  { name: 'Ramon',       field: 'Medicine',          year: 1906, quote: 'Every man can, if he so desires, become the sculptor of his own brain.', contribution: 'Founded modern neuroscience; neuron doctrine.' },
  { name: 'Hodgkin',     field: 'Chemistry',         year: 1964, quote: 'I was captured for life by chemistry and by crystals.',        contribution: 'X-ray crystallography of penicillin, insulin, B12.' },
  { name: 'Pauling',     field: 'Chemistry/Peace',   year: 1954, quote: 'The best way to have a good idea is to have a lot of ideas.',  contribution: 'The chemical bond; later, nuclear disarmament.' },
  { name: 'Sanger',      field: 'Chemistry',         year: 1958, quote: 'Science is a great game. It is inspiring and refreshing.',     contribution: 'Sequenced insulin and DNA; two Chemistry Nobels.' },
  { name: 'Lovelace',    field: 'Computing',         year: 1843, quote: 'The Analytical Engine weaves algebraic patterns.',             contribution: 'First algorithm intended for a machine.' },
  { name: 'Turing',      field: 'Computing',         year: 1936, quote: 'We can only see a short distance ahead, but plenty there needs to be done.', contribution: 'Foundations of computation and AI.' },
  { name: 'Hopper',      field: 'Computing',         year: 1952, quote: 'The most damaging phrase is: we\'ve always done it this way.',  contribution: 'Invented the compiler; coined "debugging".' },
] as const

/** Pick a laureate name not already in `used`, falling back to a numbered one. */
export function nextLaureate(used: Set<string>): Laureate {
  for (const l of LAUREATES) {
    if (!used.has(l.name)) return l
  }
  // All used — append an index to keep names unique
  const base = LAUREATES[used.size % LAUREATES.length]!
  return { ...base, name: `${base.name}-${used.size}` }
}

export function findLaureate(name: string): Laureate | undefined {
  const base = name.replace(/-\d+$/, '')
  return LAUREATES.find(l => l.name === base)
}

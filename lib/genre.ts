import { GENRES, type Genre } from '@/components/books/genre-filter'

export { GENRES }
export type { Genre }

export type BookGenre = Exclude<Genre, 'All'>

interface GenreRule {
  genre: BookGenre
  keywords: string[]
}

const GENRE_RULES: GenreRule[] = [
  {
    genre: 'Philosophy',
    keywords: [
      'philosophy', 'philosophical', 'philosopher', 'ethics', 'ethical', 'stoic', 'stoicism',
      'meditation', 'meditations', 'marcus aurelius', 'nietzsche', 'plato', 'aristotle',
      'socrates', 'kant', 'descartes', 'spinoza', 'hegel', 'schopenhauer', 'kierkegaard',
      'wittgenstein', 'camus', 'sartre', 'existential', 'existentialism', 'epictetus',
      'seneca', 'machiavelli', 'sun tzu', 'art of war', 'tao', 'tao te ching', 'lao tzu',
      'confucius', 'buddha', 'buddhism', 'metaphysics', 'epistemology', 'logic',
      'critique of pure reason', 'beyond good and evil', 'zarathustra', 'being and time',
      'republic', 'symposium', 'apology', 'nicomachean', 'leviathan', 'social contract',
      'rousseau', 'utilitarianism', 'john stuart mill', 'wisdom', 'meaning of life',
      'tractatus', 'enquiry', 'david hume', 'moral', 'morality', 'virtue', 'epictetus'
    ],
  },
  {
    genre: 'Science',
    keywords: [
      'science', 'scientific', 'physics', 'quantum', 'chemistry', 'chemical', 'biology',
      'biological', 'mathematic', 'mathematics', 'algebra', 'calculus', 'geometry',
      'statistic', 'statistics', 'probability', 'astronomy', 'astrophysics', 'cosmology',
      'einstein', 'hawking', 'feynman', 'newton', 'galileo', 'darwin', 'evolution',
      'evolutionary', 'genetics', 'dna', 'gene', 'genome', 'neuroscience', 'brain',
      'neuron', 'computer science', 'algorithm', 'algorithms', 'programming', 'data science',
      'artificial intelligence', 'machine learning', 'deep learning', 'robotics',
      'technology', 'relativity', 'brief history of time', 'cosmos', 'carl sagan',
      'climate', 'ecology', 'geology', 'medicine', 'anatomy', 'physiology', 'space',
      'universe', 'astrophysical', 'thermodynamics', 'electromagnetism', 'gravity',
      'code', 'coding', 'developer', 'software'
    ],
  },
  {
    genre: 'History',
    keywords: [
      'history', 'historical', 'historian', 'ancient', 'medieval', 'civilization',
      'empire', 'roman', 'rome', 'greece', 'greek', 'egypt', 'egyptian', 'dynasty',
      'revolution', 'revolutionary', 'civil war', 'world war', 'wwi', 'wwii', 'holocaust',
      'crusades', 'colonial', 'colonialism', 'sapiens', 'yuval noah harari',
      'guns, germs', 'jared diamond', 'winston churchill', 'battle of', 'treaty of',
      'monarchy', 'middle ages', 'cold war', 'soviet', 'ussr', 'vietnam', 'ottoman',
      'byzantine', 'archaeology', 'antiquity', 'chronicles', 'conquest', 'military history',
      'renaissance', 'feudal', 'napoleonic', 'waterloo', 'century'
    ],
  },
  {
    genre: 'Biography',
    keywords: [
      'biography', 'autobiography', 'memoir', 'memoirs', 'diary of', 'diaries', 'life of',
      'story of my life', 'confessions of', 'letters of', 'steve jobs', 'walter isaacson',
      'barack obama', 'promised land', 'mandela', 'long walk to freedom', 'anne frank',
      'malcolm x', 'martin luther king', 'elon musk', 'leonardo da vinci',
      'benjamin franklin', 'marie curie', 'frida kahlo', 'mahatma gandhi',
      'experiments with truth', 'becoming', 'michelle obama', 'shoe dog', 'phil knight',
      'open: an autobiography', 'andre agassi', 'educated', 'tara westover',
      'born a crime', 'trevor noah', 'profile', 'reminiscence', 'portrait of'
    ],
  },
  {
    genre: 'Classic',
    keywords: [
      'classic', 'classics', 'iliad', 'odyssey', 'homer', 'dante', 'divine comedy', 'inferno',
      'shakespeare', 'hamlet', 'macbeth', 'othello', 'king lear', 'romeo and juliet',
      'midsummer', 'dickens', 'great expectations', 'oliver twist', 'tale of two cities',
      'david copperfield', 'a christmas carol', 'dostoevsky', 'dostoyevsky',
      'crime and punishment', 'brothers karamazov', 'the idiot', 'notes from underground',
      'demons', 'tolstoy', 'war and peace', 'anna karenina', 'victor hugo', 'les miserables',
      'hunchback of notre dame', 'jane austen', 'pride and prejudice', 'sense and sensibility',
      'emma', 'persuasion', 'bronte', 'jane eyre', 'wuthering heights', 'herman melville',
      'moby dick', 'kafka', 'metamorphosis', 'the trial', 'the castle', 'jonathan swift',
      'gulliver', 'cervantes', 'don quixote', 'geoffrey chaucer', 'canterbury tales',
      'virgil', 'aeneid', 'john milton', 'paradise lost', 'edgar allan poe', 'mark twain',
      'huckleberry finn', 'tom sawyer', 'f. scott fitzgerald', 'great gatsby', 'oscar wilde',
      'picture of dorian gray', 'chekhov', 'gogol', 'dead souls', 'pushkin', 'gustave flaubert',
      'madame bovary', 'balzac', 'goethe', 'faust', 'stendhal', 'the red and the black',
      'james joyce', 'ulysses', 'dubliners', 'virginia woolf', 'to the lighthouse',
      'mrs dalloway', 'george orwell', '1984', 'nineteen eighty-four', 'animal farm',
      'aldous huxley', 'brave new world', 'fahrenheit 451', 'ray bradbury', 'frankenstein',
      'mary shelley', 'dracula', 'bram stoker', 'count of monte cristo', 'alexandre dumas',
      'three musketeers', 'heart of darkness', 'joseph conrad'
    ],
  },
  {
    genre: 'Fiction',
    keywords: [
      'novel', 'fiction', 'fictional', 'story', 'stories', 'tale', 'tales', 'adventures',
      'mystery', 'thriller', 'detective', 'sherlock holmes', 'arthur conan doyle',
      'hercule poirot', 'agatha christie', 'fantasy', 'sci-fi', 'science fiction',
      'magic', 'wizard', 'dragon', 'lord of the rings', 'lotr', 'tolkien', 'the hobbit',
      'harry potter', 'jk rowling', 'game of thrones', 'george r.r. martin', 'ice and fire',
      'dune', 'frank herbert', 'isaac asimov', 'foundation', 'neuromancer', 'william gibson',
      'cyberpunk', 'stephen king', 'the shining', 'percy jackson', 'hunger games',
      'suzanne collins', 'twilight', 'romance', 'comedy', 'drama', 'chronicles of narnia',
      'c.s. lewis', 'legend', 'mythology', 'fable', 'fables', 'haunting', 'ghost'
    ],
  },
  {
    genre: 'Non-Fiction',
    keywords: [
      'non-fiction', 'nonfiction', 'guide', 'handbook', 'manual', 'how to', 'self-help',
      'habits', 'atomic habits', 'james clear', 'psychology', 'psychological', 'economics',
      'economic', 'wealth', 'money', 'investing', 'investment', 'intelligent investor',
      'warren buffett', 'business', 'management', 'leadership', 'peter drucker',
      'thinking, fast and slow', 'daniel kahneman', 'freakonomics', 'outliers',
      'malcolm gladwell', 'blink', 'tipping point', 'deep work', 'cal newport',
      'digital minimalism', 'lean startup', 'eric ries', 'zero to one', 'peter thiel',
      'good to great', 'jim collins', '7 habits', 'stephen covey', 'subtle art',
      'mark manson', 'psychology of money', 'morgan housel', 'rich dad poor dad',
      'robert kiyosaki', 'essay', 'essays', 'report', 'study', 'analysis', 'journal',
      'principles', 'ray dalio', 'textbook', 'reference', 'learn', 'mastery'
    ],
  },
]

/**
 * Normalizes a text string for fuzzy token matching
 */
export type BookGenre = string

interface GenreRule {
  genre: string
  keywords: string[]
}

const EXTENDED_GENRE_RULES: GenreRule[] = [
  {
    genre: 'Technology',
    keywords: [
      'react', 'next.js', 'javascript', 'typescript', 'python', 'rust', 'golang', 'linux',
      'docker', 'kubernetes', 'aws', 'cloud', 'frontend', 'backend', 'fullstack', 'database',
      'sql', 'nosql', 'devops', 'cybersecurity', 'hacking', 'network', 'web development'
    ],
  },
  {
    genre: 'Self-Help',
    keywords: [
      'habits', 'atomic habits', 'productivity', 'mindset', 'motivation', 'discipline',
      'focus', 'goals', 'self improvement', 'confidence', 'routine', 'morning routine',
      'subtle art', 'procrastination', 'success', 'winning', 'leadership'
    ],
  },
  {
    genre: 'Psychology',
    keywords: [
      'psychology', 'psychological', 'behavior', 'behavioral', 'mental health', 'therapy',
      'cognitive', 'trauma', 'subconscious', 'freud', 'jung', 'anxiety', 'depression',
      'emotional intelligence', 'psychiatry', 'neurodivergent'
    ],
  },
  {
    genre: 'Business',
    keywords: [
      'business', 'startup', 'startups', 'marketing', 'sales', 'finance', 'investing',
      'investor', 'wall street', 'economics', 'entrepreneur', 'entrepreneurship',
      'venture capital', 'accounting', 'management', 'mba'
    ],
  },
  {
    genre: 'Poetry',
    keywords: [
      'poetry', 'poem', 'poems', 'verse', 'sonnet', 'sonnets', 'anthology', 'poet', 'rhyme'
    ],
  },
  {
    genre: 'Art',
    keywords: [
      'art', 'painting', 'drawing', 'illustration', 'graphic design', 'architecture',
      'photography', 'sculpture', 'artist', 'visual arts'
    ],
  },
]

function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[._\-–—/\\+]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

/**
 * Classifies a book into one of the standard genres:
 * 'Fiction' | 'Non-Fiction' | 'Science' | 'History' | 'Philosophy' | 'Biography' | 'Classic'
 * OR generates a new specialized genre category if standard ones do not fit.
 */
export function classifyBookGenre(book: {
  title?: string | null
  fileName?: string | null
  genre?: string | null
}): BookGenre {
  // 1. If explicit genre (standard or custom from AI/user) is already present, format and use it
  if (book.genre && book.genre.trim()) {
    const raw = book.genre.trim()
    return raw
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }

  // 2. Score title and filename against standard rules
  const title = book.title || ''
  const fileName = book.fileName || ''
  const combined = cleanText(`${title} ${fileName}`)

  if (!combined) return 'Non-Fiction'

  let bestGenre: BookGenre | null = null
  let highestScore = 0

  for (const rule of [...GENRE_RULES, ...EXTENDED_GENRE_RULES]) {
    let score = 0
    for (const kw of rule.keywords) {
      const cleanKw = cleanText(kw)
      if (!cleanKw) continue

      if (cleanKw.includes(' ') && combined.includes(cleanKw)) {
        score += 6
      } else {
        const regex = new RegExp(`\\b${cleanKw}\\b`, 'i')
        if (regex.test(combined)) {
          score += 2
        }
      }
    }

    if (score > highestScore) {
      highestScore = score
      bestGenre = rule.genre
    }
  }

  if (bestGenre && highestScore >= 2) {
    return bestGenre
  }

  // 3. Fallback heuristics
  if (/\b(novel|tale|tales|chronicle|chronicles|secret|curse|blood|shadow|night|warrior)\b/i.test(combined)) {
    return 'Fiction'
  }

  return 'Non-Fiction'
}

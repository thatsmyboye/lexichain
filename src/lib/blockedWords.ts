// Words that are in public/words.txt but must never be playable.
//
// The list holds proper nouns tied to atrocities and slurs whose main modern
// meaning is the slur, with their inflections and compounds. Words whose
// slur sense competes with a common innocent one stay playable on purpose:
// coon (raccoon), chink (a crack), spick (spick and span), dyke (a dike),
// fag (a cigarette), poof (the exclamation), kraut (sauerkraut), sheeny
// (shiny), gyp, and craft terms such as faggoting.
//
// Every entry here should exist in public/words.txt; add inflections when you
// add a word.
export const BLOCKED_WORDS: ReadonlySet<string> = new Set([
  // Proper nouns tied to atrocities
  "hitler", "hitlerian", "hitlerism", "hitlerite",
  "stalin", "stalinist", "stalinism",
  "mussolini", "mao", "lenin", "leninist", "leninism",
  "nazi", "nazis", "nazism", "nazify",
  "gestapo",

  // Anti-Black
  "nig", "nigger", "niggers", "niggerdom", "niggered", "niggerfish", "niggerfishes",
  "niggergoose", "niggerhead", "niggerish", "niggerism", "niggerling", "niggertoe",
  "niggerweed", "niggery", "niggra",
  "darkey", "darkeys", "darkie", "darkies", "darky",
  "jigaboo", "jigaboos", "pickaninny", "pickaninnies", "sambo", "sambos",
  "golliwog", "golliwogg", "golliwogs", "gollywog",
  "negress", "kaffir", "kaffirs",

  // Anti-Asian
  "chinaman", "chinamen", "chinee", "gook", "gooks", "jap", "coolie", "coolies",

  // Anti-Latino and anti-Hispanic
  "beaner", "beaners", "spic", "spics", "spik", "spiks", "wetback", "wetbacks",

  // Anti-Jewish
  "kike", "kikes", "yid", "yids", "sheenie", "sheenies", "jewed", "jewing",

  // Anti-Indigenous
  "redskin", "redskins", "injun", "abo", "abos", "boong", "lubra",
  "squaw", "squaws", "squawberries", "squawberry", "squawbush", "squawdom",
  "squawfish", "squawfishes", "squawflower", "squawroot", "squawtits", "squawweed",

  // Other ethnic and national
  "dago", "dagoes", "dagos", "wop", "wops", "woppish", "polack", "bohunk", "bohunks",
  "greaseball", "wog", "honky", "honkie", "honkies", "wigger", "taig", "pikey", "gyppo",

  // Anti-LGBTQ
  "faggot", "faggots", "faggotry", "faggoty", "faggy", "pooftah", "poove", "trannie",

  // Disability
  "retard", "retards", "retarded", "mongoloid", "mongoloids",
]);

const LOWERCASE_TITLE_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "is",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "vs",
  "with",
  "yet",
]);

function wordCore(word: string) {
  return word.replace(/^[^\p{L}\p{N}]*/u, "").replace(/[^\p{L}\p{N}.]*$/u, "");
}

function lowercaseCore(word: string) {
  const core = wordCore(word);
  return core ? word.replace(core, core.toLocaleLowerCase()) : word;
}

function capitalizeCore(word: string) {
  const core = wordCore(word);
  if (!core) return word;

  const lettersOnly = core.replace(/[^\p{L}]/gu, "");
  const hasIntentionalInternalCapital = /\p{Ll}.*\p{Lu}/u.test(lettersOnly);
  const isAcronym = lettersOnly.length > 1 && lettersOnly === lettersOnly.toLocaleUpperCase();
  if (hasIntentionalInternalCapital || isAcronym) return word;

  return word.replace(core, core.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase()));
}

/**
 * Gives generated node labels an editorial title treatment while keeping
 * articles, conjunctions, and short prepositions quiet inside the phrase.
 */
export function formatNodeLabel(label: string) {
  const words = label.trim().split(/\s+/);

  return words
    .map((word, index) => {
      const core = wordCore(word);
      const normalized = core.replace(/\.$/, "").toLocaleLowerCase();
      const isEdgeWord = index === 0 || index === words.length - 1;
      const followsBreak = index > 0 && /[:—–]$/.test(words[index - 1]);

      if (!isEdgeWord && !followsBreak && LOWERCASE_TITLE_WORDS.has(normalized)) {
        return lowercaseCore(word);
      }

      return capitalizeCore(word);
    })
    .join(" ");
}

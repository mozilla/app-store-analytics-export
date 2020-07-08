function toUnderscore(text) {
  return text
    .replace(/([\p{Lowercase_Letter}\d])(\p{Uppercase_Letter})/gu, '$1_$2')
    .replace(/(\p{Uppercase_Letter}+)(\p{Uppercase_Letter}\p{Lowercase_Letter}+)/gu, '$1_$2')
    .toLowerCase();
}

exports.toUnderscore = toUnderscore;

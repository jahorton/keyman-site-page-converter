let pandoc = require("pandoc-filter");

// Pandoc wants to default to a four-space indentation for code blocks sometimes; this function
// disables that for us.
function force_backtick_code_blocks(ele, format, meta) {
  if(ele.t == "CodeBlock" && !ele.c[0][0]) {
    // Doesn't even emit in the output; it just blocks the "can I indent" internal conditional!
    ele.c[0][0] = "code-block-indentation-prevention"
  }
}

// Strips the 'language-' prefix off the language attribute of the code block if it exists.
function clean_code_block_language(ele, format, meta) {
  if(ele.t == "CodeBlock" && ele.c[0][1].length > 0) {
    ele.c[0][1] = ele.c[0][1].map((entry) => {
      return entry.startsWith("language-") ? entry.substring("language-".length) : entry;
    })
  }
}

// Disabling the extension on output appears to do nothing, so...
function prevent_header_auto_identifiers(ele, format, meta) {
  if(ele.t == "Header") {
    ele.c[1][0] = "";
    ele.c[1][1] = [];
  }
  return;
}

// Allows us to strip off link alt-text / captioning
function clean_links(ele, format, meta) {
  if(ele.t == "Link") {
    if(ele.c[2] && ele.c[2].length > 1) {
      ele.c[2] = [ele.c[2][0], '']
    }
  }
}

// It seems all must be called by one top-level function?
function all(ele, format, meta) {
  force_backtick_code_blocks(ele, format, meta);
  clean_code_block_language(ele, format, meta);
  prevent_header_auto_identifiers(ele, format, meta);
  clean_links(ele, format, meta);
  // Cannot convert <span class="key"></span> to <key></key> here; Pandoc's AST
  // does not support a 'Key' type.
  // See: https://github.com/jgm/pandoc/issues/5796
}

pandoc.stdio(all);

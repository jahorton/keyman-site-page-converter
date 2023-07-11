let pandoc = require("pandoc-filter");

let CODEBLOCK_LANGUAGE = undefined;
if(process.env?.CODEBLOCK_LANGUAGE) {
  CODEBLOCK_LANGUAGE = process.env.CODEBLOCK_LANGUAGE
}

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
  if(ele.t == "CodeBlock") {
    if(ele.c[0][1].length > 0) {
      ele.c[0][1] = ele.c[0][1].map((entry) => {
        return entry.startsWith("language-") ? entry.substring("language-".length) : entry;
      })
    } else if(CODEBLOCK_LANGUAGE) {
      ele.c[0][1] = [ CODEBLOCK_LANGUAGE ];// TODO:  support setting a default
    }
  }
}

// Disabling the extension on output appears to do nothing, so...
function prevent_header_auto_identifiers(ele, format, meta) {
  if(ele.t == "Header") {
    ele.c[1][0] = "";
    ele.c[1][1] = [];
    ele.c[1][2] = [];
  }
  return;
}

// Allows us to strip off link alt-text / captioning
function clean_links(ele, format, meta) {
  if(ele.t == "Link") {
    // Removes link 'title text'
    if(ele.c[2] && ele.c[2].length > 1) {
      ele.c[2] = [ele.c[2][0], '']
    }

    // Double-check the link itself:  we prefer removing page extensions from links.
    let href = ele.c[2][0];

    // If it's a site-external link, do not modify the link further.
    if(href.indexOf('http://') != -1 || href.indexOf('https://') != -1) {
      return;
    }

    let lastFolderIndex = href.lastIndexOf('/');
    let extensionIndex = href.lastIndexOf('.');

    let extension = href.substring(extensionIndex);
    switch(extension) {
      // We'll go 'opt-in' for certain file extensions.
      // For example, any linked .pdf files still need their extension specified.
      // This also goes for .htm / .html, apparently!
      case '.md':
      case '.php':
        // if neither is found, -1 is not > -1.
        // if '<file with extension>', no folder (-1) < index of extension
        // if '../<extensionless>', extensionIndex < lastFolderIndex
        // if '../<file with extension>', lastFolderIndex < index of extension
        if(extensionIndex > lastFolderIndex) {
          ele.c[2][0] = href.substring(0, extensionIndex);
        }
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

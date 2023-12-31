import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import { pathToFileURL } from 'url';

let BASE_DIR = path.dirname(import.meta.url); //
if(BASE_DIR.startsWith("file:///")) {
  BASE_DIR = BASE_DIR.substring("file:///".length);
}

// Performs relative pathing to the help.keyman.com repo's directory.
const REPO_DIR = `${BASE_DIR}/../help.keyman.com`;
const LOCALHOST = `http://localhost:8055`;

/**
 * Defines this script's command-line interface, which is used when executed directly by Node.
 * @returns
 */
export function command_main() {
  function displayHelp() {
    console.log("This tool is designed for use in converting individual pages of the Keyman sites from HTML to MD.");
    console.log("");
    console.log("Usage:  node convert.mjs <site-path-to-page>");
    console.log("  --ast                             Instead of converting the page, outputs `pandoc`'s AST parse of it.");
    console.log("  --codeblock-language <language>   Sets the language used by codeblocks if not already set.");
    console.log("  --finalize                        Completely erases the original page after converting it.");
    console.log("  --verbose                         Adds verbose logging (to help diagnose problems).");
    console.log();
    console.log("<site-path-to-page> should closely match the URL for the live site, but without the protocol");
    console.log("or server-root prefix.  For https://help.keyman.com/convert/this/page, use `convert/this/page`");
    console.log("(no backticks)");
  }

  // Basic help-request check
  let mainArgs = [].concat(process.argv); // make a shallow copy of the arguments array.

  // By default, any node-based process has two command-line args:
  // [0] - node installation root
  // [1] - path to the script being run.
  mainArgs.shift(); // remove the first two elements
  mainArgs.shift();

  // A list of paths for pages to convert
  let paths = [];
  // Configuration settings for the call
  let options = {
    ast: false,
    finalize: false,
    codeblockLanguage: undefined,
    verbose: false
  };

  for(let arg = mainArgs.shift(); arg !== undefined; arg = mainArgs.shift()) {
    switch(arg) {
      case '--help':
      case '-h':
      case '-?':
        displayHelp();
        process.exit();
      case '--ast':
        options.ast = true;
        break;
      case '--finalize':
        options.finalize = true;
        break;
      case '--codeblock-language':
        options.codeblockLanguage = mainArgs.shift();
        break;
      case '--verbose':
        options.verbose = true;
        break;
      default:
        // In the default state, this should be the site path to the page to convert,
        // leaving off the server root aspect.
        paths.push(arg);
    }
  }

  return {
    paths: paths,
    options: options
  }
}

/**
 * Converts the help-site page based at the specified location.
 * @param {*} location  The location component of the URL for the page when hosted.
 * @param {*} options Includes the options specified below:
 *   - `options.ast`: If `true`, outputs pandoc's AST / parse-tree as its own file (.ast)
 *   - `options.finalize`:  If `true`, erases the original source version after conversion.
 *   - `options.verbose`:  Outputs the commands used to run pandoc and possibly other logging
 *   - `options.codeblockLanguage`: Sets the language for any code-blocks without one already set
 * @returns
 */
export function convertFile(location, options) {
  const location_folder = path.dirname(location);
  const filename = path.parse(location).name; // no extension or path parts
  const filepath = `${REPO_DIR}/${location_folder}/${filename}.php`;
  const outpath  = `${REPO_DIR}/${location_folder}/${filename}.md`;
  const sitepath = `${LOCALHOST}/${location_folder}/${filename}`;

  // Does the original page source exist?  Check before proceeding!
  if(!fs.existsSync(filepath)) {
    console.error(`Original PHP/HTML source for the page (${filepath}) does not exist!`);
    process.exit(1);
  }

  // Disable the template header.
  let sourceFileContents = fs.readFileSync(filepath).toString();
  let pageTitle = '';

  // The most-commonly used & most up-to-date template application:
  let modernTitleMatch = sourceFileContents.match(/'title'[ ]*=>[ ]*"([^"]+)"/);
  if(!modernTitleMatch) {
    modernTitleMatch = sourceFileContents.match(/'title'[ ]*=>[ ]*'([^']+)'/);
  }
  if(modernTitleMatch) {
    pageTitle = modernTitleMatch[1];
  }

  let titleInsert = '';
  if(modernTitleMatch) {
    pageTitle = pageTitle.replace(/&amp;/g, '&');
    // Preserve the title component for future reads.
    titleInsert = `// 'title' => "${pageTitle}"`
  }
  sourceFileContents = sourceFileContents.replace(/head\([^\)]*\);?/, titleInsert);

  // An older variant we need to look out for:
  sourceFileContents = sourceFileContents.replace("require_once('header.php');", '');
  sourceFileContents = sourceFileContents.replace("include('footer.php');", '');

  let legacyTitleMatch = sourceFileContents.match(/\$pagename[ ]*=[ ]*'([^']+)'/);
  if(legacyTitleMatch) {
    pageTitle = legacyTitleMatch[1];
  }

  pageTitle = pageTitle.replace(/&amp;/g, '&');

  fs.writeFileSync(filepath, sourceFileContents);

  // Did we convert it once previously?  If so, we should remove the conversion before proceeding.
  if(fs.existsSync(outpath)) {
    fs.rmSync(outpath); // to remove the original file we just converted
  }

  let pandocCmd;

  if(options.ast) {
    // Allows us to see pandoc's parse for the file; this gives us useful information for
    // increasing our pandoc filter's coverage.
    const astpath = `${REPO_DIR}/${location_folder}/${filename}.ast`;
    pandocCmd = `pandoc --from html --to native "${sitepath}" -o "${astpath}"`;
    if(options.verbose) {
      console.log(`Executing: ${pandocCmd}`);
    }

    // No codeblock-language settings; we want the original AST output here, to serve
    // as a reference for implementing our corrections.
    const catOutput = child_process.execSync(pandocCmd).toString();  //EXECute.
    if(catOutput) {
      console.log(catOutput);
    }
  }

  const EXEC_OPTIONS={
    // Sets environment variables for the .execSync to follow command.
    env: {
      CODEBLOCK_LANGUAGE: options.codeblockLanguage
    }
  };

  // Standard case.
  pandocCmd = `pandoc --from html --to markdown_phpextra+backtick_code_blocks \
"${sitepath}" -o "${outpath}" --filter "${BASE_DIR}/pandoc-filter.js"`;

  if(options.verbose) {
    console.log(`Executing: ${pandocCmd}`);
    console.log();
  }

  const catOutput = child_process.execSync(pandocCmd, EXEC_OPTIONS).toString();  //EXECute.
  if(catOutput) {
    console.log(catOutput);
    console.log();
  }

  // If we're writing out AST, that's a sign
  if(options.ast && options.finalize) {
    console.error(`--ast and --finalize mode are both set.  As AST mode is used to diagnose automation
issues with page conversion, this is considered an error.  Aborting.`);
    process.exit(1);
  }

  const fileContents = fs.readFileSync(outpath).toString();

  fileContents.split('\n'); // Gives an array of individual lines of the file.

  // Handles conversion of converted title to our custom title format
  //
  // # Comments
  const firstNewLine = fileContents.indexOf('\n');  // Find the first position of '\n' - the newline character
  const firstLine = fileContents.substring(0, firstNewLine); // Get the section of the string we want:  from position 0 to the newline's position.
  let everythingElse = fileContents;
  let newFirstLines = '';

  let firstLineHeaderMatch = firstLine.match(/#[^#][ ]*([^\n]+)/);

  // Preserve legacy page-titles, but allow modern ones to be replaced
  // by in-page headers.  (Legacy titles are directly inserted in their
  // PHP pages, but that goes missing when we turn the templates off!)
  let extractedTitle = false;
  if(firstLineHeaderMatch && !legacyTitleMatch) {
    pageTitle = firstLineHeaderMatch[1];
    extractedTitle = true;
  }

  // If we set the title based on the first <h1> (or similar) entry,
  // don't include its original version.
  if(extractedTitle) {
    everythingElse = fileContents.substring(firstNewLine+1); // +1:  doesn't copy the '\n'.
  }

  if(pageTitle) {
    newFirstLines = `---
title: ${pageTitle}
---`;
  } else {
    console.warn("Could not determine file's title!");
    everythingElse = fileContents;
  }

  // End title conversion

  // Attempt conversion of <span class="key"></span> elements to <key></key> elements.
  // Can't be done via pandoc filtering, but fortunately... our <key> elements are simple and
  // ought be easy enough to regex-match.
  const keySpanRegex = /<span class="key">(.+?)<\/span>/g;
  everythingElse = everythingElse.replace(keySpanRegex, "<key>$1</key>");

  fs.writeFileSync(outpath, `${newFirstLines}
${everythingElse}`);

  if(options.linkCheck) {
    const magicGrepCmd = `grep -rEl "(href=(['\\"])(?:[^'\\"]+/)?${filename})\.php(#[^'\\"]+)?['\\"]"`;
    const pathsWithReference = child_process.execSync(magicGrepCmd).toString();  //EXECute.
    if(pathsWithReference) {
      const basePathsList = pathsWithReference.split('\n');
      console.log();
      console.log(`Paths detected with possible link to ${filepath}:`)
      for(let path of basePathsList) {
        // Silence any reports for folders versioned before 16.0.  They're old enough that
        // we (currently) don't care to convert 'em.
        const versionMatch = path.match(/(\d+)\.(\d+)/);
        if(versionMatch) {
          let major = versionMatch[1];
          let minor = versionMatch[2];

          if(Number.parseInt(major, 10) >= 16) {
            console.log(`- ${path}`);
          }
        } else {
          console.log(`- ${path}`);
        }
      }
    }
  }

  if(options.finalize) {
    fs.rmSync(filepath); // to remove the original file we just converted
    console.log(`Deleted ${filepath}.`);
  }
}

// Only run this if we're being directly run via Node, not through an import.
if(import.meta.url === pathToFileURL(process.argv[1]).href) {
  let { paths, options } = command_main();

  // Currently perma-on, but easy enough to turn off if/when we want.
  options.linkCheck = true;
  if(options.verbose) {
    console.log("Paths: ");
    console.log(paths);
    console.log();
    console.log("Options: ");
    console.log(options);
    console.log();
  }
  paths.forEach((path) => convertFile(path, options));
}
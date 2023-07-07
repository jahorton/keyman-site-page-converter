// console.log("Hello World");

import fs from 'fs';
import path from 'path';

import child_process from 'child_process';
child_process.execSync('cp Readme.md CopiedReadme.md');

import process from 'process';

console.log("Command-line arguments:");
console.log(process.argv);
// process.exit();


// let buffer = fs.readFileSync('Readme.md');
// let text = buffer.toString();

// console.log(text);

let myDir = process.cwd();  // Current Working Directory

console.log("Working from " + myDir);

let folderContents = fs.readdirSync('./');

for(let i=1; i <= folderContents.length; i++) {
  let file = folderContents[i-1];
  let isDir = fs.lstatSync(myDir + '/' + file).isDirectory();

  console.log(`${isDir ? "Directory" : "File"} ${i}: ${file} - total path ${path.join(myDir, file)}`);
  if(path.extname(myDir + '/' + file) == '.mjs') {
    console.log("Is this script!");
  }
}


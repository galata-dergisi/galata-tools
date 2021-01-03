// Copyright 2021 Mehmet Baker
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
// 
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
// 
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.const path = require('path');

const fs = require('fs');
const path = require('path');
const program = require('commander');
const readline = require('readline');
const { upload, eventEmitter } = require('@mehmetb/youtube-uploader');
const { StringDecoder } = require('string_decoder');

const MAX_UPLOADS = 100;

/**
 * @param {object[]} items items array
 */
function sortItemsByMagazineIndexThenByFileName(items) {
  items.sort((a, b) => {
    if (a.magazineIndex === b.magazineIndex) {
      const sortedFileNames = [a.file, b.file].sort();
      return sortedFileNames.indexOf(a.file) - sortedFileNames.indexOf(b.file);
    }

    return a.magazineIndex - b.magazineIndex;
  });
}

async function getItems() {
  const outputDirectory = path.join(__dirname, 'output');
  const dirs = await fs.promises.readdir(outputDirectory);
  const items = [];

  for (const dir of dirs) {
    const dirPath = path.join(outputDirectory, dir);
    const stat = await fs.promises.stat(dirPath);
    if (stat.isDirectory()) {
      const files = await fs.promises.readdir(dirPath);
      if (files.includes('item.json')) {
        const fileContent = await fs.promises.readFile(path.join(dirPath, './item.json'), 'utf-8');
        const item = JSON.parse(fileContent);
        items.push(item);
      }
    }
  }

  sortItemsByMagazineIndexThenByFileName(items);
  return items;
}

function getItemDescription(item) {
  let description = `Ses Makinesi | Sayı ${item.magazineIndex}, Galata Dergisi\n\n`;

  if (item.label1) {
    description += `${item.label1.trim()}`;
  } else {
    description += 'Şair:';
  }

  description += ` ${item.poet}\n`;

  if (item.label2) {
    description += `${item.label2.trim()}`;
  } else {
    description += 'Okuyan:';
  }

  description += ` ${item.reciter}\n`;
  description += `\nhttps://galatadergisi.org`;
  return description;
}

function getTitle(item) {
  return`Sayı ${item.magazineIndex} — ${item.title}`;
}

async function uploadItems(items) {
  const outputDirectory = path.join(__dirname, 'output');
  const videos = items.map((item) => ({
    path: path.join(outputDirectory, item.id, `./${item.id}.mp4`),
    title: getTitle(item),
    description: getItemDescription(item),
    tags: ['Ses Makinesi'],
    playlist: `Ses Makinesi - Sayı ${item.magazineIndex}`,
  }));

  eventEmitter.on('beforeupload', (e) => {
    const videoIndex = videos.findIndex((v) => e.video === v);
    const video = videos[videoIndex];
    const order = `${String(videoIndex + 1).padStart(3, '0')}/${String(videos.length).padStart(3, '0')}`;
    console.log(`Uploading item ${order}: ${video.title}`);
  });

  eventEmitter.on('afterupload', (e) => {
    const videoIndex = videos.findIndex((v) => e.video === v);
    const order = `${String(videoIndex + 1).padStart(3, '0')}/${String(videos.length).padStart(3, '0')}`;
    console.log(`Upload complete: ${order}`);
  });

  eventEmitter.on('uploadprogress', (e) => {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0, null);
    process.stdout.write(`${e.progress}% complete`);
    if (e.progress === 100) console.log('');
  });

  await upload(videos);
}

async function main(start, end, dryRun = false) {
  try {
    let items = await getItems();
    const initialCount = items.length;
    console.log(`There are ${initialCount} items in total.`);

    if (typeof start === 'number' && typeof end === 'number') {
      items = items.slice(start, end + 1);
    } else {
      items = items.slice(start);
    }

    if (items.length > MAX_UPLOADS) {
      console.warn(`There are more than ${MAX_UPLOADS} items to upload. Will upload the first ${MAX_UPLOADS} only.`);
      items = items.slice(0, MAX_UPLOADS);
    }

    console.log(`${items.length} items will be uploaded.`);

    if (dryRun) {
      for (let i = 0; i < items.length; ++i) {
        const order = `${String(i + start + 1).padStart(3, '0')}/${String(initialCount).padStart(3, '0')}`;
        console.log(`${order}: ${getTitle(items[i])}`);
      }
    } else {
      await uploadItems(items);
    }
  } catch (ex) {
    console.trace(ex);
  }
}

program
  .option('-s, --start <number>', 'Start from item at index (zero-based, inclusive)', 0)
  .option('-e, --end <number>', 'Stop at nth item (zero-based, inclusive)')
  .option('-d, --dry-run', 'Do not upload but show a list of items that are going to be uploaded')
  .parse(process.argv);

let start = Number(program.start);
let end;

if (isNaN(start)) {
  console.error('Invalid --start index');
  process.exit(1);
}

if (/\d+/.test(program.end)) {
  end = Number(program.end);

  if (isNaN(end)) {
    console.error('Invalid --end index');
    process.exit(1);
  }

  if (end < start) {
    console.error('--end cannot be lower than --start!');
    process.exit(1);
  }
}

main(start, end, program.dryRun);

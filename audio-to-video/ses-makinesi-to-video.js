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
const { v4: uuid } = require('uuid');
const program = require('commander');
const getPoems = require('./lib/db-fetcher');
const lowerthirdGenerator = require('./lib/lowerthird-generator');
const videoGenerator = require('./lib/video-generator');

program
  .option('--min <number>', 'Fetch pages of magazine issues with index greater than or equal to this', -1)
  .option('--max <number>', 'Fetch pages of magazine issues with index lower than or equal to this')
  .option('-i, --include <json file>', 'Manually add the entries of this JSON file')
  .requiredOption('-p, --public <path>', 'Path to "public" folder of galatadergisi.org')
  .parse(process.argv);

async function generateVideoForItem({ item, outputDirectory, public }) {
  try {
    item.id = uuid();

    console.log(`Creating output directory for magazine #${item.magazineIndex}'s ${item.title}`);
    item.outputDirectory = path.join(outputDirectory, item.id);
    await fs.promises.mkdir(item.outputDirectory, { recursive: true });

    item.lowerthirdImage = `${item.id}.png`;
    const lowerthirdImage = path.join(item.outputDirectory, `${item.id}.png`);

    const options = {
      title: item.title,
      subText1: item.poet,
      subText2: item.reciter,
      filename: lowerthirdImage,
    };

    if (item.label1) options.label1 = item.label1;
    if (item.label2) options.label2 = item.label2;

    console.log('Generating lowerthird');
    await lowerthirdGenerator(options);

    const audioPathBits = item.file.replace('/magazines', '')
      .split('/');
    const audioPath = `/${audioPathBits[2]}/${audioPathBits[1]}/${audioPathBits[3]}`;
    await videoGenerator({
      id: item.id,
      cover: path.join(public, item.cover),
      file: path.join(public, audioPath),
      outputDirectory: item.outputDirectory,
      lowerthirdImage,
    });
    await fs.promises.writeFile(path.join(item.outputDirectory, 'item.json'), JSON.stringify(item, null, 2));
  } catch (ex) {
    console.trace(ex);
    console.error(`Failed to generate video for item: 
      Magazine Index: ${item.magazineIndex} Audio File: ${item.file}`);
  }
}

async function main() {
  try {
    const minIndex = program.min;
    const maxIndex = program.max ? Number(program.max) : null;

    console.log('Min index is', minIndex);
    console.log('Max index is', maxIndex);

    console.log('Fetching items from database...');
    const items = await getPoems({
      minIndex, 
      maxIndex: isNaN(maxIndex) ? null : maxIndex,
      includePath: program.include,
    });
    console.log('List of poems is retrieved');

    console.log('Creating output directory');
    const outputDirectory = path.join(__dirname, 'output');
    await fs.promises.mkdir(outputDirectory, { recursive: true });

    const public = path.resolve(program.public);

    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      console.info(`Processing item ${String(i + 1).padStart(3, '0')}/${items.length}`);
      await generateVideoForItem({ item, outputDirectory, public });      
      console.info(`Finished processing item ${String(i + 1).padStart(3, '0')}/${items.length}`);
    }
  } catch (ex) {
    console.trace(ex);
  }
}

main();

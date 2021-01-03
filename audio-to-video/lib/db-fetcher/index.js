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
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

/**
 * This code retrieves all "Ses Makinesi" sections from the database and returns 
 * the poetry information in JSON format. The returned data will be used for video
 * cover creation.
 */

/**
 * @typedef DatabasePage
 * @type {object}
 * @property {number} id
 * @property {number} magazineIndex
 * @property {number} pageNumber
 * @property {string} content HTML string
 */

 /**
  * @typedef Page
  * @type {object}
  * @property {number} id
  * @property {number} magazineIndex
  * @property {number} pageNumber
  * @property {string} content HTML string
  * @property {string} cover
  */

  /**
   * @typedef Poem
   * @type {object}
   * @property {string} poet
   * @property {string} title
   * @property {string} reciter
   * @property {string} file
   * @property {string} cover
   * @property {number} magazineIndex
   */

const fs = require('fs');
const mariadb = require('mariadb');
const sanitizeHTML = require('sanitize-html');
const config = require('./config');


function uniqueMap(array, callback) {
  const mappedArray = array.map(callback);
  return Array.from(new Set(mappedArray));
}

/**
 * This will retrieve the "Ses Makinesi" pages. "Ses Makinesi" section may take up 2 pages,
 * therefore we fetch the page next to it as well.
 * @param {*} connection 
 * @param {number} minIndex Minimum (inclusive) magazineIndex
 * @param {number} maxIndex Maximum (inclusive) magazineIndex
 * @returns {DatabasePage[]} pages
 */
async function fetchDatabasePages(connection, minIndex, maxIndex) {
  const queryValues = [minIndex];
  if (typeof maxIndex === 'number') queryValues.push(maxIndex);

  // Magazine #34 will be added manually
  const pages1 = await connection.query(`
    SELECT 
      * 
    FROM 
      pages 
    WHERE 
      magazineIndex <> 34 AND 
      \`content\` LIKE "%<h1 class=\\"mTitle\\">Ses Makinesi</h1>%" AND 
      magazineIndex >= ? 
      ${typeof maxIndex === 'number' ? ' AND magazineIndex <= ?' : ''}
    ORDER BY 
      magazineIndex ASC
    `, queryValues);
  const placeholders = pages1.map(() => `(magazineIndex = ? AND pageNumber = ?)`).join(' OR ');
  const values = pages1.flatMap((page) => [page.magazineIndex, page.pageNumber + 1]);
  const pages2 = await connection.query(`SELECT * FROM pages WHERE ${placeholders}`, values);
  return [...pages1, ...pages2];
}

/**
 * This will fetch the cover page of each mamgazine and then parse the location of cover image.
 * @param {*} connection 
 * @param {DatabasePage[]} pages 
 * @returns {Page[]} pages
 */
async function fetchCoverImageLocations(connection, pages) {
  const magazineIndexes = uniqueMap(pages, (page) => page.magazineIndex);
  const placeholders = magazineIndexes.map(() => '?').join(', ');
  const firstPages = await connection.query(`SELECT * FROM pages WHERE pageNumber = 1 AND magazineIndex IN (${placeholders})`, magazineIndexes);  

  return pages.map((page) => {
    const firstPage = firstPages.find((p) => p.magazineIndex === page.magazineIndex);
    const cover = firstPage.content.match(/src="([^"]+)"/)[1];
    return {
      ...page,
      cover, 
    };
  });
}

/**
 * "Ses Makinesi" section has tabular data. This function returns all the relevant rows.
 * @param {string} htmlString 
 * @returns {string[]} rows
 */
function getAllRows(htmlString) {
  let currentIndex = -1;
  const rows = [];

  do {
    currentIndex = htmlString.indexOf('<tr>', currentIndex + 1);
    if (currentIndex > -1) {
      const endIndex = htmlString.indexOf('</tr>', currentIndex);
      rows.push(htmlString.slice(currentIndex, endIndex));
    }
  } while (currentIndex > -1);

  return rows;
}

/**
 * Parses the audio file paths and returns them in the order they appeared.
 * @param {string} htmlString 
 * @returns {string[]} Path of audio files.
 */
function parseAudioLocations(htmlString) {
  const results = [];
  let currentIndex = -1;

  while (true) {
    currentIndex = htmlString.indexOf('<input', currentIndex + 1);
    if (currentIndex === -1) return results;

    const end = htmlString.indexOf('>', currentIndex);
    const input = htmlString.slice(currentIndex, end + 1);

    if (input.includes('type="hidden"') && input.includes('size="1"')) {
      const result = input.match(/class="([^"]+)"/)[1];
      results.push(result);
    }
  }
}

/**
 * This function parses the last column of a row. First columns hold label texts
 * in "Ses Makinesi" sections.
 * @param {string} htmlString 
 * @returns {string} Sanitized string
 */
function parseLastTableColumn(htmlString) {
  const start = htmlString.lastIndexOf('<td>');
  const end = htmlString.lastIndexOf('</td>');
  const text = htmlString.slice(start + 4, end);
  return sanitizeHTML(text, { allowedTags: []});
}

/**
 * Parses each table row and returns the parsed data as JSON.
 * @param {string[]} rows An array of HTML strings. 
 * @param {Page} page 
 * @returns {Poem[]} poems
 */
function parsePoems(rows, page) {
  if (rows.length % 4 !== 0) {
    console.log(page.magazineIndex, page.pageNumber);
    throw new Error('Incorrect number of rows!');
  }

  const audioFiles = parseAudioLocations(page.content);
  const poems  = [];

  for (let i = 0; i < rows.length; i += 4) {
    const order = i / 4;
    const poet = parseLastTableColumn(rows[i + 1]);
    const title = parseLastTableColumn(rows[i + 2]);
    const reciter = parseLastTableColumn(rows[i + 3]);
    poems.push({
      poet,
      title,
      reciter,
      file: audioFiles[order],
      cover: page.cover,
      magazineIndex: page.magazineIndex,
    });
  }

  return poems;
}

/**
 * This will parse each "Ses Makinesi" section and return a JSON. 
 * @param {Page[]} pages 
 * @returns {Poem[]} poems
 */
function crawlPoems(pages) {
  // sort by magazineIndex, then by pageNumber
  pages.sort((page1, page2) => {
    if (page1.magazineIndex === page2.magazineIndex) {
      return page1.pageNumber - page2.pageNumber;
    }

    return page1.magazineIndex - page2.magazineIndex;
  });

  const poems = [];

  for (let i = 0; i < pages.length; ++i) {
    const page1 = pages[i];
    const rows = getAllRows(page1.content);

    if (pages[i+1].magazineIndex === page1.magazineIndex) {
      const page2 = pages[i + 1];
      rows.push(...getAllRows(page2.content));
      i += 1;
    }

    poems.push(...parsePoems(rows, page1));
  }

  return poems;
}

function getData(connection, minIndex, maxIndex) {
  return fetchDatabasePages(connection, minIndex, maxIndex)
    .then((result) => fetchCoverImageLocations(connection, result))
    .then(crawlPoems);
}

async function getManuallyIncludedItems(filepath) {
  const fileContent = await fs.promises.readFile(filepath, 'utf8');
  return JSON.parse(fileContent);
}

/**
 * @param {object} params Parameters
 * @param {number} [minIndex=-1] Minimum (inclusive) magazineIndexto fetch. (Default: fetch all)
 * @param {number} [maxIndex] Maximum (inclusive) magazineIndex
 * @param {string} [includePath] Will be concatted with results if points to a JSON file.
 * @returns {Poem[]}
 */
module.exports = async function main({ minIndex = -1, maxIndex = null, includePath }) {
  let connection;

  try {
    connection = await mariadb.createConnection(config.db);
    const data = await getData(connection, minIndex, maxIndex);

    if (includePath) {
      const manuallyIncludedItems = await getManuallyIncludedItems(includePath);
      return data.concat(manuallyIncludedItems);
    }

    return data;
  } catch (ex) {
    console.trace(ex);
    return null;
  } finally {
    if (connection) {
      connection.end();
    }
  }
}

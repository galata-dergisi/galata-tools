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

const fs = require('fs');
const { createCanvas, registerFont, loadImage } = require('canvas');

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const TEXT_POSITION = 575;
const SUBTEXT_POSITION = 630;
const TEXT_PADDING = 40;
const SUBTEXT_PADDING = 42;
const MAX_TEXT_WIDTH = 1200;
const LABELS = {
  poet: 'Şair: ',
  recitedBy: '     Okuyan: ',
};

registerFont('UbuntuMono-Regular.ttf', { family: 'UbuntuMono' });
registerFont('UbuntuMono-Bold.ttf', { family: 'UbuntuMono', weight: 700 });
const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
const ctx = canvas.getContext('2d');

async function generatePoster(title, poet, recitedBy, filename = 'image.png') {
  try {
    const image = await loadImage('lowerthird.jpg');
    ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // write the name of the poem
    ctx.fillStyle = '#000';
    ctx.font = 'normal 42px UbuntuMono';
    ctx.fillText(title, TEXT_PADDING, TEXT_POSITION, MAX_TEXT_WIDTH);

    // write the label for poet's name
    ctx.font = 'bold 26px UbuntuMono';
    const poetLabelWidth = ctx.measureText(LABELS.poet).width;
    ctx.fillText(LABELS.poet, SUBTEXT_PADDING, SUBTEXT_POSITION);

    // write poet's name
    ctx.font = 'normal 26px UbuntuMono';
    const poetTextWidth = ctx.measureText(poet).width;
    ctx.fillText(poet, SUBTEXT_PADDING + poetLabelWidth, SUBTEXT_POSITION, MAX_TEXT_WIDTH / 2);

    // write the label for reciter's name
    ctx.font = 'bold 26px UbuntuMono';
    const recitedByLabelWidth = ctx.measureText(LABELS.recitedBy).width;
    ctx.fillText(LABELS.recitedBy, SUBTEXT_PADDING + poetLabelWidth + poetTextWidth, SUBTEXT_POSITION);

    // write reciter's name
    ctx.font = 'normal 26px UbuntuMono';
    ctx.fillText(recitedBy, SUBTEXT_PADDING + poetLabelWidth + poetTextWidth + recitedByLabelWidth, SUBTEXT_POSITION, MAX_TEXT_WIDTH / 2);

    const imageBuffer = canvas.toBuffer('image/png');
    await fs.promises.writeFile(filename, imageBuffer);
  } catch (ex) {
    console.trace(ex);
  }
}

generatePoster('Capriccio Ölüm // Ölüm Cantabile', 'İsmet Özel', 'Semih Bozkurt');
//generatePoster('Kara Gözler', 'İsmet Özel', 'Büşra Elif Yüksel');

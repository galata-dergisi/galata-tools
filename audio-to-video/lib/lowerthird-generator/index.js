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
const path = require('path');
const { createCanvas, registerFont, loadImage } = require('canvas');

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const TEXT_POSITION = 575;
const SUBTEXT_POSITION = 630;
const TEXT_PADDING = 40;
const SUBTEXT_PADDING = 42;
const MAX_TEXT_WIDTH = 1120;
const LABELS = {
  poet: 'Şair: ',
  recitedBy: '     Okuyan: ',
};

registerFont('UbuntuMono-Regular.ttf', { family: 'UbuntuMono' });
registerFont('UbuntuMono-Bold.ttf', { family: 'UbuntuMono', weight: 700 });
const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
const ctx = canvas.getContext('2d');

/**
 * @param {object} params Parameters
 * @param {string} params.title
 * @param {string} params.subText1
 * @param {string} params.subText2
 * @param {string} [params.label1]
 * @param {string} [params.label2]
 * @param {string} [params.filename=image.png]
 */
module.exports = async function generateLowerThirdImage(params) {
  params = {
    label1: LABELS.poet,
    label2: LABELS.recitedBy,
    filename: 'image.png',
    ...params,
  };

  try {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const image = await loadImage(path.join(__dirname, 'lowerthird.png'));
    ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // write the title
    ctx.fillStyle = '#000';
    ctx.font = 'normal 42px UbuntuMono';
    ctx.fillText(params.title, TEXT_PADDING, TEXT_POSITION, MAX_TEXT_WIDTH);

    // write the label 1
    ctx.font = 'bold 26px UbuntuMono';
    const label1Width = ctx.measureText(params.label1).width;
    ctx.fillText(params.label1, SUBTEXT_PADDING, SUBTEXT_POSITION);

    // write subText1
    ctx.font = 'normal 26px UbuntuMono';
    const subText1Width = ctx.measureText(params.subText1).width;
    ctx.fillText(params.subText1, SUBTEXT_PADDING + label1Width, SUBTEXT_POSITION, MAX_TEXT_WIDTH / 2);

    // write the label 2
    ctx.font = 'bold 26px UbuntuMono';
    const label2Width = ctx.measureText(params.label2).width;
    ctx.fillText(params.label2, SUBTEXT_PADDING + label1Width + subText1Width, SUBTEXT_POSITION);

    // write subText2
    ctx.font = 'normal 26px UbuntuMono';
    ctx.fillText(params.subText2, SUBTEXT_PADDING + label1Width + subText1Width + label2Width, SUBTEXT_POSITION, MAX_TEXT_WIDTH / 2);

    const imageBuffer = canvas.toBuffer('image/png');
    await fs.promises.writeFile(params.filename, imageBuffer);
  } catch (ex) {
    console.trace(ex);
  }
}

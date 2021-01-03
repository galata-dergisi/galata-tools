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

const path = require('path');
const { spawn } = require('child_process');

const LOGO_PATH = path.join(__dirname, 'logo.mov');

function runFFMPEG(args) {
  return new Promise((resolve, reject) => {
    // ffmpeg must be in your PATH!!!
    const proc = spawn('ffmpeg', args, {
      stdio: 'pipe',
      shell: true,
    });

    proc.on('error', reject);

    const exitHandler = (code, signal) => {
      if (signal) {
        return reject(new Error(`Exiting with SIGNAL: ${signal}`));
      }

      if (code !== 0) {
        return reject(new Error(`ffmpeg has exited with code ${code}`));
      }

      resolve();
    };

    proc.on('exit', exitHandler);
    proc.on('close', exitHandler);
  });
}

async function createVideoOutput(cover, lowerthird, videoOutputDirectory) {
  const isVideoCover = /\.mp4$/.test(cover);
  const videoOutput = path.join(videoOutputDirectory, 'video_track.mp4');

  if (isVideoCover) {
    console.info('Cover is a movie. Creating overlay video with logo and lowerthird image...');
    const lowerthirdWithLogoPath = path.join(videoOutputDirectory, 'lowerthird_and_logo.mov');
    await runFFMPEG(['-i', `"${lowerthird}"`, '-i', `"${LOGO_PATH}"`, '-filter_complex', '"[0:v][1:v] overlay=60:0"', '-c:v', 'qtrle', `"${lowerthirdWithLogoPath}"`]);

    console.info('Concatting overlay video and magazine cover movie...');
    await runFFMPEG(['-i', `"${lowerthirdWithLogoPath}"`, '-stream_loop', '-1', '-i', `"${cover}"`, '-filter_complex', '"[1:v]scale=-1:720,pad=1280:720:(ow-iw)/2:(oh-ih)/2 [cover];[cover][0:v] overlay=0:0:shortest=1"', '-shortest', '-an', `"${videoOutput}"`]);
  } else {
    console.info('Concatting logo, lowerthird and magazine cover image...');
    await runFFMPEG(['-i', `"${cover}"`, '-i', `"${lowerthird}"`, '-i', `"${LOGO_PATH}"`, '-filter_complex', '"[0:v]scale=-1:720,pad=1280:720:(ow-iw)/2:(oh-ih)/2 [cover];[cover][2:v] overlay=60:0 [cover_with_logo];[cover_with_logo][1:v] overlay=0:0"', '-an', `"${videoOutput}"`]);
  }

  return videoOutput;
}

function concatAudioAndVideo({ audioFilePath, videoFilePath, outputDirectory, id }) {
  console.log('Concatting audio and video (generating final output...');
  const outputPath = path.join(outputDirectory, `${id}.mp4`);
  return runFFMPEG(['-stream_loop', '-1', '-i', `"${videoFilePath}"`, '-i', `"${audioFilePath}"`, '-c', 'copy', '-strict', '-1', '-shortest', '-map 0:v:0', '-map 1:a:0', '-movflags', '+faststart', `"${outputPath}"`]);
}

/**
 * 
 * @param {object} params Parameters 
 * @param {string} params.id ID of item
 * @param {string} params.cover Cover image of the magazine
 * @param {string} params.lowerthirdImage Path to lowerthird image
 * @param {string} params.file Path to audio file
 * @param {string} params.outputDirectory
 */
module.exports = async function generateVideo(params) {
  const videoFilePath = await createVideoOutput(params.cover, params.lowerthirdImage, params.outputDirectory);
  await concatAudioAndVideo({
    id: params.id,
    audioFilePath: params.file,
    videoFilePath,
    outputDirectory: params.outputDirectory,
  });
}

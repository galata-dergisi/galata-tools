// Copyright 2016 Google LLC
// Copyright 2021 Mehmet Baker
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// YouTube API needs a verified project. Otherwise the uploaded videos are getting locked to private.
// This code is kept for reference only!

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');

let youtube;

async function getYoutubeInstance() {
  const auth = await authenticate({
    keyfilePath: path.join(__dirname, './oauth2.keys.json'),
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube',
    ],
  });
  google.options({ auth });
  return google.youtube('v3');
}

/**
 * Upload a video to YouTube
 * @param {object} params Parameters
 * @param {string} params.file Absolute path to file
 * @param {string} params.title Video title
 * @param {string} [params.description] Video description
 * @param {string[]} [params.tags] Video tags
 */
module.exports = async function upload(params) {
  if (!youtube) {
    youtube = await getYoutubeInstance();
  }

  console.log('Uploading', params.title);

  const fileSize = (await fs.promises.stat(params.file)).size;
  const res = await youtube.videos.insert(
    {
      part: 'id,snippet,status',
      notifySubscribers: false,
      requestBody: {
        snippet: {
          title: params.title,
          description: params.description,
          tags: params.tags,
        },
        status: {
          privacyStatus: 'private',
        },
      },
      media: {
        body: fs.createReadStream(params.file),
      },
    },
    {
      onUploadProgress: (e) => {
        const progress = (e.bytesRead / fileSize) * 100;
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, null);
        process.stdout.write(`${Math.round(progress)}% complete`);
      },
    }
  );

  console.log(`\nFinished uploading\n`);
  return res.data;
}

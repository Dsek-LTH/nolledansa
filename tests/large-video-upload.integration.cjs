// Local-only test: node tests/large-video-upload.integration.cjs /fixtures/video.mp4 unchanged|convert [minimumGiB=2]
const assert = require('node:assert/strict');
const { createReadStream, statSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { request } = require('node:http');
const { execFileSync } = require('node:child_process');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const [path, expectation, minimumGiB = '2'] = process.argv.slice(2);
if (process.env.S3_ENDPOINT !== 'http://storage:9000' || !path || !['unchanged', 'convert'].includes(expectation)) {
  throw new Error('Use only in the local Compose environment with a fixture path and expectation.');
}
const base = 'http://127.0.0.1:3000';
const size = statSync(path).size;
assert.ok(size > Number(minimumGiB) * 1024 ** 3, 'Fixture must exceed the requested minimum GiB');
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
let key;
let bytesSent = 0;
const sourceHash = createHash('sha256');
const source = createReadStream(path);
const meter = new Transform({ transform(chunk, encoding, callback) {
  sourceHash.update(chunk);
  bytesSent += chunk.length;
  callback(null, chunk);
} });
source.on('error', error => meter.destroy(error));
const started = Date.now();
const progress = setInterval(() => console.log(`Processing ${path}: ${Math.round(bytesSent / size * 100)}% transferred, ${Math.round((Date.now() - started) / 1000)}s elapsed`), 20000);
(async () => {
  const upload = request(`${base}/api/upload/video`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(size) },
  });
  const reply = new Promise((resolve, reject) => {
    upload.on('error', reject);
    upload.on('response', async response => {
      try {
        let text = '';
        for await (const chunk of response) text += chunk.toString();
        resolve({ status: response.statusCode, result: JSON.parse(text) });
      } catch (error) { reject(error); }
    });
  });
  const [, { status, result }] = await Promise.all([pipeline(source, meter, upload), reply]);
  assert.equal(status, 200, JSON.stringify(result));
  assert.ok(result.url, JSON.stringify(result));
  key = result.key;
  assert.equal(bytesSent, size);
  const url = new URL(result.url, base).href;
  const range = await fetch(url, { headers: { Range: 'bytes=0-99' } });
  assert.equal(range.status, 206);
  const outputSize = Number(range.headers.get('content-range').split('/')[1]);
  assert.equal((await range.arrayBuffer()).byteLength, 100);
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', url], { timeout: 60000 }));
  assert.equal(info.streams.find(s => s.codec_type === 'video').codec_name, 'h264');
  assert.equal(info.streams.find(s => s.codec_type === 'audio').codec_name, 'aac');
  const probe = target => JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', target,
  ], { timeout: 60000 }));
  const before = probe(path);
  const after = probe(url);
  assert.ok(Math.abs(Number(before.format.duration) - Number(after.format.duration)) < 0.5, 'Video duration must be preserved');
  const beforeVideo = before.streams.find(s => s.codec_type === 'video');
  const afterVideo = after.streams.find(s => s.codec_type === 'video');
  assert.equal(afterVideo.width, beforeVideo.width);
  assert.equal(afterVideo.height, beforeVideo.height);
  if (expectation === 'unchanged') {
    assert.equal(outputSize, size);
    const outputHash = createHash('sha256');
    const download = await fetch(url);
    assert.equal(download.status, 200);
    for await (const chunk of download.body) outputHash.update(chunk);
    assert.equal(outputHash.digest('hex'), sourceHash.digest('hex'), 'Compatible file must stay byte-identical');
  }
  console.log(`PASS ${path}: ${size} input bytes, ${outputSize} output bytes, ${expectation}, range requests supported`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clearInterval(progress);
  source.destroy();
  meter.destroy();
  if (key) await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: key }));
});

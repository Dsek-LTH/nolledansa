// Run inside the local app container: node tests/video-upload.integration.cjs
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, appendFileSync, statSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const base = 'http://127.0.0.1:3000';
if (process.env.S3_ENDPOINT !== 'http://storage:9000') throw new Error('Run only in compose.local.yml.');
const directory = mkdtempSync(join(tmpdir(), 'video-integration-'));
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION, forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});
const keys = [];
const ffmpeg = args => execFileSync('ffmpeg', ['-v', 'error', '-nostdin', '-y', ...args], { timeout: 60000 });
const videoHash = path => ffmpeg(['-i', path, '-map', '0:v:0', '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-']).toString();

(async () => {
  const cases = [
    { name: 'compatible.mp4', video: 'libx264', audio: 'aac', unchanged: true, copyVideo: true },
    { name: 'hevc.mp4', video: 'libx265', audio: 'aac' },
    { name: 'container.mkv', video: 'libx264', audio: 'aac', copyVideo: true },
    { name: 'audio.mp4', video: 'libx264', audio: 'ac3', copyVideo: true },
  ];
  if (process.env.LARGE_VIDEO_TEST === '1') {
    cases.push({ name: 'hevc-160mb.mp4', video: 'libx265', audio: 'aac', megabytes: 160 });
  }
  for (const item of cases) {
    const input = join(directory, item.name);
    ffmpeg([
      '-f', 'lavfi', '-i', 'testsrc2=size=96x64:rate=10',
      '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '1',
      '-c:v', item.video, '-pix_fmt', 'yuv420p', '-threads', '1',
      ...(item.video === 'libx265' ? ['-x265-params', 'pools=1:frame-threads=1:log-level=error'] : []),
      '-c:a', item.audio, input,
    ]);
    if (item.megabytes) {
      // A valid MP4 free box exercises large uploads without lengthy fixture encoding.
      const padding = Buffer.alloc(item.megabytes * 1024 * 1024 - statSync(input).size);
      padding.writeUInt32BE(padding.length, 0);
      padding.write('free', 4);
      appendFileSync(input, padding);
    }
    const original = readFileSync(input);
    const form = new FormData();
    form.set('kind', 'video');
    form.set('file', new File([original], item.name, { type: 'video/mp4' }));
    const response = await fetch(`${base}/api/upload/object`, { method: 'POST', body: form });
    assert.equal(response.headers.get('x-accel-buffering'), 'no', 'Video processing must use a streaming response');
    const uploaded = await response.json();
    assert.equal(response.status, 200, JSON.stringify(uploaded));
    keys.push(uploaded.key);
    const download = await fetch(new URL(uploaded.url, base));
    assert.equal(download.status, 200);
    const bytes = Buffer.from(await download.arrayBuffer());
    const output = join(directory, `result-${item.name}.mp4`);
    writeFileSync(output, bytes);
    const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', output]));
    assert.equal(info.streams.find(s => s.codec_type === 'video').codec_name, 'h264');
    assert.equal(info.streams.find(s => s.codec_type === 'audio').codec_name, 'aac');
    ffmpeg(['-i', output, '-map', '0:v:0', '-f', 'null', '-']);
    if (item.unchanged) assert.deepEqual(bytes, original, 'Compatible file must remain byte-identical');
    if (item.copyVideo) assert.equal(videoHash(input), videoHash(output), 'Compatible video bitstream must be preserved');
    const range = await fetch(new URL(uploaded.url, base), { headers: { Range: 'bytes=0-99' } });
    assert.equal(range.status, 206);
    assert.equal((await range.arrayBuffer()).byteLength, 100);
    console.log(`PASS ${item.name}: upload, playback download, codecs, preservation and range requests`);
  }
  const invalid = new FormData();
  invalid.set('kind', 'video');
  invalid.set('file', new File(['invalid video'], 'invalid.mp4', { type: 'video/mp4' }));
  const response = await fetch(`${base}/api/upload/object`, { method: 'POST', body: invalid });
  const failed = await response.json();
  assert.equal(typeof failed.error, 'string', 'Processing failure must be valid JSON, not a dropped connection');
  assert.equal(failed.url, undefined);
  console.log('PASS invalid.mp4: processing error returned without breaking the connection');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const Key of keys) await client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key }));
  rmSync(directory, { recursive: true, force: true });
});

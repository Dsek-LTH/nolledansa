const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
// Load the pure TypeScript policy without requiring a Next.js runtime.
const compiled = ts.transpileModule(readFileSync('lib/video-compatibility.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
new Function('exports', compiled)(loaded.exports);
const { videoPlan } = loaded.exports;
const video = { index: 0, codec_type: 'video', codec_name: 'h264', pix_fmt: 'yuv420p' };
const audio = { index: 1, codec_type: 'audio', codec_name: 'aac', profile: 'LC' };
const info = (streams, format = { format_name: 'mov,mp4,m4a,3gp,3g2,mj2' }) => ({ streams, format });

test('compatible MP4 stays unchanged, also without audio', () => {
  assert.equal(videoPlan(info([video, audio])).unchanged, true);
  assert.equal(videoPlan(info([video])).unchanged, true);
  assert.equal(videoPlan(info([{ ...video, pix_fmt: 'yuvj420p' }, audio])).unchanged, true);
});
test('HEVC and 10-bit H.264 require video encoding, preserving AAC', () => {
  for (const stream of [{ ...video, codec_name: 'hevc' }, { ...video, pix_fmt: 'yuv420p10le' }]) {
    const plan = videoPlan(info([stream, audio]));
    assert.equal(plan.unchanged, false);
    assert.equal(plan.copyVideo, false);
    assert.equal(plan.copyAudio, true);
  }
});
test('incompatible audio preserves the video bitstream', () => {
  const plan = videoPlan(info([video, { ...audio, codec_name: 'ac3' }]));
  assert.equal(plan.copyVideo, true);
  assert.equal(plan.copyAudio, false);
  assert.equal(plan.unchanged, false);
});
test('MKV and QuickTime containers remux compatible streams', () => {
  for (const format of [{ format_name: 'matroska,webm' }, { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', tags: { major_brand: 'qt  ' } }]) {
    const plan = videoPlan(info([video, audio], format));
    assert.equal(plan.unchanged, false);
    assert.equal(plan.copyVideo && plan.copyAudio, true);
  }
});
test('cover art is skipped and audio-only files are rejected', () => {
  const cover = { ...video, index: 2, disposition: { attached_pic: 1 } };
  assert.equal(videoPlan(info([cover, video, audio])).video.index, 0);
  assert.throws(() => videoPlan(info([cover, audio])), /videospår/);
});

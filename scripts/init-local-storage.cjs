// Used only by compose.local.yml, never by the production start command.
const { S3Client, CreateBucketCommand } = require('@aws-sdk/client-s3');
const { setTimeout: delay } = require('node:timers/promises');
const client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});
(async () => {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: process.env.S3_BUCKET_NAME }));
      console.log('Local test bucket ready.');
      return;
    } catch (error) {
      if (['BucketAlreadyOwnedByYou', 'BucketAlreadyExists'].includes(error.name)) return;
      if (attempt === 30) throw error;
      await delay(2000);
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

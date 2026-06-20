const fs = require('fs');
async function run() {
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/birajsubedi/whisper-large-v2-nepali-financial', {
      method: 'POST',
      headers: { Authorization: 'Bearer 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' },
      body: Buffer.from([0,0,0,0])
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch(e) {
    console.error(e);
  }
}
run();

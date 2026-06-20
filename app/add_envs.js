const fs = require('fs');
const { execSync } = require('child_process');

const envs = {
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3aWFxcmN3Y2JkdmdyamFnb2lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzOTc3MjksImV4cCI6MjA5Njk3MzcyOX0.EuJLS6PPPgnmFUj0sklSamw7fuV4zRIhXJicKVyRuro",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3aWFxcmN3Y2JkdmdyamFnb2lrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTM5NzcyOSwiZXhwIjoyMDk2OTczNzI5fQ.gfDvk372PIMH_OmxsvU6EszWNm6EKNRrS5V6iMCn1tQ",
  JWT_SECRET: "vH9p4wA+nZ7mX8qR2vL5kY3cD6fJ1bT0aM4gN7xW9oE=",
  HF_TOKEN: "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",
  HF_MODEL_ID: "birajsubedi/whisper-large-v2-nepali-financial"
};

for (const [key, val] of Object.entries(envs)) {
  console.log(`Adding ${key}...`);

  execSync(`npx vercel env add ${key} production --value "${val}"`, { stdio: 'inherit' });
}
console.log("All envs added successfully!");

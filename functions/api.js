const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const openai = require("openai");
const formidable = require('formidable');
require('dotenv').config();

const app = express();
const router = express.Router()
const corsOptions = {
  credentials: true,
  origin: "*"

};
app.use(cors(corsOptions));
const openAI = new openai.OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
const upload = multer({ storage: storage })

router.get("/", (req, res) => {
  res.send("App is running..");
});

router.get('/api/upload', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ['http://localhost:3000','https://vidsum-ai.vercel.app']);

  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.json({ message: 'GET REQUEST SUCCESSFULL' })
})






router.post('/api/upload', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://vidsum-ai.vercel.app');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  const chunks = [];
  console.log(req.body)

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Error parsing the form:', err);
      return res.status(500).json({ message: 'Error parsing the form.' });
    }

    // Access the uploaded file (Blob)
    const audioFile = files.audio;
    console.log('Audio file: ', audioFile);
    console.log(audioFile[0].filepath);


    // The temporary path where the file is stored
    const oldPath = audioFile[0].filepath;
    console.log('Oldpath: ', oldPath);

    const dir = path.join('/tmp', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Define the new path where you want to save the file
    // const newPath = path.join('dist', 'uploads', audioFile[0].newFilename + '.mp3');
    const newPath = path.join(dir, audioFile[0].newFilename + '.mp3');
    console.log('Newpath: ', newPath);

    fs.copyFile(oldPath, newPath, (copyErr) => {
      if (copyErr) {
        console.error('Error saving file:', copyErr);
        return res.status(500).json({ message: 'Failed to save audio file.' });
      }

      fs.rm(oldPath, (rmErr) => {
        if (rmErr) {
          console.error('Error removing old file:', rmErr);
          return res.status(500).json({ message: 'Failed to clean up old file.' });
        }
        console.log('Audio Uploaded');
      });
    });
    try {
      console.log('TRANSCRIPTION Begins');
      console.log('Newpath: ', newPath);
      const transcription = await openAI.audio.transcriptions.create({
        // file: fs.createReadStream('./' + newPath),
        file: fs.createReadStream(newPath),
        model: "whisper-1",
      });
      const transcript = transcription.text;
      // const transcript = 'एक, दो, तीन, चार, पाथ, छे, साथ, आट, नौ, द';
      console.log(transcript);
      console.log('Summarizing');
      const systemPrompt =
        `
        You are an advanced language model. Your task is to process a video transcript, translate it if necessary, and then provide a summary. Please follow these precise instructions:

1. **Language Detection and Conversion**:
   - **Original Language**: Identify the language of the transcript. If it's not English, translate the entire transcript to English. Indicate the original language in the format: 'Original Language: [Detected language]'. If the transcript is already in English, state: 'Original Language: English'.
   - **Converted to**: Confirm the language of the final transcript after conversion in the format: 'Converted to: English'.

2. **Context Identification**:
   - **Context**: Briefly describe the main topic or situation of the video in 1-2 sentences. Use the format: 'Context: [Description of the context]'. Avoid mentioning the word "transcript."
   - **Accuracy**: Do not make assumptions about the content. If the transcript mentions specific words, use those exact terms in your context and summary. Do not infer details not explicitly mentioned.

3. **Detailed Summary**:
   - **Summary**: Provide a detailed summary of the video's content, elaborating on the key points discussed. Include specifics such as who is speaking, what is being discussed, and any notable events or decisions mentioned. Use the format: 'Summary: [Detailed summary of the video]'. Ensure that the summary is accurate and directly reflects the content of the transcript.

### Response Format:
Please ensure your response strictly follows this format:

**Original Language:** [Detected language]  
**Converted to:** [Language]  
**Context:** [Brief description of context]  
**Summary:** [Detailed summary]

- Keep each section clear and distinct.
- Avoid adding extra text or deviating from this structure.
- Focus on accuracy and detail without making assumptions.
        `

      const completion = await openAI.chat.completions.create({
        model: "gpt-3.5-turbo-0125",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: transcript
          }
        ]
      });
      console.log(completion);

      return res.status(200).json({ transcription: transcript, summary: completion.choices[0].message.content });

      // return res.status(200).json({ transcription : transcription.text });
    }
    catch (err) {
      console.log(err);

    }
  });





})

app.use('/.netlify/functions/api', router);
module.exports.handler = serverless(app);

// const port = process.env.PORT || 5000;
// app.listen(port, () => {
//   console.log("Server running on " + port);
//   console.log(process.env.OPENAI_API_KEY);

// })
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const openai = require("openai");
const formidable = require('formidable');
require('dotenv').config();

const app = express();
const corsOptions = {
  origin: 'http://localhost:3000', // Allow only this origin
  methods: 'GET,POST',             // Allow only specific methods
  allowedHeaders: ['Content-Type'],// Allow only specific headers
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
app.get('/api/upload', (req, res) => {
  res.json({ message: 'GET REQUEST SUCCESSFULL' })
})

app.post('/api/upload', async (req, res) => {
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

    // Define the new path where you want to save the file
    const newPath = path.join('public', 'uploads', audioFile[0].originalFilename);
    console.log('Newpath: ', newPath);

    // Move the file from the temporary location to the desired location
    // fs.rename(oldPath, newPath, (err) => {
    //   if (err) {
    //     console.error('Error saving file:', err);
    //     return res.status(500).json({ message: 'Failed to save audio file.' });
    //   }
    //   console.log('Audio Uploaded');

    // });
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
        return res.status(200).json({ message: 'Audio file uploaded successfully.' });
      });
    });
  });
  // const mainPath = './' + newPath;
  // console.log('Main path:' ,mainPath);

  try {
    console.log('TRANSCRIPTION Begins');
    const transcription = await openAI.audio.transcriptions.create({
      // file: fs.createReadStream('./' + newPath),
      file: fs.createReadStream('./public/uploads/output.mp3'),
      model: "whisper-1",
    });
    const transcript = transcription.text;
    // const transcript = 'एक, दो, तीन, चार, पाथ, छे, साथ, आट, नौ, द';
    console.log(transcript);
    console.log('Summarizing');
    const systemPrompt = 'If the text is in other language, then convert it to English. Also mention their in the format that Original Language: (detected language) the Converted to : English, the Context:(some context of the audio transcript), then Summary: (Summarize the transcript without changing its contexts) '
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

})



const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Server running on " + port);
  console.log(process.env.OPENAI_API_KEY);

})
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;

// Inisialisasi Google Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Konfigurasi upload file
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

// Middleware CORS manual
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

app.use(express.json());

// **BARU: Sajikan file statis dari folder 'public'**
app.use(express.static(path.join(__dirname, 'public')));


// Daftar MIME type yang diizinkan untuk dokumen
const allowedDocMimeTypes = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];

// Daftar MIME type yang diizinkan untuk audio
const allowedAudioMimeTypes = [
  'audio/mpeg', // MP3
  'audio/wav',  // WAV
  'audio/mp4',  // MP4 (audio)
  'audio/webm'  // WEBM
];

// Endpoint: Generate Text
app.post('/generate-text', async (req, res) => {
  const { prompt } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    res.json({ output: text });
  } catch (error) {
    console.error('Text generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Process Document
app.post('/generate-from-document', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  // Validasi tipe file dokumen
  if (!allowedDocMimeTypes.includes(mimeType)) {
    fs.unlinkSync(filePath);
    return res.status(400).json({ error: 'Unsupported file type. Only PDF, TXT, DOC, DOCX are allowed.' });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString('base64');

    const documentPart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    };

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Analyze this document and provide key insights:' },
          documentPart
        ]
      }]
    });
    
    const response = await result.response;
    const text = response.text();
    res.json({ output: text });
  } catch (error) {
    console.error('Document processing error:', error);
    
    // Handle Gemini API errors specifically
    if (error.message.includes('SAFETY')) {
      res.status(400).json({ error: 'Content blocked by safety filters' });
    } else if (error.message.includes('large')) {
      res.status(400).json({ error: 'File size exceeds 10MB limit' });
    } else {
      res.status(500).json({ error: 'Error processing document' });
    }
  } finally {
    // Pastikan file dihapus setelah diproses
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// Endpoint: Process Audio
app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const filePath = req.file.path;
  const mimeType = req.file.mimetype;

  // Validasi tipe file audio
  if (!allowedAudioMimeTypes.includes(mimeType)) {
    fs.unlinkSync(filePath);
    return res.status(400).json({ error: 'Unsupported audio format. Only MP3, WAV, MP4, WEBM are allowed.' });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const base64Audio = buffer.toString('base64');

    const audioPart = {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType
      }
    };

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: 'Transcribe or analyze the following audio:' },
          audioPart
        ]
      }]
    });

    const response = await result.response;
    const text = response.text();
    res.json({ output: text });
  } catch (error) {
    console.error('Audio processing error:', error);
    
    if (error.message.includes('SAFETY')) {
      res.status(400).json({ error: 'Content blocked by safety filters' });
    } else if (error.message.includes('large')) {
      res.status(400).json({ error: 'File size exceeds 10MB limit' });
    } else {
      res.status(500).json({ error: 'Error processing audio' });
    }
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});

// Endpoint: Chat Conversation
app.post('/chat', async (req, res) => {
  const { history, message } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const chat = model.startChat({
      history: history || [],
      generationConfig: { 
        maxOutputTokens: 1000,
        temperature: 0.9
      }
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();
    
    // Kirim kembali respons dan histori yang sudah diperbarui
    res.json({ 
      output: text,
      history: [ // Bangun histori baru di backend untuk dikirim kembali
        ...(history || []),
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text: text }] }
      ]
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`API Endpoints:
  - POST /generate-text
  - POST /generate-from-document
  - POST /generate-from-audio
  - POST /chat`);
  
  // Buat folder uploads jika belum ada
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
    console.log('Created uploads directory');
  }
});
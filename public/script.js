// Ambil semua elemen yang diperlukan dari DOM
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sendButton = document.getElementById('send-btn');
const attachmentBtn = document.getElementById('attachment-btn');
const fileInput = document.getElementById('file-input');
const filePreviewContainer = document.getElementById('file-preview-container');

// Variabel untuk menyimpan riwayat percakapan dan file yang dipilih
let conversationHistory = [];
let selectedFile = null;

// --- Event Listeners ---

// Klik tombol attachment untuk membuka dialog file
attachmentBtn.addEventListener('click', () => {
  fileInput.click();
});

// Saat file dipilih dari dialog
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    selectedFile = file;
    displayFilePreview(file);
  }
});

// Saat form disubmit (kirim pesan atau file)
form.addEventListener('submit', async function (e) {
  e.preventDefault();
  const userMessage = input.value.trim();

  // Cek apakah ada pesan atau file yang akan dikirim
  if (!userMessage && !selectedFile) return;

  // Tampilkan pesan pengguna di UI jika ada
  if (userMessage) {
    appendMessage('user', userMessage);
  }
  
  // Nonaktifkan form saat menunggu respons
  setLoading(true);

  try {
    let response;
    // Jika ada file yang dipilih
    if (selectedFile) {
      // Buat FormData untuk mengirim file
      const formData = new FormData();
      formData.append('prompt', userMessage);

      // Tentukan endpoint dan nama field berdasarkan tipe file
      const fileType = getFileType(selectedFile.type);
      formData.append(fileType.field, selectedFile);
      
      response = await fetch(fileType.endpoint, {
        method: 'POST',
        body: formData, // Kirim sebagai FormData, jangan set Content-Type
      });

    } else {
      // Jika hanya teks, kirim ke endpoint /chat
      response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: conversationHistory,
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Something went wrong');
    }

    const data = await response.json();
    const botMessage = data.output;
    
    appendMessage('bot', botMessage);
    
    // Perbarui riwayat hanya jika dari endpoint /chat
    if (data.history) {
      conversationHistory = data.history;
    }

  } catch (error) {
    console.error('Error:', error);
    appendMessage('bot', `Error: ${error.message}`);
  } finally {
    // Bersihkan input dan aktifkan kembali form
    input.value = '';
    clearFileSelection();
    setLoading(false);
  }
});


// --- Helper Functions ---

function getFileType(mimeType) {
  if (mimeType.startsWith('image/')) {
    return { endpoint: '/generate-from-image', field: 'image' };
  } else if (mimeType.startsWith('audio/')) {
    return { endpoint: '/generate-from-audio', field: 'audio' };
  } else {
    return { endpoint: '/generate-from-document', field: 'document' };
  }
}

function displayFilePreview(file) {
  filePreviewContainer.innerHTML = ''; // Kosongkan pratinjau sebelumnya
  filePreviewContainer.style.display = 'flex';

  let previewElement;
  if (file.type.startsWith('image/')) {
    previewElement = document.createElement('img');
    previewElement.src = URL.createObjectURL(file);
    previewElement.onload = () => URL.revokeObjectURL(previewElement.src); // Bebaskan memori
  } else {
    previewElement = document.createElement('i');
    previewElement.className = 'fa-solid fa-file'; // Ikon file generik
  }
  
  const fileInfo = document.createElement('span');
  fileInfo.className = 'file-info';
  fileInfo.textContent = file.name;
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'cancel-file-btn';
  cancelButton.innerHTML = '&times;';
  cancelButton.onclick = clearFileSelection;
  
  filePreviewContainer.appendChild(previewElement);
  filePreviewContainer.appendChild(fileInfo);
  filePreviewContainer.appendChild(cancelButton);
}

function clearFileSelection() {
  selectedFile = null;
  fileInput.value = ''; // Reset input file
  filePreviewContainer.style.display = 'none';
  filePreviewContainer.innerHTML = '';
}

function appendMessage(sender, text) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', sender);
  
  const textNode = document.createTextNode(text);
  msgDiv.appendChild(textNode);
  
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function setLoading(isLoading) {
  input.disabled = isLoading;
  sendButton.disabled = isLoading;
  attachmentBtn.disabled = isLoading;
}
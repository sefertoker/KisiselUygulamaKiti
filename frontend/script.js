//  LOCAL STORAGE KEYS
const STORAGE_KEYS = {
  THEME: 'app_theme',
  MUSIC_PLAYLIST: 'app_music_playlist'
};

// Kullanıcıyı başta kontrol et ve global olarak ata
let user = JSON.parse(localStorage.getItem('user'));
if (!user) {
    window.location.href = 'login.html';
}

//  SAAT & TARİH
function updateTimeAndDate() {
  const now = new Date();
  document.getElementById('time').textContent = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('date').textContent = now.toLocaleDateString('tr-TR');
}

setInterval(updateTimeAndDate, 1000);
updateTimeAndDate();

//  THEME TOGGLE
const body = document.body;
const themeToggle = document.querySelector('.theme-toggle');

function toggleTheme() {
  body.classList.toggle('dark-theme');
  localStorage.setItem(STORAGE_KEYS.THEME, body.classList.contains('dark-theme'));
}

themeToggle.addEventListener('click', toggleTheme);

// Load saved theme
if (localStorage.getItem(STORAGE_KEYS.THEME) === 'true') {
  body.classList.add('dark-theme');
}

// TODO: Kullanıcıya özel todo işlemleri
function fetchTodos() {
    if (!user) return;
    fetch(`http://localhost:8080/todo/list/${user.id}`)
        .then(res => res.json())
        .then(todos => {
            window.todos = todos;
            renderTodos();
        });
}

function addTodo() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (text) {
        if (!user) return;
        fetch('http://localhost:8080/todo/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ user_id: user.id, content: text })
        })
        .then(() => fetchTodos());
        input.value = '';
    }
}

function toggleTodo(id) {
    if (!user) return;
    fetch(`http://localhost:8080/todo/toggle/${user.id}/${id}`, { method: 'POST' })
        .then(() => fetchTodos());
}

function deleteTodo(id) {
    if (!user) return;
    fetch(`http://localhost:8080/todo/delete/${user.id}/${id}`, { method: 'DELETE' })
        .then(() => fetchTodos());
}

function renderTodos() {
    const todoList = document.getElementById('todo-list');
    todoList.innerHTML = '';
    (window.todos || []).forEach(todo => {
        const li = document.createElement('li');
        li.innerHTML = `
          <input type="checkbox" ${todo.completed ? 'checked' : ''}>
          <span class="${todo.completed ? 'completed' : ''}">${todo.content}</span>
          <button class="delete-btn" title="Sil">❌</button>
        `;
        const checkbox = li.querySelector('input');
        checkbox.addEventListener('change', () => toggleTodo(todo.id));
        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTodo(todo.id);
        });
        todoList.appendChild(li);
    });
}

document.getElementById('todo-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});

fetchTodos();

// HESAP MAKİNESİ & DÖNÜŞÜMLER
const calcDisplay = document.getElementById('calc-display');
const calcButtons = document.getElementById('calc-buttons');

// Update number conversions when calculator display changes
function updateConversions() {
  let value = calcDisplay.value;
  
  // Remove any non-numeric characters except the last operator
  value = value.replace(/[^0-9]*$/, '');
  value = parseInt(value);
  
  if (!isNaN(value)) {
    document.getElementById('binary').textContent = value.toString(2);
    document.getElementById('decimal').textContent = value;
    document.getElementById('octal').textContent = value.toString(8);
    document.getElementById('hex').textContent = value.toString(16).toUpperCase();
  } else {
    ['binary', 'decimal', 'octal', 'hex'].forEach(id => {
      document.getElementById(id).textContent = '';
    });
  }
}

const calcLayout = [
  '7','8','9','/',
  '4','5','6','*',
  '1','2','3','-',
  'C','0','+'
];

let lastWasOperator = false;

calcLayout.forEach(val => {
  const btn = document.createElement('button');
  btn.textContent = val;
  btn.onclick = () => {
    if (val === 'C') {
      calcDisplay.value = '';
      lastWasOperator = false;
    } else if (['+', '-', '*', '/'].includes(val)) {
      if (!lastWasOperator && calcDisplay.value !== '') {
        calcDisplay.value += val;
        lastWasOperator = true;
      }
    } else {
      if (calcDisplay.value === '0' && val !== '.') {
        calcDisplay.value = val;
      } else {
        calcDisplay.value += val;
      }
      lastWasOperator = false;
    }
    updateConversions();
  };
  calcButtons.appendChild(btn);
});

// Add equals button
const equalsBtn = document.createElement('button');
equalsBtn.textContent = '=';
equalsBtn.onclick = () => {
  if (calcDisplay.value) {
    try {
      // Remove trailing operators before evaluation
      let expression = calcDisplay.value.replace(/[+\-*/.]$/, '');
      calcDisplay.value = eval(expression);
      lastWasOperator = false;
      updateConversions();
    } catch {
      calcDisplay.value = 'HATA';
      setTimeout(() => {
        calcDisplay.value = '';
        updateConversions();
      }, 1000);
    }
  }
};
calcButtons.appendChild(equalsBtn);

// Initial conversion update
updateConversions();

// 🎵 MÜZİK YÜKLEME
let playlist = [];
const musicList = document.getElementById('music-list');
const musicUpload = document.getElementById('music-upload');

function handleFiles(files) {
  Array.from(files).forEach(file => {
    // Sadece ses dosyalarını kabul et
    if (file.type.startsWith('audio/')) {
      // Dosya boyutunu kontrol et (10MB'dan büyükse uyarı ver)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} dosyası çok büyük! Lütfen 10MB'dan küçük dosyalar yükleyin.`);
        return;
      }
      
      console.log(`Müzik dosyası seçildi: ${file.name}, ${file.type}, ${file.size} byte`);
      
      const reader = new FileReader();
      reader.onload = function(e) {
        console.log(`Müzik dosyası okundu: ${file.name}, veri uzunluğu: ${e.target.result.length}`);
        addMusicToPlaylist(file.name, e.target.result);
      };
      reader.onerror = function() {
        console.error(`Dosya okuma hatası: ${file.name}`);
        alert(`${file.name} dosyası okunamadı!`);
      };
      reader.readAsDataURL(file);
    } else {
      alert(`${file.name} bir ses dosyası değil! Sadece ses dosyaları yükleyebilirsiniz.`);
    }
  });
}

function addMusicToPlaylist(musicName, musicData) {
  if (!user) return;
  
  // Veri boyutunu kontrol et (yaklaşık 15MB sınırı)
  if (musicData.length > 15 * 1024 * 1024) {
    alert(`${musicName} dosyası çok büyük! Lütfen daha küçük bir dosya seçin.`);
    return;
  }
  
  console.log(`Müzik yükleniyor: ${musicName}, veri uzunluğu: ${(musicData.length / 1024 / 1024).toFixed(2)} MB`);
  
  // Yükleme sırasında bilgi göster
  musicList.innerHTML = '<div class="loading-message">Yükleniyor... Lütfen bekleyin</div>';
  
  // Timeout ekleyelim, uzun süren istekler için
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout
  
  fetch('http://localhost:8080/media/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      name: musicData,
      media_type: 'music',
      original_name: musicName // Orijinal dosya adını da gönder
    }),
    signal: controller.signal
  })
  .then(response => {
    clearTimeout(timeoutId);
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`Sunucu hatası: ${text}`);
      });
    }
    return response.text();
  })
  .then(data => {
    console.log('Müzik başarıyla yüklendi:', data);
    alert(`${musicName} başarıyla yüklendi!`);
    fetchMusic(); // Müzik listesini yenile
  })
  .catch(error => {
    clearTimeout(timeoutId);
    console.error('Müzik yükleme hatası:', error);
    
    let errorMessage = 'Bilinmeyen bir hata oluştu.';
    
    if (error.name === 'AbortError') {
      errorMessage = 'Yükleme zaman aşımına uğradı. Sunucu yanıt vermiyor veya dosya çok büyük.';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Sunucuya bağlanılamadı. Lütfen sunucunun çalıştığından emin olun.';
    } else {
      errorMessage = error.message;
    }
    
    alert(`Müzik yüklenirken bir hata oluştu: ${errorMessage}`);
    fetchMusic(); // Hata olsa bile listeyi yenile
  });
}

function fetchMusic() {
  if (!user) return;
  fetch(`http://localhost:8080/media/list/${user.id}/music`)
    .then(res => res.json())
    .then(musics => {
      playlist = musics;
      renderPlaylist();
    });
}

// Müzik silme fonksiyonu
function deleteMusic(musicId) {
  if (!user || !musicId) return;
  
  // Silme işlemi sırasında yükleniyor göster
  const loadingMessage = document.createElement('div');
  loadingMessage.classList.add('loading-message');
  loadingMessage.textContent = 'Müzik siliniyor...';
  musicList.innerHTML = '';
  musicList.appendChild(loadingMessage);
  
  fetch(`http://localhost:8080/media/delete/${user.id}/${musicId}`, {
    method: 'DELETE'
  })
  .then(response => {
    if (!response.ok) {
      return response.text().then(text => {
        throw new Error(`Silme hatası: ${text}`);
      });
    }
    return response.text();
  })
  .then(data => {
    console.log('Müzik başarıyla silindi:', data);
    
    // Eğer silinen müzik şu an çalıyorsa, çalmayı durdur
    if (currentMusic !== null && playlist[currentMusic] && playlist[currentMusic].id === musicId) {
      const audioPlayer = document.getElementById('audio');
      audioPlayer.pause();
      isPlaying = false;
      currentMusic = null;
    }
    
    // Müzik listesini yenile
    fetchMusic();
  })
  .catch(error => {
    console.error('Müzik silme hatası:', error);
    alert(`Müzik silinirken bir hata oluştu: ${error.message}`);
    fetchMusic(); // Hata olsa bile listeyi yenile
  });
}

// Aktif çalan müzik ve oynatıcı durumu
let currentMusic = null;
let isPlaying = false;

function renderPlaylist() {
  musicList.innerHTML = '';
  
  // Eğer liste boşsa bilgi mesajı göster
  if (playlist.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.classList.add('empty-playlist');
    emptyMessage.textContent = 'Müzik eklemek için tıklayın veya sürükleyin';
    
    const uploadButton = document.createElement('button');
    uploadButton.classList.add('upload-button');
    uploadButton.textContent = 'Dosya Seç';
    uploadButton.addEventListener('click', () => musicUpload.click());
    
    musicList.appendChild(emptyMessage);
    musicList.appendChild(uploadButton);
    return;
  }
  
  // Yeni müzik ekleme butonu oluştur
  const addMusicBtn = document.createElement('div');
  addMusicBtn.classList.add('add-music-btn');
  addMusicBtn.innerHTML = '<div class="add-icon">+</div><div>Yeni müzik ekle</div>';
  addMusicBtn.addEventListener('click', () => musicUpload.click());
  musicList.appendChild(addMusicBtn);
  
  // Müzik listesini oluştur
  playlist.forEach((music, index) => {
    const musicItem = document.createElement('div');
    musicItem.classList.add('music-item');
    musicItem.setAttribute('data-id', music.id);
    musicItem.setAttribute('data-index', index);
    musicItem.draggable = true; // Sürüklenebilir yap
    
    // Sürükle-bırak için tutamaç ikonu
    const dragHandle = document.createElement('div');
    dragHandle.classList.add('drag-handle');
    dragHandle.innerHTML = '&#8942;&#8942;'; // Dikey noktalar
    
    const musicName = document.createElement('span');
    // Orijinal dosya adını göster, yoksa UUID'yi göster
    let displayName = music.original_name || music.name;
    
    // Eğer orijinal dosya adı yoksa ve dosya adı bir URL değilse
    if (!music.original_name && !music.name.startsWith('data:')) {
      // Dosya yolundan sadece dosya adını al
      const parts = music.name.split('_');
      if (parts.length > 2) {
        // user_id_music_uuid.mp3 formatından sadece son kısmı al
        displayName = parts[parts.length - 1];
      }
    }
    
    // Uzun dosya adlarını kısalt
    displayName = displayName.length > 30 ? displayName.substring(0, 27) + '...' : displayName;
    musicName.textContent = displayName;
    musicName.title = music.original_name || music.name; // Tam adı tooltip olarak göster
    
    // Silme butonu
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('delete-music-btn');
    deleteBtn.innerHTML = '&#10005;'; // Çarpı işareti
    deleteBtn.title = 'Müziği sil';
    
    // Silme butonuna tıklama olayı ekle
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Tıklama olayının yukarı yayılmasını engelle
      if (confirm(`"${displayName}" müziğini silmek istediğinizden emin misiniz?`)) {
        deleteMusic(music.id);
      }
    });
    
    // Müzik öğesine tıklama olayı ekle
    musicItem.addEventListener('click', () => {
      playMusic(index);
    });
    
    // Gizli audio elementi (sadece URL'yi saklamak için)
    const audioSource = document.createElement('audio');
    if (music.name.startsWith('data:audio')) {
      audioSource.src = music.name;
    } else {
      audioSource.src = `http://localhost:8080/media/${music.name}`;
    }
    audioSource.style.display = 'none';
    
    // Öğeleri müzik öğesine ekle
    musicItem.appendChild(dragHandle);
    musicItem.appendChild(musicName);
    musicItem.appendChild(deleteBtn);
    musicItem.appendChild(audioSource);
    
    // Müzik öğesini listeye ekle
    musicList.appendChild(musicItem);
    
    // Sürükle-bırak olaylarını ekle
    setupDragAndDrop(musicItem);
  });
  
  // Eğer daha önce seçili bir müzik varsa, onu vurgula
  if (currentMusic !== null) {
    const musicItems = document.querySelectorAll('.music-item');
    if (currentMusic < musicItems.length) {
      musicItems[currentMusic].classList.add('active');
    } else {
      // Eğer seçili müzik artık listede yoksa, ilk müziği seç
      currentMusic = 0;
      updatePlayerControls();
    }
  } else if (playlist.length > 0) {
    // Hiç seçili müzik yoksa ve liste doluysa, ilk müziği seç ama oynatma
    currentMusic = 0;
    updatePlayerControls();
  }
}

// Müzik çalma fonksiyonu
function playMusic(index) {
  // Eğer geçerli bir indeks değilse, çık
  if (index < 0 || index >= playlist.length) return;
  
  // Daha önce seçili müziği kaldır
  const musicItems = document.querySelectorAll('.music-item');
  musicItems.forEach(item => item.classList.remove('active'));
  
  // Yeni müziği seç
  currentMusic = index;
  musicItems[index].classList.add('active');
  
  // Ana oynatıcıyı güncelle
  updatePlayerControls();
  
  // Otomatik oynat
  const audioPlayer = document.getElementById('audio');
  audioPlayer.play()
    .then(() => {
      isPlaying = true;
      document.getElementById('play-pause').classList.add('playing');
    })
    .catch(error => {
      console.error('Müzik oynatılamadı:', error);
      alert('Müzik oynatılamadı. Lütfen tekrar deneyin.');
    });
}

// Oynatıcı kontroller
function updatePlayerControls() {
  const audioPlayer = document.getElementById('audio');
  const musicName = document.getElementById('music-name');
  const playPauseBtn = document.getElementById('play-pause');
  
  if (currentMusic !== null && playlist.length > 0) {
    const music = playlist[currentMusic];
    
    // Müzik adını göster - öncelikle orijinal dosya adını kullan
    let displayName = music.original_name || music.name;
    
    // Eğer orijinal dosya adı yoksa ve dosya adı bir URL değilse
    if (!music.original_name && !music.name.startsWith('data:')) {
      const parts = music.name.split('_');
      if (parts.length > 2) {
        displayName = parts[parts.length - 1];
      }
    }
    musicName.textContent = displayName;
    
    // Audio kaynağını ayarla
    if (music.name.startsWith('data:audio')) {
      audioPlayer.src = music.name;
    } else {
      audioPlayer.src = `http://localhost:8080/media/${music.name}`;
    }
    
    // Oynatma durumunu güncelle
    if (isPlaying) {
      playPauseBtn.classList.add('playing');
    } else {
      playPauseBtn.classList.remove('playing');
    }
  } else {
    // Liste boşsa veya seçili müzik yoksa
    musicName.textContent = 'Müzik seçilmedi';
    audioPlayer.src = '';
    isPlaying = false;
    playPauseBtn.classList.remove('playing');
  }
}

// Sürükle-bırak için ayarlar
function setupDragAndDrop(musicItem) {
  musicItem.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', e.target.getAttribute('data-index'));
    musicItem.classList.add('dragging');
  });
  
  musicItem.addEventListener('dragend', () => {
    musicItem.classList.remove('dragging');
  });
  
  musicItem.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingItem = document.querySelector('.dragging');
    if (draggingItem && draggingItem !== musicItem) {
      const draggedIndex = parseInt(draggingItem.getAttribute('data-index'));
      const targetIndex = parseInt(musicItem.getAttribute('data-index'));
      
      if (draggedIndex !== targetIndex) {
        musicItem.classList.add('drag-over');
      }
    }
  });
  
  musicItem.addEventListener('dragleave', () => {
    musicItem.classList.remove('drag-over');
  });
  
  musicItem.addEventListener('drop', (e) => {
    e.preventDefault();
    musicItem.classList.remove('drag-over');
    
    const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const targetIndex = parseInt(musicItem.getAttribute('data-index'));
    
    if (draggedIndex !== targetIndex) {
      // Listedeki sıralamayı değiştir
      const temp = playlist[draggedIndex];
      playlist.splice(draggedIndex, 1);
      playlist.splice(targetIndex, 0, temp);
      
      // Aktif çalan müzik indeksini güncelle
      if (currentMusic === draggedIndex) {
        currentMusic = targetIndex;
      } else if (currentMusic > draggedIndex && currentMusic <= targetIndex) {
        currentMusic--;
      } else if (currentMusic < draggedIndex && currentMusic >= targetIndex) {
        currentMusic++;
      }
      
      // Listeyi yeniden oluştur
      renderPlaylist();
    }
  });
}

if (musicList) fetchMusic();

if (musicList && musicUpload) {
  // Müzik listesine tıklama olayı ekliyoruz
  musicList.addEventListener('click', (e) => {
    // Boş alana tıklandığında dosya seçiciyi aç
    if (e.target === musicList || e.target.classList.contains('empty-playlist')) {
      musicUpload.click();
    }
  });
  
  musicUpload.addEventListener('change', (e) => handleFiles(e.target.files));
  musicList.addEventListener('dragover', (e) => {
    e.preventDefault();
    musicList.classList.add('drag-over');
  });
  musicList.addEventListener('dragleave', () => musicList.classList.remove('drag-over'));
  musicList.addEventListener('drop', (e) => {
    e.preventDefault();
    musicList.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });
}

// Müzik çalma çubuğu kontrollerini ayarla
document.addEventListener('DOMContentLoaded', () => {
  const audioPlayer = document.getElementById('audio');
  const playPauseBtn = document.getElementById('play-pause');
  const prevBtn = document.getElementById('prev-track');
  const nextBtn = document.getElementById('next-track');
  const progressBar = document.querySelector('.progress-track');
  const currentTimeEl = document.getElementById('current-time');
  const totalTimeEl = document.getElementById('total-time');
  const volumeBtn = document.getElementById('volume-btn');
  const volumeSlider = document.getElementById('volume');
  
  // Oynat/Duraklat butonu
  playPauseBtn.addEventListener('click', () => {
    if (!audioPlayer.src) return; // Müzik yoksa çık
    
    if (isPlaying) {
      audioPlayer.pause();
      isPlaying = false;
      playPauseBtn.classList.remove('playing');
    } else {
      audioPlayer.play()
        .then(() => {
          isPlaying = true;
          playPauseBtn.classList.add('playing');
        })
        .catch(err => console.error('Oynatma hatası:', err));
    }
  });
  
  // Önceki müzik butonu
  prevBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    
    let newIndex = currentMusic - 1;
    if (newIndex < 0) newIndex = playlist.length - 1; // Listenin sonuna dön
    playMusic(newIndex);
  });
  
  // Sonraki müzik butonu
  nextBtn.addEventListener('click', () => {
    if (playlist.length === 0) return;
    
    let newIndex = currentMusic + 1;
    if (newIndex >= playlist.length) newIndex = 0; // Listenin başına dön
    playMusic(newIndex);
  });
  
  // Müzik bittiğinde sonraki müziğe geç
  audioPlayer.addEventListener('ended', () => {
    if (playlist.length === 0) return;
    
    let newIndex = currentMusic + 1;
    if (newIndex >= playlist.length) newIndex = 0; // Listenin başına dön
    playMusic(newIndex);
  });
  
  // İlerleme çubuğu güncelleme
  audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    
    // İlerleme yüzdesini hesapla
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    document.documentElement.style.setProperty('--progress', `${progress}%`);
    
    // Geçen süreyi güncelle
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    totalTimeEl.textContent = formatTime(audioPlayer.duration);
    
    // Progress input değerini güncelle
    const progressInput = document.getElementById('progress');
    progressInput.value = progress;
  });
  
  // İlerleme çubuğu ile müzik konumunu değiştirme
  const progressInput = document.getElementById('progress');
  progressInput.addEventListener('input', () => {
    if (!audioPlayer.duration) return;
    
    const seekTime = (progressInput.value / 100) * audioPlayer.duration;
    audioPlayer.currentTime = seekTime;
  });
  
  // Ses kontrolü
  volumeSlider.addEventListener('input', () => {
    const volume = volumeSlider.value;
    audioPlayer.volume = volume;
    
    // Ses seviyesine göre ikonu güncelle
    if (volume > 0.5) {
      volumeBtn.setAttribute('data-volume', 'high');
    } else if (volume > 0) {
      volumeBtn.setAttribute('data-volume', 'low');
    } else {
      volumeBtn.setAttribute('data-volume', 'muted');
    }
    
    // Ses çubuğu görsel güncelleme
    document.documentElement.style.setProperty('--volume', `${volume * 100}%`);
  });
  
  // Ses açma/kapatma butonu
  volumeBtn.addEventListener('click', () => {
    const currentVolume = audioPlayer.volume;
    
    if (currentVolume > 0) {
      // Sesi kapat
      audioPlayer.dataset.lastVolume = currentVolume;
      audioPlayer.volume = 0;
      volumeSlider.value = 0;
      volumeBtn.setAttribute('data-volume', 'muted');
    } else {
      // Sesi aç (son ses seviyesine veya varsayılan olarak 0.5)
      const lastVolume = parseFloat(audioPlayer.dataset.lastVolume) || 0.5;
      audioPlayer.volume = lastVolume;
      volumeSlider.value = lastVolume;
      volumeBtn.setAttribute('data-volume', lastVolume > 0.5 ? 'high' : 'low');
    }
    
    // Ses çubuğu görsel güncelleme
    document.documentElement.style.setProperty('--volume', `${audioPlayer.volume * 100}%`);
  });
});

// Saniye formatını MM:SS şeklinde biçimlendir
function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

// 🖼️ RESİM YÜKLEME
let gallery = [];
const galleryGrid = document.getElementById('gallery-grid');

function handleImages(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      addImageToGallery(file.name, e.target.result);
    };
    reader.readAsDataURL(file);
  });
}

function addImageToGallery(imageName, imageData) {
  if (!user) return;
  fetch('http://localhost:8080/media/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: user.id,
      name: imageData,
      media_type: 'image'
    })
  }).then(() => fetchGallery());
}

function fetchGallery() {
  if (!user) return;
  fetch(`http://localhost:8080/media/list/${user.id}/image`)
    .then(res => res.json())
    .then(images => {
      gallery = images;
      renderGallery();
    });
}

// Resim silme fonksiyonu
function deleteImage(imageId) {
  if (!user || !imageId) return;
  
  fetch(`http://localhost:8080/media/delete/${user.id}/${imageId}`, {
    method: 'DELETE'
  })
  .then(response => {
    if (response.ok) {
      // Başarılı silme işlemi sonrası galeriyi yenile
      fetchGallery();
    } else {
      console.error('Resim silinirken bir hata oluştu');
      alert('Resim silinirken bir hata oluştu. Lütfen tekrar deneyin.');
    }
  })
  .catch(error => {
    console.error('Silme işlemi hatası:', error);
    alert('Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.');
  });
}

function renderGallery() {
  galleryGrid.innerHTML = '';
  
  // Eğer galeri boşsa bilgi mesajı göster
  if (gallery.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.classList.add('empty-gallery');
    emptyMessage.textContent = 'Resim eklemek için tıklayın veya sürükleyin';
    
    const uploadButton = document.createElement('button');
    uploadButton.classList.add('upload-button');
    uploadButton.textContent = 'Dosya Seç';
    uploadButton.addEventListener('click', () => imageUpload.click());
    
    galleryGrid.appendChild(emptyMessage);
    galleryGrid.appendChild(uploadButton);
    return;
  }
  
  // Boş alan oluştur - resim yükleme için kullanılacak
  const emptySpace = document.createElement('div');
  emptySpace.classList.add('empty-upload-area');
  emptySpace.innerHTML = '<div class="upload-icon">+</div><div>Yeni resim ekle</div>';
  emptySpace.addEventListener('click', () => imageUpload.click());
  galleryGrid.appendChild(emptySpace);
  
  gallery.forEach(image => {
    // Her resim için bir kapsayıcı div oluştur
    const imageContainer = document.createElement('div');
    imageContainer.classList.add('image-container');
    
    const img = document.createElement('img');
    // Eğer veri base64 ile başlıyorsa doğrudan kullan, değilse sunucudan bir URL ise ona göre göster
    if (image.name.startsWith('data:image')) {
      img.src = image.name;
    } else {
      img.src = `http://localhost:8080/media/${image.name}`;
    }
    img.classList.add('gallery-image');
    img.alt = 'Galeri Resmi';
    img.setAttribute('data-id', image.id || '');
    
    // Silme butonu oluştur
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('image-delete-btn');
    deleteBtn.innerHTML = '❌';
    deleteBtn.title = 'Resmi Sil';
    
    // Silme butonuna tıklandığında resmi sil
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Modal açılmasını engelle
      if (confirm('Bu resmi silmek istediğinize emin misiniz?')) {
        deleteImage(image.id);
      }
    });
    
    // Resme tıklandığında modal açılsın
    imageContainer.addEventListener('click', () => {
      openImageModal(img.src);
    });
    
    imageContainer.appendChild(img);
    imageContainer.appendChild(deleteBtn);
    galleryGrid.appendChild(imageContainer);
  });
}

// Resim modalını açma fonksiyonu
function openImageModal(imageSrc) {
  const modal = document.querySelector('.gallery-modal');
  const modalImg = document.getElementById('modal-image');
  
  modalImg.src = imageSrc;
  modal.classList.add('active');
  
  // ESC tuşu ile kapatma
  document.addEventListener('keydown', closeModalOnEsc);
}

// ESC tuşu ile modal kapatma
function closeModalOnEsc(e) {
  if (e.key === 'Escape') {
    closeImageModal();
  }
}

// Resim modalını kapatma fonksiyonu
function closeImageModal() {
  const modal = document.querySelector('.gallery-modal');
  modal.classList.remove('active');
  document.removeEventListener('keydown', closeModalOnEsc);
}

const imageUpload = document.getElementById('image-upload');

if (galleryGrid && imageUpload) {
  // Galeri grid'e tıklama olayı ekliyoruz
  galleryGrid.addEventListener('click', (e) => {
    // Boş alana tıklandığında dosya seçiciyi aç
    if (e.target === galleryGrid || e.target.classList.contains('empty-gallery')) {
      imageUpload.click();
    }
  });
  
  imageUpload.addEventListener('change', (e) => handleImages(e.target.files));
  galleryGrid.addEventListener('dragover', (e) => {
    e.preventDefault();
    galleryGrid.classList.add('drag-over');
  });
  galleryGrid.addEventListener('dragleave', () => galleryGrid.classList.remove('drag-over'));
  galleryGrid.addEventListener('drop', (e) => {
    e.preventDefault();
    galleryGrid.classList.remove('drag-over');
    handleImages(e.dataTransfer.files);
  });
}

if (galleryGrid) fetchGallery();

// Çıkış yap butonu işlevselliği
document.querySelector('.logout-btn').addEventListener('click', function() {
    localStorage.removeItem('user');
    window.location.href = 'login.html';
});

const weatherInput = document.getElementById('weatherInput');
weatherInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const key = 'acdba0ef3c4e9c0aa739df160072f169';
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${weatherInput.value}&appid=${key}&units=metric&lang=tr`)
    .then(res => res.json())
    .then(data => {
      const html = `
        <p>${data.name}, ${data.sys.country}</p>
        <p>${Math.round(data.main.temp)}°C - ${data.weather[0].description}</p>
        <p>Min/Max: ${data.main.temp_min}° / ${data.main.temp_max}°</p>
      `;
      document.getElementById('weatherDisplay').innerHTML = html;
    });
  }
});
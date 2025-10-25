/* script.js
   - YouTube Data API integration (replace keys below)
   - Animated particle background
   - Modal player using YouTube IFrame API
   - Load more / Playlist
*/

const API_KEY = 'YOUR_YOUTUBE_API_KEY';   // <-- replace
const CHANNEL_ID = 'YOUR_CHANNEL_ID';     // <-- replace
const PLAYLIST_ID = 'YOUR_PLAYLIST_ID';   // <-- replace
const MAX_RESULTS = 6; // per fetch

// ========= Particle background (neon dots + lines) =========
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
function resizeCanvas(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initParticles() {
  particles = [];
  const count = Math.round((canvas.width * canvas.height) / 70000);
  for (let i=0;i<count;i++){
    particles.push({
      x: Math.random()*canvas.width,
      y: Math.random()*canvas.height,
      vx: (Math.random()-0.5)*0.25,
      vy: (Math.random()-0.5)*0.25,
      r: 0.6 + Math.random()*1.8,
      hue: 200 + Math.random()*120
    });
  }
}
initParticles();

function drawParticles(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // gradient glow overlay
  for (let p of particles){
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < -10) p.x = canvas.width + 10;
    if (p.x > canvas.width + 10) p.x = -10;
    if (p.y < -10) p.y = canvas.height + 10;
    if (p.y > canvas.height + 10) p.y = -10;

    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 40);
    grd.addColorStop(0, `hsla(${p.hue},100%,70%,0.22)`);
    grd.addColorStop(0.4, `hsla(${p.hue},90%,55%,0.09)`);
    grd.addColorStop(1, `transparent`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r*6, 0, Math.PI*2);
    ctx.fill();
  }

  // lines connect
  for (let i=0;i<particles.length;i++){
    for (let j=i+1;j<particles.length;j++){
      const a = particles[i], b = particles[j];
      const dx = a.x-b.x, dy = a.y-b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 140){
        ctx.beginPath();
        ctx.strokeStyle = `rgba(34,140,255, ${0.01 + (0.12*(1 - dist/140))})`;
        ctx.lineWidth = 1;
        ctx.moveTo(a.x,a.y);
        ctx.lineTo(b.x,b.y);
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(drawParticles);
}
drawParticles();
window.addEventListener('orientationchange', initParticles);

// ========= YouTube Data API: load channel videos =========
let nextPageToken = '';
const videoGrid = document.getElementById('video-grid');
const loadMoreBtn = document.getElementById('load-more');
loadMoreBtn.addEventListener('click', ()=>loadVideos(true));

async function loadVideos(more=false){
  try {
    let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${CHANNEL_ID}&maxResults=${MAX_RESULTS}&order=date&type=video&key=${API_KEY}`;
    if (more && nextPageToken) url += `&pageToken=${nextPageToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) {
      console.error('YouTube API error', data.error);
      videoGrid.innerHTML = `<p style="grid-column:1/-1;color:#f7d1d1;">Could not load videos. Check API key and channel ID in script.js</p>`;
      return;
    }

    nextPageToken = data.nextPageToken || '';
    for (const item of data.items){
      const vid = item.id.videoId;
      const title = item.snippet.title;
      const thumb = item.snippet.thumbnails.medium.url;
      const published = new Date(item.snippet.publishedAt).toLocaleDateString();

      const card = document.createElement('article');
      card.className = 'card';
      card.innerHTML = `
        <div class="meta">
          <img class="thumb" src="${thumb}" alt="${escapeHTML(title)} thumbnail">
          <div style="flex:1;margin-left:12px;">
            <h3>${escapeHTML(title)}</h3>
            <p>${published}</p>
            <div class="waveform" aria-hidden="true">
              <div class="bar" style="height:${randBar()}px"></div>
              <div class="bar" style="height:${randBar()}px"></div>
              <div class="bar" style="height:${randBar()}px"></div>
              <div class="bar" style="height:${randBar()}px"></div>
              <div class="bar" style="height:${randBar()}px"></div>
            </div>
          </div>
        </div>
        <div class="play-btn" data-video="${vid}" title="Play ${escapeHTML(title)}">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      `;
      videoGrid.appendChild(card);

      // click handler to open modal + play
      card.querySelector('.play-btn').addEventListener('click', (e)=>{
        const videoId = e.currentTarget.getAttribute('data-video');
        openPlayerModal(videoId, item.snippet.title);
      });

      // on hover animate bars (increase amplitude)
      card.addEventListener('mouseenter', ()=>{
        card.querySelectorAll('.bar').forEach((b)=> {
          b.style.animationDuration = (0.7 + Math.random()*0.5) + 's';
        });
      });
      card.addEventListener('mouseleave', ()=>{
        card.querySelectorAll('.bar').forEach((b)=> {
          b.style.animationDuration = '1s';
        });
      });
    }

    // hide load more if no token
    loadMoreBtn.style.display = nextPageToken ? 'inline-block' : 'none';
  } catch(err){
    console.error('Load videos error', err);
    videoGrid.innerHTML = `<p style="grid-column:1/-1;color:#f7d1d1;">Network error while loading videos.</p>`;
  }
}

// helper
function randBar(){ return 6 + Math.round(Math.random()*28); }
function escapeHTML(str){ return str.replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s])); }

// ========= Playlist loader (small) =========
const playlistContainer = document.getElementById('playlist-container');
async function loadPlaylist(){
  if (!PLAYLIST_ID || PLAYLIST_ID === 'YOUR_PLAYLIST_ID') return;
  try {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${PLAYLIST_ID}&maxResults=4&key=${API_KEY}`;
    const res = await fetch(url);
    const d = await res.json();
    if (d.items){
      for (const it of d.items){
        const vid = it.snippet.resourceId.videoId;
        const title = it.snippet.title;
        const thumb = it.snippet.thumbnails.medium.url;
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
          <div class="meta">
            <img class="thumb" src="${thumb}" alt="${escapeHTML(title)}">
            <div style="flex:1;margin-left:12px;">
              <h3>${escapeHTML(title)}</h3>
              <p>Playlist pick</p>
            </div>
          </div>
          <div class="play-btn" data-video="${vid}">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        `;
        playlistContainer.appendChild(el);
        el.querySelector('.play-btn').addEventListener('click', ()=> openPlayerModal(vid, title));
      }
    }
  } catch(err){ console.warn('playlist load failed', err); }
}

// ========= Modal & YouTube IFrame API player =========
const modal = document.getElementById('player-modal');
const closeBtn = document.getElementById('close-player');
const toggleMuteBtn = document.getElementById('toggle-mute');
const openYT = document.getElementById('open-youtube');
let player, currentVideoId = '';
closeBtn.addEventListener('click', closePlayerModal);
modal.addEventListener('click', (e)=>{ if (e.target === modal) closePlayerModal(); });

function openPlayerModal(videoId, title='') {
  currentVideoId = videoId;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  // create player if not yet
  if (typeof YT === 'undefined' || !YT.Player) {
    // fallback: embed iframe directly until YT API ready
    document.getElementById('player').innerHTML = `<iframe width="100%" height="450" src="https://www.youtube.com/embed/${videoId}?rel=0&autoplay=1&mute=1" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    toggleMuteBtn.innerText = 'Unmute';
    openYT.onclick = ()=> window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    return;
  }

  if (!player) {
    player = new YT.Player('player', {
      height: '450',
      width: '100%',
      videoId: videoId,
      playerVars: { rel:0, modestbranding:1, autoplay:1 },
      events:{
        onReady: (e)=> { e.target.playVideo(); e.target.mute(); toggleMuteBtn.innerText='Unmute'; },
      }
    });
  } else {
    player.loadVideoById(videoId);
    // attempt autoplay + mute to allow autoplay on browsers
    try { player.playVideo(); player.mute(); toggleMuteBtn.innerText='Unmute'; } catch(e){ console.warn(e); }
  }

  openYT.onclick = ()=> window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
}

function closePlayerModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  if (player && player.stopVideo) try { player.stopVideo(); } catch(e){}
  document.getElementById('player').innerHTML = ''; // clear so iframe API will recreate on next open
  player = null;
}

// YouTube API ready callback (global)
function onYouTubeIframeAPIReady(){
  // nothing here — player will be created when user opens modal
}

// toggle mute
toggleMuteBtn.addEventListener('click', ()=>{
  if (!player) return;
  const muted = player.isMuted();
  if (muted) { player.unMute(); toggleMuteBtn.innerText = 'Mute'; }
  else { player.mute(); toggleMuteBtn.innerText = 'Unmute'; }
});

// ========= Request form handling & demo visualizer =========
const reqForm = document.getElementById('request-form');
const reqStatus = document.getElementById('request-status');
reqForm.addEventListener('submit', (ev)=>{
  ev.preventDefault();
  reqStatus.innerText = 'Request received — thank you! ✨';
  reqForm.reset();
  setTimeout(()=> reqStatus.innerText = '', 4500);
});

// demo visualizer: pulse the waveform bars site-wide briefly
document.getElementById('demo-visual').addEventListener('click', ()=>{
  document.querySelectorAll('.waveform .bar').forEach((b,i)=>{
    b.style.animation = `pulse 0.45s ${i*0.04}s ease-in-out 2`;
    setTimeout(()=> b.style.animation = '', 900);
  });
});

// ========= Init =========
document.addEventListener('DOMContentLoaded', ()=>{
  loadVideos(false);
  loadPlaylist();
});

// Small accessibility helper: focus trap for modal (light)
document.addEventListener('keydown', (e)=>{
  if (e.key === 'Escape' && modal.classList.contains('open')) closePlayerModal();
});
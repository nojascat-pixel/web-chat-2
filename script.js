(() => {
  const canvas = document.getElementById("c"), ctx = canvas.getContext("2d");
  const video = document.getElementById("video");
  const vCanvas = document.getElementById("v-canvas"), vCtx = vCanvas.getContext("2d");
  const hint = document.getElementById("status-hint");

  // 過去の葉っぱを保存する専用キャンバス
  const bgCanvas = document.createElement("canvas");
  const bgCtx = bgCanvas.getContext("2d");

  const treeImg = new Image();
  treeImg.src = "assets/m_material.png"; 

  const leafImages = [];
  for(let i=1; i<=16; i++) {
    const img = new Image();
    img.src = `assets/leaf/leaf${String(i).padStart(2, '0')}.png`;
    leafImages.push(img);
  }
  for(let i=1; i<=20; i++) {
    const img = new Image();
    img.src = `assets/leaf/leaf2-${i}.png`;
    leafImages.push(img);
  }

  const AUDIO_PATH = "assets/1714.mp4";
  let audioUnlocked = false;
  let chimeAudio = null; // 再利用するAudioオブジェクト

  function resize(){
    const dpr = window.devicePixelRatio || 1;
    canvas.width = bgCanvas.width = window.innerWidth * dpr;
    canvas.height = bgCanvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.scale(dpr, dpr);
    bgCtx.scale(dpr, dpr);
    // 背景を初期化
    bgCtx.fillStyle = "#162130";
    bgCtx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", resize);
  resize();

  window.addEventListener("pointerdown", async () => {
    if (!audioUnlocked) {
      // 再利用するAudioオブジェクトを作成
      chimeAudio = new Audio(AUDIO_PATH);
      chimeAudio.volume = 1.0;
      
      // audio.play()を必ず一度成功させてロックを解除
      try {
        await chimeAudio.play();
        // すぐに一時停止（ロック解除が目的）
        chimeAudio.pause();
        chimeAudio.currentTime = 0; // 先頭に戻す
        audioUnlocked = true;
        hint.innerHTML = "見守り中...";
      } catch (e) {
        console.warn("Audio unlock failed:", e);
        // エラーでもunlockedにしておく（次回の再生を試みる）
        audioUnlocked = true;
      }
    }
  });

  let activeLeaves = []; // 今出現中の葉っぱ

  function handlePresence() {
    if (audioUnlocked && chimeAudio) {
      // 既に解除済みのAudioオブジェクトを再利用して再生
      chimeAudio.currentTime = 0; // 先頭に戻す
      chimeAudio.play().catch((e) => {
        console.warn("Audio play failed:", e);
      });
    }
    sproutLeaf();
  }

  function sproutLeaf(){
    const ready = leafImages.filter(img => img.complete);
    if(ready.length === 0) return;
    const img = ready[Math.floor(Math.random() * ready.length)];
    const treeScale = (window.innerHeight * 0.6) / (treeImg.height || 1000);
    const tw = treeImg.width * treeScale, th = treeImg.height * treeScale;

    activeLeaves.push({
      img, x: (window.innerWidth / 2) + (Math.random() - 0.5) * (tw * 1.2),
      y: (window.innerHeight - 50) - (th * (0.55 + Math.random() * 0.45)), // 枝のあたり
      w: 35, h: 35, rot: Math.random() * Math.PI * 2, op: 0
    });
  }

  function draw(){
    // 1. 蓄積された背景を描画（ここは葉っぱだけの層）
    ctx.drawImage(bgCanvas, 0, 0, window.innerWidth, window.innerHeight);

    // 2. 木を描画（背景の葉っぱの上に描く）
    if(treeImg.complete) {
      const treeScale = (window.innerHeight * 0.6) / treeImg.height;
      const tw = treeImg.width * treeScale, th = treeImg.height * treeScale;
      ctx.drawImage(treeImg, window.innerWidth/2 - tw/2, window.innerHeight - th - 10, tw, th);
    }

    // 3. 出現中の葉を「木より手前」に描画
    activeLeaves = activeLeaves.filter(l => {
      l.op += 0.02;
      ctx.globalAlpha = l.op;
      ctx.save(); ctx.translate(l.x, l.y); ctx.rotate(l.rot);
      ctx.drawImage(l.img, -l.w/2, -l.h/2, l.w, l.h); ctx.restore();

      // 出現完了したら背景キャンバスに描き写す（スタンプ）
      if (l.op >= 1) {
        bgCtx.globalAlpha = 0.8;
        bgCtx.save(); bgCtx.translate(l.x, l.y); bgCtx.rotate(l.rot);
        bgCtx.drawImage(l.img, -l.w/2, -l.h/2, l.w, l.h); bgCtx.restore();
        return false;
      }
      return true;
    });
    
    ctx.globalAlpha = 1.0;
    requestAnimationFrame(draw);
  }

  let prevFrame = null, lastTrigger = 0;
  async function initCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 160, height: 120 } });
      video.srcObject = s;
      vCanvas.width = 40; vCanvas.height = 30;
      // カメラチェックを0.2秒に1回にして負荷を逃がす
      setInterval(check, 200);
    } catch(e) { hint.innerHTML = "カメラエラー"; }
  }

  function check() {
    if (!video.videoWidth || !audioUnlocked) return;
    const now = Date.now();
    if (now - lastTrigger < 1000) return; // 1秒に1枚制限

    vCtx.drawImage(video, 0, 0, vCanvas.width, vCanvas.height);
    const curr = vCtx.getImageData(0, 0, vCanvas.width, vCanvas.height);
    if (prevFrame) {
      let diff = 0;
      for (let i = 0; i < curr.data.length; i += 64) {
        if (Math.abs(curr.data[i] - prevFrame.data[i]) > 50) diff++;
      }
      if (diff > 3) { handlePresence(); lastTrigger = now; }
    }
    prevFrame = curr;
  }

  initCamera(); draw();
})();
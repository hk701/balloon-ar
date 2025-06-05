// ✅ 使用 r128 版本
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

let scene, camera, renderer, balloons = [];
let video, videoTexture;
let analyser, audioData;
let isStarted = false;

init();
animate();

function init() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 添加开始按钮
  const startButton = document.createElement('button');
  startButton.textContent = '点击开始 AR 体验';
  startButton.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 15px 30px;
    font-size: 18px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    z-index: 1000;
  `;
  document.body.appendChild(startButton);
  
  startButton.onclick = () => {
    startCamera();
    startButton.remove();
  };

  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(3, 3, 5);
  scene.add(light);

  // 窗口大小变化处理
  window.addEventListener('resize', onWindowResize);
}

function startCamera() {
  navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: "environment" }, 
    audio: true 
  })
    .then(stream => {
      video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("muted", "");
      video.muted = true;
      video.srcObject = stream;

      video.onloadeddata = () => {
        videoTexture = new THREE.VideoTexture(video);
        scene.background = videoTexture;
      };

      video.play();

      // 音频处理
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const mic = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      mic.connect(analyser);
      audioData = new Uint8Array(analyser.frequencyBinCount);
      
      isStarted = true;
    })
    .catch(err => {
      console.error("摄像头/麦克风访问失败:", err);
      // 备选方案：使用天空背景
      scene.background = new THREE.Color(0x87CEEB);
      isStarted = true;
    });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function addBalloon() {
  const maxAttempts = 10;
  let x, z;
  let positionAccepted = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    x = (Math.random() - 0.5) * 4;
    z = (Math.random() - 0.5) * 2;

    const tooClose = balloons.some(b => {
      const dx = b.position.x - x;
      const dz = b.position.z - z;
      return dx * dx + dz * dz < 0.3 * 0.3;
    });

    if (!tooClose) {
      positionAccepted = true;
      break;
    }
  }

  if (!positionAccepted) return;

  // 直接创建简单的气球几何体
  createSimpleBalloon(x, z);
}

function createSimpleBalloon(x, z) {
  // 创建简单的气球几何体作为备选
  const balloonGroup = new THREE.Group();
  
  // 气球主体
  const balloonGeometry = new THREE.SphereGeometry(0.3, 16, 16);
  const balloonMaterial = new THREE.MeshLambertMaterial({ 
    color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6) 
  });
  const balloonMesh = new THREE.Mesh(balloonGeometry, balloonMaterial);
  balloonGroup.add(balloonMesh);
  
  // 气球线
  const stringGeometry = new THREE.CylinderGeometry(0.005, 0.005, 0.5, 4);
  const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const stringMesh = new THREE.Mesh(stringGeometry, stringMaterial);
  stringMesh.position.y = -0.4;
  balloonGroup.add(stringMesh);
  
  balloonGroup.position.set(x, -2.5, z);
  balloonGroup.userData.speed = 0.01 + Math.random() * 0.01;
  scene.add(balloonGroup);
  balloons.push(balloonGroup);
}

function animate() {
  requestAnimationFrame(animate);

  if (isStarted && analyser) {
    analyser.getByteFrequencyData(audioData);
    const volume = audioData.reduce((a, b) => a + b, 0) / audioData.length;
    if (volume > 60 && balloons.length < 20) { // 限制气球数量
      addBalloon();
    }
  }

  for (let i = balloons.length - 1; i >= 0; i--) {
    const b = balloons[i];
    b.position.y += b.userData.speed;
    b.position.x += Math.sin(performance.now() * 0.001 + b.position.y) * 0.001;

    if (b.position.y > 5) {
      scene.remove(b);
      balloons.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}
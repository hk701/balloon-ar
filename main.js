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
  startButton.textContent = '点击开始 AR 体验 📱';
  startButton.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 20px 40px;
    font-size: 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    z-index: 1000;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  `;
  document.body.appendChild(startButton);
  
  startButton.onclick = () => {
    startCamera();
    startButton.remove();
  };

  const light = new THREE.DirectionalLight(0xffffff, 0.6); // 降低光强度从 1.2 到 0.6
  light.position.set(3, 3, 5);
  scene.add(light);
  
  // 添加环境光来减弱阴影
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // 增加环境光
  scene.add(ambientLight);

  // 窗口大小变化处理
  window.addEventListener('resize', onWindowResize);
}

function startCamera() {
  // 更强制的后置摄像头设置
  const constraints = {
    video: { 
      facingMode: { exact: "environment" }, // 强制要求后置摄像头
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }, 
    audio: true 
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      handleStream(stream);
    })
    .catch(err => {
      console.log("强制后置摄像头失败，尝试普通模式");
      // 如果强制后置失败，降级到普通模式
      return navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: true 
      });
    })
    .then(stream => {
      handleStream(stream);
    })
    .catch(err => {
      console.error("摄像头/麦克风访问失败:", err);
      // 备选方案：使用天空背景
      scene.background = new THREE.Color(0x87CEEB);
      isStarted = true;
    });
}

function handleStream(stream) {
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
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function addBalloon() {
  const maxAttempts = 20;
  let x, z, scale;
  let positionAccepted = false;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 更大的分布范围
    x = (Math.random() - 0.5) * 8;
    z = -1 - Math.random() * 4; // 气球出现在更远的位置 (-1 到 -5)
    scale = 0.3 + Math.random() * 0.7; // 随机大小 (0.3 到 1.0)

    // 基于气球大小调整最小距离
    const minDistance = scale * 0.8;
    const tooClose = balloons.some(b => {
      const dx = b.position.x - x;
      const dz = b.position.z - z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const requiredDistance = minDistance + b.userData.scale * 0.8;
      return distance < requiredDistance;
    });

    if (!tooClose) {
      positionAccepted = true;
      break;
    }
  }

  if (!positionAccepted) return;

  // 创建气球，传入缩放参数
  createSimpleBalloon(x, z, scale);
}

function createSimpleBalloon(x, z, scale) {
  // 创建简单的气球几何体作为备选
  const balloonGroup = new THREE.Group();
  
  // 气球主体 - 根据scale调整大小
  const balloonRadius = 0.25 * scale;
  const balloonGeometry = new THREE.SphereGeometry(balloonRadius, 16, 16);
  const balloonMaterial = new THREE.MeshLambertMaterial({ 
    color: 0xff0000  // 红色
  });
  const balloonMesh = new THREE.Mesh(balloonGeometry, balloonMaterial);
  balloonGroup.add(balloonMesh);
  
  // 气球线 - 根据scale调整粗细和长度
  const stringThickness = 0.003 * scale;
  const stringLength = 0.4 * scale;
  const stringGeometry = new THREE.CylinderGeometry(stringThickness, stringThickness, stringLength, 4);
  const stringMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const stringMesh = new THREE.Mesh(stringGeometry, stringMaterial);
  stringMesh.position.y = -balloonRadius - stringLength / 2;
  balloonGroup.add(stringMesh);
  
  // 设置位置和用户数据
  balloonGroup.position.set(x, -3, z);
  balloonGroup.scale.set(scale, scale, scale);
  balloonGroup.userData.speed = 0.005 + Math.random() * 0.01;
  balloonGroup.userData.scale = scale; // 保存缩放信息用于碰撞检测
  balloonGroup.userData.swayOffset = Math.random() * Math.PI * 2; // 随机摇摆偏移
  
  scene.add(balloonGroup);
  balloons.push(balloonGroup);
}

function animate() {
  requestAnimationFrame(animate);

  if (isStarted && analyser) {
    analyser.getByteFrequencyData(audioData);
    const volume = audioData.reduce((a, b) => a + b, 0) / audioData.length;
    console.log('音量:', volume); // 调试音量检测
    if (volume > 40 && balloons.length < 15) { // 降低触发阈值，限制气球数量
      console.log('创建新气球'); // 调试气球创建
      addBalloon();
    }
  }

  for (let i = balloons.length - 1; i >= 0; i--) {
    const b = balloons[i];
    
    // 上升运动
    b.position.y += b.userData.speed;
    
    // 更自然的左右摇摆，基于气球的位置和时间
    const time = performance.now() * 0.001;
    const swayAmount = 0.002 * b.userData.scale; // 大气球摇摆更明显
    b.position.x += Math.sin(time * 0.8 + b.userData.swayOffset + b.position.y * 0.5) * swayAmount;
    
    // 轻微的前后摇摆
    b.position.z += Math.cos(time * 0.6 + b.userData.swayOffset) * swayAmount * 0.5;

    // 移除超出屏幕的气球
    if (b.position.y > 6) {
      scene.remove(b);
      balloons.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

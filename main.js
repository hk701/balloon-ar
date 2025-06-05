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
  console.log('开始启动摄像头...');
  console.log('用户代理:', navigator.userAgent);
  console.log('是否支持getUserMedia:', !!navigator.mediaDevices?.getUserMedia);
  
  // iPhone Safari 特殊处理
  const isiPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
  console.log('是否为iPhone:', isiPhone);
  
  // 简化的约束，iPhone Safari 更兼容
  const constraints = {
    video: { 
      facingMode: "environment",
      width: { ideal: 640, max: 1280 },
      height: { ideal: 480, max: 720 }
    }, 
    audio: true 
  };

  console.log('使用约束:', constraints);

  navigator.mediaDevices.getUserMedia(constraints)
    .then(stream => {
      console.log('强制后置摄像头成功');
      handleStream(stream);
    })
    .catch(err => {
      console.log("强制后置摄像头失败，尝试普通模式", err);
      // 如果强制后置失败，降级到普通模式
      return navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: true 
      });
    })
    .then(stream => {
      if (stream) {
        console.log('普通模式摄像头成功');
        handleStream(stream);
      }
    })
    .catch(err => {
      console.log("普通模式也失败，尝试前置摄像头", err);
      // iPhone 有时前置摄像头更稳定
      return navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }, 
        audio: true 
      });
    })
    .then(stream => {
      if (stream) {
        console.log('前置摄像头成功');
        handleStream(stream);
      }
    })
    .catch(err => {
      console.log("前置摄像头也失败，尝试最基本模式", err);
      // 最简单的约束
      return navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
    })
    .then(stream => {
      if (stream) {
        console.log('任意摄像头成功');
        handleStream(stream);
      }
    })
    .then(stream => {
      handleStream(stream);
    })
    .catch(err => {
      console.error("所有摄像头模式都失败:", err);
      showError("摄像头访问失败，点击屏幕可以创建气球");
      // 备选方案：使用纯黑色背景
      scene.background = new THREE.Color(0x000000);
      // 即使没有摄像头也可以点击创建气球
      addClickListener();
      isStarted = true;
    });
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.textContent = message;
  errorDiv.style.cssText = `
    position: absolute;
    top: 80px;
    left: 20px;
    right: 20px;
    background: rgba(255, 0, 0, 0.8);
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 1000;
    font-size: 16px;
    text-align: center;
  `;
  document.body.appendChild(errorDiv);
  
  // 5秒后移除错误信息
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

function handleStream(stream) {
  console.log('处理摄像头流...');
  console.log('流轨道:', stream.getTracks().map(track => ({
    kind: track.kind,
    label: track.label,
    enabled: track.enabled,
    readyState: track.readyState
  })));
  
  video = document.createElement("video");
  video.setAttribute("playsinline", ""); // iPhone 必需
  video.setAttribute("autoplay", "");
  video.setAttribute("muted", "");
  video.setAttribute("webkit-playsinline", ""); // 老版本 iPhone
  video.muted = true;
  video.playsInline = true; // 确保内联播放
  video.srcObject = stream;

  // 更详细的视频事件监听
  video.onloadstart = () => console.log('视频开始加载');
  video.onloadedmetadata = () => {
    console.log('视频元数据加载完成');
    console.log('视频尺寸:', video.videoWidth, 'x', video.videoHeight);
  };
  video.onloadeddata = () => {
    console.log('视频数据加载完成');
    console.log('创建视频纹理...');
    try {
      videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBFormat;
      scene.background = videoTexture;
      console.log('视频纹理设置成功');
      showSuccess("摄像头成功启动！");
    } catch (textureError) {
      console.error('视频纹理创建失败:', textureError);
      scene.background = new THREE.Color(0x000000);
      showError("视频纹理失败，使用黑色背景");
    }
  };
  video.oncanplay = () => console.log('视频可以播放');
  video.onplay = () => console.log('视频开始播放');
  video.onplaying = () => console.log('视频正在播放');

  video.onerror = (e) => {
    console.error('视频播放错误:', e);
    console.error('错误详情:', video.error);
    showError("视频播放失败: " + (video.error?.message || '未知错误'));
  };

  // 强制播放
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      console.log('视频播放成功');
    }).catch(e => {
      console.error('视频播放promise失败:', e);
      showError("视频播放失败: " + e.message);
    });
  }

  // 音频处理
  try {
    console.log('开始设置音频...');
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // iPhone需要用户交互后才能启动音频上下文
    if (audioContext.state === 'suspended') {
      console.log('音频上下文被暂停，尝试恢复...');
      audioContext.resume().then(() => {
        console.log('音频上下文恢复成功');
      });
    }
    
    const mic = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    mic.connect(analyser);
    audioData = new Uint8Array(analyser.frequencyBinCount);
    console.log('音频设置完成');
    
    showSuccess("摄像头和音频启动成功！对着麦克风说话释放气球");
  } catch (audioError) {
    console.error('音频设置失败:', audioError);
    showError("音频功能不可用，点击屏幕也可以创建气球");
    // 添加点击创建气球的功能
    addClickListener();
  }
  
  isStarted = true;
}

function addClickListener() {
  // 点击屏幕创建气球的备用功能
  er.domElement.addEventListener('click', () => {
    if (balloons.length < 15) {
      console.log('点击创建气球');
      addBalloon();
    }
  });
  
  renderer.domElement.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 防止双重触发
    if (balloons.length < 15) {
      console.log('触摸创建气球');
      addBalloon();
    }
  });
}


function showSuccess(message) {
  const successDiv = document.createElement('div');
  successDiv.textContent = message;
  successDiv.style.cssText = `
    position: absolute;
    top: 80px;
    left: 20px;
    right: 20px;
    background: rgba(0, 255, 0, 0.8);
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 1000;
    font-size: 16px;
    text-align: center;
  `;
  document.body.appendChild(successDiv);
  
  // 3秒后移除成功信息
  setTimeout(() => {
    if (successDiv.parentNode) {
      successDiv.parentNode.removeChild(successDiv);
    }
  }, 3000);
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
